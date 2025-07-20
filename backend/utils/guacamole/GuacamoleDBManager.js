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

      // Füge alle Parameter ein
      for (const [key, value] of Object.entries(parameters)) {
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
