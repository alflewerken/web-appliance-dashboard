const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const { requireAdmin, createAuditLog } = require('../utils/auth');
const { broadcast } = require('./sse');
const { getClientIp } = require('../utils/getClientIp');
const { restoreBackgroundImageFromAuditLog } = require('../utils/backgroundImageHelper');

// Get audit log details with restore options
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const [logs] = await pool.execute(
      `SELECT 
        al.id,
        al.user_id,
        al.action,
        al.resource_type,
        al.resource_id,
        al.details,
        al.ip_address,
        al.created_at,
        u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.id = ?`,
      [req.params.id]
    );

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
    if (
      [
        'category_deleted',
        'user_deleted',
        'service_deleted',
        'appliance_deleted',
        'ssh_host_deleted',
      ].includes(log.action)
    ) {
      canRestore = true;
      // Look for the resource data in different possible locations
      const resourceData =
        details[log.resource_type] ||
        details.category ||
        details.user ||
        details.service ||
        details.appliance ||
        details.deleted_appliance ||
        details.deleted_service ||
        details.deleted_category ||
        details.deleted_user ||
        details.deleted_host;

      restoreInfo = {
        type: log.resource_type,
        data: resourceData,
      };

      console.log(
        `Delete action detected: ${log.action}, canRestore: ${canRestore}`
      );
    }

    // Handle update actions (including reverts)
    if (
      [
        'category_updated',
        'user_updated',
        'service_updated',
        'appliance_update',
        'appliance_updated',
        'appliance_reverted',
      ].includes(log.action) &&
      details.original_data
    ) {
      canRestore = true;
      restoreInfo = {
        type: log.resource_type,
        original_data: details.original_data,
        new_data: details.new_data,
        canRevertToOriginal: true,
      };

      console.log(
        `Update/Revert action detected: ${log.action}, canRestore: ${canRestore}`
      );
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
  const connection = await pool.getConnection();

  try {
    // Get the audit log
    const [logs] = await connection.execute(
      'SELECT * FROM audit_logs WHERE id = ? AND action = "category_deleted"',
      [req.params.logId]
    );

    if (logs.length === 0) {
      return res
        .status(404)
        .json({ error: 'Audit log not found or not a category deletion' });
    }

    const log = logs[0];
    const details = JSON.parse(log.details || '{}');
    const categoryData = details.category;

    if (!categoryData) {
      return res
        .status(400)
        .json({ error: 'No category data found in audit log' });
    }

    // Use new name if provided, otherwise use original name
    const categoryName = req.body.newName || categoryData.name;

    await connection.beginTransaction();

    // Check if category name already exists
    const [existing] = await connection.execute(
      'SELECT id FROM categories WHERE name = ?',
      [categoryName]
    );

    if (existing.length > 0) {
      await connection.rollback();
      return res
        .status(409)
        .json({ error: 'Category with this name already exists' });
    }

    // Restore the category
    const [result] = await connection.execute(
      'INSERT INTO categories (name, icon, color, description, is_system, `order`) VALUES (?, ?, ?, ?, ?, ?)',
      [
        categoryName,  // Use the new name here
        categoryData.icon || 'Folder',
        categoryData.color || '#007AFF',
        categoryData.description || null,
        categoryData.is_system || 0,
        categoryData.order || 999,
      ]
    );

    const restoredCategoryId = result.insertId;

    // Create audit log for restoration
    await createAuditLog(
      req.user.id,
      'category_restored',
      'categories',
      restoredCategoryId,
      {
        restored_from_log_id: log.id,
        original_deletion_date: log.created_at,
        restored_by: req.user.username,
        restored_data: categoryData,
      },
      getClientIp(req)
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Category restored successfully',
      category_id: restoredCategoryId,
    });

    // Broadcast category restoration
    broadcast('category_restored', {
      id: restoredCategoryId,
      ...categoryData,
      name: categoryName,  // Override with new name if different
    });

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'category_restored',
      resource_type: 'categories',
      resource_id: restoredCategoryId,
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error restoring category:', error);
    res.status(500).json({ error: 'Failed to restore category' });
  } finally {
    connection.release();
  }
});

