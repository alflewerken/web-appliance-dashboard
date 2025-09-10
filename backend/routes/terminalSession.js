// Terminal Session Management - Using QueryBuilder
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const { verifyToken } = require('../utils/auth');
const { createAuditLog } = require('../utils/auditLogger');
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');
const { logger } = require('../utils/logger');
const { getClientIp } = require('../utils/getClientIp');

// Initialize QueryBuilder
const db = new QueryBuilder(pool);

// Ensure terminal sessions directory exists
const SESSIONS_DIR = '/tmp/terminal-sessions';

async function ensureSessionsDir() {
  try {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
  } catch (error) {
    logger.error('Error creating sessions directory:', error);
  }
}

// Initialize
ensureSessionsDir();

/**
 * POST /api/terminal/session
 * Create a new terminal session
 */
router.post('/session', verifyToken, async (req, res) => {
  try {
    const { hostId, sshConnection } = req.body;
    const ipAddress = getClientIp(req);
    
    if (!hostId && !sshConnection) {
      return res.status(400).json({
        success: false,
        error: 'Either hostId or sshConnection is required'
      });
    }

    let sessionData = {};
    let auditDetails = {};
    let resourceType = null;
    let resourceId = null;
    
    if (hostId) {
      // Get host details using QueryBuilder
      const hosts = await db.select('hosts', {
        id: hostId,
        createdBy: req.user.id
      });

      if (hosts.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Host not found'
        });
      }

      const host = hosts[0];
      
      // Debug logging

      sessionData = {
        host: host.hostname,
        port: host.port || 22,
        user: host.username,
        keyPath: host.sshKeyName ? `/root/.ssh/id_rsa_user${host.createdBy || req.user.id}_${host.sshKeyName}` : undefined
      };
      
      // Prepare audit details for host
      auditDetails = {
        hostname: host.hostname,
        username: host.username,
        port: host.port || 22,
        displayName: host.name,  // 'name' field in hosts table is the display name
        name: host.name || host.hostname,  // Use display name from 'name' field
        hostIdentifier: host.name ? `${host.name} (${host.hostname})` : `${host.username}@${host.hostname}`
      };
      resourceType = 'ssh_host';
      resourceId = hostId;
      
    } else if (sshConnection) {
      // Parse SSH connection string (user@host:port)
      const match = sshConnection.match(/^(.+)@(.+):(\d+)$/);
      if (!match) {
        return res.status(400).json({
          success: false,
          error: 'Invalid SSH connection string format'
        });
      }
      
      sessionData = {
        user: match[1],
        host: match[2],
        port: parseInt(match[3], 10)
      };
      
      // Try to find associated appliance using QueryBuilder
      const appliances = await db.select('appliances', { sshConnection });
      
      if (appliances.length > 0) {
        const appliance = appliances[0];
        
        // WICHTIG: SSH Key kommt vom Host, nicht vom Appliance!
        // Parse SSH connection to find matching host
        let keyName = 'dashboard'; // Default
        
        // SSH Connection Format: user@host:port
        const connMatch = sshConnection.match(/^(.+)@(.+):(\d+)$/);
        if (connMatch) {
          const [, username, hostname, port] = connMatch;
          
          // Find a host with matching credentials
          const hosts = await db.select('hosts', {
            hostname: hostname,
            username: username,
            port: parseInt(port, 10),
            createdBy: req.user.id
          });
          
          if (hosts.length > 0) {
            keyName = hosts[0].sshKeyName || 'dashboard';
            logger.info(`Found matching host "${hosts[0].name}" with SSH key "${keyName}" for connection ${sshConnection}`);
          } else {
            // Try without port match (some hosts might have default port)
            const hostsNoPort = await db.select('hosts', {
              hostname: hostname,
              username: username,
              createdBy: req.user.id
            });
            
            if (hostsNoPort.length > 0) {
              keyName = hostsNoPort[0].sshKeyName || 'dashboard';
              logger.info(`Found matching host "${hostsNoPort[0].name}" with SSH key "${keyName}" for connection ${sshConnection} (port mismatch ignored)`);
            } else {
              // No matching host found, use user's default key if it exists
              logger.info(`No matching host found for SSH connection ${sshConnection}, using user's default key "dashboard"`);
            }
          }
        }
        
        // Determine the correct key path
        // First check if user-specific key exists
        const userKeyPath = `/root/.ssh/id_rsa_user${req.user.id}_${keyName}`;
        const fallbackKeyPath = `/root/.ssh/id_rsa_${keyName}`;
        
        // Check which key file actually exists
        try {
          await fs.access(userKeyPath, fs.constants.F_OK);
          sessionData.keyPath = userKeyPath;
          logger.info(`Using user-specific SSH key: ${userKeyPath}`);
        } catch (error) {
          // User-specific key doesn't exist, try fallback
          try {
            await fs.access(fallbackKeyPath, fs.constants.F_OK);
            sessionData.keyPath = fallbackKeyPath;
            logger.info(`Using fallback SSH key: ${fallbackKeyPath}`);
          } catch (error2) {
            // Neither key exists, use user key path anyway (will fail with clear error)
            sessionData.keyPath = userKeyPath;
            logger.warn(`SSH key not found, terminal will likely fail: ${userKeyPath}`);
          }
        }
        
        auditDetails = {
          applianceName: appliance.name,
          appliance_name: appliance.name,
          name: appliance.name,
          sshConnection: sshConnection,
          keyName: keyName
        };
        resourceType = 'appliances';
        resourceId = appliance.id;
      } else {
        // No associated appliance, just log the connection
        auditDetails = {
          sshConnection: sshConnection,
          hostname: match[2],
          username: match[1],
          port: parseInt(match[3], 10),
          name: sshConnection
        };
        resourceType = 'ssh_connection';
        resourceId = null;
      }
    }

    // Generate session ID
    const sessionId = `term_${uuidv4()}`;
    
    // Create session file
    const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.conf`);
    const sessionContent = Object.entries(sessionData)
      .map(([key, value]) => value ? `${key}=${value}` : '')
      .filter(line => line)
      .join('\n');
    
    await fs.writeFile(sessionFile, sessionContent, 'utf8');
    
    // Also create a symlink for latest session
    const latestLink = path.join(SESSIONS_DIR, 'latest-session.conf');
    try {
      await fs.unlink(latestLink);
    } catch (error) {
      // Ignore if doesn't exist
    }
    await fs.symlink(sessionFile, latestLink);
    
    // Create audit log for terminal access
    const resourceName = auditDetails.applianceName || auditDetails.name || auditDetails.hostname || sessionData.hostname || 'Terminal';
    
    await createAuditLog(
      req.user.id,
      'terminal_open',
      resourceType,
      resourceId,
      {
        ...auditDetails,
        sessionId: sessionId
      },
      ipAddress,
      resourceName
    );
    
    logger.info(`Terminal session created: ${sessionId} for user ${req.user.id}`);
    
    res.json({
      success: true,
      sessionId,
      websocketUrl: `/api/terminal/ws/${sessionId}`
    });
  } catch (error) {
    logger.error('Error creating terminal session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create terminal session'
    });
  }
});

module.exports = router;
