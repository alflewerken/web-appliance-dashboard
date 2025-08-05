const mysql = require('mysql2/promise');
const fs = require('fs');

async function restoreCommandsSafe() {
  const connection = await mysql.createConnection({
    host: 'database',
    user: 'root',
    password: 'RWxLOzv3S3UHME0Q5qvr4z3X6xw4aBMg',
    database: 'appliance_dashboard'
  });
  
  console.log('=== SAFE COMMAND RESTORE ===');
  
  // Check existing hosts
  const [hosts] = await connection.execute('SELECT id, name FROM hosts');
  console.log('Existing hosts:');
  hosts.forEach(h => console.log(`  - ID ${h.id}: ${h.name}`));
  
  // Lade Backup
  const backup = JSON.parse(fs.readFileSync('/app/backup.json', 'utf8'));
  const commands = backup.data.appliance_commands;
  
  console.log(`\nFound ${commands.length} commands in backup`);
  
  // Helper function to convert datetime
  function convertDateTime(dateStr) {
    if (!dateStr) return null;
    return dateStr.replace('T', ' ').replace('.000Z', '');
  }
  
  // Filter for Nextcloud-Mac commands only
  const nextcloudCommands = commands.filter(cmd => cmd.appliance_id === 45);
  console.log(`Found ${nextcloudCommands.length} commands for Nextcloud-Mac`);
  
  // Restore Commands without host_id to avoid foreign key issues
  let restored = 0;
  for (const cmd of nextcloudCommands) {
    try {
      // Set host_id to null since the referenced host doesn't exist
      await connection.execute(
        `INSERT INTO appliance_commands 
         (appliance_id, description, command, host_id, order_index, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          cmd.appliance_id,
          cmd.description,
          cmd.command,
          null, // Set to null to avoid foreign key constraint
          cmd.order_index || 0,
          convertDateTime(cmd.created_at),
          convertDateTime(cmd.updated_at)
        ]
      );
      restored++;
      console.log(`Restored: ${cmd.description}`);
    } catch (error) {
      console.error(`Failed to restore command:`, error.message);
    }
  }
  
  console.log(`\nSuccessfully restored ${restored} commands for Nextcloud-Mac`);
  
  // Verify
  const [verify] = await connection.execute(
    'SELECT * FROM appliance_commands WHERE appliance_id = 45 ORDER BY id'
  );
  console.log(`\nNextcloud-Mac now has ${verify.length} commands:`);
  verify.forEach((cmd, i) => {
    console.log(`  ${i+1}. ${cmd.description}`);
    console.log(`     Command: ${cmd.command}`);
  });
  
  await connection.end();
}

restoreCommandsSafe().catch(console.error);
