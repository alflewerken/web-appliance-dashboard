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
const { syncGuacamoleConnection } = require('../utils/guacamoleHelper');
const { decrypt } = require('../utils/encryption');

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
      const details = typeof log.details === 'string' 
        ? JSON.parse(log.details || '{}')
        : log.details || {};
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
        getClientIp(req),
        categoryName  // Pass the category name as resourceName
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
      const details = typeof log.details === 'string' 
        ? JSON.parse(log.details || '{}')
        : log.details || {};
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
        getClientIp(req),
        originalData.name  // Pass the category name as resourceName
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
      const details = typeof log.details === 'string' 
        ? JSON.parse(log.details || '{}')
        : log.details || {};
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
router.post('/restore/appliance/:logId', requireAdmin, async (req, res) => {
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
      const details = typeof log.details === 'string' 
        ? JSON.parse(log.details || '{}')
        : log.details || {};
      
      // The appliance data could be in different places depending on how it was saved
      // New format: directly in details (spread operator)
      // Old format: under details.service or details.appliance
      let applianceData = null;
      
      if (details.service) {
        applianceData = details.service;
      } else if (details.appliance) {
        applianceData = details.appliance;
      } else if (details.name && details.url) {
        // New format: appliance data is directly in details
        applianceData = details;
      }

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
      let restoredBackgroundImage = applianceData.backgroundImage || applianceData.background_image;
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
        isFavorite: applianceData.isFavorite || applianceData.is_favorite || 0,
        startCommand: applianceData.startCommand || applianceData.start_command,
        stopCommand: applianceData.stopCommand || applianceData.stop_command,
        statusCommand: applianceData.statusCommand || applianceData.status_command,
        restartCommand: applianceData.restartCommand || applianceData.restart_command,
        autoStart: applianceData.autoStart || applianceData.auto_start || 0,
        sshConnection: applianceData.sshConnection || applianceData.ssh_connection,
        transparency: applianceData.transparency,
        blurAmount: applianceData.blurAmount || applianceData.blur_amount,
        openModeMini: applianceData.openModeMini || applianceData.open_mode_mini,
        openModeMobile: applianceData.openModeMobile || applianceData.open_mode_mobile,
        openModeDesktop: applianceData.openModeDesktop || applianceData.open_mode_desktop,
        serviceStatus: applianceData.serviceStatus || applianceData.service_status,
        backgroundImage: restoredBackgroundImage,
        remoteDesktopEnabled: applianceData.remoteDesktopEnabled || applianceData.remote_desktop_enabled,
        remoteDesktopType: applianceData.remoteDesktopType || applianceData.remote_desktop_type,
        remoteProtocol: applianceData.remoteProtocol || applianceData.remote_protocol,
        remoteHost: applianceData.remoteHost || applianceData.remote_host,
        remotePort: applianceData.remotePort || applianceData.remote_port,
        remoteUsername: applianceData.remoteUsername || applianceData.remote_username,
        remotePasswordEncrypted: applianceData.remotePasswordEncrypted || applianceData.remote_password_encrypted,
        rustdeskId: applianceData.rustdeskId || applianceData.rustdesk_id,
        rustdeskPasswordEncrypted: applianceData.rustdeskPasswordEncrypted || applianceData.rustdesk_password_encrypted,
        rustdeskInstalled: applianceData.rustdeskInstalled || applianceData.rustdesk_installed,
        rustdeskInstallationDate: applianceData.rustdeskInstallationDate || applianceData.rustdesk_installation_date,
        guacamolePerformanceMode: applianceData.guacamolePerformanceMode || applianceData.guacamole_performance_mode,
        orderIndex: applianceData.orderIndex || applianceData.order_index
      });

      const restoredApplianceId = insertResult.insertId;

      // Restore commands if they existed
      const commands = details.customCommands || details.commands;
      if (commands && Array.isArray(commands)) {
        for (const cmd of commands) {
          await trx.insert('appliance_commands', {
            applianceId: restoredApplianceId,
            description: cmd.description,
            command: cmd.command,
            hostId: cmd.hostId || cmd.host_id,
            orderIndex: cmd.orderIndex || cmd.order_index || 0
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
        getClientIp(req),
        applianceName  // Pass the service name as resourceName
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
router.post('/revert/appliance/:logId', requireAdmin, async (req, res) => {
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
      const details = typeof log.details === 'string' 
        ? JSON.parse(log.details || '{}')
        : log.details || {};
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
      // Original data is already in camelCase format from QueryBuilder
      const updateData = {};
      
      // Copy all fields from originalData (already in camelCase)
      if (originalData.name !== undefined) updateData.name = originalData.name;
      if (originalData.url !== undefined) updateData.url = originalData.url;
      if (originalData.description !== undefined) updateData.description = originalData.description;
      if (originalData.icon !== undefined) updateData.icon = originalData.icon;
      if (originalData.color !== undefined) updateData.color = originalData.color;
      if (originalData.category !== undefined) updateData.category = originalData.category;
      if (originalData.isFavorite !== undefined) updateData.isFavorite = originalData.isFavorite;
      if (originalData.startCommand !== undefined) updateData.startCommand = originalData.startCommand;
      if (originalData.stopCommand !== undefined) updateData.stopCommand = originalData.stopCommand;
      if (originalData.statusCommand !== undefined) updateData.statusCommand = originalData.statusCommand;
      if (originalData.restartCommand !== undefined) updateData.restartCommand = originalData.restartCommand;
      if (originalData.autoStart !== undefined) updateData.autoStart = originalData.autoStart;
      if (originalData.sshConnection !== undefined) updateData.sshConnection = originalData.sshConnection;
      if (originalData.transparency !== undefined) updateData.transparency = originalData.transparency;
      if (originalData.blurAmount !== undefined) updateData.blurAmount = originalData.blurAmount;
      if (originalData.backgroundImage !== undefined) updateData.backgroundImage = originalData.backgroundImage;
      if (originalData.remoteDesktopEnabled !== undefined) updateData.remoteDesktopEnabled = originalData.remoteDesktopEnabled;
      if (originalData.remoteDesktopType !== undefined) updateData.remoteDesktopType = originalData.remoteDesktopType;
      if (originalData.remoteProtocol !== undefined) updateData.remoteProtocol = originalData.remoteProtocol;
      if (originalData.remoteHost !== undefined) updateData.remoteHost = originalData.remoteHost;
      if (originalData.remotePort !== undefined) updateData.remotePort = originalData.remotePort;
      if (originalData.remoteUsername !== undefined) updateData.remoteUsername = originalData.remoteUsername;
      if (originalData.visualSettings !== undefined) updateData.visualSettings = originalData.visualSettings;

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
          revertedFromData: details.changes || details.new_data,
          revertedBy: req.user.username,
          appliance_name: originalData.name
        },
        getClientIp(req),
        originalData.name  // resourceName
      );

      // Broadcast updates - both events for compatibility
      broadcast('appliance_reverted', {
        id: log.resourceId,
        ...originalData
      });
      
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
  console.log('[AuditRestore] User restore endpoint called for log ID:', req.params.logId);
  console.log('[AuditRestore] Request body:', req.body);
  
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
      const details = typeof log.details === 'string' 
        ? JSON.parse(log.details || '{}')
        : log.details || {};
      const userData = details.user || details.User || details;

      if (!userData) {
        throw new Error('No user data found in audit log');
      }

      // Use new name if provided, otherwise use original
      const newUsername = req.body.newName || userData.username;
      const newUserEmail = req.body.newEmail || userData.email;
      const useNewName = req.body.newName && req.body.newName !== userData.username;
      const useNewEmail = req.body.newEmail && req.body.newEmail !== userData.email;
      
      // Check if new email is provided and valid
      if (useNewEmail) {
        // Check if new email is already taken
        const emailCheck = await trx.select('users', { email: newUserEmail }, { limit: 1 });
        if (emailCheck.length > 0) {
          throw new Error(`Email "${newUserEmail}" is already in use by another user (${emailCheck[0].username})`);
        }
      } else {
        // If no new email provided, check if original email is available
        const emailCheck = await trx.select('users', { email: userData.email }, { limit: 1 });
        if (emailCheck.length > 0) {
          // Return specific error that frontend can handle
          throw new Error(`Email "${userData.email}" is already in use by another user (${emailCheck[0].username}). Please provide a new email address.`);
        }
      }
      
      // Check if username is already taken
      if (useNewName) {
        const usernameCheck = await trx.select('users', { username: newUsername }, { limit: 1 });
        if (usernameCheck.length > 0) {
          throw new Error(`User with username "${newUsername}" already exists`);
        }
      } else {
        // When restoring with original name, also check username
        const usernameCheck = await trx.select('users', { username: userData.username }, { limit: 1 });
        if (usernameCheck.length > 0) {
          throw new Error(`User with username "${userData.username}" already exists`);
        }
      }

      // Restore the user with new name/email if provided
      const insertResult = await trx.insert('users', {
        username: newUsername,  // Use new name here
        email: newUserEmail,    // Use new email here
        passwordHash: userData.password_hash || userData.passwordHash || '',
        role: userData.role || 'user',
        isActive: userData.is_active !== undefined ? userData.is_active : (userData.isActive !== undefined ? userData.isActive : 1)
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
          newName: useNewName ? newUsername : undefined,
          newEmail: useNewEmail ? newUserEmail : undefined,
          restoredBy: req.user.username
        },
        getClientIp(req),
        newUsername  // Pass the new username as resourceName
      );

      console.log('[AuditRestore] Broadcasting user_restored event for user:', newUsername);
      
      // Broadcast the restoration
      broadcast('user_restored', {
        id: restoredUserId,
        username: newUsername,  // Use new name in broadcast
        email: newUserEmail,    // Use new email in broadcast
        role: userData.role,
        isActive: userData.is_active || userData.isActive
      });
      
      console.log('[AuditRestore] user_restored event broadcasted');

      return {
        success: true,
        message: 'User restored successfully',
        userId: restoredUserId,
        username: newUsername,  // Return new name
        email: newUserEmail     // Return new email
      };
    });

    res.json(result);
  } catch (error) {
    console.error('[AuditRestore] Error restoring user:', error);
    console.error('[AuditRestore] Error stack:', error.stack);
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
      const details = typeof log.details === 'string' 
        ? JSON.parse(log.details || '{}')
        : log.details || {};
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
        getClientIp(req),
        originalData.username || existing[0].username  // Pass the username as resourceName
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
router.post('/restore/host/:logId', requireAdmin, async (req, res) => {
  try {
    const result = await db.transaction(async (trx) => {
      // Get the audit log
      const logs = await trx.select('audit_logs', {
        id: req.params.logId,
        action: 'host_delete'  // WICHTIG: ohne 'd' am Ende, so wie es gespeichert wird
      }, { limit: 1 });

      if (logs.length === 0) {
        throw new Error('Audit log not found or not a host deletion');
      }

      const log = logs[0];
      const details = typeof log.details === 'string' 
        ? JSON.parse(log.details || '{}')
        : log.details || {};

      if (!details.name) {
        throw new Error('No host data found in audit log');
      }

      // Use new name if provided, otherwise use original name
      const hostName = req.body.newName || details.name;

      // Check if host with same name already exists
      const existing = await trx.select('hosts',
        { name: hostName },
        { limit: 1 }
      );

      if (existing.length > 0) {
        throw new Error(`Host with name "${hostName}" already exists`);
      }

      // Restore the host
      // WICHTIG: Details kommen bereits in camelCase vom QueryBuilder
      // Passwörter sind bereits verschlüsselt und müssen so übernommen werden
      const insertResult = await trx.insert('hosts', {
        name: hostName,  // Use new name if provided
        description: details.description || null,
        hostname: details.hostname,
        port: details.port,
        username: details.username,
        password: details.password,  // Already encrypted
        privateKey: details.privateKey || details.private_key,  // Fallback für alte Logs
        sshKeyName: details.sshKeyName || details.ssh_key_name,
        icon: details.icon,
        color: details.color,
        transparency: details.transparency,
        blur: details.blur,
        remoteDesktopEnabled: details.remoteDesktopEnabled ?? details.remote_desktop_enabled ?? 0,  // Wichtig: ?? statt || für boolean
        remoteDesktopType: details.remoteDesktopType || details.remote_desktop_type,
        remoteProtocol: details.remoteProtocol || details.remote_protocol,
        remotePort: details.remotePort || details.remote_port,
        remoteUsername: details.remoteUsername || details.remote_username,
        remotePassword: details.remotePassword || details.remote_password,  // Already encrypted
        guacamolePerformanceMode: details.guacamolePerformanceMode || details.guacamole_performance_mode,
        rustdeskId: details.rustdeskId || details.rustdesk_id,
        rustdeskPassword: details.rustdeskPassword || details.rustdesk_password,  // Already encrypted
        createdBy: req.user.id,
        updatedBy: req.user.id
      });

      const restoredHostId = insertResult.insertId;

      // Restore Guacamole connection if Remote Desktop was enabled
      const remoteEnabled = details.remoteDesktopEnabled ?? details.remote_desktop_enabled;
      const remoteDesktopType = details.remoteDesktopType || details.remote_desktop_type || 'guacamole';
      
      if (remoteEnabled && remoteDesktopType === 'guacamole') {
        try {
          // Prepare data for syncGuacamoleConnection
          // WICHTIG: Bei VNC ist das Passwort im remotePassword Feld!
          // The password is already encrypted in the audit log, pass it as-is
          const guacamoleData = {
            id: restoredHostId,
            name: hostName,
            remote_desktop_enabled: true,
            remote_host: details.hostname,
            remote_protocol: details.remoteProtocol || details.remote_protocol || 'vnc',
            remote_port: details.remotePort || details.remote_port,
            remote_username: details.remoteUsername || details.remote_username,
            remote_password_encrypted: details.remotePassword || details.remote_password || '',  // Pass encrypted password as-is
            guacamole_performance_mode: details.guacamolePerformanceMode || details.guacamole_performance_mode,
            // FIX: Für VNC brauchen wir das Passwort auch für die VNC-Verbindung selbst
            password: details.remotePassword || details.remote_password || '',  // VNC password (encrypted)
            // SSH-Credentials für SFTP (verwende normale SSH-Credentials des Hosts)
            sshHostname: details.hostname,
            sshUsername: details.username,  // SSH username
            sshPassword: details.password   // SSH password (encrypted)
          };
          
          console.log(`Restoring Guacamole connection for host ${hostName} with protocol ${guacamoleData.remote_protocol}`);
          
          // syncGuacamoleConnection will handle the decryption
          await syncGuacamoleConnection(guacamoleData);
          console.log(`✅ Guacamole connection restored for host ${hostName}`);
        } catch (guacError) {
          console.error('Failed to restore Guacamole connection:', guacError);
          // Don't fail the entire restoration if Guacamole fails
        }
      }

      // Create audit log for restoration
      await createAuditLog(
        req.user.id,
        'host_restored',
        'hosts',
        restoredHostId,
        {
          restoredFromLogId: req.params.logId,
          restoredHostData: details,
          newName: hostName !== details.name ? hostName : undefined,  // Log new name if changed
          restoredBy: req.user.username
        },
        getClientIp(req),
        hostName  // Use new name as resourceName
      );

      // Broadcast the restoration
      broadcast('host_restored', {
        hostId: restoredHostId,
        hostName: hostName,  // Use new name in broadcast
        restoredBy: req.user.username
      });

      return {
        success: true,
        message: 'Host restored successfully',
        hostId: restoredHostId,
        hostName: hostName  // Return new name
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
router.post('/revert/host/:logId', requireAdmin, async (req, res) => {
  try {
    const result = await db.transaction(async (trx) => {
      // Get the audit log
      const logs = await trx.select('audit_logs', {
        id: req.params.logId
      }, { limit: 1 });

      if (logs.length === 0) {
        throw new Error('Audit log not found');
      }

      const log = logs[0];
      
      // Check if this is a host update action
      if (!['host_updated', 'host_update', 'hostUpdated', 'hostUpdate'].includes(log.action)) {
        throw new Error('Audit log is not a host update action');
      }
      const details = typeof log.details === 'string' 
        ? JSON.parse(log.details || '{}')
        : log.details || {};
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

      // Get the current host for name
      const hosts = await trx.select('hosts', { id: log.resourceId }, { limit: 1 });
      const currentHost = hosts[0];
      const hostName = originalData.name || currentHost?.name || 'Unknown Host';

      // Revert the host
      await trx.update('hosts', updateData, { id: log.resourceId });

      // Create audit log for reversion
      await createAuditLog(
        req.user.id,
        'host_reverted',
        'hosts',
        log.resourceId,
        {
          name: hostName,
          reverted_audit_log_id: req.params.logId,
          reverted_changes: details.changes || details.new_data || {},
          restored_values: originalData,
          reverted_by: req.user.username
        },
        getClientIp(req),
        hostName  // Add the host name here
      );

      // Broadcast updates - both events for compatibility
      broadcast('host_reverted', {
        id: log.resourceId,
        ...originalData
      });
      
      // Also send host_updated for general update listeners
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