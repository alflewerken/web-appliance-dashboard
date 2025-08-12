const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');
const db = new QueryBuilder(pool);
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

    // Find user - Special query to include password_hash
    // First, check if user exists
    const usersBasic = await db.select('users', {
      $or: [
        { username: username },
        { email: username }
      ],
      is_active: 1  // Changed from isActive to is_active
    });
    
    if (usersBasic.length === 0) {
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
    
    // Now get the full user with password_hash using raw query
    const rawQuery = `
      SELECT id, username, email, role, is_active, password_hash, last_login, last_activity, created_at, updated_at
      FROM users 
      WHERE (username = ? OR email = ?) AND is_active = 1
      LIMIT 1
    `;
    
    const users = await db.raw(rawQuery, [username, username]);
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0]; // Behalte snake_case für Passwort-Vergleich
    
    // Debug: Log user object to check password_hash
    console.log('Login Debug - User object keys:', Object.keys(user));
    console.log('Login Debug - password_hash exists:', !!user.password_hash);
    console.log('Login Debug - passwordHash exists:', !!user.passwordHash);
    
    // Handle both possible field names (password_hash or passwordHash)
    const passwordHash = user.password_hash || user.passwordHash;
    
    if (!passwordHash) {
      console.error('Login error: No password hash found in user object');
      console.error('User object:', JSON.stringify(user, null, 2));
      return res.status(500).json({ error: 'Authentication configuration error' });
    }

    // Verify password
    const isValidPassword = await comparePassword(password, passwordHash);
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
    const settings = await db.select('user_settings', { settingKey: 'auth_token_expiry' });
    const tokenExpiry =
      settings.length > 0 ? parseInt(settings[0].settingValue) : 86400;

    // Create session - Using raw for DATE_ADD function
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenExpiry);
    
    await db.insert('active_sessions', {
      userId: user.id,
      sessionToken: tokenHash,
      expiresAt: expiresAt,
      ipAddress: ipAddress,
      userAgent: userAgent
    });

    // Update last login
    await db.update('users', { lastLogin: new Date() }, { id: user.id });

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
    const permissions = await db.select('role_permissions', { role: user.role });

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
      // Try to delete session, but don't fail if it doesn't exist
      try {
        await db.delete('active_sessions', { sessionToken: tokenHash });
      } catch (deleteError) {
        console.log('Session delete warning:', deleteError.message);
        // Continue anyway - session might already be deleted or never existed
      }
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
    console.error('Logout error:', error);
    // Don't fail logout completely - user wants to logout anyway
    res.json({ message: 'Logged out (with warnings)', warning: error.message });
  }
});

