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
    const token = req.headers.authorization?.split(' ')[1];

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
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
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

// Audit log erstellen
const createAuditLog = async (
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

    await pool.execute(
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

module.exports = {
  verifyToken,
  requireAdmin,
  optionalAuth,
  hashPassword,
  comparePassword,
  hashToken,
  generateToken,
  createAuditLog,
  JWT_SECRET,
};
