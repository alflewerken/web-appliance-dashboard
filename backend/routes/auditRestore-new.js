const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');
const db = new QueryBuilder(pool);
const { requireAdmin } = require('../utils/auth');
const { createAuditLog } = require('../utils/auditLogger');
const { broadcast } = require('./sse');
const { getClientIp } = require('../utils/getClientIp');
const { restoreBackgroundImageFromAuditLog } = require('../utils/backgroundImageHelper');

// Get audit log details with restore options
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const logs = await db.selectWithJoin({
      from: 'audit_logs',
      select: [
        'audit_logs.id',
        'audit_logs.user_id',
        'audit_logs.action',
        'audit_logs.resource_type', 
        'audit_logs.resource_id',
        'audit_logs.details',
        'audit_logs.ip_address',
        'audit_logs.created_at',
        'users.username'
      ],
      joins: [{
        table: 'users',
        on: 'audit_logs.user_id = users.id',
        type: 'LEFT'
      }],
      where: { 'audit_logs.id': req.params.id },
      options: { limit: 1 }
    });

    if (logs.length === 0) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    const log = logs[0];

    // Parse details JSON
    let details = {};
    try {
      details = JSON.parse(log.details || '{}');
    } catch (e) {
      console.error('Error parsing audit log details:', e);
    }

    // Check if the resource can be restored
    let canRestore = false;
    let restoreInfo = null;

    // Handle delete actions
    if (['category_deleted', 'user_deleted', 'service_deleted', 'appliance_deleted', 
         'ssh_host_deleted', 'host_deleted'].includes(log.action)) {
      canRestore = true;
      const resourceData = details[log.resource_type] || details.category || details.user || 
                          details.service || details.appliance || details.deleted_appliance ||
                          details.deleted_service || details.deleted_category || details.deleted_user || 
                          details.deleted_host;

      restoreInfo = {
        type: log.resource_type,
        data: resourceData,
      };
    }

    // Handle update actions (including reverts)
    if (['category_updated', 'user_updated', 'service_updated', 'appliance_update',
         'appliance_updated', 'appliance_reverted', 'host_updated'].includes(log.action) && 
         details.original_data) {
      canRestore = true;
      restoreInfo = {
        type: log.resource_type,
        original_data: details.original_data,
        new_data: details.new_data,
        canRevertToOriginal: true,
      };
    }

    res.json({
      ...log,
      details,
      canRestore,
      restoreInfo,
    });
  } catch (error) {
    console.error('Error fetching audit log details:', error);
    res.status(500).json({ error: 'Failed to fetch audit log details' });
  }
});
// Restore deleted category  
router.post('/restore/category/:logId', requireAdmin, async (req, res) => {
  try {
    const result = await db.transaction(async (trx) => {
      // Get the audit log
      const logs = await trx.select('audit_logs', 
        { 
          id: req.params.logId,
          action: 'category_deleted'
        },
        { limit: 1 }
      );

      if (logs.length === 0) {
        throw new Error('Audit log not found or not a category deletion');
      }

      const log = logs[0];
      const details = JSON.parse(log.details || '{}');
      const categoryData = details.category;

      if (!categoryData) {
        throw new Error('No category data found in audit log');
      }

      // Use new name if provided, otherwise use original name
      const categoryName = req.body.newName || categoryData.name;

      // Check if category name already exists
      const existing = await trx.select('categories', 
        { name: categoryName },
        { limit: 1 }
      );

      if (existing.length > 0) {
        throw new Error('Category with this name already exists');
      }

      // Restore the category
      const result = await trx.insert('categories', {
        name: categoryName,
        icon: categoryData.icon || 'Folder',
        color: categoryData.color || '#007AFF',
        description: categoryData.description || '',
        isSystem: categoryData.is_system || 0,
        order: categoryData.order || 0
      });

      // Create audit log for restoration
      await createAuditLog(
        req.user.id,
        'category_restored',
        'category',
        result.insertId,
        {
          restoredFromLogId: req.params.logId,
          restoredCategoryData: categoryData,
          newName: categoryName !== categoryData.name ? categoryName : undefined
        },
        getClientIp(req)
      );

      // Broadcast the restoration
      broadcast('category_restored', {
        categoryId: result.insertId,
        categoryName: categoryName,
        restoredBy: req.user.username
      });

      return {
        success: true,
        message: 'Category restored successfully',
        categoryId: result.insertId,
        categoryName: categoryName
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error restoring category:', error);
    res.status(error.message.includes('already exists') ? 409 : 500)
      .json({ error: error.message || 'Failed to restore category' });
  }
});

// Revert category to original state
router.post('/revert/category/:logId', requireAdmin, async (req, res) => {
  try {
    const result = await db.transaction(async (trx) => {
      // Get the audit log
      const logs = await trx.select('audit_logs',
        {
          id: req.params.logId,
          action: 'category_updated'
        },
        { limit: 1 }
      );

      if (logs.length === 0) {
        throw new Error('Audit log not found or not a category update');
      }

      const log = logs[0];
      const details = JSON.parse(log.details || '{}');
      const originalData = details.original_data;

      if (!originalData) {
        throw new Error('No original data found in audit log');
      }

      // Check if category still exists
      const existing = await trx.select('categories',
        { id: log.resourceId },
        { limit: 1 }
      );

      if (existing.length === 0) {
        throw new Error('Category no longer exists');
      }

      // Revert the category
      await trx.update('categories', {
        name: originalData.name,
        icon: originalData.icon,
        color: originalData.color,
        description: originalData.description
      }, { id: log.resourceId });

      // Create audit log for revert
      await createAuditLog(
        req.user.id,
        'category_reverted',
        'category',
        log.resourceId,
        {
          revertedFromLogId: req.params.logId,
          revertedData: originalData,
          previousData: details.new_data
        },
        getClientIp(req)
      );

      // Broadcast the update
      broadcast('category_updated', {
        categoryId: log.resourceId,
        revertedBy: req.user.username
      });

      return {
        success: true,
        message: 'Category reverted to original state',
        categoryId: log.resourceId
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error reverting category:', error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: error.message || 'Failed to revert category' });
  }
});// Revert user to original state
router.post('/revert/user/:logId', requireAdmin, async (req, res) => {
  try {
    const result = await db.transaction(async (trx) => {
      // Get the audit log
      const logs = await trx.select('audit_logs', {
        id: req.params.logId,
        action: 'user_updated'
      }, { limit: 1 });

      if (logs.length === 0) {
        throw new Error('Audit log not found or not a user update');
      }

      const log = logs[0];
      const details = JSON.parse(log.details || '{}');
      const originalData = details.original_data;

      if (!originalData) {
        throw new Error('No original data found in audit log');
      }

      // Check if user still exists
      const existing = await trx.select('users',
        { id: log.resourceId },
        { limit: 1 }
      );

      if (existing.length === 0) {
        throw new Error('User no longer exists');
      }

      // Build update data based on available original data
      const updateData = {};
      
      if (originalData.username !== undefined) {
        updateData.username = originalData.username;
      }
      if (originalData.email !== undefined) {
        updateData.email = originalData.email;
      }
      if (originalData.role !== undefined) {
        updateData.role = originalData.role;
      }
      if (originalData.is_active !== undefined) {
        updateData.isActive = originalData.is_active;
      }

      if (Object.keys(updateData).length === 0) {
        throw new Error('No fields to revert');
      }

      // Revert the user
      await trx.update('users', updateData, { id: log.resourceId });

      // Create audit log for reversion
      await createAuditLog(
        req.user.id,
        'user_reverted',
        'users',
        log.resourceId,
        {
          revertedFromLogId: log.id,
          revertedToData: originalData,
          revertedFromData: details.new_data,
          revertedBy: req.user.username
        },
        getClientIp(req)
      );

      // Broadcast updates
      broadcast('user_updated', {
        id: log.resourceId,
        ...originalData
      });

      return {
        success: true,
        message: 'User reverted to original state successfully',
        userId: log.resourceId
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error reverting user:', error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: error.message || 'Failed to revert user' });
  }
});
// Restore deleted appliance
router.post('/restore/appliances/:logId', requireAdmin, async (req, res) => {
  try {
    const result = await db.transaction(async (trx) => {
      // Get the audit log
      const logs = await trx.select('audit_logs', {
        id: req.params.logId,
        action: 'appliance_deleted'
      }, { limit: 1 });

      if (logs.length === 0) {
        throw new Error('Audit log not found or not an appliance deletion');
      }

      const log = logs[0];
      const details = JSON.parse(log.details || '{}');
      const applianceData = details.service || details.appliance;

      if (!applianceData) {
        throw new Error('No appliance data found in audit log');
      }

      // Use new name if provided, otherwise use original name
      const applianceName = req.body.newName || applianceData.name;

      // Check if appliance name already exists
      const existing = await trx.select('appliances',
        { name: applianceName },
        { limit: 1 }
      );

      if (existing.length > 0) {
        throw new Error('Appliance with this name already exists');
      }

      // Restore background image if it was saved
      let restoredBackgroundImage = applianceData.background_image;
      if (details.backgroundImageData) {
        const newFilename = await restoreBackgroundImageFromAuditLog(details.backgroundImageData);
        if (newFilename) {
          restoredBackgroundImage = newFilename;
        }
      }

      // Restore the appliance
      const insertResult = await trx.insert('appliances', {
        name: applianceName,
        url: applianceData.url,
        description: applianceData.description,
        icon: applianceData.icon,
        color: applianceData.color,
        category: applianceData.category,
        isFavorite: applianceData.isFavorite || 0,
        startCommand: applianceData.start_command,
        stopCommand: applianceData.stop_command,
        statusCommand: applianceData.status_command,
        restartCommand: applianceData.restart_command,
        autoStart: applianceData.auto_start || 0,
        sshConnection: applianceData.ssh_connection,
        transparency: applianceData.transparency,
        blurAmount: applianceData.blur_amount,
        openModeMini: applianceData.open_mode_mini,
        openModeMobile: applianceData.open_mode_mobile,
        openModeDesktop: applianceData.open_mode_desktop,
        serviceStatus: applianceData.service_status,
        backgroundImage: restoredBackgroundImage,
        remoteDesktopEnabled: applianceData.remote_desktop_enabled,
        remoteDesktopType: applianceData.remote_desktop_type,
        remoteProtocol: applianceData.remote_protocol,
        remoteHost: applianceData.remote_host,
        remotePort: applianceData.remote_port,
        remoteUsername: applianceData.remote_username,
        remotePasswordEncrypted: applianceData.remote_password_encrypted,
        rustdeskId: applianceData.rustdeskId,
        rustdeskPasswordEncrypted: applianceData.rustdesk_password_encrypted,
        rustdeskInstalled: applianceData.rustdesk_installed,
        rustdeskInstallationDate: applianceData.rustdesk_installation_date,
        guacamolePerformanceMode: applianceData.guacamolePerformanceMode,
        orderIndex: applianceData.order_index
      });

      const restoredApplianceId = insertResult.insertId;

      // Restore commands if they existed
      if (details.commands && Array.isArray(details.commands)) {
        for (const cmd of details.commands) {
          await trx.insert('appliance_commands', {
            applianceId: restoredApplianceId,
            description: cmd.description,
            command: cmd.command,
            hostId: cmd.host_id,
            orderIndex: cmd.order_index || 0
          });
        }
      }

      // Create audit log for restoration
      await createAuditLog(
        req.user.id,
        'appliance_restored',
        'appliances',
        restoredApplianceId,
        {
          restoredFromLogId: req.params.logId,
          restoredApplianceData: applianceData,
          newName: applianceName !== applianceData.name ? applianceName : undefined
        },
        getClientIp(req)
      );

      // Broadcast the restoration
      broadcast('appliance_restored', {
        applianceId: restoredApplianceId,
        applianceName: applianceName,
        restoredBy: req.user.username
      });

      return {
        success: true,
        message: 'Appliance restored successfully',
        applianceId: restoredApplianceId,
        applianceName: applianceName
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error restoring appliance:', error);
    res.status(error.message.includes('already exists') ? 409 : 500)
      .json({ error: error.message || 'Failed to restore appliance' });
  }
});
// Revert appliance to original state
router.post('/revert/appliances/:logId', requireAdmin, async (req, res) => {
  try {
    const result = await db.transaction(async (trx) => {
      // Get the audit log
      const logs = await trx.select('audit_logs', {
        id: req.params.logId,
        action: 'appliance_update'
      }, { limit: 1 });

      if (logs.length === 0) {
        throw new Error('Audit log not found or not an appliance update');
      }

      const log = logs[0];
      const details = JSON.parse(log.details || '{}');
      const originalData = details.original_data;

      if (!originalData) {
        throw new Error('No original data found in audit log');
      }

      // Check if appliance still exists
      const existing = await trx.select('appliances',
        { id: log.resourceId },
        { limit: 1 }
      );

      if (existing.length === 0) {
        throw new Error('Appliance no longer exists');
      }

      // Build update data from original data
      const updateData = {};
      
      // Map all the fields from snake_case to camelCase
      if (originalData.name !== undefined) updateData.name = originalData.name;
      if (originalData.url !== undefined) updateData.url = originalData.url;
      if (originalData.description !== undefined) updateData.description = originalData.description;
      if (originalData.icon !== undefined) updateData.icon = originalData.icon;
      if (originalData.color !== undefined) updateData.color = originalData.color;
      if (originalData.category !== undefined) updateData.category = originalData.category;
      if (originalData.isFavorite !== undefined) updateData.isFavorite = originalData.isFavorite;
      if (originalData.start_command !== undefined) updateData.startCommand = originalData.start_command;
      if (originalData.stop_command !== undefined) updateData.stopCommand = originalData.stop_command;
      if (originalData.status_command !== undefined) updateData.statusCommand = originalData.status_command;
      if (originalData.restart_command !== undefined) updateData.restartCommand = originalData.restart_command;
      if (originalData.auto_start !== undefined) updateData.autoStart = originalData.auto_start;
      if (originalData.ssh_connection !== undefined) updateData.sshConnection = originalData.ssh_connection;
      if (originalData.transparency !== undefined) updateData.transparency = originalData.transparency;
      if (originalData.blur_amount !== undefined) updateData.blurAmount = originalData.blur_amount;
      if (originalData.background_image !== undefined) updateData.backgroundImage = originalData.background_image;
      if (originalData.remote_desktop_enabled !== undefined) updateData.remoteDesktopEnabled = originalData.remote_desktop_enabled;
      if (originalData.remote_desktop_type !== undefined) updateData.remoteDesktopType = originalData.remote_desktop_type;
      if (originalData.remote_protocol !== undefined) updateData.remoteProtocol = originalData.remote_protocol;
      if (originalData.remote_host !== undefined) updateData.remoteHost = originalData.remote_host;
      if (originalData.remote_port !== undefined) updateData.remotePort = originalData.remote_port;
      if (originalData.remote_username !== undefined) updateData.remoteUsername = originalData.remote_username;

      if (Object.keys(updateData).length === 0) {
        throw new Error('No fields to revert');
      }

      // Revert the appliance
      await trx.update('appliances', updateData, { id: log.resourceId });

      // Create audit log for reversion
      await createAuditLog(
        req.user.id,
        'appliance_reverted',
        'appliances',
        log.resourceId,
        {
          revertedFromLogId: req.params.logId,
          revertedToData: originalData,
          revertedFromData: details.new_data,
          revertedBy: req.user.username
        },
        getClientIp(req)
      );

      // Broadcast updates
      broadcast('appliance_updated', {
        id: log.resourceId,
        ...originalData
      });

      return {
        success: true,
        message: 'Appliance reverted to original state successfully',
        applianceId: log.resourceId
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error reverting appliance:', error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: error.message || 'Failed to revert appliance' });
  }
});
// Restore deleted users (batch/duplicate route)
router.post('/restore/users/:logId', requireAdmin, async (req, res) => {
  try {
    const result = await db.transaction(async (trx) => {
      // Get the audit log
      const logs = await trx.select('audit_logs', {
        id: req.params.logId,
        $or: [
          { action: 'user_delete' },
          { action: 'user_deleted' }
        ]
      }, { limit: 1 });

      if (logs.length === 0) {
        throw new Error('Audit log not found or not a user deletion');
      }

      const log = logs[0];
      const details = JSON.parse(log.details || '{}');
      const userData = details.user;

      if (!userData) {
        throw new Error('No user data found in audit log');
      }

      // Check if username or email already exists
      const existing = await trx.select('users', {
        $or: [
          { username: userData.username },
          { email: userData.email }
        ]
      }, { limit: 1 });

      if (existing.length > 0) {
        throw new Error('User with this username or email already exists');
      }

      // Restore the user (reuse the password hash from the deleted user)
      const insertResult = await trx.insert('users', {
        username: userData.username,
        email: userData.email,
        passwordHash: userData.password_hash || '',
        role: userData.role || 'user',
        isActive: userData.is_active !== undefined ? userData.is_active : 1
      });

      const restoredUserId = insertResult.insertId;

      // Create audit log for restoration
      await createAuditLog(
        req.user.id,
        'user_restored',
        'users',
        restoredUserId,
        {
          restoredFromLogId: req.params.logId,
          restoredUserData: userData,
          restoredBy: req.user.username
        },
        getClientIp(req)
      );

      // Broadcast the restoration
      broadcast('user_restored', {
        id: restoredUserId,
        username: userData.username,
        email: userData.email,
        role: userData.role,
        isActive: userData.is_active
      });

      return {
        success: true,
        message: 'User restored successfully',
        userId: restoredUserId,
        username: userData.username
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error restoring user:', error);
    res.status(error.message.includes('already exists') ? 409 : 500)
      .json({ error: error.message || 'Failed to restore user' });
  }
});
// Revert users to original state (batch/duplicate route)
router.post('/revert/users/:logId', requireAdmin, async (req, res) => {
  try {
    const result = await db.transaction(async (trx) => {
      // Get the audit log
      const logs = await trx.select('audit_logs', {
        id: req.params.logId,
        $or: [
          { action: 'user_update' },
          { action: 'user_updated' },
          { action: 'user_reverted' }
        ]
      }, { limit: 1 });

      if (logs.length === 0) {
        throw new Error('Audit log not found or not a user update');
      }

      const log = logs[0];
      const details = JSON.parse(log.details || '{}');
      const originalData = details.original_data;

      if (!originalData) {
        throw new Error('No original data found in audit log');
      }

      // Check if user still exists
      const existing = await trx.select('users',
        { id: log.resourceId },
        { limit: 1 }
      );

      if (existing.length === 0) {
        throw new Error('User no longer exists');
      }

      // Build update data from original data
      const updateData = {};
      
      if (originalData.username !== undefined) {
        updateData.username = originalData.username;
      }
      if (originalData.email !== undefined) {
        updateData.email = originalData.email;
      }
      if (originalData.role !== undefined) {
        updateData.role = originalData.role;
      }
      if (originalData.is_active !== undefined) {
        updateData.isActive = originalData.is_active;
      }
      if (originalData.password_hash !== undefined) {
        updateData.passwordHash = originalData.password_hash;
      }

      if (Object.keys(updateData).length === 0) {
        throw new Error('No fields to revert');
      }

      // Revert the user
      await trx.update('users', updateData, { id: log.resourceId });

      // Create audit log for reversion
      await createAuditLog(
        req.user.id,
        'user_reverted',
        'users',
        log.resourceId,
        {
          revertedFromLogId: req.params.logId,
          revertedToData: originalData,
          revertedFromData: details.new_data || existing[0],
          revertedBy: req.user.username
        },
        getClientIp(req)
      );

      // Broadcast updates
      broadcast('user_updated', {
        id: log.resourceId,
        ...originalData
      });

      return {
        success: true,
        message: 'User reverted to original state successfully',
        userId: log.resourceId
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error reverting user:', error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: error.message || 'Failed to revert user' });
  }
});
// Restore deleted host
router.post('/restore/hosts/:logId', requireAdmin, async (req, res) => {
  try {
    const result = await db.transaction(async (trx) => {
      // Get the audit log
      const logs = await trx.select('audit_logs', {
        id: req.params.logId,
        action: 'host_deleted'
      }, { limit: 1 });

      if (logs.length === 0) {
        throw new Error('Audit log not found or not a host deletion');
      }

      const log = logs[0];
      const details = JSON.parse(log.details || '{}');

      if (!details.name) {
        throw new Error('No host data found in audit log');
      }

      // Check if host with same name already exists
      const existing = await trx.select('hosts',
        { name: details.name },
        { limit: 1 }
      );

      if (existing.length > 0) {
        throw new Error(`Host with name "${details.name}" already exists`);
      }

      // Restore the host
      const insertResult = await trx.insert('hosts', {
        name: details.name,
        description: details.description || null,
        hostname: details.hostname,
        port: details.port,
        username: details.username,
        password: details.password,
        privateKey: details.private_key,
        sshKeyName: details.sshKeyName,
        icon: details.icon,
        color: details.color,
        transparency: details.transparency,
        blur: details.blur,
        remoteDesktopEnabled: details.remote_desktop_enabled,
        remoteDesktopType: details.remote_desktop_type,
        remoteProtocol: details.remote_protocol,
        remotePort: details.remote_port,
        remoteUsername: details.remote_username,
        remotePassword: details.remote_password,
        guacamolePerformanceMode: details.guacamole_performance_mode,
        rustdeskId: details.rustdesk_id,
        rustdeskPassword: details.rustdeskPassword,
        createdBy: req.user.id,
        updatedBy: req.user.id
      });

      const restoredHostId = insertResult.insertId;

      // Create audit log for restoration
      await createAuditLog(
        req.user.id,
        'host_restored',
        'hosts',
        restoredHostId,
        {
          restoredFromLogId: req.params.logId,
          restoredHostData: details,
          restoredBy: req.user.username
        },
        getClientIp(req)
      );

      // Broadcast the restoration
      broadcast('host_restored', {
        hostId: restoredHostId,
        hostName: details.name,
        restoredBy: req.user.username
      });

      return {
        success: true,
        message: 'Host restored successfully',
        hostId: restoredHostId,
        hostName: details.name
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error restoring host:', error);
    res.status(error.message.includes('already exists') ? 409 : 500)
      .json({ error: error.message || 'Failed to restore host' });
  }
});

// Revert host to original state
router.post('/revert/hosts/:logId', requireAdmin, async (req, res) => {
  try {
    const result = await db.transaction(async (trx) => {
      // Get the audit log
      const logs = await trx.select('audit_logs', {
        id: req.params.logId,
        action: 'host_updated'
      }, { limit: 1 });

      if (logs.length === 0) {
        throw new Error('Audit log not found or not a host update');
      }

      const log = logs[0];
      const details = JSON.parse(log.details || '{}');
      const originalData = details.oldValues || details.original_data;

      if (!originalData) {
        throw new Error('No original data found in audit log');
      }

      // Check if host still exists
      const existing = await trx.select('hosts',
        { id: log.resourceId },
        { limit: 1 }
      );

      if (existing.length === 0) {
        throw new Error('Host no longer exists');
      }

      // Build update data from original data
      const updateData = {};
      
      if (originalData.name !== undefined) updateData.name = originalData.name;
      if (originalData.description !== undefined) updateData.description = originalData.description;
      if (originalData.hostname !== undefined) updateData.hostname = originalData.hostname;
      if (originalData.port !== undefined) updateData.port = originalData.port;
      if (originalData.username !== undefined) updateData.username = originalData.username;
      if (originalData.password !== undefined) updateData.password = originalData.password;
      if (originalData.private_key !== undefined) updateData.privateKey = originalData.private_key;
      if (originalData.sshKeyName !== undefined) updateData.sshKeyName = originalData.sshKeyName;
      if (originalData.icon !== undefined) updateData.icon = originalData.icon;
      if (originalData.color !== undefined) updateData.color = originalData.color;
      if (originalData.transparency !== undefined) updateData.transparency = originalData.transparency;
      if (originalData.blur !== undefined) updateData.blur = originalData.blur;
      if (originalData.remote_desktop_enabled !== undefined) updateData.remoteDesktopEnabled = originalData.remote_desktop_enabled;
      if (originalData.remote_desktop_type !== undefined) updateData.remoteDesktopType = originalData.remote_desktop_type;
      if (originalData.remote_protocol !== undefined) updateData.remoteProtocol = originalData.remote_protocol;
      if (originalData.remote_port !== undefined) updateData.remotePort = originalData.remote_port;
      if (originalData.remote_username !== undefined) updateData.remoteUsername = originalData.remote_username;
      if (originalData.remote_password !== undefined) updateData.remotePassword = originalData.remote_password;

      if (Object.keys(updateData).length === 0) {
        throw new Error('No fields to revert');
      }

      // Revert the host
      await trx.update('hosts', updateData, { id: log.resourceId });

      // Create audit log for reversion
      await createAuditLog(
        req.user.id,
        'host_reverted',
        'hosts',
        log.resourceId,
        {
          revertedFromLogId: req.params.logId,
          revertedToData: originalData,
          revertedFromData: details.changes || details.new_data,
          revertedBy: req.user.username
        },
        getClientIp(req)
      );

      // Broadcast updates
      broadcast('host_updated', {
        id: log.resourceId,
        ...originalData
      });

      return {
        success: true,
        message: 'Host reverted to original state successfully',
        hostId: log.resourceId
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error reverting host:', error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: error.message || 'Failed to revert host' });
  }
});

module.exports = router;