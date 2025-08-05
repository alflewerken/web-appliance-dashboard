const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../utils/auth');
const pool = require('../utils/database');
const { logger } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const {
  mapSSHKeyDbToJs,
  mapSSHKeyJsToDb,
  getSSHKeySelectColumns,
  mapSSHKeyDbToJsPublic
} = require('../utils/dbFieldMappingSSHKeys');

// SSH directory
const SSH_DIR = '/root/.ssh';

// Ensure SSH directory exists
async function ensureSSHDir() {
  try {
    await fs.mkdir(SSH_DIR, { recursive: true, mode: 0o700 });
  } catch (error) {
    logger.error('Error creating SSH directory:', error);
  }
}

// Execute command with timeout
async function execWithTimeout(command, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const child = exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
    }, timeoutMs);

    child.on('exit', () => {
      clearTimeout(timeout);
    });
  });
}

// Auto-create dashboard key for user if not exists
async function ensureUserDashboardKey(userId, username) {
  try {
    // Check if user already has a dashboard key
    const [existing] = await pool.execute(
      'SELECT id FROM ssh_keys WHERE key_name = ? AND created_by = ?',
      ['dashboard', userId]
    );

    if (existing.length > 0) {
      return { exists: true };
    }

    // Create dashboard key for user
    await ensureSSHDir();

    const privateKeyPath = path.join(SSH_DIR, `id_rsa_user${userId}_dashboard`);
    const publicKeyPath = `${privateKeyPath}.pub`;

    // Generate key with timeout
    const keygenCmd = `ssh-keygen -t rsa -b 2048 -f "${privateKeyPath}" -N "" -C "dashboard@${username}"`;
    await execWithTimeout(keygenCmd, 10000); // 10 second timeout

    // Read generated keys
    const privateKey = await fs.readFile(privateKeyPath, 'utf8');
    const publicKey = await fs.readFile(publicKeyPath, 'utf8');

    // Get fingerprint with timeout
    const { stdout: fingerprint } = await execWithTimeout(
      `ssh-keygen -lf "${publicKeyPath}" | awk '{print $2}'`,
      5000
    );

    // Store in database
    await pool.execute(`
      INSERT INTO ssh_keys (
        key_name, key_type, key_size, comment, 
        public_key, private_key, fingerprint, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'dashboard',
      'rsa',
      2048,
      `dashboard@${username}`,
      publicKey.trim(),
      privateKey,
      fingerprint.trim(),
      userId
    ]);

    logger.info(`Auto-created dashboard SSH key for user ${username} (ID: ${userId})`);
    
    return { 
      exists: false, 
      created: true,
      keyName: 'dashboard',
      publicKey: publicKey.trim()
    };
  } catch (error) {
    logger.error(`Error auto-creating dashboard key for user ${userId}:`, error);
    throw error;
  }
}

// Get all SSH keys
router.get('/', verifyToken, async (req, res) => {
  try {
    // Auto-create dashboard key if user has none
    try {
      await ensureUserDashboardKey(req.user.id, req.user.username);
    } catch (autoCreateError) {
      logger.warn('Failed to auto-create dashboard key:', autoCreateError);
      // Continue even if auto-create fails
    }

    // User can only see their own SSH keys
    const [keys] = await pool.execute(`
      SELECT ${getSSHKeySelectColumns()}
      FROM ssh_keys
      WHERE created_by = ?
      ORDER BY key_name ASC
    `, [req.user.id]);

    res.json({
      success: true,
      keys: keys.map(mapSSHKeyDbToJsPublic)
    });
  } catch (error) {
    logger.error('Error fetching SSH keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SSH keys'
    });
  }
});

// Ensure user has dashboard key (for host creation)
router.get('/ensure-dashboard', verifyToken, async (req, res) => {
  try {
    const result = await ensureUserDashboardKey(req.user.id, req.user.username);
    
    // Get all user's keys
    const [keys] = await pool.execute(`
      SELECT ${getSSHKeySelectColumns()}
      FROM ssh_keys
      WHERE created_by = ?
      ORDER BY key_name ASC
    `, [req.user.id]);

    res.json({
      success: true,
      dashboardKeyStatus: result,
      keys: keys.map(mapSSHKeyDbToJsPublic),
      defaultKey: 'dashboard' // Always default to dashboard key
    });
  } catch (error) {
    logger.error('Error ensuring dashboard key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to ensure dashboard key'
    });
  }
});

// Get public key content
router.get('/:keyName/public', verifyToken, async (req, res) => {
  try {
    // User can only see their own keys
    const [keys] = await pool.execute(
      'SELECT public_key FROM ssh_keys WHERE key_name = ? AND created_by = ?',
      [req.params.keyName, req.user.id]
    );

    if (keys.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'SSH key not found'
      });
    }

    res.json({
      success: true,
      publicKey: keys[0].public_key
    });
  } catch (error) {
    logger.error('Error fetching public key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch public key'
    });
  }
});

// Generate new SSH key
router.post('/generate', verifyToken, async (req, res) => {
  try {
    const {
      keyName = 'dashboard',
      keyType = 'rsa',
      keySize = 2048,
      comment = ''
    } = req.body;

    // Validate key name
    if (!/^[a-zA-Z0-9_-]+$/.test(keyName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid key name. Use only letters, numbers, underscore and hyphen.'
      });
    }

    // Check if key already exists for this user
    const [existing] = await pool.execute(
      'SELECT id FROM ssh_keys WHERE key_name = ? AND created_by = ?',
      [keyName, req.user.id]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'SSH key with this name already exists'
      });
    }

    await ensureSSHDir();

    // Generate key pair with user-specific path
    const privateKeyPath = path.join(SSH_DIR, `id_rsa_user${req.user.id}_${keyName}`);
    const publicKeyPath = `${privateKeyPath}.pub`;

    // Build ssh-keygen command
    let keygenCmd = `ssh-keygen -t ${keyType} -b ${keySize} -f "${privateKeyPath}" -N ""`;
    if (comment) {
      keygenCmd += ` -C "${comment}"`;
    }

    // Execute ssh-keygen with timeout
    await execWithTimeout(keygenCmd, 10000); // 10 second timeout

    // Read generated keys
    const privateKey = await fs.readFile(privateKeyPath, 'utf8');
    const publicKey = await fs.readFile(publicKeyPath, 'utf8');

    // Get fingerprint with timeout
    const { stdout: fingerprint } = await execWithTimeout(
      `ssh-keygen -lf "${publicKeyPath}" | awk '{print $2}'`,
      5000
    );

    // Store in database
    await pool.execute(`
      INSERT INTO ssh_keys (
        key_name, key_type, key_size, comment, 
        public_key, private_key, fingerprint, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      keyName,
      keyType,
      keySize,
      comment || null,
      publicKey.trim(),
      privateKey,
      fingerprint.trim(),
      req.user.id
    ]);

    logger.info(`SSH key generated: ${keyName} by user ${req.user.username}`);

    res.json({
      success: true,
      message: 'SSH key generated successfully',
      keyName,
      publicKey: publicKey.trim()
    });
  } catch (error) {
    logger.error('Error generating SSH key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate SSH key'
    });
  }
});