// Revert category to original state
router.post('/revert/category/:logId', requireAdmin, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    // Get the audit log
    const [logs] = await connection.execute(
      'SELECT * FROM audit_logs WHERE id = ? AND action = "category_updated"',
      [req.params.logId]
    );

    if (logs.length === 0) {
      return res
        .status(404)
        .json({ error: 'Audit log not found or not a category update' });
    }

    const log = logs[0];
    const details = JSON.parse(log.details || '{}');
    const originalData = details.original_data;

    if (!originalData) {
      return res
        .status(400)
        .json({ error: 'No original data found in audit log' });
    }

    await connection.beginTransaction();

    // Check if category still exists
    const [existing] = await connection.execute(
      'SELECT * FROM categories WHERE id = ?',
      [log.resource_id]
    );

    if (existing.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Category no longer exists' });
    }

    // Revert the category
    await connection.execute(
      'UPDATE categories SET name = ?, icon = ?, color = ?, description = ? WHERE id = ?',
      [
        originalData.name,
        originalData.icon,
        originalData.color,
        originalData.description,
        log.resource_id,
      ]
    );

    // Create audit log for reversion
    await createAuditLog(
      req.user.id,
      'category_reverted',
      'categories',
      log.resource_id,
      {
        reverted_from_log_id: log.id,
        reverted_to_data: originalData,
        reverted_from_data: details.new_data,
        reverted_by: req.user.username,
      },
      getClientIp(req)
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Category reverted to original state successfully',
    });

    // Broadcast category update
    broadcast('category_updated', {
      id: log.resource_id,
      ...originalData,
    });

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'category_reverted',
      resource_type: 'categories',
      resource_id: log.resource_id,
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error reverting category:', error);
    res.status(500).json({ error: 'Failed to revert category' });
  } finally {
    connection.release();
  }
});

// Restore deleted user
router.post('/restore/user/:logId', requireAdmin, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    // Get the audit log
    const [logs] = await connection.execute(
      'SELECT * FROM audit_logs WHERE id = ? AND action = "user_deleted"',
      [req.params.logId]
    );

    if (logs.length === 0) {
      return res
        .status(404)
        .json({ error: 'Audit log not found or not a user deletion' });
    }

    const log = logs[0];
    const details = JSON.parse(log.details || '{}');
    const userData = details.user;

    if (!userData) {
      return res.status(400).json({ error: 'No user data found in audit log' });
    }

    await connection.beginTransaction();

    // Check if username or email already exists
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [userData.username, userData.email]
    );

    if (existing.length > 0) {
      await connection.rollback();
      return res
        .status(409)
        .json({ error: 'User with this username or email already exists' });
    }

    // Generate a temporary password
    const bcrypt = require('bcryptjs');
    const tempPassword = 'changeme' + Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Restore the user
    const [result] = await connection.execute(
      'INSERT INTO users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
      [
        userData.username,
        userData.email,
        passwordHash,
        userData.role || 'user',
        0, // Set as inactive, needs password reset
      ]
    );

    const restoredUserId = result.insertId;

    // Create audit log for restoration
    await createAuditLog(
      req.user.id,
      'user_restored',
      'users',
      restoredUserId,
      {
        restored_from_log_id: log.id,
        original_deletion_date: log.created_at,
        restored_by: req.user.username,
        restored_data: userData,
        temp_password: tempPassword,
        requires_password_reset: true,
      },
      getClientIp(req)
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'User restored successfully',
      user_id: restoredUserId,
      temp_password: tempPassword,
      note: 'User is inactive and must reset password',
    });

    // Broadcast user restoration
    broadcast('user_restored', {
      id: restoredUserId,
      username: userData.username,
      email: userData.email,
      role: userData.role,
      is_active: 0,
    });

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'user_restored',
      resource_type: 'users',
      resource_id: restoredUserId,
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error restoring user:', error);
    res.status(500).json({ error: 'Failed to restore user' });
  } finally {
    connection.release();
  }
});

