#!/usr/bin/env node

// Script to manually recreate Guacamole connections
// Run this after a restore if remote desktop buttons don't work

const { recreateGuacamoleConnections } = require('../utils/recreateGuacamoleConnections');

console.log('🔧 Manual Guacamole Connection Recreation');
console.log('=========================================\n');

async function run() {
  try {
    console.log('Starting recreation process...\n');
    
    const result = await recreateGuacamoleConnections();
    
    console.log('\n✅ Process completed!');
    console.log(`   Recreated: ${result.recreated} connections`);
    console.log(`   Errors: ${result.errors}`);
    console.log(`   Skipped: ${result.skipped ? 'Yes (Guacamole not available)' : 'No'}`);
    
    if (result.recreated > 0) {
      console.log('\n✨ Remote desktop buttons should now work again!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

run();