#!/bin/bash

# Re-sync all Guacamole connections to enable SFTP with correct credentials

echo "========================================="
echo "Re-syncing Guacamole connections with SFTP"
echo "========================================="
echo ""

# Docker container names
BACKEND_CONTAINER="appliance_backend"
DB_CONTAINER="appliance_database"

echo "1. Triggering re-sync of all appliances..."

# Execute Node.js script in backend container to re-sync all connections
docker exec -i $BACKEND_CONTAINER node -e "
const pool = require('./utils/database');
const { syncGuacamoleConnection } = require('./utils/guacamoleHelper');

async function resyncAll() {
  try {
    // Get all appliances with remote desktop enabled
    const [appliances] = await pool.execute(
      'SELECT * FROM appliances WHERE remote_desktop_enabled = 1'
    );
    
    console.log(\`Found \${appliances.length} appliances with remote desktop enabled\`);
    
    for (const appliance of appliances) {
      console.log(\`Syncing appliance \${appliance.id}: \${appliance.name}\`);
      await syncGuacamoleConnection(appliance);
    }
    
    console.log('All appliances synced successfully!');
  } catch (error) {
    console.error('Error during sync:', error);
  } finally {
    process.exit(0);
  }
}

resyncAll();
"

echo ""
echo "2. Restarting Guacamole to apply changes..."
docker-compose restart guacamole

echo ""
echo "========================================="
echo "✅ SFTP ist jetzt automatisch aktiviert!"
echo "========================================="
echo ""
echo "Die Dateiübertragung verwendet automatisch:"
echo "- SSH-Credentials wenn im Service konfiguriert"
echo "- Sonst die Remote Desktop Credentials"
echo ""
echo "Dateien landen standardmäßig auf dem Desktop!"