// Revert user to original state
router.post('/revert/user/:logId', requireAdmin, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    // Get the audit log
    const [logs] = await connection.execute(
      'SELECT * FROM audit_logs WHERE id = ? AND action = "user_updated"',
      [req.params.logId]
    );

    if (logs.length === 0) {
      return res
        .status(404)
        .json({ error: 'Audit log not found or not a user update' });
    }

    const log = logs[0];
    const details = JSON.parse(log.details || '{}');
    const originalData = details.original_data;

    if (!originalData) {
      return res
        .status(400)
        .json({ error: 'No original data found in audit log' });
    }

    await connection.beginTransaction();

    // Check if user still exists
    const [existing] = await connection.execute(
      'SELECT * FROM users WHERE id = ?',
      [log.resource_id]
    );

    if (existing.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'User no longer exists' });
    }

    // Build update query based on available original data
    const updates = [];
    const values = [];

    if (originalData.username) {
      updates.push('username = ?');
      values.push(originalData.username);
    }
    if (originalData.email) {
      updates.push('email = ?');
      values.push(originalData.email);
    }
    if (originalData.role) {
      updates.push('role = ?');
      values.push(originalData.role);
    }
    if (originalData.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(originalData.is_active);
    }

    values.push(log.resource_id);

    // Revert the user
    await connection.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Create audit log for reversion
    await createAuditLog(
      req.user.id,
      'user_reverted',
      'users',
      log.resource_id,
      {
        reverted_from_log_id: log.id,
        reverted_to_data: originalData,
        reverted_from_data: details.new_data,
        reverted_by: req.user.username,
      },
      getClientIp(req)
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'User reverted to original state successfully',
    });

    // Broadcast user update
    broadcast('user_updated', {
      id: log.resource_id,
      ...originalData,
    });

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'user_reverted',
      resource_type: 'users',
      resource_id: log.resource_id,
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error reverting user:', error);
    res.status(500).json({ error: 'Failed to revert user' });
  } finally {
    connection.release();
  }
});

