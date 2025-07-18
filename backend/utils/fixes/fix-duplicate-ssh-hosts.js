// Script to handle duplicate SSH hosts issue
// Run with: node backend/utils/fixes/fix-duplicate-ssh-hosts.js

const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixDuplicateHosts() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'appliance_dashboard',
  });

  try {
    // Find all duplicate SSH hosts
    console.log('Finding duplicate SSH hosts...');
    
    const [duplicates] = await connection.execute(`
      SELECT host, username, port, COUNT(*) as count, 
             GROUP_CONCAT(id) as ids,
             GROUP_CONCAT(hostname) as hostnames,
             GROUP_CONCAT(CASE WHEN deleted_at IS NOT NULL THEN 'deleted' ELSE 'active' END) as statuses
      FROM ssh_hosts 
      GROUP BY host, username, port 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.length === 0) {
      console.log('No duplicates found!');
      return;
    }
    
    console.log(`Found ${duplicates.length} duplicate groups:`);
    
    for (const dup of duplicates) {
      console.log(`\n${dup.username}@${dup.host}:${dup.port} - ${dup.count} entries`);
      console.log(`IDs: ${dup.ids}`);
      console.log(`Hostnames: ${dup.hostnames}`);
      console.log(`Statuses: ${dup.statuses}`);
      
      // Get detailed info for each duplicate
      const ids = dup.ids.split(',');
      const [details] = await connection.execute(
        `SELECT id, hostname, is_active, deleted_at, created_at 
         FROM ssh_hosts 
         WHERE id IN (${ids.map(() => '?').join(',')})
         ORDER BY created_at`,
        ids
      );
      
      console.log('\nDetailed info:');
      details.forEach(host => {
        console.log(`  ID ${host.id}: ${host.hostname} - Created: ${host.created_at} - ${host.deleted_at ? 'DELETED' : 'ACTIVE'}`);
      });
    }
    
    // Ask for confirmation
    console.log('\n\nOptions:');
    console.log('1. Delete all DELETED duplicates (keep only active ones)');
    console.log('2. Delete older duplicates (keep newest)');
    console.log('3. Manual review (exit without changes)');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

// Add command line option to auto-fix
const args = process.argv.slice(2);
if (args[0] === '--auto-fix-deleted') {
  autoFixDeleted();
} else {
  fixDuplicateHosts();
}

async function autoFixDeleted() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'appliance_dashboard',
  });

  try {
    console.log('Auto-fixing by removing deleted duplicates...');
    
    // First, find IDs of deleted hosts that have active duplicates
    const [toDelete] = await connection.execute(`
      SELECT d.id 
      FROM ssh_hosts d
      INNER JOIN ssh_hosts a ON 
        d.host = a.host AND 
        d.username = a.username AND 
        d.port = a.port AND
        d.id != a.id
      WHERE d.deleted_at IS NOT NULL 
        AND a.deleted_at IS NULL
    `);
    
    if (toDelete.length > 0) {
      console.log(`Found ${toDelete.length} deleted hosts with active duplicates`);
      
      // Delete them permanently
      const ids = toDelete.map(row => row.id);
      const [result] = await connection.execute(
        `DELETE FROM ssh_hosts WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
      
      console.log(`Deleted ${result.affectedRows} duplicate hosts`);
    } else {
      console.log('No deleted duplicates found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}
