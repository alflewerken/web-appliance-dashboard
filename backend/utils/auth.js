const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('./database');
const { getClientIp } = require('./getClientIp');

// JWT Secret aus Umgebungsvariablen oder generieren
const JWT_SECRET =
  process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Middleware für Token-Verifikation
const verifyToken = async (req, res, next) => {

  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {

      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if session exists in database
    const [sessions] = await pool.execute(
      'SELECT s.*, u.* FROM active_sessions s JOIN users u ON s.user_id = u.id WHERE s.session_token = ? AND s.expires_at > NOW() AND u.is_active = 1',
      [hashToken(token)]
    );

    if (sessions.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Update last activity in session
    await pool.execute(
      'UPDATE active_sessions SET last_activity = NOW() WHERE session_token = ?',
      [hashToken(token)]
    );

    // Attach user to request
    req.user = {
      id: sessions[0].user_id,
      username: sessions[0].username,
      email: sessions[0].email,
      role: sessions[0].role,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Middleware für Admin-Rechte
const requireAdmin = (req, res, next) => {

  // Akzeptiere sowohl 'Administrator' als auch 'admin'
  if (req.user?.role !== 'Administrator' && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Middleware für Power User Rechte
const requirePowerUser = (req, res, next) => {
  if (!req.user || !['Administrator', 'Power User'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Power User access required' });
  }
  next();
};

// Middleware für authentifizierte Benutzer (kein Gast)
const requireAuthenticated = (req, res, next) => {
  if (!req.user || req.user.role === 'Gast') {
    return res.status(403).json({ error: 'Authenticated user required' });
  }
  next();
};

// Überprüfen ob Benutzer eine bestimmte Berechtigung hat
const hasPermission = async (userId, resource, action) => {
  try {
    // Get user role
    const [users] = await pool.execute('SELECT role FROM users WHERE id = ?', [
      userId,
    ]);

    if (users.length === 0) return false;

    const userRole = users[0].role;

    // Check role permissions
    const [permissions] = await pool.execute(
      'SELECT 1 FROM role_permissions WHERE role = ? AND resource = ? AND action = ?',
      [userRole, resource, action]
    );

    return permissions.length > 0;
  } catch (error) {
    console.error('Error checking permissions:', error);
    return false;
  }
};

// Middleware für spezifische Berechtigungen
const requirePermission = (resource, action) => async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const hasAccess = await hasPermission(req.user.id, resource, action);

  if (!hasAccess) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      required: `${resource}:${action}`,
    });
  }

  next();
};

// Get user permissions
const getUserPermissions = async userId => {
  try {
    const [users] = await pool.execute('SELECT role FROM users WHERE id = ?', [
      userId,
    ]);

    if (users.length === 0) return [];

    const [permissions] = await pool.execute(
      'SELECT resource, action FROM role_permissions WHERE role = ?',
      [users[0].role]
    );

    return permissions.map(p => `${p.resource}:${p.action}`);
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
};
// Passwort hashen
const hashPassword = async password => await bcrypt.hash(password, 10);

// Passwort vergleichen
const comparePassword = async (password, hash) =>
  await bcrypt.compare(password, hash);

// Token hashen für Datenbank-Speicherung
const hashToken = token => {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
};

// JWT Token generieren
const generateToken = userId =>
  jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });

// Audit log erstellen - DEPRECATED: Use createAuditLog from auditLogger.js instead
const createAuditLog_DEPRECATED = async (
  userId,
  action,
  resourceType = null,
  resourceId = null,
  details = null,
  ipAddress = null,
  req = null
) => {

  try {
    // If no IP address is provided but request object is available, extract it
    if (!ipAddress && req) {
      ipAddress = req.clientIp || getClientIp(req);
    }

    const [result] = await pool.execute(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [
        userId,
        action,
        resourceType,
        resourceId,
        details ? JSON.stringify(details) : null,
        ipAddress,
      ]
    );

    // Get username for the audit log
    let username = 'System';
    if (userId) {
      const [users] = await pool.execute(
        'SELECT username FROM users WHERE id = ?',
        [userId]
      );
      if (users.length > 0) {
        username = users[0].username;
      }
    }

    // Broadcast SSE event for real-time updates
    const { broadcast } = require('../routes/sse');
    broadcast('audit_log_created', {
      id: result.insertId,
      user_id: userId,
      username: username,
      action: action,
      resource_type: resourceType,
      resource_id: resourceId,
      details: details,
      ip_address: ipAddress,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
  }
};

// Optional: Middleware für Authentifizierung (wenn auth_enabled = true)
const optionalAuth = async (req, res, next) => {
  try {
    // Check if auth is enabled
    const [settings] = await pool.execute(
      'SELECT setting_value FROM user_settings WHERE setting_key = ?',
      ['auth_enabled']
    );

    if (settings.length > 0 && settings[0].setting_value === 'true') {
      // Auth is enabled, check for token
      const token = req.headers.authorization?.split(' ')[1];

      if (!token) {
        // No token provided, but this is optional auth
        // Just continue without setting req.user
        return next();
      }

      // Token provided, try to verify it
      try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Check if session exists in database
        const [sessions] = await pool.execute(
          'SELECT s.*, u.* FROM active_sessions s JOIN users u ON s.user_id = u.id WHERE s.session_token = ? AND s.expires_at > NOW() AND u.is_active = 1',
          [hashToken(token)]
        );

        if (sessions.length > 0) {
          // Valid session found
          req.user = {
            id: sessions[0].user_id,
            username: sessions[0].username,
            email: sessions[0].email,
            role: sessions[0].role,
          };
        }
      } catch (tokenError) {
        // Invalid token, but this is optional auth
        // Just continue without setting req.user
      }
    }

    // Continue regardless of auth status
    next();
  } catch (error) {
    // On error, continue without auth
    next();
  }
};

// Check if user can access specific appliance
const canAccessAppliance = async (userId, applianceId) => {
  try {
    const [results] = await pool.execute(
      `SELECT can_view FROM user_accessible_appliances 
             WHERE user_id = ? AND id = ? AND can_view = TRUE`,
      [userId, applianceId]
    );

    return results.length > 0;
  } catch (error) {
    console.error('Error checking appliance access:', error);
    return false;
  }
};

// Check if user can execute commands on appliance
const canExecuteOnAppliance = async (userId, applianceId) => {
  try {
    const [results] = await pool.execute(
      `SELECT can_execute FROM user_accessible_appliances 
             WHERE user_id = ? AND id = ? AND can_execute = TRUE`,
      [userId, applianceId]
    );

    return results.length > 0;
  } catch (error) {
    console.error('Error checking execute permission:', error);
    return false;
  }
};

// Get accessible appliances for user
const getAccessibleAppliances = async userId => {
  try {
    const [appliances] = await pool.execute(
      `SELECT * FROM user_accessible_appliances 
             WHERE user_id = ? AND can_view = TRUE
             ORDER BY name`,
      [userId]
    );

    return appliances;
  } catch (error) {
    console.error('Error getting accessible appliances:', error);
    return [];
  }
};

module.exports = {
  verifyToken,
  requireAdmin,
  requirePowerUser,
  requireAuthenticated,
  requirePermission,
  hasPermission,
  getUserPermissions,
  optionalAuth,
  hashPassword,
  comparePassword,
  hashToken,
  generateToken,
  // createAuditLog_DEPRECATED, // Don't export - use auditLogger.js instead
  canAccessAppliance,
  canExecuteOnAppliance,
  getAccessibleAppliances,
  JWT_SECRET,
};
