// Hosts Management Routes - Using QueryBuilder
const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin, requirePermission } = require('../utils/auth');
const { createAuditLog } = require('../utils/auditLogger');
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');
const { logger } = require('../utils/logger');
const bcrypt = require('bcryptjs');
const sseManager = require('../utils/sseManager');
const { getClientIp } = require('../utils/getClientIp');
const { syncGuacamoleConnection, deleteGuacamoleConnection } = require('../utils/guacamoleHelper');

// Initialize QueryBuilder
const db = new QueryBuilder(pool);

// Get all hosts
router.get('/', verifyToken, async (req, res) => {
  try {
    // User can only see their own hosts
    const hosts = await db.select(
      'hosts',
      { createdBy: req.user.id },
      { orderBy: 'name' }
    );

    // Remove sensitive password fields from all hosts
    const sanitizedHosts = hosts.map(host => {
      const sanitized = { ...host };
      delete sanitized.password;
      delete sanitized.privateKey;
      delete sanitized.remotePassword;
      delete sanitized.rustdeskPassword;
      return sanitized;
    });

    res.json({
      success: true,
      hosts: sanitizedHosts
    });
  } catch (error) {
    logger.error('Error fetching hosts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch hosts'
    });
  }
});

// Get single host
router.get('/:id', verifyToken, async (req, res) => {
  try {
    // User can only see their own hosts
    const host = await db.findOne('hosts', {
      id: req.params.id,
      createdBy: req.user.id
    });

    if (!host) {
      return res.status(404).json({
        success: false,
        error: 'Host not found'
      });
    }

    // Remove sensitive password fields before sending to frontend
    delete host.password;
    delete host.privateKey;
    delete host.remotePassword;
    delete host.rustdeskPassword;

    res.json({
      success: true,
      host
    });
  } catch (error) {
    logger.error('Error fetching host:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch host'
    });
  }
});

// Create new host
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      name,
      description,
      hostname,
      port,
      username,
      password,
      privateKey,
      sshKeyName,
      icon,
      color,
      transparency,
      blur,
      remoteDesktopEnabled,
      remoteDesktopType,
      remoteProtocol,
      remotePort,
      remoteUsername,
      remotePassword,
      guacamolePerformanceMode,
      rustdeskId,
      rustdeskPassword
    } = req.body;

    // Validate required fields
    if (!name || !hostname || !username) {
      return res.status(400).json({
        success: false,
        error: 'Name, hostname, and username are required'
      });
    }

    // Encrypt passwords if provided
    let encryptedPassword = null;
    let encryptedRemotePassword = null;
    let encryptedRustdeskPassword = null;

    if (password) {
      encryptedPassword = await bcrypt.hash(password, 10);
    }
    if (remotePassword) {
      encryptedRemotePassword = await bcrypt.hash(remotePassword, 10);
    }
    if (rustdeskPassword) {
      encryptedRustdeskPassword = await bcrypt.hash(rustdeskPassword, 10);
    }

    // Insert new host
    const result = await db.insert('hosts', {
      name,
      description,
      hostname,
      port: port || 22,
      username,
      password: encryptedPassword,
      privateKey,
      sshKeyName,
      icon: icon || 'Server',
      color: color || '#007AFF',
      transparency: transparency !== undefined ? transparency : 0.10,
      blur: blur !== undefined ? blur : 0,
      remoteDesktopEnabled: Boolean(remoteDesktopEnabled),
      remoteDesktopType: remoteDesktopType || 'guacamole',
      remoteProtocol,
      remotePort,
      remoteUsername,
      remotePassword: encryptedRemotePassword,
      guacamolePerformanceMode: guacamolePerformanceMode || 'balanced',
      rustdeskId,
      rustdeskPassword: encryptedRustdeskPassword,
      createdBy: req.user.id,
      updatedBy: req.user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Get the created host
    const newHost = await db.findOne('hosts', { id: result.insertId });

    // Create Guacamole connection if remote desktop is enabled
    if (remoteDesktopEnabled && remoteDesktopType === 'guacamole') {
      try {
        await syncGuacamoleConnection({
          ...newHost,
          // Pass unencrypted passwords for Guacamole
          remotePassword: remotePassword
        });
      } catch (guacError) {
        logger.error('Failed to create Guacamole connection:', guacError);
      }
    }

    // Create audit log
    await createAuditLog(
      req.user.id,
      'host_create',
      'hosts',
      result.insertId,
      newHost,
      getClientIp(req),
      name
    );

    // Remove sensitive fields before sending response
    const sanitizedHost = { ...newHost };
    delete sanitizedHost.password;
    delete sanitizedHost.privateKey;
    delete sanitizedHost.remotePassword;
    delete sanitizedHost.rustdeskPassword;

    res.status(201).json({
      success: true,
      host: sanitizedHost
    });

    // Broadcast update (without passwords)
    sseManager.broadcast({
      type: 'host_created',
      data: sanitizedHost
    });

  } catch (error) {
    logger.error('Error creating host:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create host'
    });
  }
});