// Delete SSH key
router.delete('/:keyId', verifyToken, async (req, res) => {
  try {
    // Get key details first - check ownership
    const [keys] = await pool.execute(
      'SELECT key_name FROM ssh_keys WHERE id = ? AND created_by = ?',
      [req.params.keyId, req.user.id]
    );

    if (keys.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'SSH key not found'
      });
    }

    const keyName = keys[0].key_name;

    // Check if key is in use by any of the user's hosts
    const [hosts] = await pool.execute(
      'SELECT COUNT(*) as count FROM hosts WHERE ssh_key_name = ? AND created_by = ?',
      [keyName, req.user.id]
    );

    if (hosts[0].count > 0) {
      return res.status(400).json({
        success: false,
        error: 'SSH key is in use by one or more hosts and cannot be deleted'
      });
    }

    // Delete from database
    await pool.execute('DELETE FROM ssh_keys WHERE id = ?', [req.params.keyId]);

    // Delete key files
    try {
      const privateKeyPath = path.join(SSH_DIR, `id_rsa_user${req.user.id}_${keyName}`);
      const publicKeyPath = `${privateKeyPath}.pub`;
      
      await fs.unlink(privateKeyPath);
      await fs.unlink(publicKeyPath);
    } catch (error) {
      logger.warn(`Failed to delete key files for ${keyName}:`, error);
    }

    logger.info(`SSH key deleted: ${keyName} by user ${req.user.username}`);

    res.json({
      success: true,
      message: 'SSH key deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting SSH key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete SSH key'
    });
  }
});

