const mysql = require('mysql2/promise');

async function addTestCommands() {
  const connection = await mysql.createConnection({
    host: 'database',
    user: 'root',
    password: 'RWxLOzv3S3UHME0Q5qvr4z3X6xw4aBMg',
    database: 'appliance_dashboard'
  });
  
  console.log('=== Adding test commands for Nextcloud-Mac ===');
  
  // Prüfe ob Nextcloud-Mac existiert
  const [appliances] = await connection.execute(
    "SELECT * FROM appliances WHERE name = 'Nextcloud-Mac'"
  );
  
  if (appliances.length === 0) {
    console.log('ERROR: Nextcloud-Mac not found!');
    await connection.end();
    return;
  }
  
  const applianceId = appliances[0].id;
  console.log(`Found Nextcloud-Mac with ID: ${applianceId}`);
  
  // Füge Test-Commands hinzu
  const commands = [
    {
      description: 'Nextcloud Status prüfen',
      command: 'docker ps | grep nextcloud',
      host_id: null
    },
    {
      description: 'Nextcloud Logs anzeigen',
      command: 'docker logs nextcloud-app --tail 50',
      host_id: null
    },
    {
      description: 'Speicherplatz prüfen',
      command: 'df -h | grep -E "/$|/data"',
      host_id: null
    }
  ];
  
  for (const cmd of commands) {
    try {
      await connection.execute(
        'INSERT INTO appliance_commands (appliance_id, description, command, host_id) VALUES (?, ?, ?, ?)',
        [applianceId, cmd.description, cmd.command, cmd.host_id]
      );
      console.log(`Added command: ${cmd.description}`);
    } catch (error) {
      console.error(`Error adding command: ${cmd.description}`, error.message);
    }
  }
  
  // Zeige alle Commands für Nextcloud-Mac
  const [allCommands] = await connection.execute(
    'SELECT * FROM appliance_commands WHERE appliance_id = ?',
    [applianceId]
  );
  
  console.log(`\nTotal commands for Nextcloud-Mac: ${allCommands.length}`);
  allCommands.forEach(cmd => {
    console.log(`- ${cmd.description}: ${cmd.command}`);
  });
  
  await connection.end();
}

addTestCommands().catch(console.error);
