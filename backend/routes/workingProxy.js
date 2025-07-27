// Docker-interne Host-Auflösung für macOS
// Auf macOS können Docker-Container den Host über host.docker.internal erreichen

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const pool = require('../utils/database');
const { logger } = require('../utils/logger');
const axios = require('axios');
const http = require('http');
const https = require('https');

// Axios-Instanz mit angepassten Einstellungen
const proxyClient = axios.create({
    timeout: 30000,
    maxRedirects: 5,
    validateStatus: () => true, // Alle Status-Codes akzeptieren
    httpsAgent: new https.Agent({
        rejectUnauthorized: false, // Selbstsignierte Zertifikate erlauben
        family: 4 // IPv4 erzwingen
    }),
    httpAgent: new http.Agent({
        keepAlive: true,
        family: 4 // IPv4 erzwingen
    })
});

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
        const targetUrl = `${baseUrl}${path ? '/' + path : ''}${req.url.split('?')[1] ? '?' + req.url.split('?')[1] : ''}`;
        
        logger.info(`[PROXY] Forwarding request to: ${targetUrl}`);
        
        // Headers vorbereiten
        const headers = { ...req.headers };
        delete headers.host;
        delete headers['content-length'];
        headers['X-Forwarded-For'] = req.headers['x-real-ip'] || req.ip;
        headers['X-Forwarded-Proto'] = req.headers['x-forwarded-proto'] || req.protocol;
        headers['X-Forwarded-Host'] = req.headers['x-forwarded-host'] || req.hostname;
        
        // Host-Header auf Ziel-Host setzen
        const targetHost = new URL(targetUrl).host;
        headers['Host'] = targetHost;
        
        // Proxy-Request
        const response = await proxyClient({
            method: req.method,
            url: targetUrl,
            headers: headers,
            data: req.body,
            responseType: 'stream'
        });
        
        // Response-Headers kopieren
        Object.entries(response.headers).forEach(([key, value]) => {
            // Einige Headers nicht weitergeben
            if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        });
        
        // Status setzen
        res.status(response.status);
        
        // Stream weiterleiten
        response.data.pipe(res);
        
        // Logging
        logger.info(`[PROXY] Response status: ${response.status} for ${targetUrl}`);
        
    } catch (error) {
        logger.error('[PROXY] Error:', {
            applianceId,
            error: error.message,
            stack: error.stack
        });
        
        // Spezifische Fehlermeldungen
        if (error.code === 'ECONNREFUSED') {
            res.status(502).json({ 
                error: 'Bad Gateway', 
                message: 'Target service is not reachable',
                details: error.message 
            });
        } else if (error.code === 'ETIMEDOUT') {
            res.status(504).json({ 
                error: 'Gateway Timeout', 
                message: 'Target service timeout',
                details: error.message 
            });
        } else {
            res.status(500).json({ 
                error: 'Proxy Error', 
                message: 'Failed to proxy request',
                details: error.message 
            });
        }
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
        
        logger.info(`[PROXY] Health check for ${appliance.name}: ${baseUrl}`);
        
        // Einfacher Health-Check
        const response = await proxyClient.get(baseUrl, { timeout: 5000 });
        
        res.json({
            appliance: appliance.name,
            url: baseUrl,
            status: response.status,
            reachable: response.status < 500
        });
        
    } catch (error) {
        logger.error(`[PROXY] Health check failed for appliance ${applianceId}:`, error.message);
        res.json({
            appliance: applianceId,
            reachable: false,
            error: error.message
        });
    }
});

module.exports = router;