// SSH Setup - Register public key on remote host
router.post('/setup', verifyToken, async (req, res) => {
  try {
    const {
      hostname,
      host,
      username,
      password,
      port = 22,
      keyName = 'dashboard'
    } = req.body;

    logger.info(`SSH Setup requested for host ${hostname} (${host}:${port}) with user ${username}`);

    // Get the public key - check ownership
    const [keys] = await pool.execute(
      'SELECT public_key FROM ssh_keys WHERE key_name = ? AND created_by = ?',
      [keyName, req.user.id]
    );

    if (keys.length === 0) {
      logger.warn(`SSH key not found: ${keyName} for user ${req.user.id}`);
      return res.status(404).json({
        success: false,
        error: 'SSH key not found. Please generate a key first.'
      });
    }

    const publicKey = keys[0].public_key;

    // Create a temporary file for the password to avoid shell escaping issues
    const tempDir = '/tmp';
    const tempPasswordFile = path.join(tempDir, `sshpass_${Date.now()}.tmp`);
    const tempKeyFile = path.join(tempDir, `sshkey_${Date.now()}.pub`);

    try {
      // Write password and public key to temporary files
      await fs.writeFile(tempPasswordFile, password, { mode: 0o600 });
      await fs.writeFile(tempKeyFile, publicKey, { mode: 0o644 });

      // Use sshpass with file option for better security and escaping
      const sshCommand = `sshpass -f "${tempPasswordFile}" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p ${port} ${username}@${host} "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys" < "${tempKeyFile}"`;

      await execWithTimeout(sshCommand, 30000); // 30 second timeout for SSH operations
      
      logger.info(`SSH key registered on host ${hostname} (${host}) for user ${username}`);
      
      res.json({
        success: true,
        message: 'SSH key successfully registered on remote host'
      });
    } catch (error) {
      logger.error('Failed to register SSH key:', error);
      
      // Check for common errors
      if (error.message.includes('Permission denied') || error.message.includes('permission denied')) {
        return res.status(401).json({
          success: false,
          error: 'Authentication failed. Please check username and password.'
        });
      } else if (error.message.includes('Connection refused')) {
        return res.status(503).json({
          success: false,
          error: 'Connection refused. Please check host and port.'
        });
      } else if (error.message.includes('No route to host') || error.message.includes('Temporary failure in name resolution')) {
        return res.status(503).json({
          success: false,
          error: 'Cannot reach host. Please check hostname/IP and network connectivity.'
        });
      } else if (error.message.includes('Connection timed out')) {
        return res.status(504).json({
          success: false,
          error: 'Connection timed out. Host may be unreachable or port may be blocked.'
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Failed to register SSH key on remote host',
        details: error.message
      });
    } finally {
      // Clean up temporary files
      try {
        await fs.unlink(tempPasswordFile);
        await fs.unlink(tempKeyFile);
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    logger.error('Error in SSH setup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to setup SSH connection'
    });
  }
});

// Get private key content (only for owner)
router.get('/:keyName/private', verifyToken, async (req, res) => {
  try {
    // User can only get their own private keys
    const [keys] = await pool.execute(
      'SELECT private_key FROM ssh_keys WHERE key_name = ? AND created_by = ?',
      [req.params.keyName, req.user.id]
    );

    if (keys.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'SSH key not found'
      });
    }

    res.json({
      success: true,
      privateKey: keys[0].private_key
    });
  } catch (error) {
    logger.error('Error fetching private key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch private key'
    });
  }
});

