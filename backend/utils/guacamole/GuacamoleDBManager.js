const { Pool } = require('pg');
const crypto = require('crypto');

class GuacamoleDBManager {
  constructor() {
    // Verbindung zur Guacamole PostgreSQL Datenbank
    this.pool = new Pool({
      host: process.env.GUACAMOLE_DB_HOST || 'appliance_guacamole_db',
      port: 5432,
      database: process.env.GUACAMOLE_DB_NAME || 'guacamole_db',
      user: process.env.GUACAMOLE_DB_USER || 'guacamole_user',
      password: process.env.GUACAMOLE_DB_PASSWORD || 'guacamole_pass123'
    });
  }

  /**
   * Erstellt oder aktualisiert eine Verbindung in Guacamole
   */
  async createOrUpdateConnection(applianceId, config) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Verbindungsname basierend auf Appliance
      const connectionName = `dashboard-${applianceId}`;
      
      // Prüfe ob Verbindung bereits existiert
      const existingConn = await client.query(
        'SELECT connection_id FROM guacamole_connection WHERE connection_name = $1',
        [connectionName]
      );

      let connectionId;
      
      if (existingConn.rows.length > 0) {
        // Update existierende Verbindung
        connectionId = existingConn.rows[0].connection_id;
        await client.query(
          'UPDATE guacamole_connection SET protocol = $1 WHERE connection_id = $2',
          [config.protocol, connectionId]
        );
      } else {
        // Erstelle neue Verbindung
        const result = await client.query(
          'INSERT INTO guacamole_connection (connection_name, protocol) VALUES ($1, $2) RETURNING connection_id',
          [connectionName, config.protocol]
        );
        connectionId = result.rows[0].connection_id;
      }

      // Lösche alte Parameter
      await client.query(
        'DELETE FROM guacamole_connection_parameter WHERE connection_id = $1',
        [connectionId]
      );

      // Setze neue Parameter
      const parameters = {
        hostname: config.hostname,
        port: config.port.toString()
      };

      if (config.password) {
        parameters.password = config.password;
      }

      if (config.username) {
        parameters.username = config.username;
      }

      // Zusätzliche Parameter je nach Protokoll
      if (config.protocol === 'vnc') {
        parameters.color_depth = '24';
      } else if (config.protocol === 'rdp') {
        parameters.security = 'any';
        parameters.ignore_cert = 'true';
        parameters.color_depth = '24';
        parameters.width = '1920';
        parameters.height = '1080';
      }

      // SFTP automatisch aktivieren mit den gleichen Credentials
      if (config.hostname && (config.protocol === 'vnc' || config.protocol === 'rdp')) {
        parameters['enable-sftp'] = 'true';
        
        // Verwende SSH-Credentials wenn verfügbar, sonst die Remote-Desktop-Credentials
        if (config.sshHostname) {
          parameters['sftp-hostname'] = config.sshHostname;
          parameters['sftp-username'] = config.sshUsername || config.username || '';
          parameters['sftp-password'] = config.sshPassword || config.password || '';
        } else {
          // Fallback: Verwende die gleichen Host/Credentials wie Remote Desktop
          parameters['sftp-hostname'] = config.hostname;
          parameters['sftp-username'] = config.username || '';
          parameters['sftp-password'] = config.password || '';
        }
        
        parameters['sftp-port'] = '22';
        
        // Standard Upload-Verzeichnis
        const sftpUsername = parameters['sftp-username'] || 'root';
        parameters['sftp-root-directory'] = `/home/${sftpUsername}/Desktop`;
        parameters['sftp-disable-download'] = 'false';
        parameters['sftp-disable-upload'] = 'false';
      }

      // Füge alle Parameter ein (inkl. Performance-Optimierungen)
      const allParameters = { ...parameters };
      
      // Füge zusätzliche config Parameter hinzu (z.B. Performance-Optimierungen)
      for (const [key, value] of Object.entries(config)) {
        // Überspringe bereits verarbeitete Felder
        if (!['protocol', 'hostname', 'port', 'username', 'password', 
             'sshHostname', 'sshUsername', 'sshPassword'].includes(key)) {
          allParameters[key] = value;
        }
      }
      
      for (const [key, value] of Object.entries(allParameters)) {
        await client.query(
          'INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value) VALUES ($1, $2, $3)',
          [connectionId, key, value]
        );
      }

      // Gebe allen Benutzern Leserechte (für Demo)
      // In Produktion sollte dies auf spezifische Benutzer beschränkt werden
      await client.query(`
        INSERT INTO guacamole_connection_permission (entity_id, connection_id, permission)
        SELECT entity_id, $1, 'READ'
        FROM guacamole_entity 
        WHERE type = 'USER'
        ON CONFLICT DO NOTHING
      `, [connectionId]);

