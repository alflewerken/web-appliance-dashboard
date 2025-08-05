const mysql = require('mysql2/promise');
const fs = require('fs');

async function restoreCommands() {
  const connection = await mysql.createConnection({
    host: 'database',
    user: 'root',
    password: 'RWxLOzv3S3UHME0Q5qvr4z3X6xw4aBMg',
    database: 'appliance_dashboard'
  });
  
  console.log('=== MANUAL COMMAND RESTORE ===');
  
  // Lade Backup
  const backup = JSON.parse(fs.readFileSync('/app/backup.json', 'utf8'));
  const commands = backup.data.appliance_commands;
  
  console.log(`Found ${commands.length} commands in backup`);
  
  // Helper function to convert datetime
  function convertDateTime(dateStr) {
    if (!dateStr) return null;
    // Convert from ISO format to MySQL format
    return dateStr.replace('T', ' ').replace('.000Z', '');
  }
  
  // Lösche existierende Commands
  await connection.execute('DELETE FROM appliance_commands');
  console.log('Cleared existing commands');
  
  // Restore Commands
  let restored = 0;
  for (const cmd of commands) {
    try {
      await connection.execute(
        `INSERT INTO appliance_commands 
         (id, appliance_id, description, command, host_id, order_index, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cmd.id,
          cmd.appliance_id,
          cmd.description,
          cmd.command,
          cmd.host_id || cmd.ssh_host_id || null,
          cmd.order_index || 0,
          convertDateTime(cmd.created_at),
          convertDateTime(cmd.updated_at)
        ]
      );
      restored++;
      console.log(`Restored: ${cmd.description}`);
    } catch (error) {
      console.error(`Failed to restore command ${cmd.id}:`, error.message);
    }
  }
  
  console.log(`\nSuccessfully restored ${restored} of ${commands.length} commands`);
  
  // Verify for Nextcloud-Mac
  const [verify] = await connection.execute(
    'SELECT * FROM appliance_commands WHERE appliance_id = 45'
  );
  console.log(`\nNextcloud-Mac now has ${verify.length} commands:`);
  verify.forEach(cmd => {
    console.log(`  - ${cmd.description}`);
  });
  
  // Set AUTO_INCREMENT
  const maxId = Math.max(...commands.map(c => c.id));
  await connection.execute(`ALTER TABLE appliance_commands AUTO_INCREMENT = ${maxId + 1}`);
  console.log(`\nSet AUTO_INCREMENT to ${maxId + 1}`);
  
  await connection.end();
}

restoreCommands().catch(console.error);
