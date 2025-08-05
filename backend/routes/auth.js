const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const rateLimit = require('express-rate-limit');
const { broadcast } = require('./sse');
const {
  verifyToken,
  requireAdmin,
  hashPassword,
  comparePassword,
  hashToken,
  generateToken,
} = require('../utils/auth');
const { createAuditLog } = require('../utils/auditLogger');
const {
  mapUserDbToJs,
  mapUserJsToDb,
  getUserSelectColumns,
  mapUserDbToJsWithPassword
} = require('../utils/dbFieldMappingUsers');

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 20, // Higher limit in development
  message:
    'Too many login attempts from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting in development mode or for localhost
    if (process.env.NODE_ENV === 'development') return true;
    
    const ip = req.ip || req.connection.remoteAddress;
    const isLocalhost = ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
    const isPrivateNetwork = ip?.startsWith('192.168.') || ip?.startsWith('10.') || ip?.startsWith('172.');
    
    // Skip for localhost and private networks in development
    return isLocalhost || (process.env.DISABLE_RATE_LIMIT === 'true' && isPrivateNetwork);
  },
  handler: (req, res) => {
    createAuditLog(
      null,
      'rate_limit_exceeded',
      'login',
      null,
      { ip: req.ip },
      req.ip
    );
    res
      .status(429)
      .json({ error: 'Too many login attempts, please try again later' });
  },
});

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication endpoints
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Bad request - missing credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Username and password are required
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid credentials
 *       429:
 *         description: Too many login attempts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Too many login attempts, please try again later
 */
