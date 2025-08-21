const GuacamoleDBManager = require('./guacamole/GuacamoleDBManager');
const { decrypt } = require('./encryption');  // Use encryption.js, not crypto.js!
const pool = require('./database');

/**
 * Erstellt oder aktualisiert eine Guacamole-Verbindung basierend auf den Appliance/Host-Daten
 * @param {Object} data - Die Appliance/Host-Daten aus der Datenbank
 * @returns {Promise<void>}
 */
async function syncGuacamoleConnection(data) {
  // Handle both camelCase (hosts) and snake_case (appliances) field names
  const isEnabled = data.remote_desktop_enabled || data.remoteDesktopEnabled;
  const remoteHost = data.remote_host || data.hostname; // For hosts, use hostname as remote_host
  const remoteProtocol = data.remote_protocol || data.remoteProtocol;
  const remotePort = data.remote_port || data.remotePort;
  const remoteUsername = data.remote_username || data.remoteUsername;
  const remotePassword = data.remote_password_encrypted || data.remotePassword;
  const entityId = data.id;
  
  // Nur verarbeiten, wenn Remote Desktop aktiviert ist
  if (!isEnabled || !remoteHost) {
    console.log(`Skipping Guacamole sync for entity ${entityId} - Remote Desktop not enabled or no host configured`);
    return;
  }

  try {
    // Handle password - could be plain text (from form) or encrypted (from DB)
    let finalPassword = null;
    if (remotePassword) {
      // Check if it's encrypted (contains colon separator from encryption format)
      if (remotePassword.includes(':')) {
        try {
          // Try to decrypt if it appears to be encrypted
          finalPassword = decrypt(remotePassword);
          if (!finalPassword) {
            console.log(`Warning: Failed to decrypt password for entity ${entityId}`);
            finalPassword = '';
          }
        } catch (error) {
          console.error(`Failed to decrypt password for entity ${entityId}:`, error.message);
          finalPassword = '';
        }
      } else {
        // It's plain text password from the form
        finalPassword = remotePassword;
      }
    }

    const dbManager = new GuacamoleDBManager();
    
    try {
      const connectionConfig = {
        protocol: remoteProtocol || 'vnc',
        hostname: remoteHost,
        port: remotePort || (remoteProtocol === 'vnc' ? 5900 : 3389),
        username: remoteUsername || '',
        password: finalPassword || ''
      };
      
      // Erstelle oder aktualisiere die Verbindung
      await dbManager.createOrUpdateConnection(entityId, connectionConfig);
      
      console.log(`Successfully synced Guacamole connection for entity ${entityId}`);
    } finally {
      await dbManager.close();
    }
  } catch (error) {
    console.error(`Failed to sync Guacamole connection for entity ${entityId}:`, error.message);
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
