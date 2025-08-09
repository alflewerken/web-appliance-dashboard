// Robust startup sequence for services after restore
const pool = require('./database');
const SSHAutoInitializer = require('./sshAutoInitializer');
const statusChecker = require('./statusChecker');
const { hashPassword } = require('./auth');

async function waitForDatabase(maxAttempts = 30) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await pool.execute('SELECT 1');
      return true;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return false;
}

async function initializeServices() {
  // 1. Wait for database
  const dbReady = await waitForDatabase();
  if (!dbReady) {
    return false;
  }

  // 2. Initialize Authentication (create default admin if needed)
  try {
    const adminCreated = await createInitialAdmin();
  } catch (error) {
    // Silently ignore
  }

  // 3. Initialize SSH system
  try {
    const sshInitializer = new SSHAutoInitializer();
    const sshSuccess = await sshInitializer.initialize();

    // Wait a bit for SSH to settle
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    // Silently ignore
  }
  
  // 3a. Restore SSH keys from database to filesystem
  try {
    console.log('🔑 Restoring SSH keys from database...');
    const { restoreSSHKeys } = require('../scripts/restore-ssh-keys');
    await restoreSSHKeys();
  } catch (error) {
    console.log('⚠️ Failed to restore SSH keys:', error.message);
  }

  // 4. Regenerate SSH config after restore
  try {
    const axios = require('axios');
    const response = await axios.post(
      'http://localhost:3001/api/ssh/regenerate-config'
    );
  } catch (error) {
    // Silently ignore
  }

  // 5. Test SSH connectivity before starting status checker
  try {
    const { executeSSHCommand } = require('./ssh');

    // Test with a simple local command first
    await executeSSHCommand('echo "SSH test"', 5000);
  } catch (error) {
    // Silently ignore
  }

  // 6. Wait for SSH to be fully ready
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 7. Start status checker with delay
  try {
    await statusChecker.start();
  } catch (error) {
    // Try again after 10 seconds
    setTimeout(async () => {
      try {
        await statusChecker.start();
      } catch (retryError) {
        // Silently ignore
      }
    }, 10000);
  }

  return true;
}

async function createInitialAdmin() {
  try {
    // Check if any admin exists
    const [existingAdmins] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE role = ? OR role = ?',
      ['admin', 'Administrator']
    );

    if (existingAdmins[0].count > 0) {
      return false; // Admin already exists
    }

    // Create default admin
    const defaultPassword = 'admin123';
    const passwordHash = await hashPassword(defaultPassword);

    await pool.execute(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['admin', 'admin@localhost', passwordHash, 'Administrator']
    );

    return true;
  } catch (error) {
    // If it's a duplicate entry error, that's okay
    if (error.code === 'ER_DUP_ENTRY') {
      return false;
    }
    throw error;
  }
}

module.exports = { initializeServices, waitForDatabase };