// Login endpoint
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  const ipAddress = req.clientIp;
  const userAgent = req.headers['user-agent'];

  // Debug logging for iOS issues
  try {
    // Validate input
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: 'Username and password are required' });
    }

    // Find user
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1',
      [username, username]
    );

    if (users.length === 0) {
      await createAuditLog(
        null,
        'failed_login',
        'user',
        null,
        { username },
        ipAddress
      );

      // Broadcast audit log update for failed login
      broadcast('audit_log_created', {
        action: 'failed_login',
        resource_type: 'user',
        username,
      });

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      await createAuditLog(
        user.id,
        'failed_login',
        'user',
        user.id,
        { username },
        ipAddress
      );

      // Broadcast audit log update for failed login
      broadcast('audit_log_created', {
        action: 'failed_login',
        resource_type: 'user',
        resource_id: user.id,
        username,
      });

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user.id);
    const tokenHash = hashToken(token);

    // Get token expiry from settings
    const [settings] = await pool.execute(
      'SELECT setting_value FROM user_settings WHERE setting_key = ?',
      ['auth_token_expiry']
    );
    const tokenExpiry =
      settings.length > 0 ? parseInt(settings[0].setting_value) : 86400;

    // Create session
    await pool.execute(
      'INSERT INTO active_sessions (user_id, session_token, expires_at, ip_address, user_agent) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND), ?, ?)',
      [user.id, tokenHash, tokenExpiry, ipAddress, userAgent]
    );

    // Update last login
    await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [
      user.id,
    ]);

    // Create audit log
    await createAuditLog(
      user.id,
      'user_login',
      'user',
      user.id,
      { username: user.username },
      ipAddress
    );

    // Broadcast login event
    broadcast('user_login', {
      id: user.id,
      username: user.username,
      timestamp: new Date().toISOString(),
    });

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'user_login',
      resource_type: 'user',
      resource_id: user.id,
      username: user.username,
    });

    // Get user permissions
    const [permissions] = await pool.execute(
      'SELECT permission FROM role_permissions WHERE role = ?',
      [user.role]
    );

    // Return user data and token
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      permissions: permissions.map(p => p.permission),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout endpoint
router.post('/logout', verifyToken, async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const ipAddress = req.clientIp;

  try {
    if (token) {
      const tokenHash = hashToken(token);
      await pool.execute('DELETE FROM active_sessions WHERE session_token = ?', [
        tokenHash,
      ]);
    }

    await createAuditLog(
      req.user.id,
      'user_logout',
      'user',
      req.user.id,
      null,
      ipAddress
    );

    // Broadcast logout event
    broadcast('user_logout', {
      id: req.user.id,
      username: req.user.username,
      timestamp: new Date().toISOString(),
    });

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'user_logout',
      resource_type: 'user',
      resource_id: req.user.id,
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user
router.get('/me', verifyToken, async (req, res) => {
  try {
    // Get user permissions
    const [permissions] = await pool.execute(
      'SELECT permission FROM role_permissions WHERE role = ?',
      [req.user.role]
    );

    res.json({
      user: req.user,
      permissions: permissions.map(p => p.permission),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Get all users (admin only)
router.get('/users', verifyToken, requireAdmin, async (req, res) => {
  try {
    console.log('GET /users - User:', req.user.username, 'Role:', req.user.role);
    
    // Get users with their last activity from sessions
    const [users] = await pool.execute(`
            SELECT 
                u.id, 
                u.username, 
                u.email, 
                u.role, 
                u.is_active, 
                u.last_login, 
                u.created_at,
                u.updated_at,
                MAX(s.last_activity) as last_activity,
                CASE 
                    WHEN MAX(s.last_activity) > DATE_SUB(NOW(), INTERVAL 5 MINUTE) 
                    AND s.expires_at > NOW() 
                    THEN 1 
                    ELSE 0 
                END as is_online
            FROM users u
            LEFT JOIN active_sessions s ON u.id = s.user_id
            GROUP BY u.id, u.username, u.email, u.role, u.is_active, u.last_login, u.created_at, u.updated_at
            ORDER BY u.created_at DESC
        `);

    console.log('Found users:', users.length);
    
    // Map users to camelCase
    const mappedUsers = users.map(mapUserDbToJs);
    console.log('User list:', mappedUsers.map(u => ({ id: u.id, username: u.username, role: u.role })));

    res.json(mappedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create user (admin only)
router.post('/users', verifyToken, requireAdmin, async (req, res) => {
  const { username, email, password, role = 'user' } = req.body;
  const ipAddress = req.clientIp;

  try {
    // Validate input
    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ error: 'Username, email and password are required' });
    }

    // Check password length
    const [settings] = await pool.execute(
      'SELECT setting_value FROM user_settings WHERE setting_key = ?',
      ['auth_password_min_length']
    );
    const minLength =
      settings.length > 0 ? parseInt(settings[0].setting_value) : 8;

    if (password.length < minLength) {
      return res
        .status(400)
        .json({
          error: `Password must be at least ${minLength} characters long`,
        });
    }

    // Check if user already exists
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
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
      {
        user: {
          id: result.insertId,
          username,
          email,
          role,
          is_active: 1,
          created_at: new Date().toISOString(),
        },
        created_by: req.user.username,
        timestamp: new Date().toISOString(),
      },
      ipAddress
    );

    res.json({
      id: result.insertId,
      username,
      email,
      role,
    });

    // Broadcast user creation
    broadcast('user_created', {
      id: result.insertId,
      username,
      email,
      role,
    });

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'user_created',
      resource_type: 'users',
      resource_id: result.insertId,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user (admin only)
router.put('/users/:id', verifyToken, requireAdmin, async (req, res) => {
  const userId = req.params.id;
  const { username, email, password, role, is_active } = req.body;
  const ipAddress = req.clientIp;

  try {
    // Get current user data for audit log
    const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [
      userId,
    ]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const originalData = users[0];
    const updates = [];
    const values = [];
    const updatedData = {};

    if (username) {
      updates.push('username = ?');
      values.push(username);
      updatedData.username = username;
    }
    if (email) {
      updates.push('email = ?');
      values.push(email);
      updatedData.email = email;
    }
    if (password) {
      const passwordHash = await hashPassword(password);
      updates.push('password_hash = ?');
      values.push(passwordHash);
      // Zeige an, dass das Passwort geändert wurde, aber nicht den Wert
      updatedData.password = '(geändert)';
    }
    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
      updatedData.role = role;
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active);
      updatedData.is_active = is_active;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(userId);
    await pool.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Create audit log with original and new data
    const fieldsUpdated = [];

    // Vergleiche alle Felder und sammle nur die geänderten
    if (
      updatedData.username &&
      updatedData.username !== originalData.username
    ) {
      fieldsUpdated.push('username');
    }
    if (updatedData.email && updatedData.email !== originalData.email) {
      fieldsUpdated.push('email');
    }
    if (
      updatedData.role !== undefined &&
      updatedData.role !== originalData.role
    ) {
      fieldsUpdated.push('role');
    }
    if (
      updatedData.is_active !== undefined &&
      updatedData.is_active !== originalData.is_active
    ) {
      fieldsUpdated.push('is_active');
    }
    if (password) {
      fieldsUpdated.push('password');
    }

    await createAuditLog(
      req.user.id,
      'user_updated',
      'users',
      userId,
      {
        username: originalData.username, // Füge den Benutzernamen hinzu
        original_data: {
          username: originalData.username,
          email: originalData.email,
          role: originalData.role,
          is_active: originalData.is_active,
        },
        new_data: updatedData,
        fields_updated: fieldsUpdated,
        updated_by: req.user.username,
        timestamp: new Date().toISOString(),
      },
      ipAddress
    );

    res.json({ message: 'User updated successfully' });

    // Broadcast user update
    broadcast('user_updated', {
      id: userId,
      ...updatedData,
    });

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'user_updated',
      resource_type: 'users',
      resource_id: userId,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Toggle user active status (admin only)
router.put(
  '/users/:id/toggle-active',
  verifyToken,
  requireAdmin,
  async (req, res) => {
    const userId = req.params.id;
    const ipAddress = req.clientIp;

    try {
      // Get current user data
      const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [
        userId,
      ]);
      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = users[0];
      const newStatus = user.is_active ? 0 : 1;

      // Update user status
      await pool.execute('UPDATE users SET is_active = ? WHERE id = ?', [
        newStatus,
        userId,
      ]);

      // Create specific audit log for status change
      await createAuditLog(
        req.user.id,
        newStatus ? 'user_activated' : 'user_deactivated',
        'users',
        userId,
        {
          original_status: user.is_active,
          new_status: newStatus,
          username: user.username,
          changed_by: req.user.username,
          timestamp: new Date().toISOString(),
        },
        ipAddress
      );

      res.json({
        message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
        is_active: newStatus,
      });

      // Debug logging
      console.log(
        `[SSE] Broadcasting user_status_changed for user ${user.username} (ID: ${userId})`
      );
      console.log(
        `[SSE] New status: ${newStatus ? 'activated' : 'deactivated'}`
      );

      // Broadcast user status update
      broadcast('user_status_changed', {
        id: userId,
        username: user.username,
        is_active: newStatus,
        changed_by: req.user.username,
      });

      // Broadcast specific activation/deactivation event
      const statusEvent = newStatus ? 'user_activated' : 'user_deactivated';
      console.log(`[SSE] Broadcasting ${statusEvent} event`);
      broadcast(statusEvent, {
        id: userId,
        username: user.username,
        changed_by: req.user.username,
        timestamp: new Date().toISOString(),
      });

      // Broadcast audit log update
      console.log(`[SSE] Broadcasting audit_log_created event`);
      broadcast('audit_log_created', {
        action: newStatus ? 'user_activated' : 'user_deactivated',
        resource_type: 'users',
        resource_id: userId,
        username: user.username,
      });
    } catch (error) {
      console.error('Error toggling user status:', error);
      res.status(500).json({ error: 'Failed to toggle user status' });
    }
  }
);

// Delete user (admin only)
router.delete('/users/:id', verifyToken, requireAdmin, async (req, res) => {
  const userId = req.params.id;
  const ipAddress = req.clientIp;

  try {
    // Prevent deleting own account
    if (userId == req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Get complete user info before deletion for audit log
    const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [
      userId,
    ]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = users[0];

    // Create audit log with complete user data (including password_hash for restoration)
    await createAuditLog(
      req.user.id,
      'user_deleted',
      'users',
      userId,
      {
        user: userData,
        deleted_by: req.user.username,
        timestamp: new Date().toISOString(),
      },
      ipAddress
    );

    await pool.execute('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ message: 'User deleted successfully' });

    // Broadcast user deletion
    broadcast('user_deleted', { id: userId });

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'user_deleted',
      resource_type: 'users',
      resource_id: userId,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Change password (for logged in user)
router.post('/changePassword', verifyToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const ipAddress = req.clientIp;

  try {
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: 'Current and new password are required' });
    }

    // Get user
    const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [
      req.user.id,
    ]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValid = await comparePassword(
      currentPassword,
      users[0].password_hash
    );
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [
      newPasswordHash,
      req.user.id,
    ]);

    await createAuditLog(
      req.user.id,
      'password_changed',
      'user',
      req.user.id,
      null,
      ipAddress
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Get audit logs (admin only)
router.get('/audit-logs', verifyToken, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const [logs] = await pool.execute(
      `SELECT a.*, u.username 
             FROM audit_logs a 
             LEFT JOIN users u ON a.user_id = u.id 
             ORDER BY a.created_at DESC 
             LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;
