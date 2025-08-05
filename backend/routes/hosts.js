const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin, requirePermission } = require('../utils/auth');
const { createAuditLog } = require('../utils/auditLogger');
const pool = require('../utils/database');
const { logger } = require('../utils/logger');
const bcrypt = require('bcryptjs');
const sseManager = require('../utils/sseManager');
const { getClientIp } = require('../utils/getClientIp');
const {
  mapHostDbToJs,
  mapHostJsToDb,
  getHostSelectColumns,
  mapHostDbToJsWithPasswords
} = require('../utils/dbFieldMappingHosts');

// Get all hosts
router.get('/', verifyToken, async (req, res) => {
  try {
    // User can only see their own hosts
    const [hosts] = await pool.execute(`
      SELECT ${getHostSelectColumns()}
      FROM hosts
      WHERE created_by = ?
      ORDER BY name ASC
    `, [req.user.id]);

    res.json({
      success: true,
      hosts: hosts.map(mapHostDbToJs)
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
    const [hosts] = await pool.execute(`
      SELECT 
        id,
        name,
        description,
        hostname,
        port,
        username,
        sshKeyName,
        icon,
        color,
        transparency,
        blur,
        remote_desktop_enabled,
        remote_desktop_type,
        remote_protocol,
        remote_port,
        remote_username,
        guacamolePerformanceMode,
        rustdeskId,
        created_at,
        updated_at
      FROM hosts
      WHERE id = ? AND created_by = ?
    `, [req.params.id, req.user.id]);

    if (hosts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Host not found'
      });
    }

    res.json({
      success: true,
      host: hosts[0]
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
      port = 22,
      username,
      password,
      privateKey,
      sshKeyName,
      icon = 'Server',
      color = '#007AFF',
      transparency = 0.1,
      blur = 0,
      // Remote Desktop fields
      remoteDesktopEnabled = false,
      remoteDesktopType = 'guacamole',
      remoteProtocol = 'vnc',
      remotePort,
      remoteUsername,
      remotePassword,
      guacamolePerformanceMode = 'balanced',
      rustdeskId,
      rustdeskPassword
    } = req.body;

    // Manual validation
    const errors = [];
    if (!name || !name.trim()) errors.push({ field: 'name', message: 'Name is required' });
    if (!hostname || !hostname.trim()) errors.push({ field: 'hostname', message: 'Hostname is required' });
    if (!username || !username.trim()) errors.push({ field: 'username', message: 'Username is required' });
    if (port && (port < 1 || port > 65535)) errors.push({ field: 'port', message: 'Invalid port' });
    if (color && !/^#[0-9A-F]{6}$/i.test(color)) errors.push({ field: 'color', message: 'Invalid color format' });
    if (transparency !== undefined && (transparency < 0 || transparency > 1)) errors.push({ field: 'transparency', message: 'Invalid transparency' });
    if (blur !== undefined && (blur < 0 || blur > 20)) errors.push({ field: 'blur', message: 'Invalid blur' });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: errors
      });
    }

      // Encrypt password if provided
      let encryptedPassword = null;
      if (password) {
        encryptedPassword = await bcrypt.hash(password, 10);
      }

      // Encrypt remote desktop password with reversible encryption
      const { encrypt } = require('../utils/crypto');
      let encryptedRemotePassword = null;
      if (remotePassword) {
        encryptedRemotePassword = encrypt(remotePassword);
      }

      // Encrypt rustdesk password with reversible encryption
      let encryptedRustdeskPassword = null;
      if (rustdeskPassword) {
        encryptedRustdeskPassword = encrypt(rustdeskPassword);
      }

      // Ensure username for VNC if not provided
      let finalRemoteUsername = remoteUsername;
      if (remoteDesktopEnabled && remoteProtocol === 'vnc' && !remoteUsername) {
        // Use the SSH username as default for VNC
        finalRemoteUsername = username;
        logger.info(`Auto-setting remote_username to SSH username '${username}' for new VNC host`);
      }

      const [result] = await pool.execute(`
        INSERT INTO hosts (
          name, description, hostname, port, username, password, private_key, ssh_key_name,
          icon, color, transparency, blur,
          remote_desktop_enabled, remote_desktop_type, remote_protocol,
          remote_port, remote_username, remote_password,
          guacamole_performance_mode, rustdesk_id, rustdesk_password,
          created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        name, 
        description || null,
        hostname, 
        port, 
        username, 
        encryptedPassword || null, 
        privateKey || null, 
        sshKeyName || null,
        icon, 
        color, 
        transparency, 
        blur,
        remoteDesktopEnabled ? 1 : 0, 
        remoteDesktopType || null, 
        remoteProtocol || null,
        remotePort || null, 
        finalRemoteUsername || null, 
        encryptedRemotePassword || null,
        guacamolePerformanceMode || null, 
        rustdeskId || null, 
        encryptedRustdeskPassword || null,
        req.user.id, 
        req.user.id
      ]);

      const [newHost] = await pool.execute(`
        SELECT ${getHostSelectColumns()}
        FROM hosts
        WHERE id = ?
      `, [result.insertId]);

      logger.info(`Host created: ${name} by user ${req.user.username}`);
      
      const mappedHost = mapHostDbToJs(newHost[0]);

      // Create audit log entry
      await createAuditLog(
        req.user.id,
        'host_created',
        'host',
        result.insertId,
        {
          name,
          description,
          hostname,
          port,
          username,
          icon,
          color,
          transparency,
          blur,
          remoteDesktopEnabled,
          remoteDesktopType,
          created_by: req.user.username
        },
        getClientIp(req),
        name  // Pass the host name as resource_name
      );

      // Send SSE event for host creation
      sseManager.broadcast({
        type: 'host_created',
        data: newHost[0]
      });

      // Create Guacamole connection if remote desktop is enabled
      if (remoteDesktopEnabled) {
        const guacamoleService = require('../services/guacamoleService');
        guacamoleService.updateHostConnection(result.insertId).catch(err => {
          logger.error('Failed to create Guacamole connection:', err);
        });
      }

      res.status(201).json({
        success: true,
        host: mappedHost
      });
    } catch (error) {
      logger.error('Error creating host:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create host'
      });
    }
  }
);

// Update host
router.put('/:id', verifyToken, async (req, res) => {
  try {
    // Manual validation
    const errors = [];
    if (req.body.name !== undefined && !req.body.name.trim()) errors.push({ field: 'name', message: 'Name cannot be empty' });
    if (req.body.hostname !== undefined && !req.body.hostname.trim()) errors.push({ field: 'hostname', message: 'Hostname cannot be empty' });
    if (req.body.username !== undefined && !req.body.username.trim()) errors.push({ field: 'username', message: 'Username cannot be empty' });
    if (req.body.port !== undefined && (req.body.port < 1 || req.body.port > 65535)) errors.push({ field: 'port', message: 'Invalid port' });
    if (req.body.color !== undefined && !/^#[0-9A-F]{6}$/i.test(req.body.color)) errors.push({ field: 'color', message: 'Invalid color format' });
    if (req.body.transparency !== undefined && (req.body.transparency < 0 || req.body.transparency > 1)) errors.push({ field: 'transparency', message: 'Invalid transparency' });
    if (req.body.blur !== undefined && (req.body.blur < 0 || req.body.blur > 20)) errors.push({ field: 'blur', message: 'Invalid blur' });
    
    // Remote Desktop field validations
    if (req.body.remotePort !== undefined && req.body.remotePort !== null && (req.body.remotePort < 1 || req.body.remotePort > 65535)) {
      errors.push({ field: 'remotePort', message: 'Invalid remote port' });
    }
    if (req.body.remoteDesktopEnabled !== undefined && typeof req.body.remoteDesktopEnabled !== 'boolean') {
      errors.push({ field: 'remoteDesktopEnabled', message: 'remoteDesktopEnabled must be boolean' });
    }

    // Log the received data for debugging
    console.log('PUT /hosts/:id - Received data:', req.body);
    console.log('Validation errors:', errors);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: errors
      });
    }
      // Get the original host data before update for audit log
      const [originalHost] = await pool.execute(`
        SELECT * FROM hosts WHERE id = ? AND created_by = ?
      `, [req.params.id, req.user.id]);

      // Check if host exists and belongs to user
      if (originalHost.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Host not found or access denied'
        });
      }

      const updates = [];
      const values = [];

      // Build dynamic update query
      const allowedFields = [
        'name', 'description', 'hostname', 'port', 'username', 'icon', 'color', 'transparency', 'blur', 'privateKey',
        'sshKeyName', 'remoteDesktopEnabled', 'remoteDesktopType', 'remoteProtocol', 'remotePort',
        'remoteUsername', 'guacamole_performance_mode', 'rustdeskId'
      ];
      
      for (const field of allowedFields) {
        if (req.body.hasOwnProperty(field)) {
          let dbField = field;
          // Map camelCase to snake_case
          if (field === 'privateKey') dbField = 'private_key';
          else if (field === 'sshKeyName') dbField = 'ssh_key_name';
          else if (field === 'remoteDesktopEnabled') dbField = 'remote_desktop_enabled';
          else if (field === 'remoteDesktopType') dbField = 'remote_desktop_type';
          else if (field === 'remoteProtocol') dbField = 'remote_protocol';
          else if (field === 'remotePort') dbField = 'remote_port';
          else if (field === 'remoteUsername') dbField = 'remote_username';
          else if (field === 'rustdeskId') dbField = 'rustdesk_id';
          
          // Log for debugging
          if (field === 'sshKeyName') {
            console.log(`Setting ssh_key_name to: ${req.body[field]}`);
          }
          
          updates.push(`${dbField} = ?`);
          values.push(req.body[field]);
        }
      }

      // Handle password separately
      if (req.body.password) {
        const encryptedPassword = await bcrypt.hash(req.body.password, 10);
        updates.push('password = ?');
        values.push(encryptedPassword);
      }

      // Handle remote desktop password with reversible encryption
      const { encrypt } = require('../utils/crypto');
      if (req.body.remotePassword !== undefined && req.body.remotePassword !== '') {
        console.log('Processing remotePassword - length:', req.body.remotePassword?.length || 0);
        const encryptedRemotePassword = encrypt(req.body.remotePassword);
        updates.push('remote_password = ?');
        values.push(encryptedRemotePassword);
        console.log('Remote password will be updated (encrypted length):', encryptedRemotePassword.length);
      }
      // If remotePassword is empty or undefined, keep the existing password in DB

      // Handle rustdesk password with reversible encryption
      if (req.body.rustdeskPassword !== undefined && req.body.rustdeskPassword !== '') {
        const encryptedRustdeskPassword = encrypt(req.body.rustdeskPassword);
        updates.push('rustdesk_password = ?');
        values.push(encryptedRustdeskPassword);
      }
      // If rustdeskPassword is empty or undefined, keep the existing password in DB

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No fields to update'
        });
      }

      // Add updated_by
      updates.push('updated_by = ?');
      values.push(req.user.id);

      // Add id for WHERE clause
      values.push(req.params.id);

      await pool.execute(`
        UPDATE hosts
        SET ${updates.join(', ')}
        WHERE id = ?
      `, values);

      // Check if we need to ensure username for VNC
      const [checkHost] = await pool.execute(`
        SELECT remote_desktop_enabled, remote_protocol, remote_username, username
        FROM hosts WHERE id = ?
      `, [req.params.id]);

      if (checkHost.length > 0) {
        const host = checkHost[0];
        // If remote desktop is enabled with VNC and no username is set
        if (host.remote_desktop_enabled && host.remote_protocol === 'vnc' && !host.remote_username) {
          // Set remote_username to the host username
          if (host.username) {
            await pool.execute(
              'UPDATE hosts SET remote_username = ? WHERE id = ?',
              [host.username, req.params.id]
            );
            logger.info(`Auto-set remote_username to host username '${host.username}' for VNC host ${req.params.id}`);
          }
        }
      }

      const [updatedHost] = await pool.execute(`
        SELECT 
          id, name, description, hostname, port, username, sshKeyName,
          icon, color, transparency, blur,
          remote_desktop_enabled, remote_desktop_type, remote_protocol,
          remote_port, remote_username,
          guacamole_performance_mode, rustdeskId,
          created_at, updated_at
        FROM hosts
        WHERE id = ?
      `, [req.params.id]);

      logger.info(`Host updated: ${originalHost[0].name} by user ${req.user.username}`);

      // Create audit log entry with changes
      const changes = {};
      const oldValues = {};
      
      // Track what fields were changed
      for (const field of allowedFields) {
        if (req.body.hasOwnProperty(field)) {
          let dbField = field;
          // Map camelCase to snake_case
          if (field === 'privateKey') dbField = 'private_key';
          else if (field === 'sshKeyName') dbField = 'ssh_key_name';
          else if (field === 'remoteDesktopEnabled') dbField = 'remote_desktop_enabled';
          else if (field === 'remoteDesktopType') dbField = 'remote_desktop_type';
          else if (field === 'remoteProtocol') dbField = 'remote_protocol';
          else if (field === 'remotePort') dbField = 'remote_port';
          else if (field === 'remoteUsername') dbField = 'remote_username';
          else if (field === 'rustdeskId') dbField = 'rustdesk_id';
          
          if (originalHost[0][dbField] !== req.body[field]) {
            oldValues[field] = originalHost[0][dbField];
            changes[field] = req.body[field];
          }
        }
      }
      
      // Check password changes
      if (req.body.password) {
        changes.password = '[CHANGED]';
        oldValues.password = '[HIDDEN]';
      }
      if (req.body.remotePassword) {
        changes.remotePassword = '[CHANGED]';
        oldValues.remotePassword = '[HIDDEN]';
      }
      if (req.body.rustdeskPassword) {
        changes.rustdesk_password = '[CHANGED]';
        oldValues.rustdesk_password = '[HIDDEN]';
      }

      await createAuditLog(
        req.user.id,
        'host_updated',
        'host',
        req.params.id,
        {
          name: originalHost[0].name,
          changes,
          oldValues,
          updated_by: req.user.username
        },
        getClientIp(req),
        originalHost[0].name  // Pass the host name as resource_name
      );

      // Send SSE event for host update
      sseManager.broadcast({
        type: 'host_updated',
        data: updatedHost[0]
      });

      // Update Guacamole connection if remote desktop settings changed
      if (req.body.hasOwnProperty('remote_desktop_enabled') ||
          req.body.hasOwnProperty('remote_protocol') ||
          req.body.hasOwnProperty('remote_port') ||
          req.body.hasOwnProperty('remote_username') ||
          req.body.hasOwnProperty('remote_password')) {
        const guacamoleService = require('../services/guacamoleService');
        guacamoleService.updateHostConnection(req.params.id).catch(err => {
          logger.error('Failed to update Guacamole connection:', err);
        });
      }

      res.json({
        success: true,
        host: updatedHost[0]
      });
    } catch (error) {
      logger.error('Error updating host:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update host'
      });
    }
  }
);

// Delete host
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    // Get the complete host data before deletion for audit log and potential restore
    const [existing] = await pool.execute('SELECT * FROM hosts WHERE id = ? AND created_by = ?', [req.params.id, req.user.id]);
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Host not found or access denied'
      });
    }

    const hostData = existing[0];
    
    await pool.execute('DELETE FROM hosts WHERE id = ?', [req.params.id]);

    // Delete Guacamole connection
    const guacamoleService = require('../services/guacamoleService');
    guacamoleService.deleteHostConnection(req.params.id).catch(err => {
      logger.error('Failed to delete Guacamole connection:', err);
    });

    logger.info(`Host deleted: ${hostData.name} by user ${req.user.username}`);

    // Create audit log entry with full host data for potential restore
    await createAuditLog(
      req.user.id,
      'host_deleted',
      'host',
      req.params.id,
      {
        name: hostData.name,
        description: hostData.description,
        hostname: hostData.hostname,
        port: hostData.port,
        username: hostData.username,
        sshKeyName: hostData.sshKeyName,
        icon: hostData.icon,
        color: hostData.color,
        transparency: hostData.transparency,
        blur: hostData.blur,
        remote_desktop_enabled: hostData.remote_desktop_enabled,
        remote_desktop_type: hostData.remote_desktop_type,
        remote_protocol: hostData.remote_protocol,
        remote_port: hostData.remote_port,
        remote_username: hostData.remote_username,
        guacamolePerformanceMode: hostData.guacamolePerformanceMode,
        rustdeskId: hostData.rustdeskId,
        deleted_by: req.user.username,
        // Store encrypted passwords for potential restore (still encrypted)
        password: hostData.password,
        remote_password: hostData.remote_password,
        rustdeskPassword: hostData.rustdeskPassword,
        private_key: hostData.private_key
      },
      getClientIp(req),
      hostData.name  // Pass the host name as resource_name
    );

    // Send SSE event for host deletion
    sseManager.broadcast({
      type: 'host_deleted',
      data: {
        id: req.params.id,
        name: hostData.name
      }
    });

    res.json({
      success: true,
      message: 'Host deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting host:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete host'
    });
  }
});

/**
 * Generate Guacamole token for host remote desktop
 */
router.post('/:id/remoteDesktopToken', verifyToken, async (req, res) => {
  const hostId = req.params.id;
  
  try {
    // GuacamoleService verwenden für sichere Token-Generierung
    const guacamoleService = require('../services/guacamoleService');
    const result = await guacamoleService.generateRemoteDesktopToken(req.user, hostId);
    
    // Get host name for audit log
    const [hostInfo] = await pool.execute('SELECT name FROM hosts WHERE id = ?', [hostId]);
    const hostName = hostInfo[0]?.name || `Host #${hostId}`;
    
    // Audit Log erstellen
    await createAuditLog(
      req.user.id,
      'remote_desktop_access',
      'host',
      hostId,
      {
        host_id: hostId,
        host_name: hostName,
        protocol: result.protocol
      },
      getClientIp(req),
      hostName  // Pass the host name as resource_name
    );
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error generating remote desktop token:', error);
    res.status(500).json({ 
      error: 'Failed to generate remote desktop token',
      details: error.message 
    });
  }
});

