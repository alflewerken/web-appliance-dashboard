#!/usr/bin/env node

/**
 * Fix SSH key references after restore
 * Creates symlinks for any missing SSH keys that are referenced in hosts table
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'database',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'dashboard_user', 
  password: process.env.DB_PASSWORD || 'dashboard_pass123',
  database: process.env.DB_NAME || 'appliance_dashboard',
};

const SSH_DIR = '/root/.ssh';

async function fixSSHKeyReferences() {
  let connection;
  
  try {

    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    
    // Get all unique SSH key names referenced in hosts
    const [hosts] = await connection.execute(`
      SELECT DISTINCT ssh_key_name 
      FROM hosts 
      WHERE ssh_key_name IS NOT NULL 
        AND ssh_key_name != ''
    `);

    // Get all actual SSH keys from database
    const [keys] = await connection.execute(
      'SELECT key_name FROM ssh_keys'
    );
    
    const actualKeys = keys.map(k => k.key_name);

    // Also check for commonly used key patterns
    const commonKeyPatterns = ['user1_dashboard', 'user_dashboard', 'admin_dashboard'];
    const allKeysToCheck = [...hosts.map(h => h.ssh_key_name), ...commonKeyPatterns];
    const uniqueKeysToCheck = [...new Set(allKeysToCheck)];

    // Check each referenced key
    for (const keyName of uniqueKeysToCheck) {
      const keyPath = path.join(SSH_DIR, `id_rsa_${keyName}`);
      
      try {
        // Check if key file exists
        await fs.access(keyPath);

      } catch {

        // Try to find a suitable key to link to
        let linkedTo = false;
        
        // First try: Check if there's a default key
        if (actualKeys.includes('dashboard')) {
          const defaultKeyPath = path.join(SSH_DIR, 'id_rsa_dashboard');
          try {
            await fs.access(defaultKeyPath);
            await fs.symlink(defaultKeyPath, keyPath);

            linkedTo = true;
          } catch (err) {

          }
        }
        
        // Second try: Link to first available key
        if (!linkedTo && actualKeys.length > 0) {
          const firstKey = actualKeys[0];
          const firstKeyPath = path.join(SSH_DIR, `id_rsa_${firstKey}`);
          try {
            await fs.access(firstKeyPath);
            await fs.symlink(firstKeyPath, keyPath);

            linkedTo = true;
          } catch (err) {

          }
        }
        
        if (!linkedTo) {

        }
      }
    }

  } catch (error) {
    console.error('❌ Error fixing SSH key references:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run if executed directly
if (require.main === module) {
  fixSSHKeyReferences();
}

module.exports = { fixSSHKeyReferences };
