const mysql = require('mysql2/promise');

async function checkDatabase() {
  const connection = await mysql.createConnection({
    host: 'database',
    user: 'root',
    password: 'RWxLOzv3S3UHME0Q5qvr4z3X6xw4aBMg',
    database: 'appliance_dashboard'
  });
  
  console.log('=== Table Structure ===');
  // Zeige Struktur der services Tabelle
  const [columns] = await connection.execute("SHOW COLUMNS FROM services");
  console.log('\nServices table columns:');
  columns.forEach(col => console.log(`- ${col.Field} (${col.Type})`));
  
  console.log('\n=== ALL Services ===');
  const [services] = await connection.execute("SELECT id, name FROM services ORDER BY name");
  console.log(`Total services: ${services.length}`);
  services.forEach(s => {
    console.log(`- ${s.name} (ID: ${s.id})`);
  });
  
  console.log('\n=== Custom Commands Table Structure ===');
  const [cmdColumns] = await connection.execute("SHOW COLUMNS FROM custom_commands");
  console.log('Custom commands table columns:');
  cmdColumns.forEach(col => console.log(`- ${col.Field} (${col.Type})`));
  
  console.log('\n=== ALL Custom Commands ===');
  const [commands] = await connection.execute("SELECT * FROM custom_commands");
  console.log(`Total commands: ${commands.length}`);
  commands.forEach((cmd, i) => {
    console.log(`\nCommand ${i+1}:`);
    console.log(`  Service ID: ${cmd.service_id}`);
    console.log(`  Description: ${cmd.description}`);
    console.log(`  Command: ${cmd.command}`);
  });
  
  await connection.end();
}

checkDatabase().catch(console.error);
