#!/usr/bin/env node
/**
 * Restore Monitor - Überwacht und diagnostiziert hängende Restore-Prozesse
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkRestoreStatus() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'dashboard_user',
    password: process.env.DB_PASSWORD || 'dashboard_pass123',
    database: process.env.DB_NAME || 'web_appliance_dashboard'
  });

  try {
    console.log('🔍 Checking for active database locks...\n');
    
    // Check for active transactions
    const [processlist] = await connection.execute(`
      SELECT 
        ID, 
        USER, 
        HOST, 
        DB, 
        COMMAND, 
        TIME, 
        STATE, 
        INFO 
      FROM information_schema.PROCESSLIST 
      WHERE DB = ? AND COMMAND != 'Sleep'
      ORDER BY TIME DESC
    `, [process.env.DB_NAME || 'web_appliance_dashboard']);

    if (processlist.length > 0) {
      console.log('Active database processes:');
      console.table(processlist);
      
      // Find long-running queries (over 30 seconds)
      const longRunning = processlist.filter(p => p.TIME > 30);
      if (longRunning.length > 0) {
        console.log('\n⚠️  Long-running queries detected:');
        longRunning.forEach(p => {
          console.log(`- Process ${p.ID}: Running for ${p.TIME}s`);
          console.log(`  Query: ${p.INFO?.substring(0, 100)}...`);
        });
      }
    } else {
      console.log('✅ No active database processes found');
    }

    // Check InnoDB lock waits
    const [lockWaits] = await connection.execute(`
      SELECT 
        waiting_trx_id,
        waiting_query,
        blocking_trx_id,
        blocking_query
      FROM information_schema.innodb_lock_waits
      JOIN information_schema.innodb_trx wt ON wt.trx_id = waiting_trx_id
      JOIN information_schema.innodb_trx bt ON bt.trx_id = blocking_trx_id
    `);

    if (lockWaits.length > 0) {
      console.log('\n⚠️  InnoDB lock waits detected:');
      console.table(lockWaits);
    }

    // Check table counts
    console.log('\n📊 Current table row counts:');
    const tables = [
      'appliances',
      'categories', 
      'users',
      'hosts',
      'ssh_keys',
      'background_images',
      'appliance_commands',
      'audit_logs'
    ];

    for (const table of tables) {
      try {
        const [[count]] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`- ${table}: ${count.count} rows`);
      } catch (e) {
        console.log(`- ${table}: Error counting (${e.message})`);
      }
    }

    // Check last audit log entry
    const [lastAudit] = await connection.execute(`
      SELECT action, details, created_at 
      FROM audit_logs 
      WHERE action LIKE '%backup%' OR action LIKE '%restore%'
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    if (lastAudit.length > 0) {
      console.log('\n📝 Recent backup/restore operations:');
      lastAudit.forEach(log => {
        console.log(`- ${log.action} at ${log.created_at}`);
        if (log.details) {
          try {
            const details = JSON.parse(log.details);
            if (details.error) {
              console.log(`  Error: ${details.error}`);
            }
          } catch (e) {}
        }
      });
    }

  } catch (error) {
    console.error('❌ Error checking restore status:', error.message);
  } finally {
    await connection.end();
  }
}

// Kill long-running restore processes if requested
async function killLongRunningProcesses() {
  if (process.argv.includes('--kill')) {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: 'root',
      password: process.env.DB_ROOT_PASSWORD || 'rootpassword123',
      database: process.env.DB_NAME || 'web_appliance_dashboard'
    });

    try {
      const [processlist] = await connection.execute(`
        SELECT ID 
        FROM information_schema.PROCESSLIST 
        WHERE DB = ? AND TIME > 60 AND COMMAND != 'Sleep'
      `, [process.env.DB_NAME || 'web_appliance_dashboard']);

      for (const proc of processlist) {
        console.log(`\n🔪 Killing process ${proc.ID}...`);
        try {
          await connection.execute(`KILL ?`, [proc.ID]);
          console.log(`✅ Process ${proc.ID} killed`);
        } catch (e) {
          console.log(`❌ Failed to kill process ${proc.ID}: ${e.message}`);
        }
      }
    } catch (error) {
      console.error('❌ Error killing processes:', error.message);
    } finally {
      await connection.end();
    }
  }
}

// Main execution
console.log('=== Web Appliance Dashboard - Restore Monitor ===\n');

checkRestoreStatus().then(() => {
  killLongRunningProcesses().then(() => {
    console.log('\n💡 Tips:');
    console.log('- Use --kill flag to terminate long-running processes');
    console.log('- Check backend logs: docker logs web-appliance-dashboard-backend-1');
    console.log('- Restart backend if needed: docker-compose restart backend');
    process.exit(0);
  });
});
