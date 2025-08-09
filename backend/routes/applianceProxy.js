/**
 * Appliance Proxy Routes - Backend-Proxy für alle Appliance-Zugriffe
 * 
 * Erweitert die bestehenden Appliance-Routes um Proxy-Funktionalität
 */

const express = require('express');
const router = express.Router();

// Debug route to test if router is reached
router.get('/test-proxy', (req, res) => {
    console.log('[PROXY TEST] Route reached!');
    console.log('[PROXY TEST] Query:', req.query);
    res.json({ message: 'Proxy router is working!', query: req.query });
});

const { authenticateToken } = require('../middleware/auth');
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');
const logger = require('../utils/logger');
const proxyEngine = require('../utils/proxyEngine');

// Initialize QueryBuilder
const db = new QueryBuilder(pool);
const sessionCache = require('../utils/sessionCache');
// Temporär: Korrigierte checkApplianceAccess Middleware
const checkApplianceAccessFixed = require('../middleware/checkApplianceAccessFixed');
// Import middleware from proxyAuth
const { 
    createServiceRateLimiter, 
    auditProxyAccess,
    authenticateWebSocket,
    addSecurityHeaders 
} = require('../middleware/proxyAuth');

// Rate Limiter erstellen
const applianceRateLimiter = createServiceRateLimiter();

/**
 * Middleware für Appliance-Zugriff (angepasst für appliances table)
 */
