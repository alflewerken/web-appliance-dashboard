const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const { broadcast } = require('./sse');
const { createAuditLog } = require('../utils/auth');

// Restore category from audit log (for deleted categories)
router.post('/category/:auditLogId', async (req, res) => {
  try {
    const { auditLogId } = req.params;

    // Get the audit log entry
    const [auditLogs] = await pool.execute(
      'SELECT * FROM audit_logs WHERE id = ? AND action = ? AND resource_type = ?',
      [auditLogId, 'category_deleted', 'categories']
    );

    if (auditLogs.length === 0) {
      return res
        .status(404)
        .json({
          error: 'Audit log entry not found or not a category deletion',
        });
    }

    const auditLog = auditLogs[0];
    const details =
      typeof auditLog.details === 'string'
        ? JSON.parse(auditLog.details)
        : auditLog.details;

    if (!details.category) {
      return res
        .status(400)
        .json({ error: 'No category data found in audit log' });
    }

    const categoryData = details.category;

    // Check if category with same name already exists
    const [existingCategory] = await pool.execute(
      'SELECT id FROM categories WHERE name = ?',
      [categoryData.name]
    );

    if (existingCategory.length > 0) {
      return res
        .status(400)
        .json({ error: 'Category with this name already exists' });
    }

    // Get the maximum order value for new category
    const [maxOrderRows] = await pool.execute(
      'SELECT MAX(`order`) as maxOrder FROM categories'
    );
    const nextOrder = (maxOrderRows[0].maxOrder || 0) + 1;

    // Restore the category
    const [result] = await pool.execute(
      'INSERT INTO categories (name, icon, color, description, is_system, `order`) VALUES (?, ?, ?, ?, ?, ?)',
      [
        categoryData.name,
        categoryData.icon || 'Folder',
        categoryData.color || '#007AFF',
        categoryData.description || null,
        categoryData.is_system || false,
        nextOrder,
      ]
    );

    const newCategoryId = result.insertId;

    // Create audit log for the restoration
    const ipAddress = req.clientIp;
    await createAuditLog(
      req.user?.id || null,
      'category_restored',
      'categories',
      newCategoryId,
      {
        audit_log_id: auditLogId,
        original_category_id: categoryData.id,
        restored_data: categoryData,
        restored_by: req.user?.username || 'unknown',
        restoration_timestamp: new Date().toISOString(),
      },
      ipAddress
    );

    const restoredCategory = {
      id: newCategoryId,
      ...categoryData,
      order: nextOrder,
    };

    res.json({
      success: true,
      message: 'Category restored successfully',
      category: restoredCategory,
    });

    // Broadcast category creation
    broadcast('category_created', restoredCategory);

    // Also send a specific restore event
    broadcast('category_restored', {
      category: restoredCategory,
      audit_log_id: auditLogId,
      restoredBy: req.user?.username || 'unknown',
      timestamp: new Date().toISOString(),
    });

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'category_restored',
      resource_type: 'categories',
      resource_id: newCategoryId,
    });
  } catch (error) {
    console.error('Error restoring category:', error);
    res.status(500).json({ error: 'Failed to restore category' });
  }
});

