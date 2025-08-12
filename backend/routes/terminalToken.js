const express = require('express');
const router = express.Router();

// Simple token endpoint for ttyd
router.get('/token', (req, res) => {
  // Return a simple success response
  res.json({
    success: true,
    token: 'dummy-token',
    message: 'Token endpoint for ttyd'
  });
});

router.post('/token', (req, res) => {
  // Return a simple success response
  res.json({
    success: true,
    token: 'dummy-token',
    message: 'Token endpoint for ttyd'
  });
});

module.exports = router;
