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
  console.log('SSH Test Route Hit');
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

    // Add public key to authorized_keys
    const command = `echo "${publicKey}" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`;
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

module.exports = router;
