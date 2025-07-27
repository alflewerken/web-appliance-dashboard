const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const pool = require('../utils/database');
const { logger } = require('../utils/logger');
const http = require('http');
const https = require('https');
const url = require('url');

// Helper: URL aus Appliance-Daten erstellen
const getApplianceUrl = (appliance) => {
    if (appliance.url) {
        return appliance.url;
    }
    
    const protocol = appliance.use_https ? 'https' : 'http';
    const host = appliance.ip_address || appliance.remote_host || appliance.proxy_hostname;
    const port = appliance.port || appliance.remote_port || appliance.proxy_target_port || 80;
    
    return `${protocol}://${host}:${port}`;
};

// Proxy mit nativen Node.js Modulen
const proxyRequest = (targetUrl, req, res, appliance) => {
    const parsedUrl = url.parse(targetUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.path,
        method: req.method,
        headers: {
            ...req.headers,
            host: parsedUrl.host
        }
    };
    
    // Entferne problematische Headers
    delete options.headers['content-length'];
    delete options.headers['connection'];
    
    logger.info(`[PROXY] Making request to ${options.hostname}:${options.port}${options.path}`);
    
    const proxyReq = httpModule.request(options, (proxyRes) => {
        // Status und Headers weiterleiten
        res.status(proxyRes.statusCode);
        Object.entries(proxyRes.headers).forEach(([key, value]) => {
            if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        });
        
        // Response streamen
        proxyRes.pipe(res);
        
        // Audit Log nach erfolgreicher Response
        proxyRes.on('end', async () => {
            try {
                await pool.execute(
                    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        req.user.id,
                        'proxy_access',
                        'appliances',
                        appliance.id,
                        JSON.stringify({
                            appliance_name: appliance.name,
                            target_url: targetUrl,
                            method: req.method,
                            status: proxyRes.statusCode,
                            path: parsedUrl.path
                        }),
                        req.ip || req.connection.remoteAddress,
                        req.headers['user-agent'] || 'Unknown'
                    ]
                );
                logger.info(`[AUDIT] Proxy access logged for appliance ${appliance.name}`);
            } catch (auditError) {
                logger.error('[AUDIT] Failed to log proxy access:', auditError);
            }
        });
    });
    
    proxyReq.on('error', (error) => {
        logger.error('[PROXY] Request error:', error);
        res.status(502).json({
            error: 'Bad Gateway',
            message: 'Target service is not reachable',
            details: error.message
        });
        
        // Auch Fehler im Audit Log erfassen
        pool.execute(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.id,
                'proxy_access_failed',
                'appliances',
                appliance.id,
                JSON.stringify({
                    appliance_name: appliance.name,
                    target_url: targetUrl,
                    method: req.method,
                    error: error.message
                }),
                req.ip || req.connection.remoteAddress,
                req.headers['user-agent'] || 'Unknown'
            ]
        ).catch(auditError => {
            logger.error('[AUDIT] Failed to log proxy error:', auditError);
        });
    });
    
    // Request-Body weiterleiten
    if (req.body) {
        if (typeof req.body === 'object') {
            proxyReq.write(JSON.stringify(req.body));
        } else {
            proxyReq.write(req.body);
        }
    }
    
    // Bei Streams
    req.pipe(proxyReq);
};

// Proxy-Route
router.all('/:id/proxy/*', authenticateToken, async (req, res) => {
    const applianceId = req.params.id;
    const path = req.params[0] || '';
    
    try {
        // Appliance aus Datenbank laden
        const [appliances] = await pool.execute(
            'SELECT * FROM appliances WHERE id = ?',
            [applianceId]
        );
        
        if (appliances.length === 0) {
            return res.status(404).json({ error: 'Appliance not found' });
        }
        
        const appliance = appliances[0];
        const baseUrl = getApplianceUrl(appliance);
        const queryString = req.url.split('?')[1];
        const targetUrl = `${baseUrl}${path ? '/' + path : ''}${queryString ? '?' + queryString : ''}`;
        
        logger.info(`[PROXY] Forwarding request to: ${targetUrl}`);
        
        // Proxy-Request mit nativen Modulen (mit Appliance-Daten für Audit)
        proxyRequest(targetUrl, req, res, appliance);
        
    } catch (error) {
        logger.error('[PROXY] Error:', {
            applianceId,
            error: error.message,
            stack: error.stack
        });
        
        res.status(500).json({ 
            error: 'Proxy Error', 
            message: 'Failed to proxy request',
            details: error.message 
        });
    }
});

// Health-Check für Proxy
router.get('/:id/proxy-health', authenticateToken, async (req, res) => {
    const applianceId = req.params.id;
    
    try {
        const [appliances] = await pool.execute(
            'SELECT * FROM appliances WHERE id = ?',
            [applianceId]
        );
        
        if (appliances.length === 0) {
            return res.status(404).json({ error: 'Appliance not found' });
        }
        
        const appliance = appliances[0];
        const baseUrl = getApplianceUrl(appliance);
        const parsedUrl = url.parse(baseUrl);
        const isHttps = parsedUrl.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        
        logger.info(`[PROXY] Health check for ${appliance.name}: ${baseUrl}`);
        
        // Health-Check Request
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: '/',
            method: 'GET',
            timeout: 5000
        };
        
        const healthReq = httpModule.request(options, (healthRes) => {
            res.json({
                appliance: appliance.name,
                url: baseUrl,
                status: healthRes.statusCode,
                reachable: healthRes.statusCode < 500
            });
        });
        
        healthReq.on('error', (error) => {
            logger.error(`[PROXY] Health check failed:`, error.message);
            res.json({
                appliance: appliance.name,
                url: baseUrl,
                reachable: false,
                error: error.message
            });
        });
        
        healthReq.end();
        
    } catch (error) {
        res.json({
            appliance: applianceId,
            reachable: false,
            error: error.message
        });
    }
});

module.exports = router;
