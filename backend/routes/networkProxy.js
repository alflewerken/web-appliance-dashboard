const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const networkProxy = require('../utils/networkProxyEngine');
const { logger } = require('../utils/logger');
const { createAuditLog } = require('../utils/auditLogger');

/**
 * Generic HTTP/HTTPS Proxy
 * Proxies any request to internal network addresses
 * 
 * Usage: /api/proxy/192.168.1.100:8006/path/to/resource
 * Usage: /api/proxy/proxmox.local:8006/path/to/resource
 */
router.all('/proxy/:target/*', 
    authenticateToken,
    async (req, res) => {
        try {
            // Extract target and path
            const target = req.params.target;
            const path = req.params[0] || '';
            
            // Parse target (can be ip:port or hostname:port)
            let host, port, protocol;
            const targetParts = target.split(':');
            
            if (targetParts.length === 2) {
                host = targetParts[0];
                port = targetParts[1];
            } else {
                host = target;
                port = '80'; // Default to HTTP
            }

            // Determine protocol based on port or explicit parameter
            if (req.query.https === 'true' || port === '443' || port === '8006') {
                protocol = 'https';
            } else {
                protocol = req.query.protocol || 'http';
            }

            // Build internal URL
            const internalUrl = `${protocol}://${host}:${port}/${path}${req.url.split('?')[1] ? '?' + req.url.split('?')[1] : ''}`;

            logger.info('Transparent proxy request:', {
                user: req.user.email,
                target: `${host}:${port}`,
                path,
                method: req.method
            });

            // Proxy the request
            const response = await networkProxy.proxyRequest(internalUrl, {
                method: req.method,
                headers: req.headers,
                data: req.body,
                responseType: 'stream'
            });

            // Log access
            await createAuditLog(
                req.user.id,
                'proxy_access',
                'network',
                null,
                {
                    target,
                    path,
                    method: req.method,
                    status: response.status,
                    internal_url: internalUrl
                },
                req.ip
            );

            // Set response headers
            Object.entries(response.headers).forEach(([key, value]) => {
                res.setHeader(key, value);
            });

            // Set status
            res.status(response.status);

            // Stream response
            if (response.data && response.data.pipe) {
                response.data.pipe(res);
            } else {
                res.send(response.data);
            }

        } catch (error) {
            logger.error('Proxy error:', {
                target: req.params.target,
                error: error.message,
                user: req.user.email
            });

            // Send appropriate error response
            if (error.message.includes('not found')) {
                res.status(404).json({
                    error: 'Not Found',
                    message: 'Internal host not reachable'
                });
            } else if (error.message.includes('refused')) {
                res.status(502).json({
                    error: 'Bad Gateway',
                    message: 'Internal service refused connection'
                });
            } else if (error.message.includes('timeout')) {
                res.status(504).json({
                    error: 'Gateway Timeout',
                    message: 'Internal service timeout'
                });
            } else {
                res.status(500).json({
                    error: 'Proxy Error',
                    message: 'Failed to proxy request'
                });
            }
        }
    }
);

/**
 * WebSocket Proxy
 * Proxies WebSocket connections to internal addresses
 * 
 * Usage: ws://dashboard/api/ws-proxy/192.168.1.100:8006/path
 */
router.ws('/ws-proxy/:target/*',
    authenticateToken,
    async (ws, req) => {
        const target = req.params.target;
        const path = req.params[0] || '';
        
        // Parse target
        const targetParts = target.split(':');
        const host = targetParts[0];
        const port = targetParts[1] || '80';
        
        // Determine protocol
        const protocol = (port === '443' || req.query.wss === 'true') ? 'wss' : 'ws';
        const internalWsUrl = `${protocol}://${host}:${port}/${path}`;

        logger.info('WebSocket proxy request:', {
            user: req.user.email,
            target: internalWsUrl
        });

        try {
            // Create proxy connection
            const connectionId = networkProxy.createWebSocketProxy(internalWsUrl, ws);

            // Log access
            await createAuditLog(
                req.user.id,
                'proxy_access',
                'network',
                null,
                {
                    type: 'websocket',
                    target,
                    path,
                    connection_id: connectionId
                },
                req.ip
            );

        } catch (error) {
            logger.error('WebSocket proxy error:', {
                target,
                error: error.message
            });
            ws.close(1011, 'Proxy connection failed');
        }
    }
);
/**
 * Service Discovery Endpoint
 * Lists known services in the internal network
 */
