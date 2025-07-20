// Guacamole Backup Manager - Handles backup/restore of Guacamole connections
const { Pool } = require('pg');

class GuacamoleBackupManager {
  constructor() {
    // Connection to Guacamole PostgreSQL database
    this.pool = new Pool({
      host: process.env.GUACAMOLE_DB_HOST || 'appliance_guacamole_db',
      port: 5432,
      database: process.env.GUACAMOLE_DB_NAME || 'guacamole_db',
      user: process.env.GUACAMOLE_DB_USER || 'guacamole_user',
      password: process.env.GUACAMOLE_DB_PASSWORD || 'guacamole_pass123'
    });
  }

  /**
   * Export all Guacamole connections related to dashboard appliances
   */
  async exportConnections() {
    const client = await this.pool.connect();
    try {
      // Get all connections that start with 'dashboard-'
      const connectionsResult = await client.query(`
        SELECT 
          c.connection_id,
          c.connection_name,
          c.protocol,
          c.parent_id,
          c.max_connections,
          c.max_connections_per_user,
          c.weight,
          c.failover_only
        FROM guacamole_connection c
        WHERE c.connection_name LIKE 'dashboard-%'
        ORDER BY c.connection_id
      `);

      const connections = connectionsResult.rows;
      const connectionData = [];

      // For each connection, get its parameters
      for (const conn of connections) {
        const paramsResult = await client.query(`
          SELECT parameter_name, parameter_value
          FROM guacamole_connection_parameter
          WHERE connection_id = $1
          ORDER BY parameter_name
        `, [conn.connection_id]);

        const parameters = {};
        paramsResult.rows.forEach(row => {
          parameters[row.parameter_name] = row.parameter_value;
        });

        // Get permissions
        const permsResult = await client.query(`
          SELECT 
            e.name as entity_name,
            e.type as entity_type,
            p.permission
          FROM guacamole_connection_permission p
          JOIN guacamole_entity e ON p.entity_id = e.entity_id
          WHERE p.connection_id = $1
          ORDER BY e.type, e.name
        `, [conn.connection_id]);

        connectionData.push({
          ...conn,
          parameters,
          permissions: permsResult.rows
        });
      }

      console.log(`✅ Exported ${connectionData.length} Guacamole connections`);
      return connectionData;

    } catch (error) {
      console.error('Error exporting Guacamole connections:', error);
      return [];
    } finally {
      client.release();
    }
  }

  /**
   * Import Guacamole connections from backup
   */
  async importConnections(connections) {
    if (!connections || connections.length === 0) {
      console.log('No Guacamole connections to import');
      return { imported: 0, errors: 0 };
    }

    const client = await this.pool.connect();
    let imported = 0;
    let errors = 0;

    try {
      await client.query('BEGIN');

      // Delete existing dashboard connections
      await client.query(`
        DELETE FROM guacamole_connection 
        WHERE connection_name LIKE 'dashboard-%'
      `);

      // Import each connection
      for (const conn of connections) {
        try {
          // Insert connection
          const insertResult = await client.query(`
            INSERT INTO guacamole_connection 
            (connection_name, protocol, parent_id, max_connections, 
             max_connections_per_user, weight, failover_only)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING connection_id
          `, [
            conn.connection_name,
            conn.protocol,
            conn.parent_id,
            conn.max_connections,
            conn.max_connections_per_user,
            conn.weight || 1,
            conn.failover_only || false
          ]);

          const newConnectionId = insertResult.rows[0].connection_id;

          // Insert parameters
          if (conn.parameters) {
            for (const [paramName, paramValue] of Object.entries(conn.parameters)) {
              await client.query(`
                INSERT INTO guacamole_connection_parameter
                (connection_id, parameter_name, parameter_value)
                VALUES ($1, $2, $3)
              `, [newConnectionId, paramName, paramValue]);
            }
          }

          // Insert permissions
          if (conn.permissions) {
            for (const perm of conn.permissions) {
              // Find entity ID by name and type
              const entityResult = await client.query(`
                SELECT entity_id FROM guacamole_entity
                WHERE name = $1 AND type = $2
                LIMIT 1
              `, [perm.entity_name, perm.entity_type]);

              if (entityResult.rows.length > 0) {
                await client.query(`
                  INSERT INTO guacamole_connection_permission
                  (entity_id, connection_id, permission)
                  VALUES ($1, $2, $3)
                  ON CONFLICT DO NOTHING
                `, [entityResult.rows[0].entity_id, newConnectionId, perm.permission]);
              }
            }
          }

          imported++;
          console.log(`✅ Imported Guacamole connection: ${conn.connection_name}`);
        } catch (error) {
          errors++;
          console.error(`❌ Error importing connection ${conn.connection_name}:`, error.message);
        }
      }

      await client.query('COMMIT');
      console.log(`✅ Imported ${imported} Guacamole connections, ${errors} errors`);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error importing Guacamole connections:', error);
      throw error;
    } finally {
      client.release();
    }

    return { imported, errors };
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

  /**
   * Close the connection pool
   */
  async close() {
    await this.pool.end();
  }
}

module.exports = GuacamoleBackupManager;