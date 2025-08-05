const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

/**
 * Check if user is accessing from external network
 */
router.get('/accessMode', authenticateToken, (req, res) => {
  // Get the real client IP
  const clientIp = req.headers['x-real-ip'] || 
                   req.headers['x-forwarded-for']?.split(',')[0] || 
                   req.ip;

  // Check if IP is from private network ranges
  const isPrivateIp = (ip) => {
    return ip.startsWith('192.168.') ||
           ip.startsWith('10.') ||
           ip.startsWith('172.16.') ||
           ip.startsWith('172.17.') ||
           ip.startsWith('172.18.') ||
           ip.startsWith('172.19.') ||
           ip.startsWith('172.20.') ||
           ip.startsWith('172.21.') ||
           ip.startsWith('172.22.') ||
           ip.startsWith('172.23.') ||
           ip.startsWith('172.24.') ||
           ip.startsWith('172.25.') ||
           ip.startsWith('172.26.') ||
           ip.startsWith('172.27.') ||
           ip.startsWith('172.28.') ||
           ip.startsWith('172.29.') ||
           ip.startsWith('172.30.') ||
           ip.startsWith('172.31.') ||
           ip === '127.0.0.1' ||
           ip === '::1' ||
           ip.includes('localhost');
  };

  const isExternal = !isPrivateIp(clientIp);

  res.json({
    isExternal,
    clientIp,
    accessMode: isExternal ? 'proxy' : 'direct',
    recommendation: isExternal 
      ? 'Use proxy URLs for service access' 
      : 'Use direct URLs for service access'
  });
});

/**
 * Get proxy configuration
 */
router.get('/proxy-settings', authenticateToken, (req, res) => {
  res.json({
    proxyEnabled: true,
    proxyBasePath: '/api/proxy',
    wsProxyBasePath: '/api/wsProxy',
    instructions: {
      http: 'Use /api/proxy/{ip}:{port}/path for HTTP/HTTPS',
      websocket: 'Use /api/wsProxy/{ip}:{port}/path for WebSocket'
    }
  });
});

module.exports = router;