const express = require('express');
const router = express.Router();

// Debug endpoint to show all request information
router.get('/debug/ip', (req, res) => {
  const debugInfo = {
    // Headers
    headers: req.headers,

    // Express properties
    ip: req.ip,
    ips: req.ips,

    // Connection info
    connection: {
      remoteAddress: req.connection?.remoteAddress,
      remotePort: req.connection?.remotePort,
      localAddress: req.connection?.localAddress,
      localPort: req.connection?.localPort,
    },

    // Socket info
    socket: {
      remoteAddress: req.socket?.remoteAddress,
      remotePort: req.socket?.remotePort,
      localAddress: req.socket?.localAddress,
      localPort: req.socket?.localPort,
    },

    // Extracted client IP
    clientIp: req.clientIp,

    // Request info
    method: req.method,
    url: req.url,
    protocol: req.protocol,
    hostname: req.hostname,

    // Trust proxy setting
    trustProxy: req.app.get('trust proxy'),
  };

  res.json(debugInfo);
});

// Test endpoint to create a debug audit log entry
router.post('/debug/test-audit', (req, res) => {
  const testIp = req.body.testIp || req.clientIp;

  // Log with custom IP for testing
  console.log(`Creating test audit log with IP: ${testIp}`);

  res.json({
    message: 'Test audit log created',
    usedIp: testIp,
    actualClientIp: req.clientIp,
    headers: req.headers,
  });
});

module.exports = router;