// PATCH host - for partial updates
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const hostId = req.params.id;
    
    // Debug logging
    console.log('PATCH /api/hosts/' + hostId);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    // Check if host exists and user owns it
    const existingHost = await db.findOne('hosts', {
      id: hostId,
      createdBy: req.user.id
    });

    if (!existingHost) {
      return res.status(404).json({
        success: false,
        error: 'Host not found'
      });
    }

    // Prepare update data - only for fields that were sent
    const updateData = {
      updatedBy: req.user.id,
      updatedAt: new Date()
    };
    
    const changedFields = [];
    const {
      name, description, hostname, port, username, password,
      privateKey, sshKeyName, icon, color, transparency, blur,
      remoteDesktopEnabled, remoteDesktopType, remoteProtocol,
      remotePort, remoteUsername, remotePassword,
      guacamolePerformanceMode, rustdeskId, rustdeskPassword
    } = req.body;

    // Check each field for actual changes
    if (name !== undefined && name !== existingHost.name) {
      updateData.name = name;
      changedFields.push('name');
    }
    if (description !== undefined && description !== existingHost.description) {
      updateData.description = description;
      changedFields.push('description');
    }
    if (hostname !== undefined && hostname !== existingHost.hostname) {
      updateData.hostname = hostname;
      changedFields.push('hostname');
    }
    if (port !== undefined && port != existingHost.port) {
      updateData.port = port;
      changedFields.push('port');
    }
    if (username !== undefined && username !== existingHost.username) {
      updateData.username = username;
      changedFields.push('username');
    }
    if (privateKey !== undefined && privateKey !== existingHost.privateKey) {
      updateData.privateKey = privateKey;
      changedFields.push('privateKey');
    }
    if (sshKeyName !== undefined && sshKeyName !== existingHost.sshKeyName) {
      updateData.sshKeyName = sshKeyName;
      changedFields.push('sshKeyName');
    }
    if (icon !== undefined && icon !== existingHost.icon) {
      updateData.icon = icon;
      changedFields.push('icon');
    }
    if (color !== undefined && color !== existingHost.color) {
      updateData.color = color;
      changedFields.push('color');
    }
    if (transparency !== undefined && transparency != existingHost.transparency) {
      updateData.transparency = transparency;
      changedFields.push('transparency');
    }
    if (blur !== undefined && blur != existingHost.blur) {
      updateData.blur = blur;
      changedFields.push('blur');
    }
    if (remoteDesktopEnabled !== undefined) {
      const newValue = Boolean(remoteDesktopEnabled);
      const oldValue = Boolean(existingHost.remoteDesktopEnabled);
      if (newValue !== oldValue) {
        updateData.remoteDesktopEnabled = newValue;
        changedFields.push('remoteDesktopEnabled');
      }
    }
    if (remoteDesktopType !== undefined && remoteDesktopType !== existingHost.remoteDesktopType) {
      updateData.remoteDesktopType = remoteDesktopType;
      changedFields.push('remoteDesktopType');
    }
    if (remoteProtocol !== undefined && remoteProtocol !== existingHost.remoteProtocol) {
      updateData.remoteProtocol = remoteProtocol;
      changedFields.push('remoteProtocol');
    }
    if (remotePort !== undefined && remotePort != existingHost.remotePort) {
      updateData.remotePort = remotePort;
      changedFields.push('remotePort');
    }
    if (remoteUsername !== undefined && remoteUsername !== existingHost.remoteUsername) {
      console.log('Remote username changed from', existingHost.remoteUsername, 'to', remoteUsername);
      updateData.remoteUsername = remoteUsername;
      changedFields.push('remoteUsername');
    }
    if (remotePassword !== undefined) {
      console.log('Remote password provided:', remotePassword ? 'yes (length: ' + remotePassword.length + ')' : 'empty/null');
      // For passwords, we can't compare hashed values directly
      // So we check if a new password is provided
      if (remotePassword !== '') {
        // Will be hashed below
        changedFields.push('remotePassword');
      }
    }
    if (guacamolePerformanceMode !== undefined && guacamolePerformanceMode !== existingHost.guacamolePerformanceMode) {
      updateData.guacamolePerformanceMode = guacamolePerformanceMode;
      changedFields.push('guacamolePerformanceMode');
    }
    if (rustdeskId !== undefined && rustdeskId !== existingHost.rustdeskId) {
      updateData.rustdeskId = rustdeskId;
      changedFields.push('rustdeskId');
    }

    // Handle password updates
    // If password is explicitly sent (even if empty), update it
    if (password !== undefined) {
      if (password === '' || password === null) {
        // Clear the password
        updateData.password = null;
        if (!changedFields.includes('password')) changedFields.push('password');
      } else {
        // Hash and store new password
        updateData.password = await bcrypt.hash(password, 10);
        if (!changedFields.includes('password')) changedFields.push('password');
      }
    }
    
    if (remotePassword !== undefined) {
      if (remotePassword === '' || remotePassword === null) {
        // Clear the password
        updateData.remotePassword = null;
        if (!changedFields.includes('remotePassword')) changedFields.push('remotePassword');
      } else {
        // Hash and store new password
        updateData.remotePassword = await bcrypt.hash(remotePassword, 10);
        if (!changedFields.includes('remotePassword')) changedFields.push('remotePassword');
      }
    }
    
    if (rustdeskPassword !== undefined) {
      if (rustdeskPassword === '' || rustdeskPassword === null) {
        // Clear the password
        updateData.rustdeskPassword = null;
        if (!changedFields.includes('rustdeskPassword')) changedFields.push('rustdeskPassword');
      } else {
        // Hash and store new password
        updateData.rustdeskPassword = await bcrypt.hash(rustdeskPassword, 10);
        if (!changedFields.includes('rustdeskPassword')) changedFields.push('rustdeskPassword');
      }
    }

    // If no actual changes (besides updatedAt/updatedBy), return early
    if (changedFields.length === 0) {
      console.log('No changes detected');
      return res.json({
        success: true,
        message: 'No changes detected',
        host: existingHost
      });
    }
    
    console.log('Changed fields:', changedFields);
    console.log('Update data:', updateData);

    // Apply the updates
    await db.update('hosts', updateData, { id: hostId });

    // Get updated host
    const updatedHost = await db.findOne('hosts', { id: hostId });

    // Update Guacamole connection if remote desktop settings changed
    if (changedFields.some(field => field.startsWith('remote'))) {
      if (updatedHost.remoteDesktopEnabled && updatedHost.remoteDesktopType === 'guacamole') {
        try {
          await syncGuacamoleConnection({
            ...updatedHost,
            // Pass the plain text password if it was just changed, otherwise it's already hashed in DB
            remotePassword: remotePassword || updatedHost.remotePassword
          });
        } catch (guacError) {
          logger.error('Failed to update Guacamole connection:', guacError);
        }
      } else if (!updatedHost.remoteDesktopEnabled || updatedHost.remoteDesktopType !== 'guacamole') {
        try {
          await deleteGuacamoleConnection(hostId);
        } catch (guacError) {
          logger.error('Failed to delete Guacamole connection:', guacError);
        }
      }
    }

    // Create audit log with only changed fields
    const auditChanges = {};
    changedFields.forEach(field => {
      auditChanges[field] = {
        old: existingHost[field],
        new: updatedHost[field]
      };
    });

    await createAuditLog(
      req.user.id,
      'host_update',
      'hosts',
      hostId,
      {
        host_name: existingHost.name,
        changes: auditChanges,
        fields_updated: changedFields,
        updated_by: req.user.username
      },
      getClientIp(req),
      updatedHost.name
    );

    // Remove sensitive fields before sending response
    const sanitizedHost = { ...updatedHost };
    delete sanitizedHost.password;
    delete sanitizedHost.privateKey;
    delete sanitizedHost.remotePassword;
    delete sanitizedHost.rustdeskPassword;

    res.json({
      success: true,
      host: sanitizedHost,
      fieldsUpdated: changedFields
    });

    // Broadcast update
    sseManager.broadcast({
      type: 'host_updated',
      data: {
        id: hostId,
        name: updatedHost.name,
        fieldsUpdated: changedFields
      }
    });

  } catch (error) {
    logger.error('Error updating host:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update host'
    });
  }
});

