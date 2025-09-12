#!/usr/bin/env node

/**
 * Generate fresh SSH keys and store them encrypted in database
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { encrypt, decrypt } = require('../utils/encryption');

const SSH_DIR = '/root/.ssh';

async function generateFreshKeys() {
  let connection;
  
  try {
    console.log('='.repeat(80));
    console.log('GENERATE FRESH SSH KEYS');
    console.log('='.repeat(80));
    
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'appliance_db',
      user: process.env.DB_USER || 'dashboard_user', 
      password: process.env.DB_PASSWORD || 'ZhFu+SWeAa5sqMdgMfsHn4o+BqTrtAeq',
      database: process.env.DB_NAME || 'appliance_dashboard'
    });

    console.log('✅ Connected to database\n');

    // Clear existing keys
    console.log('Clearing existing keys...');
    await connection.execute('DELETE FROM ssh_keys');
    console.log('✅ Database cleared\n');

    // Generate keys for users 1, 2, 6, 8, 9
    const users = [1, 2, 6, 8, 9];
    
    for (const userId of users) {
      console.log(`\nGenerating key for User ${userId}...`);
      
      const keyName = 'dashboard';
      const keyFileName = `id_rsa_user${userId}_${keyName}`;
      const privateKeyPath = path.join(SSH_DIR, keyFileName);
      const publicKeyPath = privateKeyPath + '.pub';
      
      // Remove old keys if they exist
      try {
        await fs.unlink(privateKeyPath);
        await fs.unlink(publicKeyPath);
      } catch (e) { }
      
      // Generate new RSA 4096 key
      console.log(`  Generating RSA 4096 bit key...`);
      await execAsync(
        `ssh-keygen -t rsa -b 4096 -f "${privateKeyPath}" -N "" -C "${keyName}@user${userId}"`
      );
      
      // Read the generated keys
      const privateKey = await fs.readFile(privateKeyPath, 'utf8');
      const publicKey = await fs.readFile(publicKeyPath, 'utf8');
      
      // Get fingerprint
      const { stdout: fingerprint } = await execAsync(
        `ssh-keygen -lf "${publicKeyPath}" | awk '{print $2}'`
      );
      
      console.log(`  ✅ Key generated`);
      console.log(`     Fingerprint: ${fingerprint.trim()}`);
      
      // Encrypt private key for database storage
      console.log(`  Encrypting for database...`);
      const encryptedPrivateKey = encrypt(privateKey);
      
      // Verify encryption
      const testDecrypt = decrypt(encryptedPrivateKey);
      if (testDecrypt !== privateKey) {
        throw new Error('Encryption verification failed');
      }
      console.log(`  ✅ Encryption verified`);
      
      // Store in database
      await connection.execute(
        `INSERT INTO ssh_keys 
         (key_name, private_key, public_key, key_type, key_size, 
          comment, fingerprint, created_by, is_default) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          keyName,
          encryptedPrivateKey,
          publicKey.trim(),
          'rsa',
          4096,
          `${keyName}@user${userId}`,
          fingerprint.trim(),
          userId,
          userId === 1 ? 1 : 0
        ]
      );
      
      console.log(`  ✅ Stored in database (encrypted)`);
    }
    
    // Create symlinks for backward compatibility
    console.log('\nCreating symlinks...');
    
    const symlinkSource = 'id_rsa_user1_dashboard';
    const symlinkTarget = path.join(SSH_DIR, 'id_rsa_dashboard');
    
    // Remove old symlinks
    try {
      await fs.unlink(symlinkTarget);
      await fs.unlink(symlinkTarget + '.pub');
    } catch (e) { }
    
    // Create new symlinks
    await fs.symlink(symlinkSource, symlinkTarget);
    await fs.symlink(symlinkSource + '.pub', symlinkTarget + '.pub');
    console.log('✅ Symlinks created\n');
    
    // Final verification
    console.log('='.repeat(80));
    console.log('VERIFICATION\n');
    
    const [finalKeys] = await connection.execute(
      'SELECT id, key_name, created_by FROM ssh_keys ORDER BY created_by'
    );
    
    console.log(`Keys in database: ${finalKeys.length}\n`);
    
    for (const key of finalKeys) {
      console.log(`Verifying Key ID ${key.id}: User ${key.created_by}`);
      
      // Get the encrypted key
      const [keyData] = await connection.execute(
        'SELECT private_key FROM ssh_keys WHERE id = ?',
        [key.id]
      );
      
      const encryptedKey = keyData[0].private_key;
      
      // Try to decrypt
      const decrypted = decrypt(encryptedKey);
      
      if (decrypted && decrypted.includes('BEGIN') && decrypted.includes('PRIVATE KEY')) {
        console.log(`  ✅ Valid SSH key, single encryption level`);
        
        // Verify file matches
        const fileName = `id_rsa_user${key.created_by}_dashboard`;
        const filePath = path.join(SSH_DIR, fileName);
        const fileContent = await fs.readFile(filePath, 'utf8');
        
        if (fileContent === decrypted) {
          console.log(`  ✅ File matches decrypted database content`);
        } else {
          console.log(`  ⚠️  File content differs from database`);
        }
      } else {
        console.log(`  ❌ Invalid or multi-encrypted`);
      }
    }
    
    // List files
    console.log('\n' + '='.repeat(80));
    console.log('FILES IN ' + SSH_DIR + '\n');
    
    const files = await fs.readdir(SSH_DIR);
    for (const file of files.sort()) {
      const filePath = path.join(SSH_DIR, file);
      const stats = await fs.lstat(filePath);
      
      if (stats.isSymbolicLink()) {
        const target = await fs.readlink(filePath);
        console.log(`${file} -> ${target}`);
      } else {
        const size = stats.size;
        console.log(`${file} (${size} bytes)`);
      }
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

// Run
console.log('Starting fresh SSH key generation...\n');
generateFreshKeys().then(() => {
  console.log('\n✅ All keys generated and verified successfully');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
