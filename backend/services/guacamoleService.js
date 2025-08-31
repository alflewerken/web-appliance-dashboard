const pool = require('../utils/database');
const { logger } = require('../utils/logger');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const GuacamoleDBManager = require('../utils/guacamole/GuacamoleDBManager');
const axios = require('axios');
const { getOptimizedConnectionParams } = require('../utils/guacamoleOptimizer');
const { decrypt } = require('../utils/encryption');

class GuacamoleService {
  constructor() {
    // Keine DB-Verbindung nötig für diese vereinfachte Version
  }

  /**
   * Generiert ein temporäres Token für Guacamole-Zugriff
   * Nutzt GuacamoleDBManager für direkte DB-Operationen
   * @param {Object} user - Benutzer-Objekt
   * @param {number} hostId - Host ID
   * @returns {Object} - Token und Guacamole URL
   */
  async generateRemoteDesktopToken(user, hostId) {
    try {
      // Host-Daten laden - mit Benutzerprüfung
      const [hosts] = await pool.execute(
        'SELECT * FROM hosts WHERE id = ? AND created_by = ?',
        [hostId, user.id]
      );

      if (hosts.length === 0) {
        throw new Error('Host not found');
      }

      const host = hosts[0];

      if (!host.remote_desktop_enabled) {
        throw new Error('Remote desktop not enabled for this host');
      }

      // Erstelle oder aktualisiere die Verbindung in der Guacamole DB
      const dbManager = new GuacamoleDBManager();
      
      try {
        // Entschlüssele das Passwort falls es verschlüsselt ist
        let decryptedPassword = '';
        if (host.remote_password) {
          try {
            // Versuche zu entschlüsseln
            decryptedPassword = decrypt(host.remote_password);
          } catch (error) {
            // Falls Entschlüsselung fehlschlägt, ist es vielleicht schon Klartext
            logger.warn('Could not decrypt password, using as-is');
            decryptedPassword = host.remote_password;
          }
        }
        
        // Hole optimierte Connection Parameter
        const optimizedParams = getOptimizedConnectionParams(
          host.remote_protocol || 'vnc',
          'balanced' // Default performance mode
        );
        
        const connectionInfo = await dbManager.createOrUpdateConnection(`host-${hostId}`, {
          protocol: host.remote_protocol || 'vnc',
          hostname: host.hostname,
          port: host.remote_port || (host.remote_protocol === 'rdp' ? 3389 : 5900),
          username: host.remote_username || '',
          password: decryptedPassword,
          ...optimizedParams
        });
        
        // Hole die Connection ID aus der Datenbank
        const connectionResult = await dbManager.pool.query(
          'SELECT connection_id FROM guacamole_connection WHERE connection_name = $1',
          [`dashboard-host-${hostId}`]
        );
        
        if (!connectionResult.rows || connectionResult.rows.length === 0) {
          throw new Error('Connection not found in Guacamole database');
        }
        
        const connectionId = connectionResult.rows[0].connection_id;
        
        // Hole Guacamole Auth Token
        const authToken = await this.getGuacamoleAuthToken();
        
        // Generiere die direkte Client-URL
        const identifier = Buffer.from(`${connectionId}\0c\0postgresql`).toString('base64');
        const encodedIdentifier = encodeURIComponent(identifier);
        const guacamoleUrl = `/guacamole/#/client/${encodedIdentifier}?token=${encodeURIComponent(authToken)}`;
        
        return {
          success: true,
          token: authToken,
          guacamoleUrl: guacamoleUrl,
          protocol: host.remote_protocol || 'vnc',
          connectionParams: {
            hostname: host.hostname,
            port: host.remote_port || (host.remote_protocol === 'rdp' ? 3389 : 5900),
            protocol: host.remote_protocol || 'vnc',
            username: host.remote_username || null
          }
        };
        
      } finally {
        // Stelle sicher, dass die DB-Verbindung geschlossen wird
        await dbManager.close();
      }

    } catch (error) {
      logger.error('Error generating remote desktop token:', error);
      throw error;
    }
  }

  /**
   * Holt oder erstellt einen Guacamole Auth Token
   */
  async getGuacamoleAuthToken(forceNew = false) {
    // Check cache first
    if (!forceNew && this.authTokenCache && this.authTokenCache.expires > Date.now()) {
      return this.authTokenCache.token;
    }
    
    try {
      // Use service name from docker-compose (not container name)
      const guacamoleUrl = 'http://guacamole:8080/guacamole';
      
      const response = await axios.post(
        `${guacamoleUrl}/api/tokens`,
        new URLSearchParams({
          username: process.env.GUACAMOLE_ADMIN_USER || 'guacadmin',
          password: process.env.GUACAMOLE_ADMIN_PASS || 'guacadmin'
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
      this.authTokenCache = {
        token: token,
        expires: Date.now() + 30 * 60 * 1000
      };
      
      return token;
      
    } catch (error) {
      logger.error('Error getting Guacamole auth token:', error);
      throw error;
    }
  }

  /**
   * Placeholder für Host-Verbindung Update
   * In dieser vereinfachten Version nicht implementiert
   * @param {number} hostId - Host ID
   */
  async updateHostConnection(hostId) {
    try {
      logger.info(`Update host connection called for host ${hostId} - no action needed in simplified version`);
    } catch (error) {
      logger.error('Error updating host connection:', error);
      // Fehler nicht weitergeben
    }
  }
}

module.exports = new GuacamoleService();