// Update host - legacy PUT route
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const hostId = req.params.id;
    
    // Check if host exists and user owns it
    const existingHost = await db.findOne('hosts', {
      id: hostId,
      createdBy: req.user.id
    });

    if (!existingHost) {
      return res.status(404).json({
        success: false,
        error: 'Host not found'
      });
    }

    const {
      name,
      description,
      hostname,
      port,
      username,
      password,
      privateKey,
      sshKeyName,
      icon,
      color,
      transparency,
      blur,
      remoteDesktopEnabled,
      remoteDesktopType,
      remoteProtocol,
      remotePort,
      remoteUsername,
      remotePassword,
      guacamolePerformanceMode,
      rustdeskId,
      rustdeskPassword
    } = req.body;

    // Prepare update data
    const updateData = {
      updatedBy: req.user.id,
      updatedAt: new Date()
    };

    // Only update provided fields
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (hostname !== undefined) updateData.hostname = hostname;
    if (port !== undefined) updateData.port = port;
    if (username !== undefined) updateData.username = username;
    if (privateKey !== undefined) updateData.privateKey = privateKey;
    if (sshKeyName !== undefined) updateData.sshKeyName = sshKeyName;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (transparency !== undefined) updateData.transparency = transparency;
    if (blur !== undefined) updateData.blur = blur;
    if (remoteDesktopEnabled !== undefined) updateData.remoteDesktopEnabled = Boolean(remoteDesktopEnabled);
    if (remoteDesktopType !== undefined) updateData.remoteDesktopType = remoteDesktopType;
    if (remoteProtocol !== undefined) updateData.remoteProtocol = remoteProtocol;
    if (remotePort !== undefined) updateData.remotePort = remotePort;
    if (remoteUsername !== undefined) updateData.remoteUsername = remoteUsername;
    if (guacamolePerformanceMode !== undefined) updateData.guacamolePerformanceMode = guacamolePerformanceMode;
    if (rustdeskId !== undefined) updateData.rustdeskId = rustdeskId;

    // Handle password updates - only update if a new password is actually provided
    if (password && password !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }
    if (remotePassword && remotePassword !== '') {
      updateData.remotePassword = await bcrypt.hash(remotePassword, 10);
    }
    if (rustdeskPassword && rustdeskPassword !== '') {
      updateData.rustdeskPassword = await bcrypt.hash(rustdeskPassword, 10);
    }

    // Update the host
    await db.update('hosts', updateData, { id: hostId });

    // Get updated host
    const updatedHost = await db.findOne('hosts', { id: hostId });

    // Update Guacamole connection if needed
    if (remoteDesktopEnabled && remoteDesktopType === 'guacamole') {
      try {
        await syncGuacamoleConnection({
          ...updatedHost,
          remotePassword: remotePassword // Pass unencrypted password
        });
      } catch (guacError) {
        logger.error('Failed to update Guacamole connection:', guacError);
      }
    } else if (!remoteDesktopEnabled || remoteDesktopType !== 'guacamole') {
      // Delete Guacamole connection if disabled
      try {
        await deleteGuacamoleConnection(hostId);
      } catch (guacError) {
        logger.error('Failed to delete Guacamole connection:', guacError);
      }
    }

    // Create audit log
    await createAuditLog(
      req.user.id,
      'host_update',
      'hosts',
      hostId,
      {
        old_data: existingHost,
        new_data: updatedHost
      },
      getClientIp(req),
      updatedHost.name
    );

    // Remove sensitive fields before sending response
    const sanitizedHost = { ...updatedHost };
    delete sanitizedHost.password;
    delete sanitizedHost.privateKey;
    delete sanitizedHost.remotePassword;
    delete sanitizedHost.rustdeskPassword;

    res.json({
      success: true,
      host: sanitizedHost
    });

    // Broadcast update (without passwords)
    sseManager.broadcast({
      type: 'host_updated',
      data: sanitizedHost
    });

  } catch (error) {
    logger.error('Error updating host:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update host'
    });
  }
});

