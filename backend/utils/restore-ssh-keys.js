#!/usr/bin/env node

/**
 * Restore SSH keys from database to filesystem
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'database',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'dashboard_user',
  password: process.env.DB_PASSWORD || 'dashboard_pass123',
  database: process.env.DB_NAME || 'appliance_dashboard',
};

const SSH_DIR = '/root/.ssh';

// Decrypt function (matching the encryption in the system)
function decrypt(encryptedData, secret) {
  try {
    // Check if data is in new format (4 parts with colons)
    const parts = encryptedData.split(':');
    
    if (parts.length === 4) {
      // New format: IV:TAG:ENCRYPTED:SALT
      const algorithm = 'aes-256-gcm';
      const key = crypto.createHash('sha256').update(String(secret)).digest('base64').substr(0, 32);
      
      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const encrypted = Buffer.from(parts[2], 'hex');
      // parts[3] is salt, not used in decryption
      
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } else if (parts.length === 2) {
      // Old format: IV:ENCRYPTED (CTR mode)
      const algorithm = 'aes-256-ctr';
      const key = crypto.createHash('sha256').update(String(secret)).digest('base64').substr(0, 32);
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = Buffer.from(parts[1], 'hex');
      
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } else {
      throw new Error(`Invalid encrypted data format: ${parts.length} parts`);
    }
  } catch (error) {
    console.error('Decryption error:', error.message);
    // Try as plain text if decryption fails
    if (!encryptedData.includes(':')) {
      return encryptedData;
    }
    return null;
  }
}

async function restoreSSHKeys() {
  let connection;
  
  try {

    // Ensure SSH directory exists with correct permissions
    await fs.mkdir(SSH_DIR, { recursive: true, mode: 0o700 });
    
    // Fix ownership of SSH directory
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);
      await execAsync(`chown -R root:root ${SSH_DIR}`);

    } catch (error) {

    }
    
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    
    // Get encryption secret
    const encryptionSecret = process.env.SSH_KEY_ENCRYPTION_SECRET || 
                           process.env.ENCRYPTION_SECRET || 
                           'default-insecure-key-change-this-in-production!!';
    
    // Fetch all SSH keys with user information
    const [keys] = await connection.execute(
      'SELECT key_name, private_key, public_key, created_by FROM ssh_keys'
    );

    for (const key of keys) {
      try {
        // Check if key is encrypted (contains colons) or plain text
        let privateKey = key.private_key;
        
        if (privateKey.includes(':') && privateKey.split(':').length === 4) {
          // Key is encrypted, decrypt it
          privateKey = decrypt(key.private_key, encryptionSecret);
          if (!privateKey) {
            console.error(`Failed to decrypt private key for ${key.key_name}`);
            continue;
          }
        } else {
          // Key is already in plain text

        }
        
        // Generate the correct filename based on whether it's a user key or system key
        let keyFileName;
        if (key.created_by) {
          // User-specific key: id_rsa_user{userId}_{keyName}
          keyFileName = `id_rsa_user${key.created_by}_${key.key_name}`;
        } else {
          // System key: id_rsa_{keyName}
          keyFileName = `id_rsa_${key.key_name}`;
        }
        
        // Write private key
        const privateKeyPath = path.join(SSH_DIR, keyFileName);
        await fs.writeFile(privateKeyPath, privateKey, { mode: 0o600 });
        console.log(`✅ Restored private key: ${keyFileName}`);

        // Write public key
        const publicKeyPath = path.join(SSH_DIR, `${keyFileName}.pub`);
        await fs.writeFile(publicKeyPath, key.public_key, { mode: 0o644 });
        console.log(`✅ Restored public key: ${keyFileName}.pub`);

      } catch (error) {
        console.error(`Error restoring key ${key.key_name}:`, error.message);
      }
    }

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
