const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const {
  verifyToken,
  requireAdmin,
  requirePermission,
  hashPassword,
  createAuditLog,
} = require('../utils/auth-enhanced');

// Get all roles with their permissions
router.get('/roles', verifyToken, requireAdmin, async (req, res) => {
  try {
    // Get all unique roles
    const [roles] = await pool.execute(
      `SELECT DISTINCT role FROM role_permissions ORDER BY 
             CASE role 
                WHEN 'admin' THEN 1 
                WHEN 'power_user' THEN 2 
                WHEN 'user' THEN 3 
                WHEN 'guest' THEN 4 
                ELSE 5 
             END`
    );

    // Get permissions for each role
    const rolesWithPermissions = await Promise.all(
      roles.map(async roleRow => {
        const [permissions] = await pool.execute(
          'SELECT resource, action FROM role_permissions WHERE role = ?',
          [roleRow.role]
        );

        return {
          role: roleRow.role,
          permissions: permissions.map(p => ({
            resource: p.resource,
            action: p.action,
            permission: `${p.resource}:${p.action}`,
          })),
        };
      })
    );

    res.json(rolesWithPermissions);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// Get users with enhanced role information
router.get(
  '/users',
  verifyToken,
  requirePermission('users', 'read'),
  async (req, res) => {
    try {
      const [users] = await pool.execute(
        `SELECT 
                u.id, 
                u.username, 
                u.email, 
                u.role, 
                u.is_active,
                u.last_login,
                u.last_activity,
                u.created_at,
                COUNT(DISTINCT s.id) as active_sessions,
                COUNT(DISTINCT uap.appliance_id) as special_permissions
             FROM users u
             LEFT JOIN active_sessions s ON u.id = s.user_id AND s.expires_at > NOW()
             LEFT JOIN user_appliance_permissions uap ON u.id = uap.user_id
             GROUP BY u.id
             ORDER BY u.created_at DESC`
      );

      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

// Update user role
router.put(
  '/users/:userId/role',
  verifyToken,
  requireAdmin,
  async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body;

    const validRoles = ['admin', 'power_user', 'user', 'guest'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    try {
      // Check if user exists
      const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [
        userId,
      ]);

      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const oldRole = users[0].role;

      // Update user role
      await pool.execute('UPDATE users SET role = ? WHERE id = ?', [
        role,
        userId,
      ]);

      // Create audit log
      await createAuditLog(
        req.user.id,
        'user_role_changed',
        'users',
        userId,
        {
          username: users[0].username,
          old_role: oldRole,
          new_role: role,
        },
        null,
        req
      );

      res.json({ message: 'User role updated successfully' });
    } catch (error) {
      console.error('Error updating user role:', error);
      res.status(500).json({ error: 'Failed to update user role' });
    }
  }
);

// Get user's appliance permissions
router.get(
  '/users/:userId/appliances',
  verifyToken,
  requirePermission('users', 'read'),
  async (req, res) => {
    const { userId } = req.params;

    try {
      // Get user role first
      const [users] = await pool.execute(
        'SELECT role FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get all appliances with user's access rights
      const [appliances] = await pool.execute(
        `SELECT 
                a.id,
                a.name,
                a.category,
                a.visibility,
                CASE 
                    WHEN ? = 'admin' THEN TRUE
                    WHEN ? = 'power_user' AND a.visibility IN ('public', 'authenticated', 'power_user') THEN TRUE
                    WHEN ? = 'user' AND a.visibility IN ('public', 'authenticated') THEN TRUE
                    WHEN ? = 'guest' AND a.visibility = 'public' THEN TRUE
                    WHEN uap.can_view = TRUE THEN TRUE
                    ELSE FALSE
                END as can_view,
                CASE 
                    WHEN ? IN ('admin', 'power_user') THEN TRUE
                    WHEN ? = 'user' AND a.visibility IN ('public', 'authenticated') THEN TRUE
                    WHEN uap.can_execute = TRUE THEN TRUE
                    ELSE FALSE
                END as can_execute,
                uap.can_view as custom_view,
                uap.can_execute as custom_execute
             FROM appliances a
             LEFT JOIN user_appliance_permissions uap ON a.id = uap.appliance_id AND uap.user_id = ?
             ORDER BY a.name`,
        [
          users[0].role,
          users[0].role,
          users[0].role,
          users[0].role,
          users[0].role,
          users[0].role,
          userId,
        ]
      );

      res.json({
        userId: parseInt(userId),
        role: users[0].role,
        appliances,
      });
    } catch (error) {
      console.error('Error fetching user appliances:', error);
      res.status(500).json({ error: 'Failed to fetch user appliances' });
    }
  }
);
// Update appliance permissions for a user
router.put(
  '/users/:userId/appliances/:applianceId',
  verifyToken,
  requireAdmin,
  async (req, res) => {
    const { userId, applianceId } = req.params;
    const { can_view, can_execute } = req.body;

    try {
      // Check if permission entry exists
      const [existing] = await pool.execute(
        'SELECT * FROM user_appliance_permissions WHERE user_id = ? AND appliance_id = ?',
        [userId, applianceId]
      );

      if (existing.length > 0) {
        // Update existing permission
        await pool.execute(
          'UPDATE user_appliance_permissions SET can_view = ?, can_execute = ? WHERE user_id = ? AND appliance_id = ?',
          [can_view, can_execute, userId, applianceId]
        );
      } else {
        // Create new permission
        await pool.execute(
          'INSERT INTO user_appliance_permissions (user_id, appliance_id, can_view, can_execute) VALUES (?, ?, ?, ?)',
          [userId, applianceId, can_view, can_execute]
        );
      }

      // Get appliance and user details for audit log
      const [appliances] = await pool.execute(
        'SELECT name FROM appliances WHERE id = ?',
        [applianceId]
      );
      const [users] = await pool.execute(
        'SELECT username FROM users WHERE id = ?',
        [userId]
      );

      await createAuditLog(
        req.user.id,
        'appliance_permission_updated',
        'user_appliance_permissions',
        null,
        {
          user_id: userId,
          username: users[0]?.username,
          appliance_id: applianceId,
          appliance_name: appliances[0]?.name,
          can_view,
          can_execute,
        },
        null,
        req
      );

      res.json({ message: 'Permissions updated successfully' });
    } catch (error) {
      console.error('Error updating appliance permissions:', error);
      res.status(500).json({ error: 'Failed to update permissions' });
    }
  }
);

// Create a new user with specific role
router.post('/users', verifyToken, requireAdmin, async (req, res) => {
  const { username, email, password, role = 'user' } = req.body;

  const validRoles = ['admin', 'power_user', 'user', 'guest'];

  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: 'Username, email and password are required' });
  }

  try {
    // Check if user already exists
    const [existing] = await pool.execute(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [username, email, passwordHash, role]
    );

    await createAuditLog(
      req.user.id,
      'user_created',
      'users',
      result.insertId,
      { username, email, role },
      null,
      req
    );

    res.json({
      id: result.insertId,
      username,
      email,
      role,
      message: 'User created successfully',
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Get appliance visibility settings
router.get(
  '/appliances/visibility',
  verifyToken,
  requirePermission('appliances', 'read'),
  async (req, res) => {
    try {
      const [appliances] = await pool.execute(
        `SELECT 
                id, 
                name, 
                visibility,
                COUNT(uap.user_id) as custom_permissions_count
             FROM appliances a
             LEFT JOIN user_appliance_permissions uap ON a.id = uap.appliance_id
             GROUP BY a.id
             ORDER BY a.name`
      );

      res.json(appliances);
    } catch (error) {
      console.error('Error fetching appliance visibility:', error);
      res.status(500).json({ error: 'Failed to fetch appliance visibility' });
    }
  }
);

// Update appliance visibility
router.put(
  '/appliances/:applianceId/visibility',
  verifyToken,
  requireAdmin,
  async (req, res) => {
    const { applianceId } = req.params;
    const { visibility } = req.body;

    const validVisibility = ['public', 'authenticated', 'power_user', 'admin'];

    if (!validVisibility.includes(visibility)) {
      return res.status(400).json({ error: 'Invalid visibility level' });
    }

    try {
      // Get appliance details for audit
      const [appliances] = await pool.execute(
        'SELECT name, visibility as old_visibility FROM appliances WHERE id = ?',
        [applianceId]
      );

      if (appliances.length === 0) {
        return res.status(404).json({ error: 'Appliance not found' });
      }

      // Update visibility
      await pool.execute('UPDATE appliances SET visibility = ? WHERE id = ?', [
        visibility,
        applianceId,
      ]);

      await createAuditLog(
        req.user.id,
        'appliance_visibility_changed',
        'appliances',
        applianceId,
        {
          name: appliances[0].name,
          old_visibility: appliances[0].old_visibility,
          new_visibility: visibility,
        },
        null,
        req
      );

      res.json({ message: 'Visibility updated successfully' });
    } catch (error) {
      console.error('Error updating appliance visibility:', error);
      res.status(500).json({ error: 'Failed to update visibility' });
    }
  }
);

// Get role statistics
router.get('/stats', verifyToken, requireAdmin, async (req, res) => {
  try {
    const [roleStats] = await pool.execute(
      `SELECT 
                role,
                COUNT(*) as user_count,
                SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active_users,
                SUM(CASE WHEN last_login > DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as recent_logins
             FROM users
             GROUP BY role
             ORDER BY 
                CASE role 
                    WHEN 'admin' THEN 1 
                    WHEN 'power_user' THEN 2 
                    WHEN 'user' THEN 3 
                    WHEN 'guest' THEN 4 
                    ELSE 5 
                END`
    );

    const [applianceStats] = await pool.execute(
      `SELECT 
                visibility,
                COUNT(*) as count
             FROM appliances
             GROUP BY visibility`
    );

    const [permissionStats] = await pool.execute(
      `SELECT 
                COUNT(DISTINCT user_id) as users_with_custom_permissions,
                COUNT(DISTINCT appliance_id) as appliances_with_custom_permissions,
                COUNT(*) as total_custom_permissions
             FROM user_appliance_permissions`
    );

    res.json({
      roles: roleStats,
      appliances: applianceStats,
      customPermissions: permissionStats[0],
    });
  } catch (error) {
    console.error('Error fetching role statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