// Get remote desktop token for host
router.post('/:id/remoteDesktopToken', verifyToken, async (req, res) => {
  try {
    const hostId = req.params.id;
    const { performanceMode = 'balanced' } = req.body;
    
    // Check if host exists and user owns it
    const host = await db.findOne('hosts', {
      id: hostId,
      createdBy: req.user.id
    });

    if (!host) {
      return res.status(404).json({
        success: false,
        error: 'Host not found'
      });
    }

    // Check if remote desktop is enabled
    if (!host.remoteDesktopEnabled) {
      return res.status(400).json({
        success: false,
        error: 'Remote desktop is not enabled for this host'
      });
    }

    // Check remote desktop type
    if (host.remoteDesktopType === 'rustdesk') {
      // RustDesk doesn't need a token, just return the ID
      return res.json({
        success: true,
        type: 'rustdesk',
        rustdeskId: host.rustdeskId
      });
    }

    // For Guacamole connections
    if (host.remoteDesktopType === 'guacamole') {
      const GuacamoleDBManager = require('../utils/guacamole/GuacamoleDBManager');
      const { getGuacamoleUrl } = require('../utils/guacamoleUrlHelper');
      
      try {
        // Get Guacamole auth token
        const axios = require('axios');
        const guacamoleInternalUrl = 'http://guacamole:8080/guacamole';
        
        // Authenticate with Guacamole
        const authResponse = await axios.post(
          `${guacamoleInternalUrl}/api/tokens`,
          new URLSearchParams({
            username: 'guacadmin',
            password: 'guacadmin'
          }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000
          }
        );
        
        const authToken = authResponse.data.authToken;
        
        // Get connection ID from Guacamole database
        const dbManager = new GuacamoleDBManager();
        const connectionResult = await dbManager.pool.query(
          'SELECT connection_id FROM guacamole_connection WHERE connection_name = $1',
          [`dashboard-${hostId}`]  // Use dashboard-{id} format, same as syncGuacamoleConnection
        );
        await dbManager.close();
        
        if (!connectionResult.rows || connectionResult.rows.length === 0) {
          // Connection doesn't exist, try to create it
          // Transform host object to match appliance structure for syncGuacamoleConnection
          const applianceCompatible = {
            id: hostId,
            remote_desktop_enabled: host.remoteDesktopEnabled,
            remote_host: host.hostname,  // Use hostname as remote_host
            remote_protocol: host.remoteProtocol,
            remote_port: host.remotePort,
            remote_username: host.remoteUsername,
            remote_password_encrypted: host.remotePassword  // Pass encrypted password
          };
          
          const { syncGuacamoleConnection } = require('../utils/guacamoleHelper');
          await syncGuacamoleConnection(applianceCompatible);
          
          // Try again to get the connection
          const dbManager2 = new GuacamoleDBManager();
          const retryResult = await dbManager2.pool.query(
            'SELECT connection_id FROM guacamole_connection WHERE connection_name = $1',
            [`dashboard-${hostId}`]  // Note: syncGuacamoleConnection uses dashboard-{id}, not dashboard-host-{id}
          );
          await dbManager2.close();
          
          if (!retryResult.rows || retryResult.rows.length === 0) {
            throw new Error('Failed to create Guacamole connection');
          }
          
          connectionResult.rows = retryResult.rows;
        }
        
        const connectionId = connectionResult.rows[0].connection_id;
        
        // Generate connection identifier
        const identifier = Buffer.from(`${connectionId}\0c\0postgresql`).toString('base64');
        const encodedIdentifier = encodeURIComponent(identifier);
        
        // Generate Guacamole URL
        const baseUrl = getGuacamoleUrl(req);
        const guacamoleUrl = `${baseUrl}/guacamole/#/client/${encodedIdentifier}?token=${encodeURIComponent(authToken)}`;
        
        // Create audit log
        await createAuditLog(
          req.user.id,
          'remote_desktop_access',
          'hosts',
          hostId,
          {
            host_name: host.name,
            protocol: host.remoteProtocol,
            remote_host: host.hostname,
            performance_mode: performanceMode
          },
          getClientIp(req)
        );
        
        return res.json({
          success: true,
          type: 'guacamole',
          guacamoleUrl: guacamoleUrl,
          connectionId: connectionId
        });
        
      } catch (guacError) {
        logger.error('Failed to get Guacamole token:', guacError);
        return res.status(500).json({
          success: false,
          error: 'Failed to establish remote desktop connection',
          details: guacError.message
        });
      }
    }
    
    // Unknown remote desktop type
    return res.status(400).json({
      success: false,
      error: `Unsupported remote desktop type: ${host.remoteDesktopType}`
    });
    
  } catch (error) {
    logger.error('Error getting remote desktop token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get remote desktop token',
      details: error.message
    });
  }
});

