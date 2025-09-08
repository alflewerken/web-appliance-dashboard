// Hosts Management Routes - Using QueryBuilder
const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin, requirePermission } = require('../utils/auth');
const { createAuditLog } = require('../utils/auditLogger');
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');
const { logger } = require('../utils/logger');
const bcrypt = require('bcryptjs');
const { encrypt, decrypt, isEncrypted } = require('../utils/encryption');
const sseManager = require('../utils/sseManager');
const SSEManager = require('../services/SSEManager');
const { getClientIp } = require('../utils/getClientIp');
const { syncGuacamoleConnection, deleteGuacamoleConnection } = require('../utils/guacamoleHelper');
const GuacamoleDBManager = require('../utils/guacamole/GuacamoleDBManager');
const { Pool } = require('pg');

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

    // Encrypt passwords if provided (use reversible encryption for SSH/Remote passwords)
    let encryptedPassword = null;
    let encryptedRemotePassword = null;
    let encryptedRustdeskPassword = null;

    if (password) {
      encryptedPassword = encrypt(password);  // Reversible encryption for SSH
    }
    if (remotePassword) {
      encryptedRemotePassword = encrypt(remotePassword);  // Reversible encryption for Remote Desktop
    }
    if (rustdeskPassword) {
      encryptedRustdeskPassword = encrypt(rustdeskPassword);  // Reversible encryption for RustDesk
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
        // Prepare data for syncGuacamoleConnection with proper structure
        const guacamoleData = {
          id: newHost.id,
          name: newHost.name,
          remote_desktop_enabled: newHost.remoteDesktopEnabled,
          remote_host: newHost.hostname,  // Use hostname as remote_host for hosts
          remote_protocol: newHost.remoteProtocol || 'vnc',
          remote_port: newHost.remotePort,
          remote_username: newHost.remoteUsername,
          // Pass the encrypted password from DB (will be decrypted by syncGuacamoleConnection)
          remote_password_encrypted: newHost.remotePassword,
          remotePassword: newHost.remotePassword,  // Also provide in camelCase for compatibility
          guacamole_performance_mode: newHost.guacamolePerformanceMode,
          // SSH credentials for SFTP
          sshHostname: newHost.hostname,
          sshUsername: newHost.username,
          sshPassword: newHost.password  // SSH password (encrypted)
        };
        
        await syncGuacamoleConnection(guacamoleData);
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

      updateData.remoteUsername = remoteUsername;
      changedFields.push('remoteUsername');
    }
    if (remotePassword !== undefined) {

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
        // Encrypt and store new password (reversible encryption)
        updateData.password = encrypt(password);
        if (!changedFields.includes('password')) changedFields.push('password');
      }
    }
    
    if (remotePassword !== undefined) {
      if (remotePassword === '' || remotePassword === null) {
        // Clear the password
        updateData.remotePassword = null;
        if (!changedFields.includes('remotePassword')) changedFields.push('remotePassword');
      } else {
        // Encrypt and store new password (reversible encryption)
        updateData.remotePassword = encrypt(remotePassword);
        if (!changedFields.includes('remotePassword')) changedFields.push('remotePassword');
      }
    }
    
    if (rustdeskPassword !== undefined) {
      if (rustdeskPassword === '' || rustdeskPassword === null) {
        // Clear the password
        updateData.rustdeskPassword = null;
        if (!changedFields.includes('rustdeskPassword')) changedFields.push('rustdeskPassword');
      } else {
        // Encrypt and store new password (reversible encryption)
        updateData.rustdeskPassword = encrypt(rustdeskPassword);
        if (!changedFields.includes('rustdeskPassword')) changedFields.push('rustdeskPassword');
      }
    }

    // If no actual changes (besides updatedAt/updatedBy), return early
    if (changedFields.length === 0) {

      return res.json({
        success: true,
        message: 'No changes detected',
        host: existingHost
      });
    }

    // Apply the updates
    await db.update('hosts', updateData, { id: hostId });

    // Get updated host
    const updatedHost = await db.findOne('hosts', { id: hostId });

    // Update Guacamole connection if remote desktop settings changed
    if (changedFields.some(field => field.startsWith('remote'))) {
      if (updatedHost.remoteDesktopEnabled && updatedHost.remoteDesktopType === 'guacamole') {
        try {
          // Prepare data for syncGuacamoleConnection with proper structure
          const guacamoleData = {
            id: updatedHost.id,
            name: updatedHost.name,
            remote_desktop_enabled: updatedHost.remoteDesktopEnabled,
            remote_host: updatedHost.hostname,  // Use hostname as remote_host for hosts
            remote_protocol: updatedHost.remoteProtocol || 'vnc',
            remote_port: updatedHost.remotePort,
            remote_username: updatedHost.remoteUsername,
            // Pass the encrypted password from DB (will be decrypted by syncGuacamoleConnection)
            remote_password_encrypted: updatedHost.remotePassword,
            remotePassword: updatedHost.remotePassword,  // Also provide in camelCase for compatibility
            guacamole_performance_mode: updatedHost.guacamolePerformanceMode,
            // SSH credentials for SFTP
            sshHostname: updatedHost.hostname,
            sshUsername: updatedHost.username,
            sshPassword: updatedHost.password  // SSH password (encrypted)
          };
          
          await syncGuacamoleConnection(guacamoleData);
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

    // Create audit log with changed fields in correct format
    const auditChanges = {};
    const auditOldValues = {};
    changedFields.forEach(field => {
      auditOldValues[field] = existingHost[field];
      auditChanges[field] = updatedHost[field];
    });

    await createAuditLog(
      req.user.id,
      'host_update',
      'hosts',
      hostId,
      {
        hostName: existingHost.name,
        changes: auditChanges,
        oldValues: auditOldValues,
        fieldsUpdated: changedFields,
        updatedBy: req.user.username
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
      updateData.password = encrypt(password);  // Reversible encryption
    }
    if (remotePassword && remotePassword !== '') {
      updateData.remotePassword = encrypt(remotePassword);  // Reversible encryption
    }
    if (rustdeskPassword && rustdeskPassword !== '') {
      updateData.rustdeskPassword = encrypt(rustdeskPassword);  // Reversible encryption
    }

    // Update the host
    await db.update('hosts', updateData, { id: hostId });

    // Get updated host
    const updatedHost = await db.findOne('hosts', { id: hostId });

    // Update Guacamole connection if needed
    if (remoteDesktopEnabled && remoteDesktopType === 'guacamole') {
      try {
        // Prepare data for syncGuacamoleConnection
        // WICHTIG: Wir müssen das verschlüsselte Passwort aus der DB übergeben
        const guacamoleData = {
          id: updatedHost.id,
          name: updatedHost.name,
          remote_desktop_enabled: updatedHost.remoteDesktopEnabled,
          remote_host: updatedHost.hostname,  // Use hostname as remote_host for hosts
          remote_protocol: updatedHost.remoteProtocol || 'vnc',
          remote_port: updatedHost.remotePort,
          remote_username: updatedHost.remoteUsername,
          // Pass the encrypted password from DB (will be decrypted by syncGuacamoleConnection)
          remote_password_encrypted: updatedHost.remotePassword,
          remotePassword: updatedHost.remotePassword,  // Also provide in camelCase for compatibility
          guacamole_performance_mode: updatedHost.guacamolePerformanceMode,
          // SSH credentials for SFTP
          sshHostname: updatedHost.hostname,
          sshUsername: updatedHost.username,
          sshPassword: updatedHost.password  // SSH password (encrypted)
        };
        
        await syncGuacamoleConnection(guacamoleData);
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

    // Create audit log with changes in correct format
    const auditChanges = {};
    const auditOldValues = {};
    
    // Compare old and new values to find what changed
    Object.keys(updateData).forEach(field => {
      if (field !== 'updatedAt' && field !== 'updatedBy') {
        if (existingHost[field] !== updatedHost[field]) {
          auditOldValues[field] = existingHost[field];
          auditChanges[field] = updatedHost[field];
        }
      }
    });

    await createAuditLog(
      req.user.id,
      'host_update',
      'hosts',
      hostId,
      {
        hostName: existingHost.name,
        changes: auditChanges,
        oldValues: auditOldValues,
        fieldsUpdated: Object.keys(auditChanges),
        updatedBy: req.user.username
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
    
    // Check if req.user exists
    if (!req.user || !req.user.id) {
      console.error('[HOSTS] req.user is missing:', req.user);
      return res.status(500).json({
        success: false,
        error: 'Authentication failed - user not found in request',
        details: 'req.user is undefined'
      });
    }
    
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
        
        // Always sync the connection to ensure it's up to date
        // Transform host object to match expected structure for syncGuacamoleConnection
        const guacamoleData = {
          id: hostId,
          name: host.name,
          remote_desktop_enabled: host.remoteDesktopEnabled,
          remote_host: host.hostname,  // Use hostname as remote_host
          remote_protocol: host.remoteProtocol || 'vnc',
          remote_port: host.remotePort || 5900,  // Default VNC port
          remote_username: host.remoteUsername,
          remote_password_encrypted: host.remotePassword,  // Pass encrypted password
          remotePassword: host.remotePassword,  // Also provide in camelCase for compatibility
          guacamole_performance_mode: host.guacamolePerformanceMode,
          // SSH credentials for SFTP
          sshHostname: host.hostname,
          sshUsername: host.username,
          sshPassword: host.password  // SSH password (encrypted)
        };

        const { syncGuacamoleConnection } = require('../utils/guacamoleHelper');
        await syncGuacamoleConnection(guacamoleData);
        
        // Get connection ID from Guacamole database
        const dbManager = new GuacamoleDBManager();
        const connectionResult = await dbManager.pool.query(
          'SELECT connection_id FROM guacamole_connection WHERE connection_name = $1',
          [`dashboard-${hostId}`]  // Use dashboard-{id} format, same as syncGuacamoleConnection
        );
        await dbManager.close();
        
        if (!connectionResult.rows || connectionResult.rows.length === 0) {
          throw new Error('Failed to create Guacamole connection');
        }
        
        const connectionId = connectionResult.rows[0].connection_id;
        
        // Generate connection identifier für PostgreSQL
        const identifier = Buffer.from(`${connectionId}\0c\0postgresql`).toString('base64');
        const encodedIdentifier = encodeURIComponent(identifier);
        
        // Build the Guacamole URL with proper token placement
        // WICHTIG: Der Token muss VOR dem Hash-Fragment sein!
        const baseUrl = getGuacamoleUrl(req);
        const guacamoleUrl = `${baseUrl}/guacamole/?token=${encodeURIComponent(authToken)}#/client/${encodedIdentifier}`;

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
          getClientIp(req),
          host.name  // Add resource name for display
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

    // Fetch SNMP configuration before deletion
    let snmpConfig = null;
    try {
      snmpConfig = await db.findOne('host_snmp_configs', { hostId: hostId });
    } catch (err) {
      logger.warn('Could not fetch SNMP config for deletion audit:', err);
    }

    // Fetch metrics logging configuration before deletion
    let metricsLogging = null;
    try {
      metricsLogging = await db.findOne('host_metrics_logging', { hostId: hostId });
    } catch (err) {
      logger.warn('Could not fetch metrics logging config for deletion audit:', err);
    }

    // Delete the host (will cascade delete SNMP configs due to foreign key)
    await db.delete('hosts', { id: hostId });

    // Delete Guacamole connection if it exists
    try {
      await deleteGuacamoleConnection(hostId);
    } catch (guacError) {
      logger.error('Failed to delete Guacamole connection:', guacError);
    }

    // Create audit log with full host data AND SNMP data for restoration
    const auditDetails = {
      ...existingHost,
      // Add SNMP configuration
      snmpConfig: snmpConfig || null,
      // Add metrics logging configuration
      metricsLogging: metricsLogging || null
    };

    await createAuditLog(
      req.user.id,
      'host_delete',
      'hosts',
      hostId,
      auditDetails,
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

// Log RustDesk access for hosts
router.post('/:id/rustdeskAccess', verifyToken, async (req, res) => {
  try {
    const hostId = req.params.id;
    const userId = req.user?.id || req.userId || 1;
    const ipAddress = getClientIp(req);

    // Get host details
    const host = await db.findOne('hosts', {
      id: hostId,
      createdBy: userId
    });

    if (!host) {
      return res.status(404).json({
        success: false,
        error: 'Host not found'
      });
    }

    // Create audit log for RustDesk access
    await createAuditLog(
      userId,
      'rustdesk_access',
      'hosts',
      hostId,
      {
        host_name: host.name,
        hostname: host.hostname,
        rustdeskId: host.rustdeskId,
        access_type: 'remote_desktop',
        protocol: 'rustdesk',
        action: 'connect'
      },
      ipAddress,
      host.name
    );

    res.json({
      success: true,
      message: 'RustDesk access logged'
    });

  } catch (error) {
    console.error('Error logging RustDesk access:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log RustDesk access'
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

// SNMP Configuration endpoints

// Get SNMP configuration for a host
router.get('/:id/snmp-config', async (req, res) => {
  try {
    const hostId = parseInt(req.params.id);
    
    // Check if user has access to this host
    const host = await db.findOne('hosts', { id: hostId });
    if (!host) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    // Get SNMP config from database
    const config = await db.findOne('host_snmp_configs', { hostId: hostId });
    
    if (!config) {
      // Return default config if none exists
      return res.json({
        config: {
          enabled: false,
          version: '2c',
          community: 'public',
          port: 161,
          username: '',
          authProtocol: 'SHA',
          authPassword: '',
          privProtocol: 'AES',
          privPassword: '',
          pollInterval: 60,
        }
      });
    }
    
    // Map database fields to camelCase for frontend
    const mappedConfig = {
      enabled: config.enabled,
      version: config.version,
      community: config.community,
      port: config.port,
      username: config.username || '',
      authProtocol: config.authProtocol || config.auth_protocol || 'SHA',
      authPassword: config.authPassword || config.auth_password || '',
      privProtocol: config.privProtocol || config.priv_protocol || 'AES',
      privPassword: config.privPassword || config.priv_password || '',
      pollInterval: config.pollInterval || config.poll_interval || 60,
    };
    
    res.json({ config: mappedConfig });
  } catch (error) {
    logger.error('Error fetching SNMP config:', error);
    res.status(500).json({ error: 'Failed to fetch SNMP configuration' });
  }
});

// Update SNMP configuration for a host
router.put('/:id/snmp-config', async (req, res) => {
  try {
    const hostId = parseInt(req.params.id);
    const config = req.body;
    
    // Check if user has access to this host
    const host = await db.findOne('hosts', { id: hostId });
    if (!host) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    // Check if config exists and save old values for audit
    const existingConfig = await db.findOne('host_snmp_configs', { hostId: hostId });
    
    // Only include the fields that should be updated
    const configData = {
      hostId: hostId,
      enabled: config.enabled || false,
      version: config.version || '2c',
      community: config.community || 'public',
      port: config.port || 161,
      username: config.username || '',
      authProtocol: config.authProtocol || 'SHA',
      authPassword: config.authPassword || '',
      privProtocol: config.privProtocol || 'AES',
      privPassword: config.privPassword || '',
      pollInterval: config.pollInterval || 60,
      updatedAt: new Date()
    };
    
    let auditDetails;
    if (existingConfig) {
      // Update existing config - correct parameter order: table, data, where
      await db.update('host_snmp_configs', configData, { id: existingConfig.id });
      
      // Prepare audit details with old and new values
      auditDetails = {
        action: 'snmp_config_updated',
        oldValues: existingConfig,
        newValues: configData,
        changes: {
          enabled: existingConfig.enabled !== configData.enabled ? 
            { old: existingConfig.enabled, new: configData.enabled } : undefined,
          version: existingConfig.version !== configData.version ?
            { old: existingConfig.version, new: configData.version } : undefined,
          community: existingConfig.community !== configData.community ?
            { old: '***', new: '***' } : undefined,  // Don't log sensitive data
          port: existingConfig.port !== configData.port ?
            { old: existingConfig.port, new: configData.port } : undefined,
          pollInterval: existingConfig.pollInterval !== configData.pollInterval ?
            { old: existingConfig.pollInterval, new: configData.pollInterval } : undefined
        }
      };
    } else {
      // Insert new config
      configData.createdAt = new Date();
      await db.insert('host_snmp_configs', configData);
      
      auditDetails = {
        action: 'snmp_config_created',
        newValues: configData
      };
    }
    
    // Create audit log with old and new values
    await createAuditLog(
      1, // Default user ID - in production, get from auth
      existingConfig ? 'snmp_config_updated' : 'snmp_config_created',
      'hosts',
      hostId,
      auditDetails,
      getClientIp(req),
      host.name
    );
    
    // Signal the polling worker to reload this host's configuration
    // The worker checks this table periodically and reloads configurations
    try {
      await pool.execute(
        `INSERT INTO snmp_reload_signals (host_id, signal_type, created_at) 
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE created_at = NOW()`,
        [hostId, configData.enabled ? 'reload' : 'stop']
      );
      
      logger.info(`SNMP reload signal sent for host ${hostId} (${host.name})`);
    } catch (signalError) {
      // If the table doesn't exist, create it
      if (signalError.code === 'ER_NO_SUCH_TABLE') {
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS snmp_reload_signals (
            host_id INT PRIMARY KEY,
            signal_type ENUM('reload', 'stop', 'add') DEFAULT 'reload',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP NULL,
            FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
          )
        `);
        
        // Retry the insert
        await pool.execute(
          `INSERT INTO snmp_reload_signals (host_id, signal_type, created_at) 
           VALUES (?, ?, NOW())`,
          [hostId, configData.enabled ? 'reload' : 'stop']
        );
        
        logger.info(`Created snmp_reload_signals table and sent reload signal for host ${hostId}`);
      } else {
        logger.error(`Failed to send reload signal for host ${hostId}:`, signalError);
      }
    }
    
    res.json({ 
      success: true, 
      config: configData,
      message: configData.enabled 
        ? 'SNMP configuration saved. Polling will restart within 60 seconds.' 
        : 'SNMP configuration saved and polling stopped.'
    });
  } catch (error) {
    logger.error('Error updating SNMP config:', error);
    res.status(500).json({ error: 'Failed to update SNMP configuration' });
  }
});

// Test SNMP connection
router.post('/:id/snmp-test', async (req, res) => {
  try {
    const hostId = parseInt(req.params.id);
    const config = req.body;
    const skipAuditLog = req.query.skipAudit === 'true' || req.body.skipAudit === true;
    
    // Check if user has access to this host
    const host = await db.findOne('hosts', { id: hostId });
    if (!host) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    // Use the real SNMP Monitor service
    const SNMPMonitor = require('../services/SNMPMonitor');
    const snmpMonitor = new SNMPMonitor(db);
    
    logger.info(`Testing SNMP connection for host ${host.name} (${host.hostname})`);
    
    // Prepare config object for new SNMP implementation
    const testConfig = {
      ip: host.hostname,
      port: config.port || 161,
      community: config.community || 'public',
      version: config.version || '2c',
      timeout: 5000,
      hostId: hostId
    };
    
    // Use testConnection for simple connectivity test
    const testResult = await snmpMonitor.testConnection(testConfig);
    
    if (testResult.success) {
      // If test successful, get full metrics
      const metricsResult = await snmpMonitor.pollHost(testConfig);
      
      if (metricsResult.success) {
        // Store the metrics in database
        try {
          await db.insert('host_monitoring_data', {
            hostId: hostId,
            status: 'online',
            lastUpdate: new Date(),
            metrics: JSON.stringify(metricsResult.metrics),
            createdAt: new Date()
          });
        } catch (dbErr) {
          logger.error('Failed to store metrics:', dbErr);
        }
        
        res.json({
          success: true,
          message: testResult.message,
          systemName: testResult.systemName,
          details: {
            metrics: metricsResult.metrics,
            timestamp: metricsResult.timestamp
          }
        });
      } else {
        // Test succeeded but metrics failed
        res.json({
          success: true,
          message: testResult.message,
          systemName: testResult.systemName,
          warning: 'Connection successful but could not retrieve full metrics'
        });
      }
    } else {
      // Test failed
      res.json({
        success: false,
        error: testResult.error,
        message: 'SNMP connection failed'
      });
    }
    
    // Create audit log only if not skipped (e.g., for live monitoring)
    if (!skipAuditLog) {
      await createAuditLog(
        req.user?.id || 1,
        'snmp_test',
        'hosts',
        hostId,
        { config, success: testResult.success },
        getClientIp(req),
        host.name
      );
    }
    
  } catch (error) {
    logger.error(`Error testing SNMP for host ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'SNMP test failed', 
      message: error.message 
    });
  }
});

// Debug endpoint for interface mapping
router.get('/:id/debug-interfaces', async (req, res) => {
  try {
    const hostId = parseInt(req.params.id);
    
    const host = await db.findOne('hosts', { id: hostId });
    if (!host) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    // Get SNMP config
    const snmpConfig = await db.findOne('host_snmp_configs', { hostId: hostId });
    if (!snmpConfig || !snmpConfig.enabled) {
      return res.status(400).json({ error: 'SNMP not configured for this host' });
    }
    
    const SNMPMonitor = require('../services/SNMPMonitor');
    const snmpMonitor = new SNMPMonitor(db);
    
    // Create SNMP session
    const snmp = require('net-snmp');
    const session = snmp.createSession(
      host.hostname,
      snmpConfig.community || 'public',
      {
        port: snmpConfig.port || 161,
        version: snmpConfig.version === '1' ? snmp.Version1 : snmp.Version2c,
        timeout: 10000
      }
    );
    
    // Walk all interfaces
    const interfaces = await snmpMonitor.walkNetworkInterfaces(session);
    session.close();
    
    // Get current config
    const metricsConfig = await db.findOne('host_metrics_logging', { hostId: hostId });
    const loggingConfig = metricsConfig?.config || {};
    const customNames = metricsConfig?.customNames || {};
    
    // Create detailed mapping
    const interfaceMapping = interfaces.map(iface => ({
      index: iface.index,
      name: iface.name,
      status: iface.status,
      speed: iface.speed,
      bytesIn: iface.statistics?.bytesReceived || 0,
      bytesOut: iface.statistics?.bytesSent || 0,
      isConfigured: !!loggingConfig[`network.interface.${iface.index}`],
      customName: customNames[`network.interface.${iface.index}`] || '',
      configKey: `network.interface.${iface.index}`
    }));
    
    // Find specific interfaces
    const en0 = interfaceMapping.find(i => i.name === 'en0');
    const en5 = interfaceMapping.find(i => i.name === 'en5');
    const awdl0 = interfaceMapping.find(i => i.name === 'awdl0');
    
    res.json({
      host: host.name,
      totalInterfaces: interfaces.length,
      configuredInterfaces: Object.keys(loggingConfig).filter(k => k.startsWith('network.interface.')),
      mapping: {
        en0: en0 || 'not found',
        en5: en5 || 'not found',
        awdl0: awdl0 || 'not found'
      },
      allInterfaces: interfaceMapping.sort((a, b) => a.index - b.index)
    });
    
  } catch (error) {
    logger.error(`Error debugging interfaces for host ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Interface debug failed', 
      message: error.message,
      stack: error.stack
    });
  }
});

// Test endpoint for debugging network interfaces
router.get('/:id/test-network', async (req, res) => {
  try {
    const hostId = parseInt(req.params.id);
    const snmp = require('net-snmp');
    
    const host = await db.findOne('hosts', { id: hostId });
    if (!host) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    const session = snmp.createSession(
      host.hostname || 'host.docker.internal',
      'public',
      {
        port: 1161,
        version: snmp.Version2c
      }
    );
    
    const SNMPMonitor = require('../services/SNMPMonitor');
    const snmpMonitor = new SNMPMonitor();
    
    const interfaces = await snmpMonitor.walkNetworkInterfaces(session);
    session.close();
    
    // Find en0
    const en0 = interfaces.find(i => i.name === 'en0');
    const if5 = interfaces.find(i => i.index === 5);
    
    res.json({
      totalInterfaces: interfaces.length,
      en0: en0,
      interface5: if5,
      first5: interfaces.slice(0, 5)
    });
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Live monitoring data route - NO AUDIT LOGGING
router.get('/:id/live-monitoring', async (req, res) => {
  try {
    const hostId = parseInt(req.params.id);
    
    // Check if user has access to this host
    const host = await db.findOne('hosts', { id: hostId });
    if (!host) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    // Get SNMP config
    const snmpConfig = await db.findOne('host_snmp_configs', { hostId: hostId });
    
    if (!snmpConfig || !snmpConfig.enabled) {
      // No SNMP configured or disabled - return cached data from DB
      const latestData = await db.select('host_monitoring_data', 
        { hostId: hostId },
        { 
          orderBy: 'createdAt', 
          order: 'desc', 
          limit: 1 
        }
      );
      
      if (latestData && latestData.length > 0) {
        let metrics = latestData[0].metrics;
        if (typeof metrics === 'string') {
          try {
            metrics = JSON.parse(metrics);
          } catch (e) {
            logger.error('Failed to parse metrics JSON:', e);
          }
        }
        
        return res.json({
          success: true,
          source: 'cache',
          status: latestData[0].status || 'online',
          lastUpdate: latestData[0].lastUpdate || latestData[0].updatedAt,
          metrics: metrics
        });
      } else {
        return res.json({
          success: false,
          source: 'cache',
          status: 'no-data',
          message: 'No cached monitoring data available'
        });
      }
    }
    
    // SNMP is enabled - fetch live data
    const SNMPMonitor = require('../services/SNMPMonitor');
    const snmpMonitor = new SNMPMonitor(db);
    
    const testConfig = {
      ip: host.hostname,
      port: snmpConfig.port || 161,
      community: snmpConfig.community || 'public',
      version: snmpConfig.version || '2c',
      timeout: 5000,
      hostId: hostId
    };
    
    // Get live metrics
    const metricsResult = await snmpMonitor.pollHost(testConfig);
    
    if (metricsResult.success) {
      // Update cache in database (no audit log)
      try {
        // Check if record exists
        const existing = await db.select('host_monitoring_data', { hostId: hostId });
        
        if (existing && existing.length > 0) {
          // Update existing record
          await db.update('host_monitoring_data', 
            {
              status: 'online',
              metrics: JSON.stringify(metricsResult.metrics),
              updatedAt: new Date()
            },
            { hostId: hostId }
          );
        } else {
          // Insert new record
          await db.insert('host_monitoring_data', {
            hostId: hostId,
            status: 'online',
            lastUpdate: new Date(),
            metrics: JSON.stringify(metricsResult.metrics)
          });
        }
      } catch (dbErr) {
        logger.error('Failed to update metrics cache:', dbErr);
      }
      
      res.json({
        success: true,
        source: 'live',
        status: 'online',
        lastUpdate: new Date(),
        metrics: metricsResult.metrics,
        timestamp: metricsResult.timestamp
      });
    } else {
      // SNMP failed - return cached data if available
      const latestData = await db.select('host_monitoring_data', 
        { hostId: hostId },
        { 
          orderBy: 'createdAt', 
          order: 'desc', 
          limit: 1 
        }
      );
      
      if (latestData && latestData.length > 0) {
        let metrics = latestData[0].metrics;
        if (typeof metrics === 'string') {
          try {
            metrics = JSON.parse(metrics);
          } catch (e) {
            logger.error('Failed to parse metrics JSON:', e);
          }
        }
        
        res.json({
          success: false,
          source: 'cache',
          status: 'offline',
          error: metricsResult.error,
          lastUpdate: latestData[0].updatedAt,
          metrics: metrics
        });
      } else {
        res.json({
          success: false,
          source: 'error',
          status: 'offline',
          error: metricsResult.error,
          message: 'SNMP connection failed and no cached data available'
        });
      }
    }
    
    // NO AUDIT LOG FOR LIVE MONITORING!
    
  } catch (error) {
    logger.error(`Error fetching live monitoring for host ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Live monitoring failed', 
      message: error.message 
    });
  }
});

// Get interface mappings for a host
router.get('/:id/interface-mappings', verifyToken, async (req, res) => {
  try {
    const hostId = parseInt(req.params.id);
    
    // Check if user owns this host
    const host = await db.findOne('hosts', {
      id: hostId,
      createdBy: req.user.id
    });
    
    if (!host) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    // Get interface mappings from database
    const [mappings] = await pool.execute(`
      SELECT 
        interface_index,
        interface_name,
        interface_descr,
        interface_type,
        interface_speed,
        last_seen
      FROM host_interface_mappings
      WHERE host_id = ?
      ORDER BY interface_index
    `, [hostId]);
    
    res.json({
      success: true,
      mappings: mappings,
      lastUpdate: mappings.length > 0 ? mappings[0].last_seen : null
    });
    
  } catch (error) {
    logger.error('Error fetching interface mappings:', error);
    res.status(500).json({ error: 'Failed to fetch interface mappings' });
  }
});

// Get monitoring data for a host
router.get('/:id/monitoring-data', async (req, res) => {
  try {
    const hostId = parseInt(req.params.id);
    
    // Check if user has access to this host
    const host = await db.findOne('hosts', { id: hostId });
    if (!host) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    // Get latest monitoring data from database using QueryBuilder
    const latestData = await db.select('host_monitoring_data', 
      { hostId: hostId },
      { 
        orderBy: 'createdAt', 
        order: 'desc', 
        limit: 1 
      }
    );
    
    if (latestData && latestData.length > 0) {
      // Parse the metrics JSON if stored as string
      let metrics = latestData[0].metrics;
      if (typeof metrics === 'string') {
        try {
          metrics = JSON.parse(metrics);
        } catch (e) {
          logger.error('Failed to parse metrics JSON:', e);
        }
      }
      
      res.json({
        status: latestData[0].status || 'online',
        lastUpdate: latestData[0].last_update || latestData[0].created_at,
        metrics: metrics
      });
    } else {
      // No data available - return empty metrics
      res.json({
        status: 'offline',
        lastUpdate: null,
        metrics: {
          cpu: null,
          memory: null,
          disk: [],
          network: [],
          temperature: null,
          uptime: null
        }
      });
    }
  } catch (error) {
    logger.error('Error fetching monitoring data:', error);
    res.status(500).json({ error: 'Failed to fetch monitoring data' });
  }
});

// Get metrics logging configuration
router.get('/:id/metrics-logging', verifyToken, async (req, res) => {
  try {
    const hostId = parseInt(req.params.id);

    // Check if user has access to this host
    const host = await db.findOne('hosts', {
      id: hostId,
      createdBy: req.user.id
    });
    
    if (!host) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    // Get logging config from database
    const config = await db.findOne('host_metrics_logging', { hostId: hostId });
    
    if (config) {

    }
    
    // The fields are already parsed by the field mapping
    res.json({
      config: config?.config || {},
      customNames: config?.customNames || {}
    });
  } catch (error) {
    logger.error('Error fetching metrics logging config:', error);
    res.status(500).json({ error: 'Failed to fetch logging configuration' });
  }
});

// Update metrics logging configuration
router.put('/:id/metrics-logging', verifyToken, async (req, res) => {
  try {
    const hostId = parseInt(req.params.id);
    const { config, customNames } = req.body;

    // Check if user has access to this host
    const host = await db.findOne('hosts', {
      id: hostId,
      createdBy: req.user.id
    });
    
    if (!host) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    // KRITISCH: Filtere Custom Names - behalte nur die für AKTIVE Metriken
    const filteredCustomNames = {};
    if (customNames && config) {
      for (const [metricKey, customName] of Object.entries(customNames)) {
        // Prüfe ob die Basis-Metrik aktiv ist
        const baseMetricKey = metricKey.replace(/\.(bytesIn|bytesOut|errors|status)$/, '');
        
        // Behalte den Custom Name nur wenn die Metrik oder ihre Basis-Metrik aktiv ist
        if (config[metricKey] === true || config[baseMetricKey] === true) {
          filteredCustomNames[metricKey] = customName;
        } else {
          logger.debug(`Removing custom name for inactive metric: ${metricKey}`);
        }
      }
    }
    
    // Check if config exists
    const existingConfig = await db.findOne('host_metrics_logging', { hostId: hostId });
    
    const configData = {
      hostId: hostId,
      config: JSON.stringify(config || {}),
      customNames: JSON.stringify(filteredCustomNames),  // Verwende gefilterte Custom Names
      updatedAt: new Date()
    };
    
    if (existingConfig) {
      // Update existing config
      await db.update('host_metrics_logging', configData, { id: existingConfig.id });
      
      // Update metric names in snmp_metrics table for better history display
      // Verwende filteredCustomNames statt customNames
      if (filteredCustomNames && Object.keys(filteredCustomNames).length > 0) {
        for (const [metricKey, customName] of Object.entries(filteredCustomNames)) {
          await pool.execute(
            `UPDATE snmp_metrics 
             SET metric_name = ? 
             WHERE host_id = ? AND metric_key = ?`,
            [customName, hostId, metricKey]
          );
        }
      }
    } else {
      // Insert new config
      configData.createdAt = new Date();
      await db.insert('host_metrics_logging', configData);
      
      // Update metric names in snmp_metrics table
      // Verwende filteredCustomNames statt customNames
      if (filteredCustomNames && Object.keys(filteredCustomNames).length > 0) {
        for (const [metricKey, customName] of Object.entries(filteredCustomNames)) {
          await pool.execute(
            `UPDATE snmp_metrics 
             SET metric_name = ? 
             WHERE host_id = ? AND metric_key = ?`,
            [customName, hostId, metricKey]
          );
        }
      }
    }
    
    // Create audit log
    await createAuditLog(
      req.user.id,
      'metrics_logging_updated',
      'hosts',
      hostId,
      configData,
      getClientIp(req),
      host.name
    );
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating metrics logging config:', error);
    res.status(500).json({ error: 'Failed to update logging configuration' });
  }
});

// SSE endpoint for real-time metrics updates
router.get('/:id/metrics-stream', async (req, res) => {

  try {
    const hostId = parseInt(req.params.id);
    logger.info(`SSE request for host ${hostId}`);
    
    // Get token from query parameter (SSE doesn't support headers)
    const token = req.query.token;
    if (!token) {

      logger.warn('SSE request without token');
      return res.status(401).json({ error: 'No token provided' });
    }
    
    // Verify token manually
    const jwt = require('jsonwebtoken');
    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;

      logger.info(`Token verified for user ${userId}`);
    } catch (tokenError) {

      logger.error('Token verification failed:', tokenError.message);
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Check if user owns this host
    const host = await db.findOne('hosts', { 
      id: hostId, 
      createdBy: userId
    });
    
    if (!host) {

      logger.warn(`Host ${hostId} not found for user ${userId}`);
      return res.status(404).json({ error: 'Host not found' });
    }

    // Add SSE connection
    SSEManager.addConnection(hostId, res);
    
    logger.info(`SSE connection established for host ${hostId} by user ${userId}`);
    
    // Keep connection open
    req.on('close', () => {
      logger.info(`SSE connection closed for host ${hostId} by user ${userId}`);
      SSEManager.removeConnection(hostId, res);
    });
    
  } catch (error) {

    logger.error('Error establishing SSE connection:', error);
    res.status(500).json({ error: 'Failed to establish SSE connection' });
  }
});

module.exports = router;
