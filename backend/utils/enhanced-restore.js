#!/usr/bin/env node
/**
 * Enhanced Restore Script with Generic Field Mapping
 * This demonstrates how the restore process should work with automatic field mapping
 */

const mysql = require('mysql2/promise');
const { genericMapJsToDb, prepareInsert } = require('./genericFieldMapping');
require('dotenv').config();

async function restoreWithMapping(backupData) {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'dashboard_user',
    password: process.env.DB_PASSWORD || 'dashboard_pass123',
    database: process.env.DB_NAME || 'web_appliance_dashboard'
  });

  try {
    await connection.beginTransaction();
    
    // Example: Restore appliances with automatic field mapping
    if (backupData.appliances && backupData.appliances.length > 0) {
      console.log(`Restoring ${backupData.appliances.length} appliances...`);
      
      for (const appliance of backupData.appliances) {
        // The generic mapper will automatically handle:
        // - camelCase to snake_case conversion
        // - Boolean to 0/1 conversion
        // - Both camelCase and snake_case input formats
        
        const { sql, values } = prepareInsert('appliances', appliance);
        
        try {
          await connection.execute(sql, values);
          console.log(`✅ Restored appliance: ${appliance.name}`);
        } catch (error) {
          console.error(`❌ Failed to restore appliance ${appliance.name}:`, error.message);
          throw error;
        }
      }
    }
    
    // Example: Restore categories
    if (backupData.categories && backupData.categories.length > 0) {
      console.log(`Restoring ${backupData.categories.length} categories...`);
      
      for (const category of backupData.categories) {
        const { sql, values } = prepareInsert('categories', category);
        
        try {
          await connection.execute(sql, values);
          console.log(`✅ Restored category: ${category.name}`);
        } catch (error) {
          console.error(`❌ Failed to restore category ${category.name}:`, error.message);
          throw error;
        }
      }
    }
    
    await connection.commit();
    console.log('✅ Restore completed successfully!');
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Restore failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Test the mapping
function testMapping() {
  const testAppliance = {
    id: 1,
    name: 'Test App',
    url: 'http://test.com',
    isFavorite: true,
    lastUsed: '2025-01-01',
    startCommand: 'start.sh',        // camelCase
    stop_command: 'stop.sh',         // snake_case (both work!)
    remoteDesktopEnabled: true,
    rustdeskId: 'ABC123',
    guacamolePerformanceMode: 'high',
    orderIndex: 5
  };
  
  console.log('Original object:', testAppliance);
  console.log('\nMapped to DB:', genericMapJsToDb(testAppliance));
  console.log('\nPrepared INSERT:', prepareInsert('appliances', testAppliance));
}

// Run test if called directly
if (require.main === module) {
  testMapping();
}

module.exports = { restoreWithMapping };
