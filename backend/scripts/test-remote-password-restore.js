#!/usr/bin/env node

// Test script to verify remote desktop password backup and restore
const mysql = require('mysql2/promise');
const { encrypt, decrypt } = require('../utils/crypto');

async function testRemotePasswordBackupRestore() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASSWORD || 'app_pass123',
    database: process.env.DB_NAME || 'appliance_db',
    port: process.env.DB_PORT || 3306
  });

  try {
    console.log('🔍 Testing Remote Desktop Password Backup/Restore...\n');

    // First create a test category if needed
    console.log('0️⃣ Creating test category...');
    await connection.execute(
      `INSERT IGNORE INTO categories (name, icon, color) VALUES (?, ?, ?)`,
      ['Test Category', 'Folder', '#FF5733']
    );

    // 1. Create a test appliance with remote desktop password
    const testPassword = 'TestPassword123!';
    const encryptedPassword = encrypt(testPassword);
    
    console.log('1️⃣ Creating test appliance with remote desktop settings...');
    console.log(`   Original password: ${testPassword}`);
    console.log(`   Encrypted password: ${encryptedPassword}\n`);

    const [result] = await connection.execute(
      `INSERT INTO appliances (
        name, url, icon, color, category,
        remote_desktop_enabled, remote_protocol, remote_host, remote_port, remote_username, remote_password_encrypted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Test Remote Desktop App',
        'http://test.example.com',
        'Monitor',
        '#FF5733',
        'Test Category',
        true,
        'vnc',
        '192.168.1.100',
        5900,
        'testuser',
        encryptedPassword
      ]
    );

    const applianceId = result.insertId;
    console.log(`✅ Test appliance created with ID: ${applianceId}\n`);

    // 2. Backup the appliance
    console.log('2️⃣ Backing up appliance...');
    const [backupData] = await connection.execute(
      'SELECT * FROM appliances WHERE id = ?',
      [applianceId]
    );
    
    console.log(`   Backup data remote_password_encrypted: ${backupData[0].remote_password_encrypted}\n`);

    // 3. Delete the appliance
    console.log('3️⃣ Deleting appliance...');
    await connection.execute('DELETE FROM appliances WHERE id = ?', [applianceId]);
    console.log('✅ Appliance deleted\n');

    // 4. Restore the appliance
    console.log('4️⃣ Restoring appliance from backup...');
    const restoreData = backupData[0];
    
    // List all fields to restore
    const fields = [
      'name', 'url', 'icon', 'color', 'category',
      'remote_desktop_enabled', 'remote_protocol', 'remote_host', 
      'remote_port', 'remote_username', 'remote_password_encrypted'
    ];
    
    const values = fields.map(field => restoreData[field]);
    const placeholders = fields.map(() => '?').join(', ');
    
    await connection.execute(
      `INSERT INTO appliances (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    console.log('✅ Appliance restored\n');

    // 5. Verify the restored data
    console.log('5️⃣ Verifying restored data...');
    const [restoredData] = await connection.execute(
      'SELECT * FROM appliances WHERE name = ?',
      ['Test Remote Desktop App']
    );

    if (restoredData.length > 0) {
      const restored = restoredData[0];
      console.log(`   Restored password encrypted: ${restored.remote_password_encrypted}`);
      
      if (restored.remote_password_encrypted === encryptedPassword) {
        console.log('✅ Password correctly restored!');
        
        // Try to decrypt
        try {
          const decryptedPassword = decrypt(restored.remote_password_encrypted);
          console.log(`   Decrypted password: ${decryptedPassword}`);
          
          if (decryptedPassword === testPassword) {
            console.log('✅ Password decryption successful!');
          } else {
            console.log('❌ Password decryption mismatch!');
          }
        } catch (err) {
          console.log('❌ Failed to decrypt password:', err.message);
        }
      } else {
        console.log('❌ Password not correctly restored!');
        console.log(`   Expected: ${encryptedPassword}`);
        console.log(`   Got: ${restored.remote_password_encrypted}`);
      }
    } else {
      console.log('❌ Appliance not found after restore!');
    }

    // Clean up
    console.log('\n6️⃣ Cleaning up...');
    await connection.execute('DELETE FROM appliances WHERE name = ?', ['Test Remote Desktop App']);
    await connection.execute('DELETE FROM categories WHERE name = ?', ['Test Category']);
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await connection.end();
  }
}

// Run the test
testRemotePasswordBackupRestore();
