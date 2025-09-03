const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');
const db = new QueryBuilder(pool);
const { NodeSSH } = require('node-ssh');
const { verifyToken } = require('../utils/auth');
const { logger } = require('../utils/logger');
const { decrypt } = require('../utils/encryption');

// Configure multer for file uploads
const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = '/tmp/uploads';
    // Ensure directory exists
    require('fs').mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 * 1024, // 50GB limit
  },
});

// Test route
router.get('/test', (req, res) => {

  res.json({ message: 'SSH routes are working' });
});

// Setup SSH key on host
router.post('/setup', verifyToken, async (req, res) => {
  const { hostname, host, username, password, port, keyName } = req.body;
  
  if (!host || !username || !password || !keyName) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: host, username, password, and keyName are required'
    });
  }

  const ssh = new NodeSSH();
  
  try {
    // Get the SSH key from database
    const keyRows = await db.select('ssh_keys', 
      { 
        keyName: keyName,
        createdBy: req.user.id
      },
      { limit: 1 }
    );

    if (keyRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'SSH key not found'
      });
    }

    const publicKey = keyRows[0].publicKey;

    // Connect to host
    await ssh.connect({
      host,
      username,
      password,
      port: port || 22,
      tryKeyboard: true,
      readyTimeout: 10000
    });

    // Create .ssh directory if it doesn't exist
    await ssh.execCommand('mkdir -p ~/.ssh && chmod 700 ~/.ssh');

    // Add public key to authorized_keys (ensure newline at end to prevent key concatenation)
    const publicKeyWithNewline = publicKey.trim() + '\n';
    const command = `echo "${publicKeyWithNewline}" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`;
    const result = await ssh.execCommand(command);

    if (result.code !== 0) {
      throw new Error(`Failed to add SSH key: ${result.stderr}`);
    }

    // Verify the key was added
    const verifyResult = await ssh.execCommand('cat ~/.ssh/authorized_keys');
    if (!verifyResult.stdout.includes(publicKey.trim())) {
      throw new Error('SSH key was not properly added to authorized_keys');
    }

    await ssh.dispose();

    logger.info(`SSH key ${keyName} registered on host ${hostname || host} for user ${username}`);

    // Create audit log entry
    const { createAuditLog } = require('../utils/auditLogger');
    const { getClientIp } = require('../utils/getClientIp');
    
    await createAuditLog(
      req.user.id,
      'ssh_key_registered',
      'ssh_key',
      null, // No specific resource ID for this action
      {
        key_name: keyName,
        host: host,
        hostname: hostname || host,
        port: port || 22,
        username: username,
        registered_by: req.user.username
      },
      getClientIp(req),
      `${keyName} auf ${hostname || host}` // Resource name
    );

    res.json({
      success: true,
      message: 'SSH key successfully registered on host'
    });

  } catch (error) {
    if (ssh) {
      ssh.dispose();
    }
    
    logger.error('Error setting up SSH key:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to register SSH key on host'
    });
  }
});

// Upload file via SSH
const handleSSHUpload = require('../utils/sshUploadHandler');
router.post('/upload', verifyToken, upload.single('file'), handleSSHUpload);

/**
 * POST /api/ssh/execute
 * Execute command on remote host via SSH
 */
router.post('/execute', verifyToken, async (req, res) => {
  const { hostId, command, useSudo = false, timeout = 30000 } = req.body;
  let ssh = null;

  try {
    // Get host details from database
    const [hostResult] = await pool.execute(
      'SELECT * FROM hosts WHERE id = ?',
      [hostId]
    );

    if (hostResult.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Host not found' 
      });
    }

    const host = hostResult[0];

    // Get SSH credentials
    let sshCredentials = {};
    
    // Check if host has stored SSH key
    if (host.ssh_key_id) {
      const [keyResult] = await pool.execute(
        'SELECT * FROM ssh_keys WHERE id = ?',
        [host.ssh_key_id]
      );
      
      if (keyResult.length > 0) {
        const sshKey = keyResult[0];
        const decryptedKey = decrypt(sshKey.private_key);
        sshCredentials = {
          privateKey: decryptedKey,
          username: host.ssh_user || sshKey.username || 'root'
        };
      }
    }
    
    // Fall back to password if no key
    if (!sshCredentials.privateKey && host.ssh_password) {
      sshCredentials = {
        username: host.ssh_user || 'root',
        password: decrypt(host.ssh_password)
      };
    }

    // If still no credentials, check for default SSH user/pass
    if (!sshCredentials.privateKey && !sshCredentials.password) {
      if (process.env.DEFAULT_SSH_USER && process.env.DEFAULT_SSH_PASS) {
        sshCredentials = {
          username: process.env.DEFAULT_SSH_USER,
          password: process.env.DEFAULT_SSH_PASS
        };
      } else {
        return res.status(400).json({ 
          success: false, 
          error: 'No SSH credentials available for this host' 
        });
      }
    }

    // Connect via SSH
    ssh = new NodeSSH();
    await ssh.connect({
      host: host.ip || host.hostname,
      port: host.ssh_port || 22,
      username: sshCredentials.username,
      password: sshCredentials.password,
      privateKey: sshCredentials.privateKey,
      tryKeyboard: true,
      timeout: 10000
    });

    // Execute command
    const result = await ssh.execCommand(command, {
      execOptions: {
        pty: useSudo,
        timeout: timeout
      }
    });

    ssh.dispose();

    // Log command execution
    logger.info(`SSH command executed on ${host.hostname}: ${command.substring(0, 50)}...`);

    // Create audit log
    const { createAuditLog } = require('../utils/auditLogger');
    const { getClientIp } = require('../utils/getClientIp');
    
    await createAuditLog(
      req.user.id,
      'ssh_command_executed',
      'host',
      hostId,
      {
        command: command.substring(0, 100),
        host: host.hostname,
        ip: host.ip,
        success: result.code === 0
      },
      getClientIp(req),
      host.hostname
    );

    res.json({
      success: result.code === 0,
      output: result.stdout,
      error: result.stderr,
      code: result.code
    });

  } catch (error) {
    if (ssh) {
      ssh.dispose();
    }
    
    logger.error('SSH execute error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute SSH command'
    });
  }
});

module.exports = router;