// Restore deleted service
router.post('/restore/appliances/:logId', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    // Check if user is admin or made the original change
    const userRole = req.user.role;
    const userId = req.user.id;
    
    // Get the audit log
    const [logs] = await connection.execute(
      'SELECT * FROM audit_logs WHERE id = ? AND action = "appliance_deleted"',
      [req.params.logId]
    );

    if (logs.length === 0) {
      return res
        .status(404)
        .json({ error: 'Audit log not found or not a service deletion' });
    }

    const log = logs[0];
    
    // Check permissions: admin or user who made the deletion
    if (userRole !== 'Administrator' && userRole !== 'admin' && log.user_id !== userId) {
      return res.status(403).json({ 
        error: 'You can only restore services you deleted yourself' 
      });
    }
    const details = JSON.parse(log.details || '{}');
    const serviceData = details.service || details.appliance;

    if (!serviceData) {
      return res
        .status(400)
        .json({ error: 'No service data found in audit log' });
    }

    // Use new name if provided, otherwise use original name
    const serviceName = req.body.newName || serviceData.name;

    await connection.beginTransaction();

    // Check if service name already exists
    const [existing] = await connection.execute(
      'SELECT id FROM appliances WHERE name = ?',
      [serviceName]
    );

    if (existing.length > 0) {
      await connection.rollback();
      return res
        .status(409)
        .json({ error: 'Service with this name already exists' });
    }

    // Restore background image if it was saved
    let restoredBackgroundImage = serviceData.background_image;
    if (details.backgroundImageData) {
      const newFilename = await restoreBackgroundImageFromAuditLog(details.backgroundImageData);
      if (newFilename) {
        restoredBackgroundImage = newFilename;
      }
    }

    // Restore the service
    const [result] = await connection.execute(
      `INSERT INTO appliances (
        name, url, description, icon, color, category, isFavorite,
        start_command, stop_command, status_command, auto_start, ssh_connection,
        transparency, blur_amount, open_mode_mini, open_mode_mobile, open_mode_desktop,
        service_status, background_image
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        serviceName,  // Use the new name here
        serviceData.url,
        serviceData.description || null,
        serviceData.icon || 'Box',
        serviceData.color || '#007AFF',
        serviceData.category || null,
        serviceData.isFavorite || 0,
        serviceData.startCommand || serviceData.start_command || null,
        serviceData.stopCommand || serviceData.stop_command || null,
        serviceData.statusCommand || serviceData.status_command || null,
        serviceData.autoStart || serviceData.auto_start || 0,
        serviceData.sshConnection || serviceData.ssh_connection || null,
        serviceData.transparency || 0.7,
        serviceData.blurAmount || serviceData.blur_amount || 20,
        serviceData.openModeMini || serviceData.open_mode_mini || 'browser_tab',
        serviceData.openModeMobile || serviceData.open_mode_mobile || 'browser_tab',
        serviceData.openModeDesktop || serviceData.open_mode_desktop || 'browser_tab',
        'unknown',
        restoredBackgroundImage || null,
      ]
    );

    const restoredServiceId = result.insertId;

    // Restore custom commands if any
    if (details.customCommands && details.customCommands.length > 0) {
      for (const cmd of details.customCommands) {
        try {
          await connection.execute(
            `INSERT INTO appliance_commands (appliance_id, description, command, ssh_host_id)
            VALUES (?, ?, ?, ?)`,
            [
              restoredServiceId,
              cmd.description,
              cmd.command,
              cmd.ssh_host_id || null,
            ]
          );
        } catch (cmdError) {
          console.error('Error restoring custom command:', cmdError);
          // Continue with other commands even if one fails
        }
      }
    }

    // Create audit log for restoration
    await createAuditLog(
      req.user.id,
      'appliance_restore',
      'appliances',
      restoredServiceId,
      {
        restored_from_log_id: log.id,
        original_deletion_date: log.created_at,
        restored_by: req.user.username,
        restored_data: serviceData,
        custom_commands_restored: details.customCommands
          ? details.customCommands.length
          : 0,
      },
      getClientIp(req)
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Service restored successfully',
      service_id: restoredServiceId,
    });

    // Broadcast service restoration as created event
    broadcast('appliance_created', {
      id: restoredServiceId,
      ...serviceData,
      name: serviceName,  // Override with new name if different
      service_status: 'unknown',
    });

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'appliance_restore',
      resource_type: 'appliances',
      resource_id: restoredServiceId,
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error restoring service:', error);
    res.status(500).json({ error: 'Failed to restore service' });
  } finally {
    connection.release();
  }
});

// Revert service to original state
router.post('/revert/appliances/:logId', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    // Check if user is admin or made the original change
    const userRole = req.user.role;
    const userId = req.user.id;
    
    // Get the audit log
    const [logs] = await connection.execute(
      'SELECT * FROM audit_logs WHERE id = ? AND action = "appliance_update"',
      [req.params.logId]
    );

    if (logs.length === 0) {
      return res
        .status(404)
        .json({ error: 'Audit log not found or not a service update' });
    }

    const log = logs[0];
    
    // Check permissions: admin or user who made the update
    if (userRole !== 'Administrator' && userRole !== 'admin' && log.user_id !== userId) {
      return res.status(403).json({ 
        error: 'You can only revert changes you made yourself' 
      });
    }
    
    const details = JSON.parse(log.details || '{}');
    const originalData = details.original_data;

    if (!originalData) {
      return res
        .status(400)
        .json({ error: 'No original data found in audit log' });
    }

    await connection.beginTransaction();

    // Check if service still exists
    const [existing] = await connection.execute(
      'SELECT * FROM appliances WHERE id = ?',
      [log.resource_id]
    );

    if (existing.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Service no longer exists' });
    }

    // Store current data before reverting (for potential re-revert)
    const currentData = existing[0];

    // Revert the service
    await connection.execute(
      `UPDATE appliances SET 
        name = ?, url = ?, description = ?, icon = ?, color = ?, 
        category = ?, isFavorite = ?, start_command = ?, stop_command = ?, 
        status_command = ?, auto_start = ?, ssh_connection = ?,
        transparency = ?, blur_amount = ?, open_mode_mini = ?, 
        open_mode_mobile = ?, open_mode_desktop = ?, background_image = ?
      WHERE id = ?`,
      [
        originalData.name,
        originalData.url,
        originalData.description,
        originalData.icon,
        originalData.color,
        originalData.category,
        originalData.isFavorite || 0,
        originalData.start_command || null,
        originalData.stop_command || null,
        originalData.status_command || null,
        originalData.auto_start || 0,
        originalData.ssh_connection || null,
        originalData.transparency || 0.7,
        originalData.blur_amount || 20,
        originalData.open_mode_mini || 'browser_tab',
        originalData.open_mode_mobile || 'browser_tab',
        originalData.open_mode_desktop || 'browser_tab',
        originalData.background_image || null,
        log.resource_id,
      ]
    );

    // Create audit log for reversion
    await createAuditLog(
      req.user.id,
      'appliance_reverted',
      'appliances',
      log.resource_id,
      {
        reverted_from_log_id: log.id,
        original_data: currentData, // Current data becomes the "original" for potential re-revert
        new_data: originalData, // We're reverting TO this data
        fields_updated: Object.keys(originalData),
        reverted_by: req.user.username,
        note: 'Änderung rückgängig gemacht',
      },
      getClientIp(req)
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Service reverted to original state successfully',
    });

    // Broadcast service update
    broadcast('appliance_updated', {
      id: log.resource_id,
      ...originalData,
    });

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'appliance_reverted',
      resource_type: 'appliances',
      resource_id: log.resource_id,
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error reverting service:', error);
    res.status(500).json({ error: 'Failed to revert service' });
  } finally {
    connection.release();
  }
});

// Restore deleted user
router.post('/restore/users/:logId', requireAdmin, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    // Get the audit log
    const [logs] = await connection.execute(
      'SELECT * FROM audit_logs WHERE id = ? AND action IN ("user_delete", "user_deleted")',
      [req.params.logId]
    );

    if (logs.length === 0) {
      return res
        .status(404)
        .json({ error: 'Audit log not found or not a user deletion' });
    }

    const log = logs[0];
    const details = JSON.parse(log.details || '{}');
    const userData = details.user;

    if (!userData) {
      return res.status(400).json({ error: 'No user data found in audit log' });
    }

    await connection.beginTransaction();

    // Check if username or email already exists
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [userData.username, userData.email]
    );

    if (existing.length > 0) {
      await connection.rollback();
      return res
        .status(409)
        .json({ error: 'User with this username or email already exists' });
    }

    // Restore the user (reuse the password hash from the deleted user)
    const [result] = await connection.execute(
      'INSERT INTO users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
      [
        userData.username,
        userData.email,
        userData.password_hash || '', // Password hash should be preserved
        userData.role || 'user',
        userData.is_active !== undefined ? userData.is_active : 1,
      ]
    );

    const restoredUserId = result.insertId;

    // Create audit log for restoration
    await createAuditLog(
      req.user.id,
      'user_restore',
      'users',
      restoredUserId,
      {
        restored_from_log_id: log.id,
        original_deletion_date: log.created_at,
        restored_by: req.user.username,
        restored_data: userData,
      },
      getClientIp(req)
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'User restored successfully',
      user_id: restoredUserId,
    });

    // Broadcast user restoration
    broadcast('user_created', {
      id: restoredUserId,
      username: userData.username,
      email: userData.email,
      role: userData.role,
      is_active: userData.is_active,
    });

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'user_restore',
      resource_type: 'users',
      resource_id: restoredUserId,
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error restoring user:', error);
    res.status(500).json({ error: 'Failed to restore user' });
  } finally {
    connection.release();
  }
});

// Revert user to original state
router.post('/revert/users/:logId', requireAdmin, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    // Get the audit log
    const [logs] = await connection.execute(
      'SELECT * FROM audit_logs WHERE id = ? AND action IN ("user_update", "user_updated", "user_reverted")',
      [req.params.logId]
    );

    if (logs.length === 0) {
      return res
        .status(404)
        .json({ error: 'Audit log not found or not a user update' });
    }

    const log = logs[0];
    const details = JSON.parse(log.details || '{}');
    const originalData = details.original_data;

    if (!originalData) {
      return res
        .status(400)
        .json({ error: 'No original data found in audit log' });
    }

    await connection.beginTransaction();

    // Check if user still exists
    const [existing] = await connection.execute(
      'SELECT * FROM users WHERE id = ?',
      [log.resource_id]
    );

    if (existing.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'User no longer exists' });
    }

    // Store current data for audit log
    const currentData = existing[0];

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (originalData.username !== undefined) {
      updates.push('username = ?');
      values.push(originalData.username);
    }
    if (originalData.email !== undefined) {
      updates.push('email = ?');
      values.push(originalData.email);
    }
    if (originalData.role !== undefined) {
      updates.push('role = ?');
      values.push(originalData.role);
    }
    if (originalData.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(originalData.is_active);
    }

    if (updates.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'No fields to revert' });
    }

    values.push(log.resource_id);

    // Revert the user
    await connection.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Create audit log for reversion
    await createAuditLog(
      req.user.id,
      'user_reverted',
      'users',
      log.resource_id,
      {
        reverted_from_log_id: log.id,
        original_data: currentData,
        reverted_to: originalData,
        reverted_by: req.user.username,
        fields_updated: Object.keys(originalData),
      },
      getClientIp(req)
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'User reverted to original state successfully',
    });

    // Broadcast user update
    broadcast('user_updated', {
      id: log.resource_id,
      ...originalData,
    });

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'user_reverted',
      resource_type: 'users',
      resource_id: log.resource_id,
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error reverting user:', error);
    res.status(500).json({ error: 'Failed to revert user' });
  } finally {
    connection.release();
  }
});

// Revert SSH host to original state
router.post('/revert/ssh_hosts/:logId', requireAdmin, async (req, res) => {
  console.log('SSH Host Revert Request received for logId:', req.params.logId);
  const connection = await pool.getConnection();

  try {
    // Get the audit log entry
    const [logs] = await connection.execute(
      'SELECT * FROM audit_logs WHERE id = ? AND action IN ("ssh_host_update", "ssh_host_updated")',
      [req.params.logId]
    );

    if (logs.length === 0) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    const log = logs[0];
    const details = JSON.parse(log.details);

    if (!details.old_data) {
      return res
        .status(400)
        .json({ error: 'No previous state available for revert' });
    }

    await connection.beginTransaction();

    // Revert SSH host to old state
    await connection.execute(
      `
      UPDATE ssh_hosts 
      SET hostname = ?, host = ?, username = ?, port = ?, key_name = ?
      WHERE id = ?
    `,
      [
        details.old_data.hostname,
        details.old_data.host,
        details.old_data.username,
        details.old_data.port,
        details.old_data.key_name,
        log.resource_id,
      ]
    );

    // Create audit log for revert
    await createAuditLog(
      req.user?.id || null,
      'ssh_host_reverted',
      'ssh_host',
      log.resource_id,
      {
        action_type: 'revert',
        reverted_from_log_id: log.id,
        old_data: details.new_data,
        new_data: details.old_data,
        reverted_by: req.user?.username || 'unknown',
      },
      req.clientIp
    );

    await connection.commit();

    // Regenerate SSH config
    try {
      const { generateSSHConfig } = require('../utils/sshManager');
      await generateSSHConfig();
    } catch (error) {
      console.log('SSH config regeneration skipped:', error.message);
    }

    res.json({
      success: true,
      message: 'SSH host successfully reverted to previous state',
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error reverting SSH host:', error);
    res.status(500).json({ error: 'Failed to revert SSH host' });
  } finally {
    connection.release();
  }
});

// Restore deleted SSH host
router.post('/restore/ssh_hosts/:logId', requireAdmin, async (req, res) => {
  console.log('SSH Host Restore Request received for logId:', req.params.logId);
  const connection = await pool.getConnection();

  try {
    // Get the audit log entry
    const [logs] = await connection.execute(
      'SELECT * FROM audit_logs WHERE id = ? AND action IN ("ssh_host_delete", "ssh_host_deleted")',
      [req.params.logId]
    );

    if (logs.length === 0) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    const log = logs[0];
    const details = JSON.parse(log.details);

    if (!details.deleted_host) {
      return res
        .status(400)
        .json({ error: 'No deleted host data available for restore' });
    }

    await connection.beginTransaction();

    // Check if host still exists (marked as inactive)
    const [existing] = await connection.execute(
      'SELECT id FROM ssh_hosts WHERE id = ? AND is_active = FALSE',
      [log.resource_id]
    );

    if (existing.length > 0) {
      // Restore soft-deleted host by setting is_active to TRUE
      await connection.execute(
        'UPDATE ssh_hosts SET is_active = TRUE WHERE id = ?',
        [log.resource_id]
      );
    } else {
      // Check if a host with same connection details already exists
      const [duplicate] = await connection.execute(
        'SELECT id FROM ssh_hosts WHERE host = ? AND username = ? AND port = ? AND is_active = TRUE',
        [details.deleted_host.host, details.deleted_host.username, details.deleted_host.port]
      );
      
      if (duplicate.length > 0) {
        await connection.rollback();
        return res.status(409).json({ 
          error: 'SSH host with this connection already exists',
          details: `A host with ${details.deleted_host.username}@${details.deleted_host.host}:${details.deleted_host.port} already exists`
        });
      }
      
      // Re-create if hard deleted
      const [result] = await connection.execute(
        `
        INSERT INTO ssh_hosts (hostname, host, username, port, key_name, is_active)
        VALUES (?, ?, ?, ?, ?, TRUE)
      `,
        [
          details.deleted_host.hostname,
          details.deleted_host.host,
          details.deleted_host.username,
          details.deleted_host.port,
          details.deleted_host.key_name || 'dashboard',
        ]
      );

      // Update resource_id in case it's different
      log.resource_id = result.insertId;
    }

    // Create audit log for restore
    await createAuditLog(
      req.user?.id || null,
      'ssh_host_restored',
      'ssh_host',
      log.resource_id,
      {
        action_type: 'restore',
        restored_from_log_id: log.id,
        restored_data: details.deleted_host,
        restored_by: req.user?.username || 'unknown',
      },
      req.clientIp
    );

    await connection.commit();

    // Regenerate SSH config
    try {
      const sshManager = require('../routes/ssh');
      if (sshManager && sshManager.generateSSHConfig) {
        await sshManager.generateSSHConfig();
      }
    } catch (error) {
      console.log('SSH config regeneration skipped:', error.message);
    }

    // Send SSE events
    // First send the restored event for audit log
    broadcast('ssh_host_restored', {
      id: log.resource_id,
      hostname: details.deleted_host.hostname,
      restored_by: req.user?.username || 'unknown',
    });

    // Then send created event to trigger UI refresh
    broadcast('ssh_host_created', {
      id: log.resource_id,
      hostname: details.deleted_host.hostname,
      host: details.deleted_host.host,
      username: details.deleted_host.username,
      port: details.deleted_host.port,
      key_name: details.deleted_host.key_name,
    });

    res.json({
      success: true,
      message: 'SSH host successfully restored',
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error restoring SSH host:', error);
    res.status(500).json({ error: 'Failed to restore SSH host' });
  } finally {
    connection.release();
  }
});

// Revert SSH host to original state
router.post('/revert/ssh_hosts/:logId', requireAdmin, async (req, res) => {
  console.log('SSH Host Revert Request received for logId:', req.params.logId);
  const connection = await pool.getConnection();

  try {
    // Get the audit log entry
    const [logs] = await connection.execute(
      'SELECT * FROM audit_logs WHERE id = ? AND action IN ("ssh_host_update", "ssh_host_updated", "ssh_host_reverted")',
      [req.params.logId]
    );

    if (logs.length === 0) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    const log = logs[0];
    const details = JSON.parse(log.details);

    if (!details.old_data) {
      return res
        .status(400)
        .json({ error: 'No previous state available for revert' });
    }

    await connection.beginTransaction();

    // Revert SSH host to old state
    await connection.execute(
      `
      UPDATE ssh_hosts 
      SET hostname = ?, host = ?, username = ?, port = ?, key_name = ?
      WHERE id = ?
    `,
      [
        details.old_data.hostname,
        details.old_data.host,
        details.old_data.username,
        details.old_data.port,
        details.old_data.key_name,
        log.resource_id,
      ]
    );

    // Create audit log for revert
    await createAuditLog(
      req.user?.id || null,
      'ssh_host_reverted',
      'ssh_host',
      log.resource_id,
      {
        action_type: 'revert',
        reverted_from_log_id: log.id,
        old_data: details.new_data || details.old_data,
        new_data: details.old_data,
        reverted_by: req.user?.username || 'unknown',
      },
      req.clientIp
    );

    await connection.commit();

    // Regenerate SSH config
    try {
      const { generateSSHConfig } = require('../utils/sshManager');
      await generateSSHConfig();
    } catch (error) {
      console.log('SSH config regeneration skipped:', error.message);
    }

    // Send SSE events
    // First send the reverted event for audit log
    broadcast('ssh_host_reverted', {
      id: log.resource_id,
      hostname: details.old_data.hostname,
      reverted_by: req.user?.username || 'unknown',
    });

    // Then send updated event to trigger UI refresh
    broadcast('ssh_host_updated', {
      id: log.resource_id,
      hostname: details.old_data.hostname,
      host: details.old_data.host,
      username: details.old_data.username,
      port: details.old_data.port,
      key_name: details.old_data.key_name,
    });

    res.json({
      success: true,
      message: 'SSH host successfully reverted to previous state',
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error reverting SSH host:', error);
    res.status(500).json({ error: 'Failed to revert SSH host' });
  } finally {
    connection.release();
  }
});

module.exports = router;
