// Script to recreate Guacamole connections after restore
const pool = require('../utils/database');
const GuacamoleDBManager = require('../utils/guacamole/GuacamoleDBManager');
const { decrypt } = require('../utils/crypto');

async function recreateGuacamoleConnections() {
  console.log('🔄 Recreating Guacamole connections after restore...');
  
  const dbManager = new GuacamoleDBManager();
  let recreatedCount = 0;
  let errorCount = 0;

  try {
    // Check if Guacamole is available
    const isAvailable = await dbManager.isAvailable();
    if (!isAvailable) {
      console.log('⚠️ Guacamole database not available, skipping connection recreation');
      return { recreated: 0, errors: 0, skipped: true };
    }

    // Get all appliances with remote desktop enabled
    const [appliances] = await pool.execute(
      'SELECT * FROM appliances WHERE remote_desktop_enabled = 1'
    );

    console.log(`Found ${appliances.length} appliances with remote desktop enabled`);

    // Recreate connection for each appliance
    for (const appliance of appliances) {
      try {
        // Decrypt password if exists
        let decryptedPassword = null;
        if (appliance.remote_password_encrypted) {
          try {
            decryptedPassword = decrypt(appliance.remote_password_encrypted);
            console.log(`✅ Decrypted password for appliance ${appliance.id}: [${decryptedPassword ? 'SUCCESS' : 'EMPTY'}]`);
          } catch (error) {
            console.warn(`⚠️ Could not decrypt password for appliance ${appliance.id}:`, error.message);
            console.warn(`  Encrypted value was: ${appliance.remote_password_encrypted?.substring(0, 20)}...`); // Nur ersten Teil zeigen
          }
        } else {
          console.log(`⚠️ No encrypted password found for appliance ${appliance.id}`);
        }

        // Create or update the connection - NUR mit entschlüsseltem Passwort
        const connectionConfig = {
          protocol: appliance.remote_protocol || 'vnc',
          hostname: appliance.remote_host,
          port: appliance.remote_port || (appliance.remote_protocol === 'vnc' ? 5900 : 3389),
          username: appliance.remote_username || ''
        };
        
        // NUR wenn wir ein Passwort haben, fügen wir es hinzu
        if (decryptedPassword) {
          connectionConfig.password = decryptedPassword;
          console.log(`🔑 Setting password for appliance ${appliance.id} (${appliance.name})`);
        } else {
          console.warn(`⚠️ No password available for appliance ${appliance.id} (${appliance.name}) - connection will require manual password entry`);
        }

        await dbManager.createOrUpdateConnection(appliance.id, connectionConfig);remote_protocol === 'vnc' ? 5900 : 3389),
          username: appliance.remote_username || '',
          password: decryptedPassword || 'indigo'  // Fallback zu 'indigo' wenn kein Passwort
        });

        recreatedCount++;
        console.log(`✅ Recreated Guacamole connection for appliance: ${appliance.name} (ID: ${appliance.id})`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to recreate connection for appliance ${appliance.name}:`, error.message);
      }
    }

  } catch (error) {
    console.error('Error recreating Guacamole connections:', error);
    throw error;
  } finally {
    await dbManager.close();
  }

  console.log(`✅ Recreated ${recreatedCount} Guacamole connections, ${errorCount} errors`);
  return { recreated: recreatedCount, errors: errorCount, skipped: false };
}

// Export for use in other modules
module.exports = { recreateGuacamoleConnections };

// Run if called directly
if (require.main === module) {
  recreateGuacamoleConnections()
    .then(result => {
      console.log('Done!', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}