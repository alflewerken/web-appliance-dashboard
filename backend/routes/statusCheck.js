// Status Check Control API
const express = require('express');
const router = express.Router();
const statusChecker = require('../utils/statusChecker');
const { verifyToken } = require('../utils/auth');

// Force immediate status check
router.post('/check-now', verifyToken, async (req, res) => {
  try {
    console.log('🔄 Manual status check requested');

    // Clear host cache to force fresh checks
    statusChecker.clearHostCache();

    // Run the check
    await statusChecker.forceCheck();

    res.json({
      message: 'Status check initiated',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in manual status check:', error);
    res.status(500).json({ error: 'Failed to initiate status check' });
  }
});

// Get status checker info
router.get('/info', verifyToken, async (req, res) => {
  try {
    res.json({
      isRunning: statusChecker.isRunning,
      checkInterval: statusChecker.checkInterval,
      hostCacheSize: statusChecker.hostAvailability.size,
      lastCheck: statusChecker.lastCheckTime || null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status checker info' });
  }
});

// Clear host cache
router.post('/clear-cache', verifyToken, async (req, res) => {
  try {
    statusChecker.clearHostCache();
    res.json({
      message: 'Host cache cleared',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

module.exports = router;
