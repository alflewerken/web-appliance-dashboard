const axios = require('axios');
const https = require('https');
const { URL } = require('url');
const cheerio = require('cheerio');
const WebSocket = require('ws');
const logger = require('../logger');

class ProxyEngine {
  constructor() {
    // Axios instance mit selbst-signierten Zertifikaten
    this.httpClient = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false // Für interne selbst-signierte Zertifikate
      }),
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: () => true // Alle Status-Codes akzeptieren
    });

    // Cache für URL-Rewrites
    this.rewriteCache = new Map();
  }

  /**
   * Proxy HTTP/HTTPS Request
   * @param {string} targetUrl - Ziel-URL
   * @param {object} req - Express Request
   * @param {object} res - Express Response
   * @param {object} options - Zusätzliche Optionen
   */
  async proxyRequest(targetUrl, req, res, options = {}) {
    try {
      logger.debug(`Proxying request to: ${targetUrl}`);

      // Headers vorbereiten
      const headers = this.prepareHeaders(req.headers, targetUrl);
      
      // Request-Konfiguration
      const config = {
        method: req.method,
        url: targetUrl,
        headers,
        data: req.body,
        responseType: 'stream',
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      };

      // Query-Parameter hinzufügen
      if (req.query && Object.keys(req.query).length > 0) {
        config.params = req.query;
      }

      // Request durchführen
      const response = await this.httpClient(config);

      // Response-Headers setzen
      this.setResponseHeaders(res, response.headers, options);

      // Content-Type prüfen für Rewriting
      const contentType = response.headers['content-type'] || '';
      const shouldRewrite = this.shouldRewriteContent(contentType);

      if (shouldRewrite && !options.skipRewrite) {
        // HTML/CSS/JS Content rewriten
        await this.rewriteAndSend(response, res, targetUrl, options);
      } else {
        // Direkt streamen
        res.status(response.status);
        response.data.pipe(res);
      }

    } catch (error) {
      logger.error('Proxy error:', error);
      this.handleProxyError(error, res);
    }
  }

  /**
   * WebSocket Proxy
   * @param {string} targetUrl - WebSocket Ziel-URL
   * @param {object} ws - Client WebSocket
   * @param {object} req - Express Request
   */
  proxyWebSocket(targetUrl, ws, req) {
    try {
      logger.debug(`Proxying WebSocket to: ${targetUrl}`);

      // WebSocket URL konvertieren
      const wsUrl = targetUrl.replace(/^http/, 'ws');
      
      // Headers vorbereiten
      const headers = this.prepareWebSocketHeaders(req.headers);

      // Target WebSocket erstellen
      const targetWs = new WebSocket(wsUrl, {
        headers,
        rejectUnauthorized: false
      });

      // Bidirektionale Verbindung
      targetWs.on('open', () => {
        logger.debug('Target WebSocket opened');
        
        // Client -> Target
        ws.on('message', (data) => {
          if (targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(data);
          }
        });

        // Target -> Client
        targetWs.on('message', (data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          }
        });
      });

      // Error handling
      targetWs.on('error', (error) => {
        logger.error('Target WebSocket error:', error);
        ws.close(1011, 'Target WebSocket error');
      });

      ws.on('error', (error) => {
        logger.error('Client WebSocket error:', error);
        targetWs.close();
      });

      // Cleanup
      ws.on('close', () => {
        targetWs.close();
      });

      targetWs.on('close', () => {
        ws.close();
      });

    } catch (error) {
      logger.error('WebSocket proxy error:', error);
      ws.close(1011, 'Proxy error');
    }
  }
  /**
   * Content Rewriting für HTML/CSS/JS
   */
  async rewriteAndSend(response, res, baseUrl, options) {
    try {
      const chunks = [];
      
      response.data.on('data', chunk => chunks.push(chunk));
      response.data.on('end', async () => {
        let content = Buffer.concat(chunks).toString('utf8');
        const contentType = response.headers['content-type'] || '';

        if (contentType.includes('text/html')) {
          content = await this.rewriteHtml(content, baseUrl, options);
        } else if (contentType.includes('text/css')) {
          content = this.rewriteCss(content, baseUrl, options);
        } else if (contentType.includes('javascript')) {
          content = this.rewriteJavaScript(content, baseUrl, options);
        }

        res.status(response.status);
        res.send(content);
      });
    } catch (error) {
      logger.error('Content rewrite error:', error);
      res.status(500).send('Content rewrite error');
    }
  }

  /**
   * HTML Content Rewriting
   */
  async rewriteHtml(html, baseUrl, options) {
    try {
      const $ = cheerio.load(html, { decodeEntities: false });
      const base = new URL(baseUrl);
      const proxyPath = options.proxyPath || '/api/services/proxy';

      // Base Tag hinzufügen/aktualisieren
      if ($('base').length === 0) {
        $('head').prepend(`<base href="${proxyPath}/${base.href}">`);
      }

      // Links rewriten
      $('a[href]').each((i, elem) => {
        const href = $(elem).attr('href');
        const rewritten = this.rewriteUrl(href, baseUrl, proxyPath);
        if (rewritten !== href) {
          $(elem).attr('href', rewritten);
        }
      });

      // Forms
      $('form[action]').each((i, elem) => {
        const action = $(elem).attr('action');
        const rewritten = this.rewriteUrl(action, baseUrl, proxyPath);
        if (rewritten !== action) {
          $(elem).attr('action', rewritten);
        }
      });

      // Scripts
      $('script[src]').each((i, elem) => {
        const src = $(elem).attr('src');
        const rewritten = this.rewriteUrl(src, baseUrl, proxyPath);
        if (rewritten !== src) {
          $(elem).attr('src', rewritten);
        }
      });

      // Stylesheets
      $('link[rel="stylesheet"][href]').each((i, elem) => {
        const href = $(elem).attr('href');
        const rewritten = this.rewriteUrl(href, baseUrl, proxyPath);
        if (rewritten !== href) {
          $(elem).attr('href', rewritten);
        }
      });

      // Images
      $('img[src]').each((i, elem) => {
        const src = $(elem).attr('src');
        const rewritten = this.rewriteUrl(src, baseUrl, proxyPath);
        if (rewritten !== src) {
          $(elem).attr('src', rewritten);
        }
      });

      // Inline JavaScript rewriting
      $('script:not([src])').each((i, elem) => {
        const script = $(elem).html();
        if (script) {
          const rewritten = this.rewriteJavaScript(script, baseUrl, options);
          $(elem).html(rewritten);
        }
      });

      return $.html();
    } catch (error) {
      logger.error('HTML rewrite error:', error);
      return html; // Fallback zum Original
    }
  }

  /**
   * CSS Content Rewriting
   */
  rewriteCss(css, baseUrl, options) {
    try {
      const proxyPath = options.proxyPath || '/api/services/proxy';
      
      // URLs in CSS rewriten
      return css.replace(/url\(['"]?([^'")]+)['"]?\)/g, (match, url) => {
        const rewritten = this.rewriteUrl(url, baseUrl, proxyPath);
        return `url('${rewritten}')`;
      });
    } catch (error) {
      logger.error('CSS rewrite error:', error);
      return css;
    }
  }