const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../utils/database');
const { createAuditLog } = require('../utils/auditLogger');
const { decrypt } = require('../utils/crypto');
const { getClientIp } = require('../utils/getClientIp');
const GuacamoleDBManager = require('../utils/guacamole/GuacamoleDBManager');
const { getGuacamoleUrl } = require('../utils/guacamoleUrlHelper');

// Cache für Guacamole Auth Tokens
const authTokenCache = new Map();

/**
 * Holt oder erstellt einen Guacamole Auth Token
 */
async function getGuacamoleAuthToken(forceNew = false) {
  // Check cache first
  if (!forceNew) {
    const cached = authTokenCache.get('admin');
    if (cached && cached.expires > Date.now()) {
      return cached.token;
    }
  }
  
  try {
    // Use internal Guacamole URL
    const guacamoleUrl = 'http://guacamole:8080/guacamole';
    
    const response = await axios.post(
      `${guacamoleUrl}/api/tokens`,
      new URLSearchParams({
        username: 'guacadmin',
        password: 'guacadmin'
      }),
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
    
    console.log('Guacamole auth token obtained successfully');
    return token;
  } catch (error) {
    console.error('Failed to get Guacamole auth token:', error.message);
    throw new Error('Guacamole authentication failed');
  }
}

/**
 * Erstellt einen direkten Link zu einer Guacamole-Verbindung mit automatischer Authentifizierung
 */
router.post('/token/:applianceId', async (req, res) => {
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
      
      // Hole die Connection ID aus der Datenbank
      const connectionResult = await dbManager.pool.query(
        'SELECT connection_id FROM guacamole_connection WHERE connection_name = $1',
        [`dashboard-${applianceId}`]
      );
      
      await dbManager.close();
      
      if (!connectionResult.rows || connectionResult.rows.length === 0) {
        throw new Error('Verbindung nicht gefunden');
      }
      
      const connectionId = connectionResult.rows[0].connection_id;
      
      // Hole Guacamole Auth Token
      const authToken = await getGuacamoleAuthToken();
      
      // Generiere URL - IMMER über Port 9080
      const baseUrl = getGuacamoleUrl(req);
      const guacamoleUrl = `${baseUrl}/guacamole`;
      
      // Erstelle die korrekte Guacamole-URL mit Token
      // Format: #/client/{identifier}?token={token}
      const identifier = Buffer.from(`${connectionId}\0c\0postgresql`).toString('base64');
      const encodedIdentifier = encodeURIComponent(identifier);
      
      // Direkte Client-URL mit Token
      const connectionUrl = `${guacamoleUrl}/#/client/${encodedIdentifier}?token=${encodeURIComponent(authToken)}`;
      
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
      
      console.log('Generated Guacamole URL with token:', {
        connectionId,
        identifier,
        encodedIdentifier,
        token: authToken.substring(0, 20) + '...',
        baseUrl,
        guacamoleUrl,
        connectionUrl
      });
      
      // Gebe URL mit Token zurück
      res.json({
        url: connectionUrl,
        needsLogin: false,
        hasToken: true,
        connectionId: connectionId,
        connectionName: connectionInfo.connectionName
      });
      
    } catch (error) {
      console.error('Fehler bei der Guacamole-Integration:', error);
      res.status(500).json({ error: 'Fehler bei der Remote Desktop Verbindung' });
    }
  } catch (error) {
    console.error('Fehler beim Erstellen des Guacamole Links:', error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

/**
 * Automatische Login-Route für Guacamole
 * Erstellt eine Session und leitet zur gewünschten Verbindung weiter
 */
router.get('/auto-login/:applianceId', async (req, res) => {
  try {
    const { applianceId } = req.params;
    
    // Hole Auth Token
    const authToken = await getGuacamoleAuthToken();
    
    // Generiere URL
    const baseUrl = getGuacamoleUrl(req);
    
    // Hole Connection ID
    const dbManager = new GuacamoleDBManager();
    const connectionResult = await dbManager.pool.query(
      'SELECT connection_id FROM guacamole_connection WHERE connection_name = $1',
      [`dashboard-${applianceId}`]
    );
    await dbManager.close();
    
    if (!connectionResult.rows || connectionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Verbindung nicht gefunden' });
    }
    
    const connectionId = connectionResult.rows[0].connection_id;
    const identifier = Buffer.from(`${connectionId}\0c\0postgresql`).toString('base64');
    const encodedIdentifier = encodeURIComponent(identifier);
    
    // Leite zur Guacamole-URL mit Token weiter
    const redirectUrl = `${baseUrl}/guacamole/#/client/${encodedIdentifier}?token=${encodeURIComponent(authToken)}`;
    
    console.log('Auto-login redirect to:', redirectUrl);
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('Auto-login failed:', error);
    res.status(500).json({ error: 'Auto-login fehlgeschlagen' });
  }
});

/**
 * Hole alle verfügbaren Guacamole-Verbindungen
 */
router.get('/connections', async (req, res) => {
  try {
    const dbManager = new GuacamoleDBManager();
    
    const result = await dbManager.pool.query(
      `SELECT 
        c.connection_id,
        c.connection_name,
        c.protocol,
        cp_host.parameter_value as hostname,
        cp_port.parameter_value as port
      FROM guacamole_connection c
      LEFT JOIN guacamole_connection_parameter cp_host 
        ON c.connection_id = cp_host.connection_id AND cp_host.parameter_name = 'hostname'
      LEFT JOIN guacamole_connection_parameter cp_port 
        ON c.connection_id = cp_port.connection_id AND cp_port.parameter_name = 'port'
      WHERE c.connection_name LIKE 'dashboard-%'
      ORDER BY c.connection_name`
    );
    
    await dbManager.close();
    
    res.json({
      connections: result.rows
    });
    
  } catch (error) {
    console.error('Fehler beim Abrufen der Verbindungen:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Verbindungen' });
  }
});

module.exports = router;
