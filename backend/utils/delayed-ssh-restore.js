#!/usr/bin/env node

/**
 * Delayed SSH key restoration service
 * Runs periodically to ensure SSH keys are restored after database operations
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const SSH_DIR = '/root/.ssh';
const CHECK_INTERVAL = 30000; // Check every 30 seconds
const MAX_ATTEMPTS = 10; // Try for 5 minutes max

let attempts = 0;

async function checkAndRestoreKeys() {
  attempts++;
  
  // Check if main dashboard key exists
  const keyPath = path.join(SSH_DIR, 'id_rsa_user1_dashboard');
  if (fs.existsSync(keyPath)) {
    console.log('✅ SSH keys already present');
    return true;
  }
  
  console.log(`⏳ Attempt ${attempts}/${MAX_ATTEMPTS}: SSH keys missing, attempting restore...`);
  
  return new Promise((resolve) => {
    exec('node /app/utils/restore-ssh-keys.js', (error, stdout, stderr) => {
      if (error) {
        console.error('Restore error:', error.message);
        resolve(false);
      } else {
        console.log(stdout);
        if (fs.existsSync(keyPath)) {
          console.log('✅ SSH keys successfully restored!');
          resolve(true);
        } else {
          console.log('⚠️ Restore completed but keys still missing');
          resolve(false);
        }
      }
    });
  });
}

async function startDelayedRestore() {
  console.log('🔄 Starting delayed SSH key restoration service...');
  
  // Initial delay to let database settle
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  const checkLoop = async () => {
    const success = await checkAndRestoreKeys();
    
    if (success || attempts >= MAX_ATTEMPTS) {
      if (!success) {
        console.log('❌ Failed to restore SSH keys after maximum attempts');
      }
      console.log('🛑 Stopping delayed restoration service');
      return;
    }
    
    // Schedule next check
    setTimeout(checkLoop, CHECK_INTERVAL);
  };
  
  checkLoop();
}

// Only run if called directly
if (require.main === module) {
  startDelayedRestore();
}

module.exports = { startDelayedRestore };