      await client.query('COMMIT');
      
      // Hole den kompletten Verbindungsnamen für die URL
      const connectionResult = await client.query(
        'SELECT connection_name FROM guacamole_connection WHERE connection_id = $1',
        [connectionId]
      );
      
      return {
        connectionId: connectionId,
        connectionName: connectionResult.rows[0].connection_name
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Holt eine Verbindung anhand des Namens
   */
  async getConnectionByName(connectionName) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT connection_id, connection_name, protocol FROM guacamole_connection WHERE connection_name = $1',
        [connectionName]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Erstellt eine neue Verbindung
   */
  async createConnection(connectionData) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Erstelle Verbindung
      const result = await client.query(
        'INSERT INTO guacamole_connection (connection_name, protocol) VALUES ($1, $2) RETURNING connection_id',
        [connectionData.connection_name, connectionData.protocol]
      );
      const connectionId = result.rows[0].connection_id;

      // Setze Parameter
      for (const [key, value] of Object.entries(connectionData.parameters)) {
        await client.query(
          'INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value) VALUES ($1, $2, $3)',
          [connectionId, key, value]
        );
      }

      await client.query('COMMIT');
      return connectionId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Aktualisiert eine bestehende Verbindung
   */
  async updateConnection(connectionId, connectionData) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      console.log(`[GuacamoleDB] Updating connection ${connectionId} with data:`, {
        protocol: connectionData.protocol,
        parameterCount: Object.keys(connectionData.parameters).length,
        parameters: Object.keys(connectionData.parameters).map(key => ({
          name: key,
          hasValue: !!connectionData.parameters[key],
          valueLength: connectionData.parameters[key]?.toString().length || 0
        }))
      });

      // Update Protokoll falls geändert
      if (connectionData.protocol) {
        await client.query(
          'UPDATE guacamole_connection SET protocol = $1 WHERE connection_id = $2',
          [connectionData.protocol, connectionId]
        );
      }

      // Lösche alte Parameter
      await client.query(
        'DELETE FROM guacamole_connection_parameter WHERE connection_id = $1',
        [connectionId]
      );

      // Setze neue Parameter
      for (const [key, value] of Object.entries(connectionData.parameters)) {
        console.log(`[GuacamoleDB] Setting parameter ${key} = ${key === 'password' ? '[HIDDEN]' : value}`);
        await client.query(
          'INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value) VALUES ($1, $2, $3)',
          [connectionId, key, value]
        );
      }

      await client.query('COMMIT');
      console.log(`[GuacamoleDB] Successfully updated connection ${connectionId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`[GuacamoleDB] Error updating connection ${connectionId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Löscht eine Verbindung
   */
  async deleteConnection(connectionId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Lösche Parameter
      await client.query(
        'DELETE FROM guacamole_connection_parameter WHERE connection_id = $1',
        [connectionId]
      );

      // Lösche Berechtigungen
      await client.query(
        'DELETE FROM guacamole_connection_permission WHERE connection_id = $1',
        [connectionId]
      );

      // Lösche Verbindung
      await client.query(
        'DELETE FROM guacamole_connection WHERE connection_id = $1',
        [connectionId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Vergibt Berechtigung für eine Verbindung
   */
  async grantConnectionPermission(entityId, connectionId, permission) {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO guacamole_connection_permission (entity_id, connection_id, permission) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (entity_id, connection_id, permission) DO NOTHING`,
        [entityId, connectionId, permission]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Holt Guacamole User Token für direkten Zugriff
   */
  async getAdminToken() {
    const client = await this.pool.connect();
    try {
      // Hole Admin User Entity
      const result = await client.query(`
        SELECT e.entity_id, u.password_salt, u.password_hash 
        FROM guacamole_user u
        JOIN guacamole_entity e ON u.entity_id = e.entity_id
        WHERE e.name = 'guacadmin'
      `);

      if (result.rows.length === 0) {
        throw new Error('Admin user not found');
      }

      // Generiere Token für Admin-Zugriff
      // Dies ist eine vereinfachte Version - in Produktion sollte die korrekte Guacamole API verwendet werden
      const token = crypto.randomBytes(32).toString('hex').toUpperCase();
      
      return token;
    } finally {
      client.release();
    }
  }

  /**
   * Check if Guacamole database is accessible
   */
  async isAvailable() {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      console.warn('Guacamole database not available:', error.message);
      return false;
    }
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = GuacamoleDBManager;
