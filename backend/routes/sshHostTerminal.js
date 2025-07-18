// SSH Host Terminal Route
const express = require('express');
const router = express.Router();
const pool = require('../utils/database');

// GET endpoint für SSH-Host-Terminal
router.get('/host-terminal/:hostId', async (req, res) => {
  try {
    let { hostId } = req.params;
    
    // Extrahiere die numerische ID, falls das Format 'ssh_host_123' verwendet wird
    if (hostId.startsWith('ssh_host_')) {
      hostId = hostId.replace('ssh_host_', '');
    }

    // Hole SSH-Host aus der Datenbank
    const [hosts] = await pool.execute(
      'SELECT * FROM ssh_hosts WHERE id = ? AND is_active = TRUE',
      [hostId]
    );

    if (hosts.length === 0) {
      return res
        .status(404)
        .json({ error: 'SSH-Host nicht gefunden oder inaktiv' });
    }

    const host = hosts[0];

    // Erstelle eine temporäre virtuelle Appliance-ID für diesen Host
    const virtualApplianceId = `ssh_host_${hostId}`;

    res.json({
      success: true,
      applianceId: virtualApplianceId,
      host: {
        hostname: host.hostname,
        connection: `${host.username}@${host.host}:${host.port}`,
        keyName: host.key_name,
      },
    });
  } catch (error) {
    console.error('SSH Host Terminal Error:', error);
    res.status(500).json({ error: error.message, details: error.stack });
  }
});

module.exports = router;