/**
 * Log RustDesk access for host
 */
router.post('/:id/rustdeskAccess', verifyToken, async (req, res) => {
  const hostId = req.params.id;
  const userId = req.user?.id || 1;
  const ipAddress = getClientIp(req);
  
  try {
    // Get host info - check ownership
    const [hosts] = await pool.execute(
      'SELECT name, rustdesk_id FROM hosts WHERE id = ? AND created_by = ?',
      [hostId, userId]
    );

    if (hosts.length === 0) {
      return res.status(404).json({ error: 'Host not found or access denied' });
    }

    const host = hosts[0];
    
    // Debug log
    logger.info(`RustDesk access - Host ID: ${hostId}, Host Name: ${host.name}`);
    
    // Create audit log
    await createAuditLog(
      userId,
      'rustdesk_access',
      'host',
      hostId,
      {
        host_name: host.name,
        rustdeskId: host.rustdeskId,
        access_type: 'remote_desktop',
        protocol: 'rustdesk'
      },
      ipAddress,
      host.name  // Pass the host name as resource_name
    );
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error logging RustDesk access:', error);
    res.status(500).json({ error: 'Failed to log access' });
  }
});

/**
 * Force update Guacamole connection for host
 */
router.post('/:id/update-guacamole-connection', verifyToken, async (req, res) => {
  const hostId = req.params.id;
  
  try {
    // Check if user owns the host
    const [hosts] = await pool.execute(
      'SELECT id FROM hosts WHERE id = ? AND created_by = ?',
      [hostId, req.user.id]
    );
    
    if (hosts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Host not found or access denied'
      });
    }
    
    const guacamoleService = require('../services/guacamoleService');
    await guacamoleService.updateHostConnection(hostId);
    
    res.json({
      success: true,
      message: 'Guacamole connection updated'
    });
    
  } catch (error) {
    logger.error('Error updating Guacamole connection:', error);
    res.status(500).json({ 
      error: 'Failed to update Guacamole connection',
      details: error.message 
    });
  }
});

module.exports = router;
