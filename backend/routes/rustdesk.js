const express = require('express');
const router = express.Router();
const RustDeskManager = require('../modules/streaming/rustdesk-manager');
const { authenticateToken } = require('../middleware/auth');
const { executeSSHCommand } = require('../utils/ssh');
const pool = require('../utils/database');
const { createAuditLog } = require('../utils/auditLogger');
const { getClientIp } = require('../utils/getClientIp');

// Singleton Instance
let rustDeskManager = null;

/**
 * Initialize RustDesk Manager
 */
async function initializeRustDesk() {
  if (!rustDeskManager) {
    rustDeskManager = new RustDeskManager();
    await rustDeskManager.initialize();
    
    // Event Listeners für Logging
    rustDeskManager.on('install-start', (data) => {
      console.log(`RustDesk installation started for host ${data.hostId}`);
    });
    
    rustDeskManager.on('install-progress', (data) => {
      console.log(`RustDesk installation progress for ${data.hostId}: ${data.progress}%`);
    });
    
    rustDeskManager.on('install-complete', (data) => {
      console.log(`RustDesk installed on ${data.hostId} with ID: ${data.rustdeskId}`);
    });
  }
  return rustDeskManager;
}

/**
 * POST /api/rustdesk/access/:applianceId
 * Log RustDesk access for audit trail
 */
router.post('/access/:applianceId', authenticateToken, async (req, res) => {
  const { applianceId } = req.params;
  const userId = req.user?.id || req.userId || 1;
  const ipAddress = getClientIp(req);
  
  try {
    // Get appliance info
    const [appliances] = await pool.execute(
      'SELECT name, rustdesk_id FROM appliances WHERE id = ?',
      [applianceId]
    );

    if (appliances.length === 0) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    const appliance = appliances[0];
    
    // Create audit log
    await createAuditLog(
      userId,
      'rustdesk_access',
      'appliances',
      applianceId,
      {
        appliance_name: appliance.name,
        rustdeskId: appliance.rustdeskId,
        access_type: 'remote_desktop',
        protocol: 'rustdesk'
      },
      ipAddress
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error logging RustDesk access:', error);
    res.status(500).json({ error: 'Failed to log access' });
  }
});

// Middleware to ensure RustDesk is initialized
router.use(async (req, res, next) => {
  try {
    await initializeRustDesk();
    next();
  } catch (error) {
    res.status(500).json({ 
      error: 'RustDesk service not available',
      details: error.message 
    });
  }
});

/**
 * GET /api/rustdesk/status
 * Get RustDesk service status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const serverRunning = await rustDeskManager.checkServerStatus();
    const sessions = rustDeskManager.getActiveSessions();
    
    res.json({
      available: serverRunning,
      serverUrl: rustDeskManager.getServerUrl(),
      webUrl: rustDeskManager.getWebUrl(),
      activeSessions: sessions.length,
      publicKey: rustDeskManager.config.publicKey
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/rustdesk/install/:hostId
 * Install RustDesk on a host
 */
router.post('/install/:hostId', authenticateToken, async (req, res) => {
  try {
    const { hostId } = req.params;
    const db = req.app.get('db');
    
    // Check existing installation
    const existingStatus = rustDeskManager.getInstallationStatus(hostId);
    if (existingStatus && existingStatus.status === 'installed') {
      return res.json(existingStatus);
    }
    
    // Get host info from database
    const [hosts] = await db.query(
      'SELECT * FROM appliances WHERE id = ?',
      [hostId]
    );
    
    if (!hosts || hosts.length === 0) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    const host = hosts[0];
    
    // Check if already installed in DB
    if (host.rustdesk_installed && host.rustdeskId) {
      // Add to manager cache
      const installation = {
        id: hostId,
        status: 'installed',
        progress: 100,
        rustdeskId: host.rustdeskId
      };
      rustDeskManager.installations.set(hostId, installation);
      return res.json(installation);
    }
    
    // Get SSH connection info
    const sshConfig = {
      host: host.remote_host || host.ip_address || host.ssh_connection,
      username: host.remote_username || 'root',
      password: host.remote_password,
      privateKey: host.ssh_private_key
    };
    
    // Start installation
    const installation = await rustDeskManager.installOnHost({
      id: hostId,
      platform: host.platform || 'linux',
      sshConfig
    }, db, executeSSHCommand);
    
    res.json(installation);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/rustdesk/install/:hostId/status
 * Get installation status
 */
router.get('/install/:hostId/status', authenticateToken, async (req, res) => {
  const { hostId } = req.params;
  const userId = req.user?.id || req.userId || 1;
  const ipAddress = getClientIp(req);
  
  console.log('=== RustDesk status check ===');
  console.log('Host ID:', hostId);
  console.log('User ID:', userId);
  console.log('IP:', ipAddress);
  
  const status = rustDeskManager.getInstallationStatus(hostId);
  
  console.log('Installation status:', status);
  
  if (!status) {
    return res.status(404).json({ error: 'No installation found' });
  }
  
  // If RustDesk is installed and ready, log the access
  if (status.status === 'installed' && status.rustdeskId) {
    console.log('RustDesk is installed, creating audit log...');
    try {
      // Get appliance info for audit log
      const [appliances] = await pool.execute(
        'SELECT name FROM appliances WHERE id = ?',
        [hostId]
      );
      
      console.log('Found appliances:', appliances.length);
      
      if (appliances.length > 0) {
        console.log('Creating audit log for appliance:', appliances[0].name);
        await createAuditLog(
          userId,
          'rustdesk_access',
          'appliances',
          hostId,
          {
            appliance_name: appliances[0].name,
            rustdeskId: status.rustdeskId,
            access_type: 'remote_desktop',
            protocol: 'rustdesk'
          },
          ipAddress,
          req
        );
        console.log('Audit log created successfully');
      }
    } catch (error) {
      console.error('Error creating audit log for RustDesk access:', error);
      // Don't fail the request if audit logging fails
    }
  } else {
    console.log('RustDesk not installed or not ready, skipping audit log');
  }
  
  res.json(status);
});

/**
 * POST /api/rustdesk/session
 * Create a new remote desktop session
 */
router.post('/session', authenticateToken, async (req, res) => {
  try {
    const { hostId, quality, fileTransfer, audio } = req.body;
    
    if (!hostId) {
      return res.status(400).json({ error: 'hostId required' });
    }
    
    // Create session
    const session = await rustDeskManager.createWebSession(hostId, {
      quality,
      fileTransfer,
      audio
    });
    
    res.json(session);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/rustdesk/session/:sessionId
 * End a session
 */
router.delete('/session/:sessionId', authenticateToken, async (req, res) => {
  const { sessionId } = req.params;
  const ended = await rustDeskManager.endSession(sessionId);
  
  if (!ended) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({ message: 'Session ended' });
});

/**
 * GET /api/rustdesk/sessions
 * Get all active sessions
 */
router.get('/sessions', authenticateToken, async (req, res) => {
  // Admin only
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const sessions = rustDeskManager.getActiveSessions();
  res.json(sessions);
});

/**
 * POST /api/rustdesk/validate-token
 * Validate a session token (for web client)
 */
router.post('/validate-token', async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }
  
  const payload = rustDeskManager.validateSessionToken(token);
  
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  res.json({
    valid: true,
    rustdeskId: payload.rid,
    permissions: payload.perm
  });
});

module.exports = router;