const checkApplianceAccess = async (req, res, next) => {
    try {
        const applianceId = req.params.id;
        const userId = req.user.id;
        
        // Appliance laden
        const appliances = await db.select('appliances', { id: applianceId });
        
        if (appliances.length === 0) {
            return res.status(404).json({ error: 'Appliance not found' });
        }
        
        const appliance = appliances[0];
        
        // TODO: Hier würde die Zugriffskontrolle implementiert
        // Momentan erlauben wir allen authentifizierten Usern Zugriff
        
        // Appliance-Config an Request anhängen
        req.applianceConfig = {
            id: appliance.id,
            name: appliance.name,
            type: appliance.proxy_protocol || 'http',
            url: appliance.url,
            hostname: appliance.proxy_hostname || appliance.remote_host,
            port: appliance.proxy_target_port || appliance.remote_port,
            username: appliance.proxy_username || appliance.remote_username,
            password: appliance.proxy_password || appliance.remote_password_encrypted,
            privateKey: appliance.proxy_private_key,
            passphrase: appliance.proxy_passphrase,
            protocol: appliance.proxy_protocol || appliance.remote_protocol,
            targetHost: appliance.proxy_target_host || appliance.remote_host,
            targetPort: appliance.proxy_target_port || appliance.remote_port,
            settings: appliance.proxy_settings || {}
        };
        
        // Für Audit-Logging
        req.serviceConfig = req.applianceConfig;
        
        next();
    } catch (error) {
        logger.error('Appliance access check error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * HAUPTPROXY-ROUTE - Alle HTTP/HTTPS Anfragen
 */
router.all('/:id/proxy/*', 
    authenticateToken,  
    checkApplianceAccessFixed,   // Temporär: Korrigierte Access-Check
    applianceRateLimiter,
    auditProxyAccess,
    addSecurityHeaders,
    async (req, res, next) => {
        try {
            // Temporär deaktiviert - Proxy für alle Appliances erlauben
            /*
            // Nur für Appliances mit aktiviertem Proxy
            const [result] = await pool.execute(
                'SELECT proxy_enabled FROM appliances WHERE id = ?',
                [req.params.id]
            );
            
            if (!result[0]?.proxy_enabled) {
                return res.status(403).json({ error: 'Proxy not enabled for this appliance' });
            }
            */
            
            // Proxy-Middleware von ProxyEngine verwenden
            const proxy = proxyEngine.createServiceProxy(req.applianceConfig);
            proxy(req, res, next);
        } catch (error) {
            logger.error('Proxy setup error:', error);
            res.status(500).json({ error: 'Proxy configuration failed' });
        }
    }
);

/**
 * WebSocket Route für Terminal (SSH)
 */
router.ws('/:id/terminal', async (ws, req) => {
    try {
        // WebSocket-Authentifizierung
        const authenticated = await authenticateWebSocket(ws, req);
        if (!authenticated) return;
        
        // Appliance laden
        const appliances = await db.select('appliances', {
            id: req.params.id,
            proxyProtocol: 'ssh'
        });
        
        if (appliances.length === 0) {
            ws.close(1008, 'Invalid appliance or not SSH type');
            return;
        }
        
        const appliance = appliances[0];
        
        // SSH-Connection aus Cache oder neu erstellen
        const ssh = await sessionCache.getSSHConnection(appliance.id, {
            hostname: appliance.proxy_hostname || appliance.remote_host,
            port: appliance.proxy_target_port || 22,
            username: appliance.proxy_username,
            password: appliance.proxy_password,
            privateKey: appliance.proxy_private_key,
            passphrase: appliance.proxy_passphrase
        });
        
        // Terminal-Session starten
        const stream = await ssh.requestShell({
            term: 'xterm-256color',
            cols: 80,
            rows: 24
        });
        
        // Bidirektionale Kommunikation
        ws.on('message', (data) => {
            stream.write(data);
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
        
        logger.info(`Terminal session started for appliance ${appliance.id} by user ${req.user.id}`);
        
        // Audit Log
        await db.insert('proxy_audit_logs', {
            userId: req.user.id,
            userName: req.user.username,
            applianceId: appliance.id,
            applianceName: appliance.name,
            action: 'terminal_session',
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
        
    } catch (error) {
        logger.error('Terminal session error:', error);
        ws.close(1011, 'Terminal session failed');
    }
});

/**
 * Appliance Health Check
 */
router.get('/:id/health', 
    authenticateToken, 
    checkApplianceAccess,
    async (req, res) => {
        try {
            const appliance = req.applianceConfig;
            const health = {
                id: appliance.id,
                name: appliance.name,
                type: appliance.type,
                status: 'unknown',
                lastCheck: new Date(),
                details: {}
            };
            
            // Je nach Appliance-Typ prüfen
            const protocol = appliance.protocol || 'http';
            
            switch (protocol) {
                case 'http':
                case 'https':
                    // HTTP Health Check
                    try {
                        const fetch = require('node-fetch');
                        const response = await fetch(appliance.url, { 
                            timeout: 5000,
                            headers: {
                                'User-Agent': 'ApplianceDashboard/1.0'
                            }
                        });
                        health.status = response.ok ? 'healthy' : 'unhealthy';
                        health.details.statusCode = response.status;
                    } catch (error) {
                        health.status = 'unreachable';
                        health.details.error = error.message;
                    }
                    break;
                    
                case 'ssh':
                    // SSH Health Check
                    try {
                        const ssh = await sessionCache.getSSHConnection(appliance.id, {
                            hostname: appliance.hostname,
                            port: appliance.port || 22,
                            username: appliance.username,
                            password: appliance.password,
                            privateKey: appliance.privateKey,
                            passphrase: appliance.passphrase
                        });
                        health.status = ssh.isConnected() ? 'healthy' : 'unhealthy';
                    } catch (error) {
                        health.status = 'unreachable';
                        health.details.error = error.message;
                    }
                    break;
            }
            
            res.json(health);
            
        } catch (error) {
            logger.error('Health check error:', error);
            res.status(500).json({ error: 'Health check failed' });
        }
    }
);

/**
 * VNC/RDP Route - Zeigt Remote Desktop Seite
 */
router.get('/:id/proxy/vnc', 
    authenticateToken, 
    checkApplianceAccess,
    async (req, res) => {
        try {
            const appliance = req.applianceConfig;
            
            // Prüfe ob Remote Desktop aktiviert ist
            const [result] = await pool.execute(
                'SELECT remote_desktop_enabled, remote_protocol, remote_host, remote_port FROM appliances WHERE id = ?',
                [req.params.id]
            );
            
            if (!result[0]?.remote_desktop_enabled) {
                return res.status(403).json({ error: 'Remote Desktop not enabled for this appliance' });
            }
            
            // Sende HTML-Seite zurück
            const html = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Remote Desktop - ${appliance.name}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #1a1a1a;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
        }
        iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
        }
        .loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="loading">Verbindung wird hergestellt...</div>
    <iframe src="/guacamole/" onload="this.previousElementSibling.style.display='none'"></iframe>
</body>
</html>`;
            
            res.setHeader('Content-Type', 'text/html');
            res.send(html);
            
        } catch (error) {
            logger.error('VNC/RDP proxy error:', error);
            res.status(500).json({ error: 'Remote Desktop connection failed' });
        }
    }
);

module.exports = router;