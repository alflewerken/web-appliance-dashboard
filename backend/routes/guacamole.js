const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../utils/database');
const { createAuditLog } = require('../utils/auditLogger');
const { decrypt } = require('../utils/crypto');
const { getClientIp } = require('../utils/getClientIp');
const GuacamoleDBManager = require('../utils/guacamole/GuacamoleDBManager');

// Cache für Guacamole Auth Tokens
const authTokenCache = new Map();

/**
 * Holt oder erstellt einen Guacamole Auth Token
 */
async function getGuacamoleAuthToken() {
  // Check cache first
  const cached = authTokenCache.get('admin');
  if (cached && cached.expires > Date.now()) {
    return cached.token;
  }
  
  // Use internal Docker network URL
  const guacamoleInternalUrl = 'http://guacamole:8080/guacamole';
  
  try {
    const response = await axios.post(`${guacamoleInternalUrl}/api/tokens`, 
      'username=guacadmin&password=guacadmin', 
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    );
    
    const token = response.data.authToken;
    
    // Cache for 30 minutes
    authTokenCache.set('admin', {
      token: token,
      expires: Date.now() + 30 * 60 * 1000
    });
    
    return token;
  } catch (error) {
    console.error('Failed to get Guacamole auth token:', error.message);
    throw new Error('Guacamole authentication failed');
  }
}

/**
 * Erstellt einen direkten Link zu einer Guacamole-Verbindung
 */
router.post('/guacamole/token/:applianceId', async (req, res) => {
  try {
    const { applianceId } = req.params;
    const userId = req.user.id;
    
    // Prüfe ob Appliance existiert
    const [appliances] = await pool.execute(
      'SELECT * FROM appliances WHERE id = ?',
      [applianceId]
    );
    
    if (appliances.length === 0) {
      return res.status(403).json({ error: 'Keine Berechtigung für diese Appliance' });
    }
    
    const appliance = appliances[0];
    
    if (!appliance.remote_desktop_enabled) {
      return res.status(400).json({ error: 'Remote Desktop ist für diese Appliance nicht aktiviert' });
    }
    
    try {
      // Entschlüssele Passwort
      let decryptedPassword = null;
      if (appliance.remote_password_encrypted) {
        try {
          decryptedPassword = decrypt(appliance.remote_password_encrypted);
        } catch (error) {
          console.error('Fehler beim Entschlüsseln des Passworts:', error);
        }
      }
      
      // Erstelle oder aktualisiere die Verbindung
      const dbManager = new GuacamoleDBManager();
      const connectionInfo = await dbManager.createOrUpdateConnection(applianceId, {
        protocol: appliance.remote_protocol,
        hostname: appliance.remote_host,
        port: appliance.remote_port || (appliance.remote_protocol === 'vnc' ? 5900 : 3389),
        username: appliance.remote_username || '',
        password: decryptedPassword || ''
      });
      await dbManager.close();
      
      // Hole Guacamole Auth Token
      const authToken = await getGuacamoleAuthToken();
      
      // Erstelle den korrekten Guacamole identifier
      // Format: <connection-id>\0c\0<data-source>
      const connectionId = connectionInfo.connectionId;
      const dataSource = 'postgresql'; // oder 'mysql' je nach DB
      const identifier = Buffer.from(`${connectionId}\0c\0${dataSource}`).toString('base64');
      
      // Audit Log
      await createAuditLog(
        userId,
        'remote_desktop_access',
        'appliance',
        applianceId,
        { 
          protocol: appliance.remote_protocol,
          host: appliance.remote_host,
          connectionName: connectionInfo.connectionName,
          connectionId: connectionId
        },
        getClientIp(req)
      );
      
      // Generiere direkte URL mit Auth Token und kodiertem Identifier
      // Verwende die direkte Guacamole URL (Port 9070) für zuverlässigen Zugriff
      let guacamoleUrl;
      
      // Wenn EXTERNAL_URL gesetzt ist, nutze diese als Basis
      if (process.env.EXTERNAL_URL) {
        const baseUrl = process.env.EXTERNAL_URL.replace(/\/$/, '');
        // Ersetze den Port mit dem Guacamole Port
        const urlParts = baseUrl.split(':');
        if (urlParts.length === 3) {
          // Format: http://domain:port -> http://domain:9070
          guacamoleUrl = `${urlParts[0]}:${urlParts[1]}:9070/guacamole`;
        } else {
          // Format ohne Port: http://domain -> http://domain:9070
          guacamoleUrl = `${baseUrl}:9070/guacamole`;
        }
      } else {
        // Fallback auf localhost
        guacamoleUrl = `http://localhost:9070/guacamole`;
      }
      
      const directUrl = `${guacamoleUrl}/#/client/${identifier}?token=${authToken}`;
      
      res.json({
        url: directUrl,
        needsLogin: false
      });
      
    } catch (error) {
      console.error('Fehler bei der Guacamole-Integration:', error);
      res.status(500).json({ error: 'Fehler bei der Remote Desktop Verbindung' });
    }
  } catch (error) {
    console.error('Fehler beim Erstellen des Guacamole Tokens:', error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

/**
 * Proxy endpoint für Guacamole - leitet Anfragen weiter mit automatischer Authentifizierung
 */
router.all('/guacamole/proxy/*', async (req, res) => {
  try {
    const authToken = await getGuacamoleAuthToken();
    const guacamoleUrl = process.env.GUACAMOLE_URL || 'http://guacamole:8080/guacamole';
    const path = req.params[0];
    
    const config = {
      method: req.method,
      url: `${guacamoleUrl}/${path}`,
      headers: {
        ...req.headers,
        'Guacamole-Token': authToken,
        'host': undefined,
        'content-length': undefined
      },
      params: { ...req.query, token: authToken }
    };
    
    if (req.body && Object.keys(req.body).length > 0) {
      config.data = req.body;
    }
    
    const response = await axios(config);
    
    // Forward response
    Object.keys(response.headers).forEach(key => {
      if (key !== 'content-encoding' && key !== 'content-length') {
        res.setHeader(key, response.headers[key]);
      }
    });
    
    res.status(response.status).send(response.data);
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(error.response?.status || 500).json({ 
      error: 'Proxy error',
      details: error.message 
    });
  }
});

module.exports = router;