#!/usr/bin/env node

/**
 * Test if SSH keys in database can be decrypted with current system key
 */

const mysql = require('mysql2/promise');
const { decrypt, isEncrypted, canDecrypt, getKey } = require('../utils/encryption');

async function testSSHKeyDecryption() {
  let connection;
  
  try {
    // Show current encryption key being used
    const currentKey = getKey();
    console.log('='.repeat(80));
    console.log('SSH KEY DECRYPTION TEST');
    console.log('='.repeat(80));
    console.log(`Current System Key: ${currentKey.substring(0, 20)}...`);
    console.log(`Key Source: ${process.env.ENCRYPTION_KEY ? 'ENCRYPTION_KEY' : 
                              process.env.SSH_KEY_ENCRYPTION_SECRET ? 'SSH_KEY_ENCRYPTION_SECRET' : 
                              'DEFAULT (insecure)'}`);
    console.log('-'.repeat(80));
    
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'appliance_db',
      user: process.env.DB_USER || 'dashboard_user', 
      password: process.env.DB_PASSWORD || 'ZhFu+SWeAa5sqMdgMfsHn4o+BqTrtAeq',
      database: process.env.DB_NAME || 'appliance_dashboard'
    });

    console.log('✅ Connected to database\n');

    // Get all SSH keys
    const [keys] = await connection.execute(
      'SELECT id, key_name, private_key, created_by, created_at FROM ssh_keys ORDER BY created_at DESC'
    );

    console.log(`Found ${keys.length} SSH keys in database:\n`);

    let successCount = 0;
    let failCount = 0;
    let unencryptedCount = 0;

    for (const key of keys) {
      console.log(`\nKey: "${key.key_name}" (ID: ${key.id}, User: ${key.created_by})`);
      console.log(`  Created: ${key.created_at}`);
      
      if (!key.private_key) {
        console.log(`  ❌ No private key stored`);
        failCount++;
        continue;
      }

      // Check if key looks encrypted
      if (!isEncrypted(key.private_key)) {
        console.log(`  ⚠️  KEY IS NOT ENCRYPTED!`);
        console.log(`  First 50 chars: ${key.private_key.substring(0, 50)}...`);
        unencryptedCount++;
        continue;
      }

      console.log(`  ✅ Key is encrypted (format detected)`);
      
      // Check key format
      const parts = key.private_key.split(':');
      console.log(`  Format: ${parts.length} parts (${parts.length === 2 ? 'iv:encrypted' : 
                                                       parts.length === 3 ? 'iv:authTag:encrypted or iv:encrypted:authTag' : 
                                                       'unknown'})`);
      
      // Test if we can decrypt with system key
      const canDecryptWithSystem = canDecrypt(key.private_key);
      console.log(`  Can decrypt with system key: ${canDecryptWithSystem ? '✅ YES' : '❌ NO'}`);
      
      if (canDecryptWithSystem) {
        // Try actual decryption
        const decrypted = decrypt(key.private_key);
        if (decrypted) {
          // Check if it looks like a valid SSH key
          const isValidSSHKey = decrypted.includes('BEGIN') && 
                               (decrypted.includes('PRIVATE KEY') || decrypted.includes('RSA PRIVATE KEY'));
          
          console.log(`  Decryption successful: ✅`);
          console.log(`  Decrypted length: ${decrypted.length} bytes`);
          console.log(`  Valid SSH key format: ${isValidSSHKey ? '✅ YES' : '⚠️  NO'}`);
          
          if (!isValidSSHKey) {
            console.log(`  First 100 chars of decrypted: ${decrypted.substring(0, 100)}...`);
          }
          
          successCount++;
        } else {
          console.log(`  ❌ Decryption returned null`);
          failCount++;
        }
      } else {
        console.log(`  ❌ Cannot decrypt with current system key`);
        console.log(`  This key might use a different encryption key`);
        failCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total keys: ${keys.length}`);
    console.log(`✅ Successfully decrypted: ${successCount}`);
    console.log(`❌ Failed to decrypt: ${failCount}`);
    console.log(`⚠️  Unencrypted keys: ${unencryptedCount}`);
    
    if (failCount > 0) {
      console.log(`\n⚠️  WARNING: ${failCount} key(s) cannot be decrypted with the current system key!`);
      console.log('This might indicate:');
      console.log('  1. Keys were encrypted with a different ENCRYPTION_KEY');
      console.log('  2. Keys are corrupted');
      console.log('  3. Keys use a different encryption format');
    }
    
    if (unencryptedCount > 0) {
      console.log(`\n⚠️  WARNING: ${unencryptedCount} key(s) are stored without encryption!`);
      console.log('Run fix-unencrypted-keys.js to encrypt them.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the test
console.log('Starting SSH key decryption test...\n');
testSSHKeyDecryption().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
