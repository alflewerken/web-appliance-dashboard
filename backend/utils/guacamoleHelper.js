const GuacamoleDBManager = require('./guacamole/GuacamoleDBManager');
const { decrypt } = require('./crypto');
const pool = require('./database');

/**
 * Erstellt oder aktualisiert eine Guacamole-Verbindung basierend auf den Appliance-Daten
 * @param {Object} appliance - Die Appliance-Daten aus der Datenbank
 * @returns {Promise<void>}
 */
async function syncGuacamoleConnection(appliance) {
  // Nur verarbeiten, wenn Remote Desktop aktiviert ist
  if (!appliance.remote_desktop_enabled || !appliance.remote_host) {
    console.log(`Skipping Guacamole sync for appliance ${appliance.id} - Remote Desktop not enabled or no host configured`);
    return;
  }

  try {
    // Entschlüssele das Passwort, falls vorhanden
    let decryptedPassword = null;
    if (appliance.remote_password_encrypted) {
      try {
        decryptedPassword = decrypt(appliance.remote_password_encrypted);
      } catch (error) {
        console.error(`Failed to decrypt password for appliance ${appliance.id}:`, error.message);
      }
    }

    // SSH functionality moved to hosts table - no longer needed
    // Appliances should have direct remote desktop configuration

    const dbManager = new GuacamoleDBManager();
    
    try {
      const connectionConfig = {
        protocol: appliance.remote_protocol || 'vnc',
        hostname: appliance.remote_host,
        port: appliance.remote_port || (appliance.remote_protocol === 'vnc' ? 5900 : 3389),
        username: appliance.remote_username || '',
        password: decryptedPassword || ''
      };
      
      // Erstelle oder aktualisiere die Verbindung
      await dbManager.createOrUpdateConnection(appliance.id, connectionConfig);
      
      console.log(`Successfully synced Guacamole connection for appliance ${appliance.id}`);
    } finally {
      await dbManager.close();
    }
  } catch (error) {
    console.error(`Failed to sync Guacamole connection for appliance ${appliance.id}:`, error.message);
    // Don't throw - we don't want to fail the appliance save operation
  }
}

/**
 * Löscht eine Guacamole-Verbindung
 * @param {number} applianceId - Die ID der Appliance
 * @returns {Promise<void>}
 */
async function deleteGuacamoleConnection(applianceId) {
  const dbManager = new GuacamoleDBManager();
  
  try {
    const connectionName = `dashboard-${applianceId}`;
    const client = await dbManager.pool.connect();
    
    try {
      // Lösche die Verbindung
      await client.query(
        'DELETE FROM guacamole_connection WHERE connection_name = $1',
        [connectionName]
      );
      
      console.log(`Deleted Guacamole connection for appliance ${applianceId}`);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`Failed to delete Guacamole connection for appliance ${applianceId}:`, error.message);
  } finally {
    await dbManager.close();
  }
}

module.exports = {
  syncGuacamoleConnection,
  deleteGuacamoleConnection
};
