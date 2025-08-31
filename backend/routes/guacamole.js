const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');
const db = new QueryBuilder(pool);
const { createAuditLog } = require('../utils/auditLogger');
const { decrypt } = require('../utils/encryption');
const { getClientIp } = require('../utils/getClientIp');
const GuacamoleDBManager = require('../utils/guacamole/GuacamoleDBManager');
const { getGuacamoleUrl } = require('../utils/guacamoleUrlHelper');
const { getOptimizedConnectionParams } = require('../utils/guacamoleOptimizer');

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

    return token;
  } catch (error) {
    console.error('Failed to get Guacamole auth token:', error.message);
    throw new Error('Guacamole authentication failed');
  }
}

/**
 * Test-Route für Guacamole Token
 */
router.get('/test-connection/:applianceId', async (req, res) => {
  try {
    const { applianceId } = req.params;
    
    // Hole Guacamole Auth Token
    const authToken = await getGuacamoleAuthToken();
    
    // Hole Connection aus der Datenbank
    const dbManager = new GuacamoleDBManager();
    const connectionResult = await dbManager.pool.query(
      'SELECT connection_id FROM guacamole_connection WHERE connection_name = $1',
      [`dashboard-${applianceId}`]
    );
    await dbManager.close();
    
    if (!connectionResult.rows || connectionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    const connectionId = connectionResult.rows[0].connection_id;
    
    // Generiere Identifier
    const identifier = Buffer.from(`${connectionId}\0c\0postgresql`).toString('base64');
    const encodedIdentifier = encodeURIComponent(identifier);
    
    // Generiere URLs
    const publicUrl = `http://localhost:9080/guacamole/?token=${encodeURIComponent(authToken)}#/client/${encodedIdentifier}`;
    const directUrl = `http://localhost:9080/guacamole/#/client/${encodedIdentifier}`;
    
    res.json({
      success: true,
      connectionId,
      identifier,
      encodedIdentifier,
      token: authToken,
      urls: {
        withToken: publicUrl,
        direct: directUrl,
        loginFirst: `http://localhost:9080/guacamole/`
      },
      debug: {
        connectionName: `dashboard-${applianceId}`,
        tokenLength: authToken.length,
        identifierDecoded: `${connectionId}\\0c\\0postgresql`
      }
    });
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Erstellt einen direkten Link zu einer Guacamole-Verbindung mit automatischer Authentifizierung
 */
router.post('/token/:applianceId', async (req, res) => {
  try {

    const { applianceId } = req.params;
    const { performanceMode = 'balanced' } = req.body; // Neu: Performance Mode
    
    // Prüfe ob req.user existiert
    if (!req.user || !req.user.id) {
      console.error('[GUACAMOLE] req.user is missing or incomplete:', req.user);
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userId = req.user.id;
    
    // Prüfe ob Appliance existiert
    const appliances = await db.select('appliances', 
      { id: applianceId },
      { limit: 1 }
    );
    
    if (appliances.length === 0) {
      return res.status(403).json({ error: 'Keine Berechtigung für diese Appliance' });
    }
    
    const appliance = appliances[0];
    
    if (!appliance.remoteDesktopEnabled) {
      return res.status(400).json({ error: 'Remote Desktop ist für diese Appliance nicht aktiviert' });
    }
    
    // Check if RustDesk is configured instead of Guacamole
    if (appliance.remoteDesktopType === 'rustdesk') {
      return res.status(400).json({ 
        error: 'Diese Appliance verwendet RustDesk. Bitte nutzen Sie den RustDesk Button.',
        type: 'rustdesk'
      });
    }
    
    try {
      // Entschlüssele Passwort
      let decryptedPassword = null;
      if (appliance.remotePasswordEncrypted) {
        try {
          decryptedPassword = decrypt(appliance.remotePasswordEncrypted);
        } catch (error) {
          console.error('Fehler beim Entschlüsseln des Passworts:', error);
        }
      }
      
      // Erstelle oder aktualisiere die Verbindung
      const dbManager = new GuacamoleDBManager();
      
      // Hole optimierte Connection Parameter
      const optimizedParams = getOptimizedConnectionParams(
        appliance.remoteProtocol, 
        performanceMode
      );
      
      const connectionInfo = await dbManager.createOrUpdateConnection(applianceId, {
        protocol: appliance.remoteProtocol,
        hostname: appliance.remoteHost,
        port: appliance.remotePort || (appliance.remoteProtocol === 'vnc' ? 5900 : 3389),
        username: appliance.remoteUsername || '',
        password: decryptedPassword || '',
        ...optimizedParams // Füge Performance-Optimierungen hinzu
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
      let authToken;
      try {
        authToken = await getGuacamoleAuthToken();
      } catch (error) {
        console.error('Failed to get token, trying with fresh token:', error);
        // Bei Fehler versuche es mit einem neuen Token
        authToken = await getGuacamoleAuthToken(true);
      }
      
      // Generiere URL - IMMER über Port 9080
      const baseUrl = getGuacamoleUrl(req);
      const guacamoleUrl = `${baseUrl}/guacamole`;
      
      // Erstelle die korrekte Guacamole-URL mit Token
      // WICHTIG: Token muss als Query-Parameter VOR dem Hash sein!
      const identifier = Buffer.from(`${connectionId}\0c\0postgresql`).toString('base64');
      const encodedIdentifier = encodeURIComponent(identifier);
      
      // Alternative URL-Struktur, die besser funktionieren könnte
      // Verwende die Session-basierte URL statt Token im Fragment
      const connectionUrl = `${guacamoleUrl}/?token=${encodeURIComponent(authToken)}#/client/${encodedIdentifier}`;
      
      // Fallback: Direkte Client-URL (nach manuellem Login)
      const directClientUrl = `${guacamoleUrl}/#/client/${encodedIdentifier}`;

      // Audit Log
      await createAuditLog(
        userId,
        'remote_desktop_access',
        'appliances',
        applianceId,
        { 
          appliance_name: appliance.name,
          protocol: appliance.remoteProtocol,
          host: appliance.remoteHost,
          connectionName: connectionInfo.connectionName,
          connectionId: connectionId
        },
        getClientIp(req),
        appliance.name  // Add resource name for display
      );
      
      // Gebe URL mit Token zurück
      res.json({
        url: connectionUrl,
        directUrl: directClientUrl,  // Fallback URL nach manuellem Login
        needsLogin: false,
        hasToken: true,
        connectionId: connectionId,
        connectionName: connectionInfo.connectionName,
        instructions: 'Falls die automatische Anmeldung nicht funktioniert, melden Sie sich manuell mit guacadmin/guacadmin an.'
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
    // WICHTIG: Token muss VOR dem Hash sein!
    const redirectUrl = `${baseUrl}/guacamole/?token=${encodeURIComponent(authToken)}#/client/${encodedIdentifier}`;

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

/**
 * Clear Guacamole auth token cache
 * POST /api/guacamole/clear-cache
 */
router.post('/clear-cache', async (req, res) => {
  try {
    // Clear the auth token cache
    authTokenCache.clear();
    
    // Create audit log
    await createAuditLog(
      'admin',
      'guacamole',
      'cache_cleared',
      null,
      req.user?.id || 0,
      getClientIp(req),
      { message: 'Guacamole auth token cache cleared' },
      null
    );
    
    res.json({ 
      success: true, 
      message: 'Guacamole auth token cache cleared successfully' 
    });
  } catch (error) {
    console.error('Error clearing Guacamole cache:', error);
    res.status(500).json({ 
      error: 'Failed to clear Guacamole cache',
      details: error.message 
    });
  }
});

module.exports = router;
