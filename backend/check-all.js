const mysql = require('mysql2/promise');

async function checkAll() {
  const connection = await mysql.createConnection({
    host: 'database',
    user: 'root',
    password: 'RWxLOzv3S3UHME0Q5qvr4z3X6xw4aBMg',
    database: 'appliance_dashboard'
  });
  
  console.log('=== All Services ===');
  const [services] = await connection.execute("SELECT * FROM services ORDER BY name");
  console.log(`Total services: ${services.length}`);
  services.forEach(s => {
    console.log(`\nService: ${s.name} (ID: ${s.id})`);
    console.log(`  URL: ${s.url}`);
    console.log(`  Category: ${s.category}`);
  });
  
  // Zeige auch Custom Commands
  console.log('\n=== All Custom Commands ===');
  const [commands] = await connection.execute(`
    SELECT cc.*, s.name as service_name 
    FROM custom_commands cc 
    JOIN services s ON cc.service_id = s.id 
    ORDER BY s.name, cc.description
  `);
  console.log(`Total commands: ${commands.length}`);
  commands.forEach(cmd => {
    console.log(`\nCommand: ${cmd.description}`);
    console.log(`  Service: ${cmd.service_name} (ID: ${cmd.service_id})`);
    console.log(`  Command: ${cmd.command}`);
    console.log(`  Host ID: ${cmd.host_id}`);
  });
  
  await connection.end();
}

checkAll().catch(console.error);
