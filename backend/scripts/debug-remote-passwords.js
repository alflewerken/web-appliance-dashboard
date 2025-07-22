#!/usr/bin/env node

// Debug script to check remote desktop passwords after restore
const mysql = require('mysql2/promise');
const { decrypt } = require('../utils/crypto');

async function debugRemotePasswords() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASSWORD || 'app_pass123',
    database: process.env.DB_NAME || 'appliance_db',
    port: process.env.DB_PORT || 3306
  });

  try {
    console.log('🔍 Checking Remote Desktop Passwords in Database...\n');

    // Get all appliances with remote desktop enabled
    const [appliances] = await connection.execute(
      `SELECT id, name, remote_desktop_enabled, remote_protocol, 
              remote_host, remote_port, remote_username, remote_password_encrypted
       FROM appliances 
       WHERE remote_desktop_enabled = 1
       ORDER BY id`
    );

    console.log(`Found ${appliances.length} appliances with remote desktop enabled:\n`);

    for (const app of appliances) {
      console.log(`📱 ${app.name} (ID: ${app.id})`);
      console.log(`   Protocol: ${app.remote_protocol}`);
      console.log(`   Host: ${app.remote_host}:${app.remote_port}`);
      console.log(`   Username: ${app.remote_username}`);
      console.log(`   Password Encrypted: ${app.remote_password_encrypted ? 'Yes' : 'No'}`);
      
      if (app.remote_password_encrypted) {
        try {
          const decrypted = decrypt(app.remote_password_encrypted);
          console.log(`   Password Length: ${decrypted.length} characters`);
          console.log(`   Password Preview: ${decrypted.substring(0, 3)}***`);
        } catch (err) {
          console.log(`   ❌ Failed to decrypt: ${err.message}`);
        }
      } else {
        console.log(`   ⚠️ No password stored!`);
      }
      console.log('');
    }

    // Check Guacamole connections
    try {
      const guacConnection = await mysql.createConnection({
        host: process.env.GUACAMOLE_DB_HOST || 'guacamole-postgres',
        user: process.env.GUACAMOLE_DB_USER || 'guacamole_user',
        password: process.env.GUACAMOLE_DB_PASSWORD || 'guacamole_pass123',
        database: process.env.GUACAMOLE_DB_NAME || 'guacamole_db',
        port: 5432
      });

      console.log('✅ Connected to Guacamole database');
      await guacConnection.end();
    } catch (err) {
      console.log('❌ Could not connect to Guacamole database:', err.message);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

// Run the debug script
debugRemotePasswords();