// Delete host
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const hostId = req.params.id;
    
    // Check if host exists and user owns it
    const existingHost = await db.findOne('hosts', {
      id: hostId,
      createdBy: req.user.id
    });

    if (!existingHost) {
      return res.status(404).json({
        success: false,
        error: 'Host not found'
      });
    }

    // Delete the host
    await db.delete('hosts', { id: hostId });

    // Delete Guacamole connection if it exists
    try {
      await deleteGuacamoleConnection(hostId);
    } catch (guacError) {
      logger.error('Failed to delete Guacamole connection:', guacError);
    }

    // Create audit log with full host data for restoration
    await createAuditLog(
      req.user.id,
      'host_delete',
      'hosts',
      hostId,
      existingHost,
      getClientIp(req),
      existingHost.name
    );

    res.json({
      success: true,
      message: 'Host deleted successfully'
    });

    // Broadcast deletion
    sseManager.broadcast({
      type: 'host_deleted',
      data: { id: hostId }
    });

  } catch (error) {
    logger.error('Error deleting host:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete host'
    });
  }
});

// Test SSH connection
router.post('/:id/test', verifyToken, async (req, res) => {
  try {
    const hostId = req.params.id;
    
    // Get host details
    const host = await db.findOne('hosts', {
      id: hostId,
      createdBy: req.user.id
    });

    if (!host) {
      return res.status(404).json({
        success: false,
        error: 'Host not found'
      });
    }

    // Import SSH test function
    const { testSSHConnection } = require('../utils/ssh');
    
    const result = await testSSHConnection({
      host: host.hostname,
      port: host.port || 22,
      username: host.username,
      password: host.password, // This is encrypted, need to handle
      privateKey: host.privateKey,
      keyName: host.sshKeyName
    });

    res.json({
      success: result.success,
      message: result.message,
      error: result.error
    });

  } catch (error) {
    logger.error('Error testing SSH connection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test SSH connection'
    });
  }
});

