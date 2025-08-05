const mysql = require('mysql2/promise');

async function checkNextcloudCommands() {
  const connection = await mysql.createConnection({
    host: 'database',
    user: 'root',
    password: 'RWxLOzv3S3UHME0Q5qvr4z3X6xw4aBMg',
    database: 'appliance_dashboard'
  });
  
  console.log('=== Finding Nextcloud Appliances ===');
  const [appliances] = await connection.execute("SELECT * FROM appliances WHERE name LIKE '%Nextcloud%'");
  console.log(`Found ${appliances.length} Nextcloud appliances:`);
  appliances.forEach(app => {
    console.log(`\nAppliance: ${app.name} (ID: ${app.id})`);
    console.log(`  URL: ${app.url}`);
    console.log(`  Icon: ${app.icon}`);
  });
  
  // Zeige Struktur der appliance_commands Tabelle
  console.log('\n=== appliance_commands table structure ===');
  const [columns] = await connection.execute("SHOW COLUMNS FROM appliance_commands");
  columns.forEach(col => console.log(`- ${col.Field} (${col.Type})`));
  
  // Zeige Commands für Nextcloud
  if (appliances.length > 0) {
    for (const app of appliances) {
      console.log(`\n=== Commands for ${app.name} (ID: ${app.id}) ===`);
      const [commands] = await connection.execute(
        'SELECT * FROM appliance_commands WHERE appliance_id = ?', 
        [app.id]
      );
      console.log(`Found ${commands.length} commands:`);
      commands.forEach((cmd, i) => {
        console.log(`\nCommand ${i+1}:`);
        console.log(`  ID: ${cmd.id}`);
        console.log(`  Description: ${cmd.description}`);
        console.log(`  Command: ${cmd.command}`);
        console.log(`  Host ID: ${cmd.host_id}`);
      });
    }
  }
  
  // Zeige ALLE Commands
  console.log('\n=== ALL Commands in appliance_commands ===');
  const [allCommands] = await connection.execute(`
    SELECT ac.*, a.name as appliance_name 
    FROM appliance_commands ac 
    LEFT JOIN appliances a ON ac.appliance_id = a.id
    ORDER BY a.name, ac.description
  `);
  console.log(`Total commands: ${allCommands.length}`);
  allCommands.forEach(cmd => {
    console.log(`\n- Appliance: ${cmd.appliance_name} (ID: ${cmd.appliance_id})`);
    console.log(`  Description: ${cmd.description}`);
    console.log(`  Command: ${cmd.command}`);
  });
  
  await connection.end();
}

checkNextcloudCommands().catch(console.error);
