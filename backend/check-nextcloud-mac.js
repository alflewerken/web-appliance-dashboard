const mysql = require('mysql2/promise');

async function checkNextcloudMac() {
  const connection = await mysql.createConnection({
    host: 'database',
    user: 'root',
    password: 'RWxLOzv3S3UHME0Q5qvr4z3X6xw4aBMg',
    database: 'appliance_dashboard'
  });
  
  console.log('=== Searching for "Nextcloud-Mac" ===');
  
  // Suche nach exaktem Namen
  const [exactMatch] = await connection.execute("SELECT * FROM services WHERE name = 'Nextcloud-Mac'");
  console.log('\nExact match for "Nextcloud-Mac":');
  console.log(exactMatch);
  
  // Suche nach ähnlichen Namen
  const [likeMatch] = await connection.execute("SELECT id, name FROM services WHERE name LIKE '%Nextcloud%' OR name LIKE '%nextcloud%'");
  console.log('\nServices containing "Nextcloud" (case insensitive):');
  console.log(likeMatch);
  
  // Zeige ALLE Services
  console.log('\n=== ALL Services in Database ===');
  const [allServices] = await connection.execute("SELECT id, name, category FROM services ORDER BY name");
  allServices.forEach(s => {
    console.log(`- ${s.name} (ID: ${s.id}, Category: ${s.category})`);
  });
  
  // Wenn wir einen Service gefunden haben, zeige die Commands
  if (exactMatch.length > 0) {
    const serviceId = exactMatch[0].id;
    console.log(`\n=== Commands for "Nextcloud-Mac" (Service ID: ${serviceId}) ===`);
    const [commands] = await connection.execute('SELECT * FROM custom_commands WHERE service_id = ?', [serviceId]);
    console.log(`Found ${commands.length} commands:`);
    commands.forEach((cmd, index) => {
      console.log(`\nCommand ${index + 1}:`);
      console.log(`  ID: ${cmd.id}`);
      console.log(`  Description: ${cmd.description}`);
      console.log(`  Command: ${cmd.command}`);
      console.log(`  Host ID: ${cmd.host_id}`);
      console.log(`  Created: ${cmd.created_at}`);
    });
  }
  
  // Zeige auch die custom_commands Tabelle
  console.log('\n=== ALL Custom Commands in Database ===');
  const [allCommands] = await connection.execute(`
    SELECT cc.*, s.name as service_name 
    FROM custom_commands cc 
    LEFT JOIN services s ON cc.service_id = s.id 
    ORDER BY cc.service_id, cc.description
  `);
  console.log(`Total commands in database: ${allCommands.length}`);
  allCommands.forEach(cmd => {
    console.log(`\n- Service: ${cmd.service_name || 'UNKNOWN'} (Service ID: ${cmd.service_id})`);
    console.log(`  Description: ${cmd.description}`);
    console.log(`  Command: ${cmd.command}`);
  });
  
  await connection.end();
}

checkNextcloudMac().catch(console.error);
