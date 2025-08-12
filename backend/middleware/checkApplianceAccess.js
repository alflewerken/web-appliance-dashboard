// Middleware für Appliance-Zugriffskontrolle
const pool = require('../utils/database');
const { logger } = require('../utils/logger');

const checkApplianceAccess = async (req, res, next) => {
    try {
        const applianceId = req.params.id;
        const userId = req.user.id;
        
        console.log('[checkApplianceAccess] Checking access for appliance:', applianceId);
        
        // Appliance laden
        const [appliances] = await pool.execute(
            'SELECT * FROM appliances WHERE id = ?',
            [applianceId]
        );
        
        if (appliances.length === 0) {
            console.log('[checkApplianceAccess] Appliance not found:', applianceId);
            return res.status(404).json({ error: 'Appliance not found' });
        }
        
        const appliance = appliances[0];
        console.log('[checkApplianceAccess] Found appliance:', appliance.name);
        
        // Parse URL to get hostname and port
        let hostname, port, protocol;
        if (appliance.url) {
            try {
                const urlObj = new URL(appliance.url);
                hostname = urlObj.hostname;
                port = urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80);
                protocol = urlObj.protocol.replace(':', '');
            } catch (e) {
                console.log('[checkApplianceAccess] Failed to parse URL:', appliance.url);
                // Fallback to direct values
                hostname = appliance.remoteHost;
                port = appliance.remotePort || 80;
                protocol = 'http';
            }
        } else {
            hostname = appliance.remoteHost;
            port = appliance.remotePort || 80;
            protocol = 'http';
        }
        
        console.log('[checkApplianceAccess] Proxy config:', { hostname, port, protocol });
        
        // Appliance-Config an Request anhängen
        req.applianceConfig = {
            id: appliance.id,
            name: appliance.name,
            type: protocol,
            url: appliance.url,
            hostname: hostname,
            port: port,
            username: appliance.remoteUsername,
            password: appliance.remotePassword,
            protocol: protocol,
            targetHost: hostname,
            targetPort: port,
            settings: {}
        };
        
        // Für Audit-Logging
        req.serviceConfig = req.applianceConfig;
        
        next();
    } catch (error) {
        console.error('[checkApplianceAccess] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = checkApplianceAccess;
