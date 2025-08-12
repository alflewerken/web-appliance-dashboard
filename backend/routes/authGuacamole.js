const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Validate Guacamole access
// This endpoint is used by nginx auth_request to validate access to Guacamole
router.get('/validate-guacamole-access', async (req, res) => {
  try {
    // Check for authorization header with bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Check for session cookie as fallback
      if (!req.session || !req.session.userId) {
        return res.status(401).send('Unauthorized');
      }
      // Session is valid
      return res.status(200).send('OK');
    }

    // Validate JWT token
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if token is specifically for Guacamole access
      if (decoded.type === 'guacamole-access') {
        // Check if token is expired
        const now = Date.now() / 1000;
        if (decoded.exp && decoded.exp < now) {
          return res.status(401).send('Token expired');
        }
        return res.status(200).send('OK');
      }
      
      // Regular auth token - check if user is logged in
      if (decoded.userId) {
        return res.status(200).send('OK');
      }
    } catch (error) {
      console.error('Token validation error:', error);
      return res.status(401).send('Invalid token');
    }

    return res.status(401).send('Unauthorized');
  } catch (error) {
    console.error('Guacamole access validation error:', error);
    return res.status(500).send('Internal error');
  }
});

// Generate time-limited Guacamole access token
router.post('/guacamole-token', async (req, res) => {
  // This should be called by authenticated users only
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { applianceId, connectionId } = req.body;

  if (!applianceId || !connectionId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // Generate a short-lived token specifically for Guacamole access
  const token = jwt.sign(
    {
      userId: req.user.id,
      applianceId,
      connectionId,
      type: 'guacamole-access'
    },
    process.env.JWT_SECRET,
    { expiresIn: '10m' } // Token valid for 10 minutes
  );

  res.json({
    token,
    expiresIn: 600 // seconds
  });
});

module.exports = router;