// Restore category from audit log (for updates - revert to original)
router.post('/category/:auditLogId/revert', async (req, res) => {
  try {
    const { auditLogId } = req.params;

    // Get the audit log entry
    const [auditLogs] = await pool.execute(
      'SELECT * FROM audit_logs WHERE id = ? AND action = ? AND resource_type = ?',
      [auditLogId, 'category_updated', 'categories']
    );

    if (auditLogs.length === 0) {
      return res
        .status(404)
        .json({ error: 'Audit log entry not found or not a category update' });
    }

    const auditLog = auditLogs[0];
    const details =
      typeof auditLog.details === 'string'
        ? JSON.parse(auditLog.details)
        : auditLog.details;

    if (!details.original_data) {
      return res
        .status(400)
        .json({ error: 'No original data found in audit log' });
    }

    const originalData = details.original_data;
    const categoryId = auditLog.resource_id;

    // Check if category still exists
    const [currentCategory] = await pool.execute(
      'SELECT * FROM categories WHERE id = ?',
      [categoryId]
    );

    if (currentCategory.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Update the category with original values
    await pool.execute(
      'UPDATE categories SET name = ?, icon = ?, color = ?, description = ? WHERE id = ?',
      [
        originalData.name,
        originalData.icon || 'Folder',
        originalData.color || '#007AFF',
        originalData.description || null,
        categoryId,
      ]
    );

    // Create audit log for the restoration
    const ipAddress = req.clientIp;
    await createAuditLog(
      req.user?.id || null,
      'category_reverted',
      'categories',
      categoryId,
      {
        audit_log_id: auditLogId,
        reverted_to: originalData,
        reverted_from: currentCategory[0],
        reverted_by: req.user?.username || 'unknown',
        restoration_timestamp: new Date().toISOString(),
      },
      ipAddress
    );

    res.json({
      success: true,
      message: 'Category reverted to original successfully',
      category: {
        id: categoryId,
        ...originalData,
      },
    });

    // Broadcast category update
    broadcast('category_updated', {
      id: categoryId,
      ...originalData,
    });

    // Also send a specific revert event
    broadcast('category_reverted', {
      category: {
        id: categoryId,
        ...originalData,
      },
      audit_log_id: auditLogId,
      revertedBy: req.user?.username || 'unknown',
      timestamp: new Date().toISOString(),
    });

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'category_reverted',
      resource_type: 'categories',
      resource_id: categoryId,
    });
  } catch (error) {
    console.error('Error reverting category:', error);
    res.status(500).json({ error: 'Failed to revert category' });
  }
});

// Restore appliance from audit log (for updates) - DEPRECATED: Use /api/audit-restore/revert/appliances/:logId instead
router.post('/appliance/:auditLogId', async (req, res) =>
  // Redirect to the new unified endpoint
  res.status(301).json({
    error: 'This endpoint has been moved',
    newEndpoint: `/api/audit-restore/revert/appliances/${req.params.auditLogId}`,
    message: 'Please use the new endpoint for appliance restoration',
  })
);

// Restore deleted appliance from audit log - DEPRECATED: Use /api/audit-restore/restore/appliances/:logId instead
router.post('/appliance-deleted/:auditLogId', async (req, res) =>
  // Redirect to the new unified endpoint
  res.status(301).json({
    error: 'This endpoint has been moved',
    newEndpoint: `/api/audit-restore/restore/appliances/${req.params.auditLogId}`,
    message: 'Please use the new endpoint for deleted appliance restoration',
  })
);

