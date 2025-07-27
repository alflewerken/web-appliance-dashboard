const axios = require('axios');
const https = require('https');
const { URL } = require('url');
const WebSocket = require('ws');
const dns = require('dns').promises;
const { logger } = require('./logger');

class NetworkProxyEngine {
    constructor() {
        // HTTP client with relaxed SSL
        this.httpClient = axios.create({
            timeout: 30000,
            maxRedirects: 5,
            validateStatus: () => true,
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            })
        });

        // Cache for DNS resolutions
        this.dnsCache = new Map();
        
        // Active WebSocket connections
        this.wsConnections = new Map();
    }

    /**
     * Main proxy method - acts as internal network client
     */
    async proxyRequest(internalUrl, options = {}) {
        const {
            method = 'GET',
            headers = {},
            data = null,
            responseType = 'stream'
        } = options;

        try {
            // Prepare headers - remove hop-by-hop headers
            const proxyHeaders = this.cleanHeaders(headers);
            
            // Parse and validate internal URL
            const targetUrl = await this.resolveInternalUrl(internalUrl);
            
            logger.info('Proxying request:', {
                method,
                targetUrl,
                originalUrl: internalUrl
            });

            // Make request as if from internal network
            const response = await this.httpClient({
                method,
                url: targetUrl,
                headers: {
                    ...proxyHeaders,
                    'X-Forwarded-For': headers['x-real-ip'] || headers['x-forwarded-for'],
                    'X-Proxied-By': 'web-appliance-dashboard'
                },
                data,
                responseType,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            return {
                status: response.status,
                statusText: response.statusText,
                headers: this.cleanResponseHeaders(response.headers),
                data: response.data
            };

        } catch (error) {
            logger.error('Proxy request failed:', {
                url: internalUrl,
                error: error.message,
                code: error.code
            });
            
            // Return error response
            if (error.code === 'ENOTFOUND') {
                throw new Error('Internal host not found');
            } else if (error.code === 'ECONNREFUSED') {
                throw new Error('Connection refused by internal service');
            } else if (error.code === 'ETIMEDOUT') {
                throw new Error('Connection timeout to internal service');
            }
            
            throw error;
        }
    }
    /**
     * Resolve internal hostname to IP if needed
     */
    async resolveInternalUrl(url) {
        try {
            const urlObj = new URL(url);
            
            // Check if hostname is already an IP
            if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(urlObj.hostname)) {
                return url;
            }
            
            // Check DNS cache
            const cacheKey = urlObj.hostname;
            if (this.dnsCache.has(cacheKey)) {
                const cachedIp = this.dnsCache.get(cacheKey);
                urlObj.hostname = cachedIp;
                return urlObj.toString();
            }
            
            // Resolve hostname
            try {
                const addresses = await dns.resolve4(urlObj.hostname);
                if (addresses.length > 0) {
                    const ip = addresses[0];
                    this.dnsCache.set(cacheKey, ip);
                    
                    // Clean cache if too large
                    if (this.dnsCache.size > 1000) {
                        const firstKey = this.dnsCache.keys().next().value;
                        this.dnsCache.delete(firstKey);
                    }
                    
                    urlObj.hostname = ip;
                    return urlObj.toString();
                }
            } catch (dnsError) {
                // If DNS fails, try as-is (might be internal hostname)
                logger.warn('DNS resolution failed, using hostname as-is:', {
                    hostname: urlObj.hostname,
                    error: dnsError.message
                });
            }
            
            return url;
        } catch (error) {
            logger.error('URL resolution error:', error);
            return url;
        }
    }

    /**
     * Clean request headers
     */
    cleanHeaders(headers) {
        const cleaned = { ...headers };
        
        // Remove hop-by-hop headers
        const hopByHopHeaders = [
            'connection', 'keep-alive', 'proxy-authenticate',
            'proxy-authorization', 'te', 'trailer', 'transfer-encoding',
            'upgrade', 'host'
        ];
        
        hopByHopHeaders.forEach(header => {
            delete cleaned[header.toLowerCase()];
        });
        
        return cleaned;
    }

    /**
     * Clean response headers
     */
    cleanResponseHeaders(headers) {
        const cleaned = { ...headers };
        
        // Remove hop-by-hop and security headers
        delete cleaned['connection'];
        delete cleaned['transfer-encoding'];
        delete cleaned['content-encoding']; // We handle decompression
        delete cleaned['x-frame-options']; // Allow embedding
        delete cleaned['content-security-policy']; // Avoid CSP issues
        
        return cleaned;
    }

    /**
     * Create WebSocket proxy for any internal WebSocket
     */
    createWebSocketProxy(internalWsUrl, clientWs) {
        const connectionId = Date.now() + Math.random();
        
        logger.info('Creating WebSocket proxy:', {
            target: internalWsUrl,
            connectionId
        });

        // Create connection to internal WebSocket
        const internalWs = new WebSocket(internalWsUrl, {
            rejectUnauthorized: false
        });

        // Store connection
        this.wsConnections.set(connectionId, {
            client: clientWs,
            internal: internalWs,
            created: Date.now()
        });

        // Error handling
        internalWs.on('error', (error) => {
            logger.error('Internal WebSocket error:', {
                connectionId,
                error: error.message
            });
            clientWs.close(1001, 'Internal connection error');
            this.wsConnections.delete(connectionId);
        });

        clientWs.on('error', (error) => {
            logger.error('Client WebSocket error:', {
                connectionId,
                error: error.message
            });
            internalWs.close();
            this.wsConnections.delete(connectionId);
        });

        // Relay messages when connected
        internalWs.on('open', () => {
            logger.info('WebSocket proxy established:', { connectionId });

            // Client to internal
            clientWs.on('message', (data) => {
                if (internalWs.readyState === WebSocket.OPEN) {
                    internalWs.send(data);
                }
            });

            // Internal to client
            internalWs.on('message', (data) => {
                if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(data);
                }
            });
        });

        // Clean up on close
        const cleanup = () => {
            this.wsConnections.delete(connectionId);
            internalWs.close();
            clientWs.close();
        };

        clientWs.on('close', cleanup);
        internalWs.on('close', cleanup);

        return connectionId;
    }

    /**
     * Get active connections stats
     */
    getStats() {
        return {
            dnsCache: this.dnsCache.size,
            activeWebSockets: this.wsConnections.size,
            connections: Array.from(this.wsConnections.entries()).map(([id, conn]) => ({
                id,
                age: Date.now() - conn.created,
                clientState: conn.client.readyState,
                internalState: conn.internal.readyState
            }))
        };
    }

    /**
     * Clean up old connections
     */
    cleanup() {
        const now = Date.now();
        const maxAge = 3600000; // 1 hour

        this.wsConnections.forEach((conn, id) => {
            if (now - conn.created > maxAge) {
                logger.info('Cleaning up old WebSocket:', { id });
                conn.client.close();
                conn.internal.close();
                this.wsConnections.delete(id);
            }
        });
    }
}

module.exports = new NetworkProxyEngine();