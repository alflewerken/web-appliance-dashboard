#!/usr/bin/env node

/**
 * Migration Script: Sync all existing Remote Desktop configurations to Guacamole
 * 
 * This script ensures that all appliances with remote desktop settings
 * have corresponding Guacamole connections created.
 */

const pool = require('../utils/database');
const { syncGuacamoleConnection } = require('../utils/guacamoleHelper');

async function migrateRemoteDesktopConnections() {
  console.log('🔄 Starting Remote Desktop Migration...\n');
  
  try {
    // Get all appliances with remote desktop enabled
    const [appliances] = await pool.execute(`
      SELECT * FROM appliances 
      WHERE remote_desktop_enabled = 1 
      AND remote_host IS NOT NULL
    `);
    
    console.log(`Found ${appliances.length} appliances with Remote Desktop enabled\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process each appliance
    for (const appliance of appliances) {
      console.log(`Processing appliance "${appliance.name}" (ID: ${appliance.id})...`);
      
      try {
        await syncGuacamoleConnection(appliance);
        successCount++;
        console.log(`✅ Successfully synced connection for "${appliance.name}"\n`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to sync "${appliance.name}": ${error.message}\n`);
      }
    }
    
    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`   Total appliances: ${appliances.length}`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    
    if (successCount > 0) {
      console.log('\n✨ Remote Desktop connections have been synchronized!');
      console.log('   Users should now be able to use the Remote Desktop feature.');
    }
    
    if (errorCount > 0) {
      console.log('\n⚠️  Some connections failed to sync. Check the error messages above.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run the migration
console.log('Web Appliance Dashboard - Remote Desktop Migration');
console.log('=================================================\n');

migrateRemoteDesktopConnections()
  .then(() => {
    console.log('\n✅ Migration completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Migration error:', error);
    process.exit(1);
  });
