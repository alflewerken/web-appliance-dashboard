const mysql = require('mysql2/promise');

async function checkCommands() {
  const connection = await mysql.createConnection({
    host: 'database',
    user: 'root',
    password: 'RWxLOzv3S3UHME0Q5qvr4z3X6xw4aBMg',
    database: 'appliance_dashboard'
  });
  
  console.log('=== Checking Nextcloud Services ===');
  
  // Finde Service ID für Nextcloud
  const [services] = await connection.execute("SELECT id, name FROM services WHERE name LIKE '%Nextcloud%'");
  console.log('\nServices mit Nextcloud im Namen:');
  console.log(services);
  
  if (services.length > 0) {
    // Prüfe Commands für jeden gefundenen Service
    for (const service of services) {
      console.log(`\n--- Checking commands for Service: ${service.name} (ID: ${service.id}) ---`);
      const [commands] = await connection.execute('SELECT * FROM custom_commands WHERE service_id = ?', [service.id]);
      console.log(`Found ${commands.length} commands:`);
      if (commands.length > 0) {
        commands.forEach((cmd, index) => {
          console.log(`Command ${index + 1}:`, {
            id: cmd.id,
            description: cmd.description,
            command: cmd.command,
            host_id: cmd.host_id
          });
        });
      }
    }
  } else {
    console.log('No services found with "Nextcloud" in the name');
  }
  
  // Zeige auch alle Services
  console.log('\n=== All Services ===');
  const [allServices] = await connection.execute("SELECT id, name FROM services ORDER BY name");
  allServices.forEach(s => console.log(`- ${s.name} (ID: ${s.id})`));
  
  await connection.end();
}

checkCommands().catch(console.error);