// Restore deleted host
router.post('/restore/:auditLogId', verifyToken, async (req, res) => {
  try {
    const { auditLogId } = req.params;
    
    // Get the audit log entry
    const auditLog = await db.findOne('audit_logs', {
      id: auditLogId,
      action: 'host_delete',
      userId: req.user.id
    });

    if (!auditLog) {
      return res.status(404).json({
        success: false,
        error: 'Audit log entry not found or not authorized'
      });
    }

    // Parse the old values (deleted host data)
    const hostData = JSON.parse(auditLog.oldValues);
    
    // Restore the host
    delete hostData.id; // Remove ID to let database generate new one
    hostData.createdBy = req.user.id;
    hostData.updatedBy = req.user.id;
    hostData.createdAt = new Date();
    hostData.updatedAt = new Date();
    
    const result = await db.insert('hosts', hostData);
    
    // Get the restored host
    const restoredHost = await db.findOne('hosts', { id: result.insertId });
    
    // Create audit log for restoration
    await createAuditLog(
      req.user.id,
      'host_restore',
      'hosts',
      result.insertId,
      restoredHost,
      getClientIp(req),
      restoredHost.name
    );

    res.json({
      success: true,
      host: restoredHost,
      message: 'Host restored successfully'
    });

    // Broadcast restoration
    sseManager.broadcast({
      type: 'host_restored',
      data: restoredHost
    });

  } catch (error) {
    logger.error('Error restoring host:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore host'
    });
  }
});

module.exports = router;
