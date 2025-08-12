/**
 * ProxyEngine - Vollständige Backend-Proxy Implementation
 */

const { createProxyMiddleware } = require('http-proxy-middleware');
const logger = require('./logger');
const sessionCache = require('./sessionCache');
const { URL } = require('url');

class ProxyEngine {
    constructor() {
        this.proxies = new Map();
        this.sessions = new Map();
    }
    
    /**
     * Erstellt einen HTTP/HTTPS Proxy-Handler
     */
    createServiceProxy(serviceConfig) {
        const proxyKey = `${serviceConfig.id}-${serviceConfig.type}`;
        
        // Prüfe ob bereits ein Proxy existiert
        if (this.proxies.has(proxyKey)) {
            return this.proxies.get(proxyKey);
        }
        
        // Parse Target-URL
        let targetUrl;
        try {
            targetUrl = new URL(serviceConfig.url);
        } catch (error) {
            logger.error('Invalid service URL:', serviceConfig.url, error);
            // Fallback zu Stub-Response
            return this.createStubProxy(serviceConfig);
        }
        
        // Proxy-Optionen
        const proxyOptions = {
            target: targetUrl.origin,
            changeOrigin: true,
            secure: false, // Erlaubt selbst-signierte Zertifikate
            ws: true, // WebSocket Support
            
            // Path-Rewriting
            pathRewrite: (path, req) => {
                // Entferne /api/appliances/:id/proxy prefix
                const prefix = `/api/appliances/${serviceConfig.id}/proxy`;
                const newPath = path.replace(prefix, '') || '/';
                logger.debug(`Path rewrite: ${path} -> ${newPath}`);
                return newPath;
            },            
            // Header-Manipulation
            onProxyReq: (proxyReq, req, res) => {
                // Füge Authentifizierung hinzu wenn konfiguriert
                if (serviceConfig.username && serviceConfig.password) {
                    const auth = Buffer.from(`${serviceConfig.username}:${serviceConfig.password}`).toString('base64');
                    proxyReq.setHeader('Authorization', `Basic ${auth}`);
                }
                
                // Entferne X-Frame-Options für iframe-Unterstützung
                proxyReq.removeHeader('x-frame-options');
                
                // Custom Headers
                proxyReq.setHeader('X-Proxied-By', 'ApplianceDashboard');
                proxyReq.setHeader('X-Original-Host', req.get('host'));
                
                // Session-Cookie weiterleiten
                const sessionId = this.getOrCreateSession(req.user.id, serviceConfig.id);
                proxyReq.setHeader('X-Dashboard-Session', sessionId.id);
                
                logger.info(`Proxying request: ${req.method} ${targetUrl.origin}${req.path}`);
            },
            
            onProxyRes: (proxyRes, req, res) => {
                // CORS Headers für externe Zugriffe
                proxyRes.headers['access-control-allow-origin'] = '*';
                proxyRes.headers['access-control-allow-credentials'] = 'true';
                
                // Entferne X-Frame-Options
                delete proxyRes.headers['x-frame-options'];
                delete proxyRes.headers['x-content-type-options'];
                
                // Cookie-Handling
                if (proxyRes.headers['set-cookie']) {
                    // Modifiziere Cookies für Proxy-Pfad
                    proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(cookie => {
                        return cookie.replace(/path=\//, `path=/api/appliances/${serviceConfig.id}/proxy/`);
                    });
                }
                
                logger.debug(`Proxy response: ${proxyRes.statusCode} from ${targetUrl.origin}`);
            },            
            onError: (err, req, res) => {
                logger.error('Proxy error:', err);
                
                // Detaillierte Fehlermeldung
                const errorResponse = {
                    error: 'Proxy Error',
                    message: err.message,
                    service: serviceConfig.name,
                    target: targetUrl.origin,
                    code: err.code,
                    timestamp: new Date().toISOString()
                };
                
                // Sende Fehler als JSON
                if (!res.headersSent) {
                    res.status(502).json(errorResponse);
                }
            },
            
            // Timeout-Einstellungen
            timeout: 30000, // 30 Sekunden
            proxyTimeout: 30000
        };
        
        // Erstelle Proxy-Middleware
        const proxy = createProxyMiddleware(proxyOptions);
        
        // Cache für Wiederverwendung
        this.proxies.set(proxyKey, proxy);
        
        return proxy;
    }
    
    /**
     * Erstellt einen Stub-Proxy für Entwicklung/Testing
     */
    createStubProxy(serviceConfig) {
        return async (req, res) => {
            try {
                const targetUrl = new URL(serviceConfig.url);
                const proxyPath = req.originalUrl.replace(`/api/appliances/${serviceConfig.id}/proxy`, '');
                
                logger.info(`[STUB] Proxy request to: ${targetUrl.origin}${proxyPath}`);
                
                res.status(200).json({
                    message: 'Proxy stub response',
                    service: serviceConfig.name,
                    targetUrl: targetUrl.origin + proxyPath,
                    headers: req.headers,
                    method: req.method,                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                logger.error('[STUB] Proxy error:', error);
                res.status(500).json({ error: 'Stub proxy error', message: error.message });
            }
        };
    }
    
    /**
     * WebSocket Proxy für Terminal/SSH
     */
    createWebSocketProxy(serviceConfig) {
        return async (ws, req) => {
            try {
                logger.info(`WebSocket proxy for service ${serviceConfig.id}`);
                
                // SSH-Verbindung aus SessionCache
                const connection = await sessionCache.getSSHConnection(serviceConfig.id, {
                    hostname: serviceConfig.hostname || serviceConfig.targetHost,
                    port: serviceConfig.port || 22,
                    username: serviceConfig.username,
                    password: serviceConfig.password,
                    privateKey: serviceConfig.privateKey,
                    passphrase: serviceConfig.passphrase
                });
                
                // Terminal-Stream erstellen
                const stream = await connection.requestShell({
                    term: 'xterm-256color',
                    cols: 80,
                    rows: 24,
                    modes: {}
                });
                
                // Bidirektionale Kommunikation
                ws.on('message', (data) => {
                    try {
                        stream.write(data);
                    } catch (err) {
                        logger.error('Error writing to stream:', err);
                    }
                });
                
                stream.on('data', (data) => {
                    if (ws.readyState === ws.OPEN) {
                        ws.send(data.toString('utf8'));
                    }
                });
                
                stream.on('close', () => {
                    ws.close();
                });
                
                ws.on('close', () => {
                    stream.close();
                });
                
            } catch (error) {
                logger.error('WebSocket proxy error:', error);
                ws.close(1011, 'Connection failed');
            }
        };
    }
    
    /**
     * Session Management
     */
    getOrCreateSession(userId, serviceId) {
        const sessionKey = `${userId}-${serviceId}`;
        
        if (!this.sessions.has(sessionKey)) {
            this.sessions.set(sessionKey, {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                userId,
                serviceId,
                created: new Date(),
                lastAccess: new Date()
            });
        }
        
        const session = this.sessions.get(sessionKey);
        session.lastAccess = new Date();
        
        return session;
    }
    
    /**
     * Cleanup alte Sessions
     */
    cleanupSessions() {
        const MAX_AGE = 24 * 60 * 60 * 1000; // 24 Stunden
        const now = Date.now();
        
        for (const [key, session] of this.sessions.entries()) {
            if (now - session.lastAccess.getTime() > MAX_AGE) {
                this.sessions.delete(key);
            }
        }
    }
}

module.exports = new ProxyEngine();