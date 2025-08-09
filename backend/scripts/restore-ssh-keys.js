#!/usr/bin/env node

/**
 * Script to restore SSH keys from database to filesystem
 * This should be run after a database restore
 */

const pool = require('../utils/database');
const fs = require('fs');
const path = require('path');

async function restoreSSHKeys() {
  try {
    console.log('🔑 Restoring SSH keys from database to filesystem...');
    
    // Get all SSH keys from database
    const [keys] = await pool.execute(`
      SELECT id, key_name, private_key, public_key, created_by
      FROM ssh_keys
      WHERE private_key IS NOT NULL
    `);
    
    console.log(`Found ${keys.length} SSH keys in database`);
    
    const sshDir = '/root/.ssh';
    
    // Ensure SSH directory exists with correct permissions
    if (!fs.existsSync(sshDir)) {
      fs.mkdirSync(sshDir, { mode: 0o700, recursive: true });
      console.log(`Created SSH directory: ${sshDir}`);
    }
    
    let restoredCount = 0;
    
    for (const key of keys) {
      try {
        // Determine filename based on key_name and created_by
        let filename;
        if (key.created_by && key.created_by !== 1) {
          // User-specific key
          filename = `id_rsa_user${key.created_by}_${key.key_name}`;
        } else {
          // System key
          filename = `id_rsa_${key.key_name}`;
        }
        
        const privateKeyPath = path.join(sshDir, filename);
        const publicKeyPath = path.join(sshDir, `${filename}.pub`);
        
        // Write private key
        fs.writeFileSync(privateKeyPath, key.private_key, { mode: 0o600 });
        console.log(`  ✅ Written private key: ${privateKeyPath}`);
        
        // Write public key if available
        if (key.public_key) {
          fs.writeFileSync(publicKeyPath, key.public_key, { mode: 0o644 });
          console.log(`  ✅ Written public key: ${publicKeyPath}`);
        }
        
        restoredCount++;
      } catch (error) {
        console.error(`  ❌ Failed to restore key "${key.key_name}":`, error.message);
      }
    }
    
    // Also check for user-specific keys that might be needed
    const [users] = await pool.execute(`
      SELECT DISTINCT id FROM users WHERE id > 1
    `);
    
    for (const user of users) {
      const userKeyName = `user${user.id}_dashboard`;
      const userKeyPath = path.join(sshDir, `id_rsa_${userKeyName}`);
      
      if (!fs.existsSync(userKeyPath)) {
        console.log(`  ⚠️  Missing key for user ${user.id}: ${userKeyPath}`);
        
        // Check if we have a dashboard key to copy
        const dashboardKeyPath = path.join(sshDir, 'id_rsa_dashboard');
        if (fs.existsSync(dashboardKeyPath)) {
          // Copy dashboard key as user key
          const dashboardPrivate = fs.readFileSync(dashboardKeyPath, 'utf8');
          const dashboardPublic = fs.readFileSync(`${dashboardKeyPath}.pub`, 'utf8');
          
          fs.writeFileSync(userKeyPath, dashboardPrivate, { mode: 0o600 });
          fs.writeFileSync(`${userKeyPath}.pub`, dashboardPublic, { mode: 0o644 });
          
          console.log(`  ✅ Created user key from dashboard key: ${userKeyPath}`);
          restoredCount++;
        }
      }
    }
    
    console.log(`\n✅ Restored ${restoredCount} SSH keys`);
    
    // List all SSH keys in filesystem
    console.log('\nSSH keys in filesystem:');
    const files = fs.readdirSync(sshDir);
    files.filter(f => f.startsWith('id_rsa')).forEach(file => {
      const stat = fs.statSync(path.join(sshDir, file));
      console.log(`  ${file} (${stat.mode.toString(8).slice(-3)})`);
    });
    
    return restoredCount;
  } catch (error) {
    console.error('Error restoring SSH keys:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  restoreSSHKeys()
    .then(count => {
      console.log(`\n✅ SSH key restoration completed`);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ SSH key restoration failed:', error);
      process.exit(1);
    });
}

module.exports = { restoreSSHKeys };