// Restore user from audit log (for deleted users)
router.post('/user/:auditLogId', async (req, res) => {
  try {
    const { auditLogId } = req.params;

    // Get the audit log entry
    const [auditLogs] = await pool.execute(
      'SELECT * FROM audit_logs WHERE id = ? AND action = ? AND resource_type = ?',
      [auditLogId, 'user_deleted', 'users']
    );

    if (auditLogs.length === 0) {
      return res
        .status(404)
        .json({ error: 'Audit log entry not found or not a user deletion' });
    }

    const auditLog = auditLogs[0];
    const details =
      typeof auditLog.details === 'string'
        ? JSON.parse(auditLog.details)
        : auditLog.details;

    if (!details.user) {
      return res.status(400).json({ error: 'No user data found in audit log' });
    }

    const userData = details.user;

    // Check if user with same username or email already exists
    const [existingUser] = await pool.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [userData.username, userData.email]
    );

    if (existingUser.length > 0) {
      return res
        .status(400)
        .json({ error: 'User with this username or email already exists' });
    }

    // Restore the user - password hash is preserved from original
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password_hash, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        userData.username,
        userData.email,
        userData.password_hash,
        userData.role || 'user',
        userData.is_active !== undefined ? userData.is_active : 1,
        userData.created_at || new Date().toISOString(),
      ]
    );

    const newUserId = result.insertId;

    // Restore user permissions if they existed
    if (details.permissions && details.permissions.length > 0) {
      for (const permission of details.permissions) {
        try {
          await pool.execute(
            'INSERT INTO user_appliance_permissions (user_id, appliance_id, can_read, can_execute) VALUES (?, ?, ?, ?)',
            [
              newUserId,
              permission.appliance_id,
              permission.can_read || 1,
              permission.can_execute || 0,
            ]
          );
        } catch (err) {
          console.error('Error restoring user permission:', err);
        }
      }
    }

    // Create audit log for the restoration
    const ipAddress = req.clientIp;
    await createAuditLog(
      req.user?.id || null,
      'user_restored',
      'users',
      newUserId,
      {
        audit_log_id: auditLogId,
        original_user_id: userData.id,
        restored_data: userData,
        restored_permissions: details.permissions || [],
        restored_by: req.user?.username || 'unknown',
        restoration_timestamp: new Date().toISOString(),
      },
      ipAddress
    );

    // Get the restored user data
    const [restoredUser] = await pool.execute(
      'SELECT id, username, email, role, is_active, created_at, last_login FROM users WHERE id = ?',
      [newUserId]
    );

    res.json({
      success: true,
      message: 'User restored successfully',
      user: restoredUser[0],
    });

    // Broadcast user creation
    broadcast('user_created', restoredUser[0]);

    // Also send a specific restore event
    broadcast('user_restored', {
      user: restoredUser[0],
      audit_log_id: auditLogId,
      restoredBy: req.user?.username || 'unknown',
      timestamp: new Date().toISOString(),
    });

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'user_restored',
      resource_type: 'users',
      resource_id: newUserId,
    });
  } catch (error) {
    console.error('Error restoring user:', error);
    res.status(500).json({ error: 'Failed to restore user' });
  }
});

// Restore user from audit log (for updates - revert to original)
router.post('/user/:auditLogId/revert', async (req, res) => {
  try {
    const { auditLogId } = req.params;

    // Get the audit log entry
    const [auditLogs] = await pool.execute(
      'SELECT * FROM audit_logs WHERE id = ? AND action = ? AND resource_type = ?',
      [auditLogId, 'user_updated', 'users']
    );

    if (auditLogs.length === 0) {
      return res
        .status(404)
        .json({ error: 'Audit log entry not found or not a user update' });
    }

    const auditLog = auditLogs[0];
    const details =
      typeof auditLog.details === 'string'
        ? JSON.parse(auditLog.details)
        : auditLog.details;

    if (!details.original_data) {
      return res
        .status(400)
        .json({ error: 'No original data found in audit log' });
    }

    const originalData = details.original_data;
    const userId = auditLog.resource_id;

    // Check if user still exists
    const [currentUser] = await pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    if (currentUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build update query dynamically based on available original data
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

    if (updates.length > 0) {
      values.push(userId);
      await pool.execute(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    // Create audit log for the restoration
    const ipAddress = req.clientIp;
    await createAuditLog(
      req.user?.id || null,
      'user_reverted',
      'users',
      userId,
      {
        audit_log_id: auditLogId,
        reverted_to: originalData,
        reverted_from: currentUser[0],
        reverted_by: req.user?.username || 'unknown',
        restoration_timestamp: new Date().toISOString(),
      },
      ipAddress
    );

    // Get the updated user data
    const [revertedUser] = await pool.execute(
      'SELECT id, username, email, role, is_active, created_at, last_login FROM users WHERE id = ?',
      [userId]
    );

    res.json({
      success: true,
      message: 'User reverted to original successfully',
      user: revertedUser[0],
    });

    // Broadcast user update
    broadcast('user_updated', revertedUser[0]);

    // Also send a specific revert event
    broadcast('user_reverted', {
      user: revertedUser[0],
      audit_log_id: auditLogId,
      revertedBy: req.user?.username || 'unknown',
      timestamp: new Date().toISOString(),
    });

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'user_reverted',
      resource_type: 'users',
      resource_id: userId,
    });
  } catch (error) {
    console.error('Error reverting user:', error);
    res.status(500).json({ error: 'Failed to revert user' });
  }
});

module.exports = router;