// Get current user
router.get('/me', verifyToken, async (req, res) => {
  try {
    // Get user permissions
    const permissions = await db.select('role_permissions', { role: req.user.role });

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
    
    // Get users with their last activity from sessions - Complex query requires raw
    const rawUsers = await db.raw(`
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

    console.log('Found users:', rawUsers.length);
    
    // Manual mapping needed for raw queries - QueryBuilder doesn't auto-map raw results
    const users = rawUsers.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      isActive: u.is_active,  // snake_case to camelCase
      lastLogin: u.last_login,  // snake_case to camelCase
      createdAt: u.created_at,  // snake_case to camelCase
      updatedAt: u.updated_at,  // snake_case to camelCase
      lastActivity: u.last_activity,  // already in correct format
      isOnline: u.is_online  // snake_case to camelCase
    }));
    
    console.log('User list:', users.map(u => ({ id: u.id, username: u.username, role: u.role, isActive: u.isActive })));

    res.json(users);
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
    const settings = await db.select('user_settings', { settingKey: 'auth_password_min_length' });
    const minLength =
      settings.length > 0 ? parseInt(settings[0].settingValue) : 8;

    if (password.length < minLength) {
      return res
        .status(400)
        .json({
          error: `Password must be at least ${minLength} characters long`,
        });
    }

    // Check if user already exists - Using QueryBuilder with OR support
    const existing = await db.select('users', {
      $or: [
        { username: username },
        { email: email }
      ]
    });

    if (existing.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const result = await db.insert('users', {
      username,
      email,
      passwordHash,
      role
    });

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

// PATCH user (admin only) - for partial updates
router.patch('/users/:id', verifyToken, requireAdmin, async (req, res) => {
  const userId = req.params.id;
  const ipAddress = req.clientIp;

  try {
    // Get current user data for comparison
    const user = await db.findOne('users', { id: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const originalData = { ...user };
    const updateData = {};
    const changedFields = {};
    const fieldsUpdated = [];

    // Process only the fields that were sent
    const { username, email, password, role, is_active } = req.body;

    // Check each field for changes
    if (username !== undefined && username !== user.username) {
      updateData.username = username;
      changedFields.username = username;
      fieldsUpdated.push('username');
    }

    if (email !== undefined && email !== user.email) {
      updateData.email = email;
      changedFields.email = email;
      fieldsUpdated.push('email');
    }

    if (password) {
      const passwordHash = await hashPassword(password);
      updateData.passwordHash = passwordHash;
      changedFields.password = '(geändert)';
      fieldsUpdated.push('password');
    }

    if (role !== undefined && role !== user.role) {
      updateData.role = role;
      changedFields.role = role;
      fieldsUpdated.push('role');
    }

    if (is_active !== undefined) {
      const currentActive = user.is_active || user.isActive;
      const newActive = is_active ? 1 : 0;
      if (newActive !== currentActive) {
        updateData.isActive = newActive;
        changedFields.is_active = newActive;
        fieldsUpdated.push('is_active');
      }
    }

    // If no changes, return early
    if (Object.keys(updateData).length === 0) {
      return res.json({ 
        message: 'No changes detected',
        user: user 
      });
    }

    // Apply updates
    await db.update('users', updateData, { id: userId });

    // Create audit log only for actual changes
    await createAuditLog(
      req.user.id,
      'user_updated',
      'users',
      userId,
      {
        username: originalData.username,
        changes: changedFields,
        fields_updated: fieldsUpdated,
        updated_by: req.user.username,
        timestamp: new Date().toISOString(),
      },
      ipAddress
    );

    // Get updated user
    const updatedUser = await db.findOne('users', { id: userId });

    res.json({ 
      message: 'User updated successfully',
      user: updatedUser,
      fieldsUpdated: fieldsUpdated
    });

    // Broadcast user update
    broadcast('user_updated', {
      id: userId,
      username: updatedUser.username,
      updatedBy: req.user.username,
      fieldsUpdated: fieldsUpdated
    });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Update user (admin only) - legacy PUT route
router.put('/users/:id', verifyToken, requireAdmin, async (req, res) => {
  const userId = req.params.id;
  const { username, email, password, role, is_active } = req.body;
  const ipAddress = req.clientIp;

  try {
    // Get current user data for audit log
    const user = await db.findOne('users', { id: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const originalData = user;
    const updateData = {};
    const updatedData = {};

    if (username) {
      updateData.username = username;
      updatedData.username = username;
    }
    if (email) {
      updateData.email = email;
      updatedData.email = email;
    }
    if (password) {
      const passwordHash = await hashPassword(password);
      updateData.passwordHash = passwordHash;
      // Zeige an, dass das Passwort geändert wurde, aber nicht den Wert
      updatedData.password = '(geändert)';
    }
    if (role !== undefined) {
      updateData.role = role;
      updatedData.role = role;
    }
    if (is_active !== undefined) {
      updateData.isActive = is_active;
      updatedData.is_active = is_active;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    await db.update('users', updateData, { id: userId });

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
      const user = await db.findOne('users', { id: userId });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const newStatus = user.isActive ? 0 : 1;

      // Update user status
      await db.update('users', { isActive: newStatus }, { id: userId });

      // Create specific audit log for status change
      await createAuditLog(
        req.user.id,
        newStatus ? 'user_activated' : 'user_deactivated',
        'users',
        userId,
        {
          original_status: user.isActive,
          new_status: newStatus,
          username: user.username,
          changed_by: req.user.username,
          timestamp: new Date().toISOString(),
        },
        ipAddress
      );

      res.json({
        message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
        isActive: newStatus,  // Changed from is_active to isActive for consistency
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
    const user = await db.findOne('users', { id: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = user;

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

    await db.delete('users', { id: userId });

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
    const user = await db.findOne('users', { id: req.user.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValid = await comparePassword(
      currentPassword,
      user.passwordHash
    );
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await db.update('users', { passwordHash: newPasswordHash }, { id: req.user.id });

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

    // Complex join query requires raw SQL
    const logs = await db.raw(
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
