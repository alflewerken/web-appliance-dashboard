const express = require('express');
const router = express.Router();

router.get('/test-audit', async (req, res) => {
  const logs = [
    { id: 1, createdAt: '2025-08-08T19:15:54.000Z', action: 'test' },
    { id: 2, createdAt: '2025-08-08T18:15:54.000Z', action: 'test' },
    { id: 3, createdAt: '2025-08-07T19:15:54.000Z', action: 'test' }
  ];
  
  const today = new Date().toISOString().split('T')[0];
  const todayCount = logs.filter(l => l.createdAt.startsWith(today)).length;
  
  res.json({
    logs,
    today,
    todayCount,
    test: 'This is a test response'
  });
});

module.exports = router;
