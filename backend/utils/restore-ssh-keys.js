#!/usr/bin/env node

/**
 * Restore SSH keys from database to filesystem
 * Uses the correct encryption/decryption from encryption.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const { decrypt } = require('../utils/encryption');

const SSH_DIR = '/root/.ssh';

// Database configuration - with retry logic
const dbConfig = {
  host: process.env.DB_HOST || 'database',
  user: process.env.DB_USER || 'dashboard_user',
  password: process.env.DB_PASSWORD || 'P3ndg3nE4JtD18fvW/1m2c2b9GdD6z7g',
  database: process.env.DB_NAME || 'appliance_dashboard',
  connectTimeout: 60000,
  waitForConnections: true
};

// Retry logic for database connection
async function connectWithRetry(maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const connection = await mysql.createConnection(dbConfig);
      console.log('Connected to database');
      return connection;
    } catch (error) {
      console.log(`Database connection attempt ${i + 1} failed:`, error.message);
      if (i < maxRetries - 1) {
        console.log(`Waiting 2 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  throw new Error('Failed to connect to database after ' + maxRetries + ' attempts');
}

async function restoreSSHKeys() {
  let connection;
  
  try {
    console.log('Starting SSH key restoration...');
    
    // Ensure SSH directory exists with correct permissions
    await fs.mkdir(SSH_DIR, { recursive: true, mode: 0o700 });
    
    // Connect to database with retry logic
    connection = await connectWithRetry();
    
    // Fetch all SSH keys with user information
    const [keys] = await connection.execute(
      'SELECT key_name, private_key, public_key, created_by FROM ssh_keys WHERE private_key IS NOT NULL AND public_key IS NOT NULL'
    );
    
    console.log(`Found ${keys.length} SSH keys in database`);
    
    for (const key of keys) {
      try {
        // Use the decrypt function from encryption.js which uses CBC
        const privateKey = decrypt(key.private_key);
        
        if (!privateKey) {
          console.error(`❌ Failed to decrypt private key for ${key.key_name} (user ${key.created_by})`);
          console.log(`   Key format: ${key.private_key.substring(0, 50)}...`);
          continue;
        }
        
        // Verify it's a valid SSH key
        if (!privateKey.includes('-----BEGIN') && !privateKey.includes('PRIVATE KEY')) {
          console.error(`❌ Decrypted content for ${key.key_name} doesn't look like an SSH key`);
          console.log(`   Content start: ${privateKey.substring(0, 50)}...`);
          continue;
        }
        
        // Generate the correct filename
        let keyFileName;
        if (key.created_by) {
          keyFileName = `id_rsa_user${key.created_by}_${key.key_name}`;
        } else {
          keyFileName = `id_rsa_${key.key_name}`;
        }
        
        // Write private key
        const privateKeyPath = path.join(SSH_DIR, keyFileName);
        await fs.writeFile(privateKeyPath, privateKey, { mode: 0o600 });
        console.log(`✅ Restored private key: ${keyFileName} (${privateKey.length} bytes)`);
        
        // Write public key
        const publicKeyPath = path.join(SSH_DIR, `${keyFileName}.pub`);
        await fs.writeFile(publicKeyPath, key.public_key, { mode: 0o644 });
        console.log(`✅ Restored public key: ${keyFileName}.pub`);
        
      } catch (error) {
        console.error(`Error restoring key ${key.key_name}:`, error.message);
      }
    }
    
    // Create symlinks for backwards compatibility
    try {
      // Link the generic dashboard key to user1's dashboard key
      const symlinkSource = path.join(SSH_DIR, 'id_rsa_user1_dashboard');
      const symlinkTarget = path.join(SSH_DIR, 'id_rsa_dashboard');
      
      // Remove old files/links if they exist
      try {
        await fs.unlink(symlinkTarget);
      } catch (e) { }
      try {
        await fs.unlink(symlinkTarget + '.pub');
      } catch (e) { }
      
      // Create new symlinks
      await fs.symlink('id_rsa_user1_dashboard', symlinkTarget);
      await fs.symlink('id_rsa_user1_dashboard.pub', symlinkTarget + '.pub');
      console.log('✅ Created compatibility symlinks for id_rsa_dashboard');
    } catch (error) {
      console.error('Warning: Could not create symlinks:', error.message);
    }
    
    console.log('SSH key restoration completed');
    
  } catch (error) {
    console.error('❌ Error restoring SSH keys:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run if executed directly
if (require.main === module) {
  restoreSSHKeys();
}

module.exports = { restoreSSHKeys };
