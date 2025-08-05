const mysql = require('mysql2/promise');

async function checkAllTables() {
  const connection = await mysql.createConnection({
    host: 'database',
    user: 'root',
    password: 'RWxLOzv3S3UHME0Q5qvr4z3X6xw4aBMg',
    database: 'appliance_dashboard'
  });
  
  console.log('=== ALL TABLES IN DATABASE ===');
  const [tables] = await connection.execute("SHOW TABLES");
  console.log(`Total tables: ${tables.length}`);
  tables.forEach(table => {
    const tableName = Object.values(table)[0];
    console.log(`- ${tableName}`);
  });
  
  // Prüfe ob es eine appliances Tabelle gibt
  console.log('\n=== Checking for appliances table ===');
  try {
    const [appliances] = await connection.execute("SELECT * FROM appliances LIMIT 10");
    console.log(`Found ${appliances.length} appliances`);
    appliances.forEach(app => {
      console.log(`- ${app.name || app.title || JSON.stringify(app).substring(0, 100)}`);
    });
  } catch (e) {
    console.log('No appliances table found');
  }
  
  // Prüfe commands Tabelle
  console.log('\n=== Checking for commands table ===');
  try {
    const [commands] = await connection.execute("SELECT * FROM commands LIMIT 10");
    console.log(`Found ${commands.length} commands`);
  } catch (e) {
    console.log('No commands table found');
  }
  
  await connection.end();
}

checkAllTables().catch(console.error);
