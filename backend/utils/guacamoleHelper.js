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

    return;
  }

  try {
    // Handle password - could be plain text (from form) or encrypted (from DB)
    let finalPassword = null;
    
    // Use remotePassword for VNC/RDP password (not SSH password!)
    const vncPassword = remotePassword;  // This is the VNC/RDP password
    
    if (vncPassword) {
      // Check if it's encrypted (contains colon separator from encryption format)
      if (vncPassword.includes(':')) {
        try {
          // Try to decrypt if it appears to be encrypted
          finalPassword = decrypt(vncPassword);
          if (!finalPassword) {

            finalPassword = '';
          }
        } catch (error) {
          console.error(`Failed to decrypt VNC/RDP password for entity ${entityId}:`, error.message);
          finalPassword = '';
        }
      } else {
        // It's plain text password from the form
        finalPassword = vncPassword;
      }
    }
    
    // Handle SSH password for SFTP separately
    let sshPasswordDecrypted = null;
    if (data.sshPassword || data.password) {
      const sshPwd = data.sshPassword || data.password;
      if (sshPwd.includes(':')) {
        try {
          sshPasswordDecrypted = decrypt(sshPwd);
        } catch (error) {
          console.error(`Failed to decrypt SSH password for entity ${entityId}:`, error.message);
          sshPasswordDecrypted = '';
        }
      } else {
        sshPasswordDecrypted = sshPwd;
      }
    }

    const dbManager = new GuacamoleDBManager();
    
    try {
      const connectionConfig = {
        protocol: remoteProtocol || 'vnc',
        hostname: remoteHost,
        port: remotePort || (remoteProtocol === 'vnc' ? 5900 : 3389),
        username: remoteUsername || '',
        password: finalPassword || '',
        // SSH credentials für SFTP (wenn vorhanden) - bereits entschlüsselt
        sshHostname: data.sshHostname,
        sshUsername: data.sshUsername,
        sshPassword: sshPasswordDecrypted  // Verwende bereits entschlüsseltes SSH-Passwort
      };
      
      // Erstelle oder aktualisiere die Verbindung
      await dbManager.createOrUpdateConnection(entityId, connectionConfig);

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