// Import existing SSH key
router.post('/import', verifyToken, async (req, res) => {
  try {
    const {
      keyName,
      privateKey,
      passphrase = ''
    } = req.body;

    // Validate key name
    if (!/^[a-zA-Z0-9_-]+$/.test(keyName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid key name. Use only letters, numbers, underscore and hyphen.'
      });
    }

    // Check if key already exists for this user
    const [existing] = await pool.execute(
      'SELECT id FROM ssh_keys WHERE key_name = ? AND created_by = ?',
      [keyName, req.user.id]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'SSH key with this name already exists'
      });
    }

    await ensureSSHDir();

    // Save the private key temporarily to extract public key
    const tempPrivateKeyPath = path.join(SSH_DIR, `temp_${Date.now()}`);
    const privateKeyPath = path.join(SSH_DIR, `id_rsa_user${req.user.id}_${keyName}`);
    const publicKeyPath = `${privateKeyPath}.pub`;

    try {
      // Write private key to temp file
      await fs.writeFile(tempPrivateKeyPath, privateKey, { mode: 0o600 });

      // Extract public key from private key
      let publicKeyCmd = `ssh-keygen -y -f "${tempPrivateKeyPath}"`;
      if (passphrase) {
        publicKeyCmd = `ssh-keygen -y -f "${tempPrivateKeyPath}" -P "${passphrase}"`;
      }

      const { stdout: publicKey } = await execWithTimeout(publicKeyCmd, 5000);

      // Get key type and size
      const { stdout: keyInfo } = await execWithTimeout(
        `ssh-keygen -l -f "${tempPrivateKeyPath}"`,
        5000
      );
      
      // Parse key info (format: "2048 SHA256:xxxxx comment (RSA)")
      const keyInfoMatch = keyInfo.match(/(\d+)\s+.*\s+\((\w+)\)$/);
      const keySize = keyInfoMatch ? parseInt(keyInfoMatch[1]) : 2048;
      const keyType = keyInfoMatch ? keyInfoMatch[2].toLowerCase() : 'rsa';

      // Get fingerprint
      const { stdout: fingerprint } = await execWithTimeout(
        `ssh-keygen -lf "${tempPrivateKeyPath}" | awk '{print $2}'`,
        5000
      );

      // Move to final location
      await fs.rename(tempPrivateKeyPath, privateKeyPath);
      await fs.writeFile(publicKeyPath, publicKey.trim(), { mode: 0o644 });

      // Prepare data with camelCase
      const keyData = {
        keyName,
        keyType,
        keySize,
        comment: 'Imported key',
        publicKey: publicKey.trim(),
        privateKey,
        fingerprint: fingerprint.trim(),
        createdBy: req.user.id
      };

      // Convert to database format
      const dbData = mapSSHKeyJsToDb(keyData);

      // Store in database
      await pool.execute(`
        INSERT INTO ssh_keys (
          key_name, key_type, key_size, comment, 
          public_key, private_key, fingerprint, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        dbData.key_name,
        dbData.key_type,
        dbData.key_size,
        dbData.comment,
        dbData.public_key,
        dbData.private_key,
        dbData.fingerprint,
        dbData.created_by
      ]);

      logger.info(`SSH key imported: ${keyName} by user ${req.user.username}`);

      res.json({
        success: true,
        message: 'SSH key imported successfully',
        keyName,
        publicKey: publicKey.trim()
      });
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempPrivateKeyPath);
      } catch (err) {
        // Ignore cleanup errors
      }
      
      if (error.message.includes('invalid format') || error.message.includes('load failed')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid private key format'
        });
      } else if (error.message.includes('incorrect passphrase')) {
        return res.status(400).json({
          success: false,
          error: 'Incorrect passphrase for encrypted key'
        });
      }
      
      throw error;
    }
  } catch (error) {
    logger.error('Error importing SSH key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import SSH key'
    });
  }
});

// Register SSH key on remote host
router.post('/register-key', verifyToken, async (req, res) => {
  try {
    const { hostname, port = 22, username, password, keyName } = req.body;

    // Validate input
    if (!hostname || !username || !password || !keyName) {
      return res.status(400).json({
        success: false,
        error: 'Hostname, username, password and keyName are required'
      });
    }

    // Get the public key
    const [keys] = await pool.execute(
      'SELECT public_key FROM ssh_keys WHERE key_name = ? AND created_by = ?',
      [keyName, req.user.id]
    );

    if (keys.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'SSH key not found'
      });
    }

    const publicKey = keys[0].public_key;

    // Create SSH command to add key to authorized_keys
    const sshCommand = `sshpass -p '${password}' ssh -o StrictHostKeyChecking=no -p ${port} ${username}@${hostname} "mkdir -p ~/.ssh && echo '${publicKey}' >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"`;

    // Execute command
    await execWithTimeout(sshCommand, 30000); // 30 second timeout

    logger.info(`SSH key ${keyName} registered on ${username}@${hostname} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'SSH key successfully registered on remote host'
    });
  } catch (error) {
    logger.error('Error registering SSH key on remote host:', error);
    
    if (error.message.includes('sshpass: command not found')) {
      return res.status(500).json({
        success: false,
        error: 'sshpass is not installed on the server'
      });
    }
    
    if (error.message.includes('Permission denied')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to register SSH key on remote host'
    });
  }
});

module.exports = router;
