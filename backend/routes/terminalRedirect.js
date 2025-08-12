// Terminal Redirect Route - Using QueryBuilder
const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');

// Initialize QueryBuilder
const db = new QueryBuilder(pool);

// Redirect to ttyd with proper parameters
router.get('/v1/:applianceId', async (req, res) => {
  try {
    const { applianceId } = req.params;
    
    // Get appliance details from database using QueryBuilder
    const appliance = await db.findOne('appliances', { id: applianceId });

    if (!appliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }
    
    if (!appliance.sshConnection) {
      return res.status(400).json({ error: 'No SSH connection configured for this appliance' });
    }

    // Parse SSH connection string (format: username@host:port)
    const match = appliance.sshConnection.match(/^(.+)@(.+):(\d+)$/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid SSH connection format' });
    }

    const [_, username, host, port] = match;
    
    // Build ttyd URL with parameters
    const ttydUrl = `/terminal/?host=${encodeURIComponent(host)}&user=${encodeURIComponent(username)}&port=${port}&hostId=${applianceId}`;
    
    // Redirect to ttyd
    res.redirect(ttydUrl);
    
  } catch (error) {
    console.error('Terminal redirect error:', error);
    res.status(500).json({ error: 'Failed to redirect to terminal' });
  }
});

module.exports = router;