router.get('/discover',
    authenticateToken,
    async (req, res) => {
        try {
            // Temporarily return empty array until Service model is ready
            const discovered = [];
            
            // // Get all configured services
            // const services = await Service.findAll({
            //     where: { status: 'active' },
            //     attributes: ['id', 'name', 'type', 'ip_address', 'port', 'use_https']
            // });

            // // Transform to proxy-friendly format
            // const discovered = services.map(service => ({
            //     name: service.name,
            //     type: service.type,
            //     target: `${service.ip_address}:${service.port || 80}`,
            //     protocol: service.use_https ? 'https' : 'http',
            //     proxyUrl: `/api/proxy/${service.ip_address}:${service.port || 80}/`
            // }));

            res.json({
                services: discovered,
                instructions: {
                    http: 'Use /api/proxy/{ip}:{port}/path for HTTP/HTTPS',
                    websocket: 'Use /api/ws-proxy/{ip}:{port}/path for WebSocket'
                }
            });

        } catch (error) {
            logger.error('Service discovery error:', error);
            res.status(500).json({
                error: 'Discovery Error',
                message: 'Failed to discover services'
            });
        }
    }
);

/**
 * Proxy Statistics
 */
router.get('/stats',
    authenticateToken,
    async (req, res) => {
        try {
            const stats = networkProxy.getStats();
            res.json(stats);
        } catch (error) {
            logger.error('Stats error:', error);
            res.status(500).json({
                error: 'Stats Error',
                message: 'Failed to get proxy statistics'
            });
        }
    }
);

/**
 * Quick access endpoints for common services
 * These are convenience wrappers around the generic proxy
 */

// Proxmox shortcut
router.all('/proxmox/:node/*',
    authenticateToken,
    (req, res, next) => {
        // Redirect to generic proxy with Proxmox port
        const node = req.params.node;
        const path = req.params[0] || '';
        req.url = `/proxy/${node}:8006/${path}`;
        req.params.target = `${node}:8006`;
        req.params[0] = path;
        req.query.https = 'true';
        next();
    },
    router.stack.find(r => r.route && r.route.path === '/proxy/:target/*').route.stack[1].handle
);

// SSH Web Terminal shortcut (for ttyd)
router.all('/terminal/:host/*',
    authenticateToken,
    (req, res, next) => {
        const host = req.params.host;
        const path = req.params[0] || '';
        req.url = `/proxy/${host}:7681/${path}`;
        req.params.target = `${host}:7681`;
        req.params[0] = path;
        next();
    },
    router.stack.find(r => r.route && r.route.path === '/proxy/:target/*').route.stack[1].handle
);

// VNC Web shortcut (for noVNC)
router.all('/vnc/:host/*',
    authenticateToken,
    (req, res, next) => {
        const host = req.params.host;
        const path = req.params[0] || '';
        req.url = `/proxy/${host}:6080/${path}`;
        req.params.target = `${host}:6080`;
        req.params[0] = path;
        next();
    },
    router.stack.find(r => r.route && r.route.path === '/proxy/:target/*').route.stack[1].handle
);

/**
 * Health check for proxy engine
 */
router.get('/health',
    (req, res) => {
        res.json({
            status: 'ok',
            engine: 'network-proxy',
            timestamp: new Date().toISOString()
        });
    }
);

module.exports = router;