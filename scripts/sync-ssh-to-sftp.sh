#!/bin/bash

# Sync SSH credentials from appliances to Guacamole SFTP

echo "========================================"
echo "Sync SSH Credentials to Guacamole SFTP"
echo "========================================"
echo ""

# Run Node.js script to sync credentials
docker exec -i appliance_backend node -e "
const pool = require('./utils/database');
const { decrypt } = require('./utils/crypto');
const GuacamoleDBManager = require('./utils/guacamole/GuacamoleDBManager');

async function syncSFTPCredentials() {
  try {
    // Get all appliances with SSH hosts
    const [appliances] = await pool.execute(\`
      SELECT 
        a.id,
        a.name,
        a.ssh_host_id,
        h.hostname as ssh_hostname,
        h.username as ssh_username,
        h.password_encrypted as ssh_password_encrypted
      FROM appliances a
      JOIN ssh_hosts h ON a.ssh_host_id = h.id
      WHERE a.remote_desktop_enabled = 1
    \`);
    
    console.log(\`Found \${appliances.length} appliances with SSH configuration\`);
    
    const dbManager = new GuacamoleDBManager();
    const client = await dbManager.pool.connect();
    
    try {
      for (const appliance of appliances) {
        console.log(\`\\nProcessing appliance \${appliance.id}: \${appliance.name}\`);
        
        // Decrypt SSH password
        let sshPassword = '';
        if (appliance.ssh_password_encrypted) {
          try {
            sshPassword = decrypt(appliance.ssh_password_encrypted);
            console.log('  - SSH password decrypted successfully');
          } catch (error) {
            console.error('  - Failed to decrypt SSH password:', error.message);
            continue;
          }
        }
        
        // Update SFTP parameters in Guacamole
        const connectionName = \`dashboard-\${appliance.id}\`;
        
        // Get connection ID
        const connResult = await client.query(
          'SELECT connection_id FROM guacamole_connection WHERE connection_name = \$1',
          [connectionName]
        );
        
        if (connResult.rows.length > 0) {
          const connectionId = connResult.rows[0].connection_id;
          console.log(\`  - Found Guacamole connection ID: \${connectionId}\`);
          
          // Update SFTP parameters
          const params = {
            'sftp-hostname': appliance.ssh_hostname,
            'sftp-username': appliance.ssh_username,
            'sftp-password': sshPassword,
            'sftp-port': '22',
            'enable-sftp': 'true',
            'sftp-root-directory': \`/home/\${appliance.ssh_username}/Desktop\`,
            'sftp-disable-host-key-checking': 'true'
          };
          
          for (const [key, value] of Object.entries(params)) {
            await client.query(
              \`INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
               VALUES (\$1, \$2, \$3)
               ON CONFLICT (connection_id, parameter_name) 
               DO UPDATE SET parameter_value = \$3\`,
              [connectionId, key, value]
            );
          }
          
          console.log('  - SFTP parameters updated successfully');
        } else {
          console.log('  - No Guacamole connection found');
        }
      }
    } finally {
      client.release();
      await dbManager.close();
    }
    
    console.log('\\nAll appliances processed!');
  } catch (error) {
    console.error('Error during sync:', error);
  } finally {
    process.exit(0);
  }
}

syncSFTPCredentials();
"

echo ""
echo "Restarting Guacamole services..."
docker-compose restart guacd guacamole

echo ""
echo "========================================"
echo "✅ SSH Credentials synced to SFTP!"
echo "========================================"
echo ""
echo "Die SFTP-Verbindung nutzt jetzt die in der App"
echo "gespeicherten SSH-Zugangsdaten!"
echo ""
echo "Bitte Browser-Cache leeren und neu verbinden."
