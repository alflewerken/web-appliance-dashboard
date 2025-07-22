const express = require('express');
const router = express.Router();
const pool = require('../../utils/database');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, hashToken } = require('../../utils/auth');

// Debug endpoint to check token and session
router.post('/check-token', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.json({ 
        error: 'No authorization header',
        debug: { headers: req.headers }
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.json({ 
        error: 'No token in authorization header',
        debug: { authHeader }
      });
    }

    // Try to decode the token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      return res.json({
        error: 'JWT verification failed',
        jwtError: jwtError.message,
        jwtErrorName: jwtError.name,
        debug: {
          token: token.substring(0, 20) + '...',
          JWT_SECRET: JWT_SECRET ? 'Set (' + JWT_SECRET.length + ' chars)' : 'Not set'
        }
      });
    }

    // Check session in database
    const hashedToken = hashToken(token);
    const [sessions] = await pool.execute(
      'SELECT s.*, u.username, u.role, u.is_active FROM active_sessions s JOIN users u ON s.user_id = u.id WHERE s.session_token = ?',
      [hashedToken]
    );

    if (sessions.length === 0) {
      return res.json({
        error: 'Session not found in database',
        decoded,
        debug: {
          hashedToken: hashedToken.substring(0, 20) + '...',
          query: 'Looking for session with hashed token'
        }
      });
    }

    const session = sessions[0];
    
    // Check if session is expired
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    
    if (expiresAt < now) {
      return res.json({
        error: 'Session expired',
        session: {
          id: session.id,
          user_id: session.user_id,
          username: session.username,
          expires_at: session.expires_at,
          created_at: session.created_at
        },
        debug: {
          now: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          expired: true
        }
      });
    }

    // Check if user is active
    if (session.is_active !== 1) {
      return res.json({
        error: 'User is not active',
        session: {
          username: session.username,
          is_active: session.is_active
        }
      });
    }

    // Everything is OK
    res.json({
      success: true,
      user: {
        id: session.user_id,
        username: session.username,
        role: session.role
      },
      session: {
        expires_at: session.expires_at,
        last_activity: session.last_activity
      },
      debug: {
        JWT_SECRET: JWT_SECRET ? 'Set (' + JWT_SECRET.length + ' chars)' : 'Not set',
        decoded
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Debug check failed',
      message: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;
