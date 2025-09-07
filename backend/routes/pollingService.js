const express = require('express');
const router = express.Router();
const pollingService = require('../services/BackgroundPollingService');
const { verifyToken } = require('../utils/auth');
const pool = require('../utils/database');

// Get polling service status
router.get('/status', verifyToken, async (req, res) => {
  try {
    const status = pollingService.getStatus();
    
    // Get additional statistics from database
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT host_id) as totalHosts,
        COUNT(*) as totalMetrics,
        MAX(timestamp) as lastCollection,
        MIN(timestamp) as firstCollection
      FROM snmp_metrics
      WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);
    
    res.json({
      service: status,
      statistics: stats[0],
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error getting polling service status:', error);
    res.status(500).json({ error: 'Failed to get service status' });
  }
});

// Start polling service
router.post('/start', verifyToken, async (req, res) => {
  try {
    if (!pollingService.getStatus().isRunning) {
      await pollingService.initialize();
      await pollingService.start();
    }
    
    res.json({
      success: true,
      message: 'Polling service started',
      status: pollingService.getStatus()
    });
  } catch (error) {
    console.error('Error starting polling service:', error);
    res.status(500).json({ error: 'Failed to start service' });
  }
});

// Stop polling service
router.post('/stop', verifyToken, async (req, res) => {
  try {
    await pollingService.stop();
    
    res.json({
      success: true,
      message: 'Polling service stopped',
      status: pollingService.getStatus()
    });
  } catch (error) {
    console.error('Error stopping polling service:', error);
    res.status(500).json({ error: 'Failed to stop service' });
  }
});

// Restart polling service
router.post('/restart', verifyToken, async (req, res) => {
  try {
    await pollingService.stop();
    await pollingService.initialize();
    await pollingService.start();
    
    res.json({
      success: true,
      message: 'Polling service restarted',
      status: pollingService.getStatus()
    });
  } catch (error) {
    console.error('Error restarting polling service:', error);
    res.status(500).json({ error: 'Failed to restart service' });
  }
});

// Add host to polling
router.post('/hosts/:hostId/add', verifyToken, async (req, res) => {
  try {
    const { hostId } = req.params;
    await pollingService.addHost(parseInt(hostId));
    
    res.json({
      success: true,
      message: `Host ${hostId} added to polling`,
      isActive: pollingService.isHostActive(parseInt(hostId))
    });
  } catch (error) {
    console.error('Error adding host to polling:', error);
    res.status(500).json({ error: 'Failed to add host' });
  }
});

// Remove host from polling
router.post('/hosts/:hostId/remove', verifyToken, async (req, res) => {
  try {
    const { hostId } = req.params;
    await pollingService.removeHost(parseInt(hostId));
    
    res.json({
      success: true,
      message: `Host ${hostId} removed from polling`
    });
  } catch (error) {
    console.error('Error removing host from polling:', error);
    res.status(500).json({ error: 'Failed to remove host' });
  }
});

// Update host polling configuration
router.post('/hosts/:hostId/update', verifyToken, async (req, res) => {
  try {
    const { hostId } = req.params;
    await pollingService.updateHost(parseInt(hostId));
    
    res.json({
      success: true,
      message: `Host ${hostId} polling configuration updated`,
      isActive: pollingService.isHostActive(parseInt(hostId))
    });
  } catch (error) {
    console.error('Error updating host polling:', error);
    res.status(500).json({ error: 'Failed to update host' });
  }
});

// Get host polling status
router.get('/hosts/:hostId/status', verifyToken, async (req, res) => {
  try {
    const { hostId } = req.params;
    const isActive = pollingService.isHostActive(parseInt(hostId));
    
    // Get last metrics from database
    const [metrics] = await pool.execute(`
      SELECT 
        metric_key,
        metric_value,
        timestamp
      FROM snmp_metrics
      WHERE host_id = ?
      AND timestamp = (
        SELECT MAX(timestamp) 
        FROM snmp_metrics 
        WHERE host_id = ?
      )
    `, [hostId, hostId]);
    
    res.json({
      hostId: parseInt(hostId),
      isActive,
      lastMetrics: metrics,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error getting host polling status:', error);
    res.status(500).json({ error: 'Failed to get host status' });
  }
});

// Get metrics history for a host
router.get('/hosts/:hostId/history', verifyToken, async (req, res) => {
  try {
    const { hostId } = req.params;
    const { metricKey, hours = 24 } = req.query;
    
    let query = `
      SELECT 
        metric_key,
        metric_name,
        metric_value,
        unit,
        timestamp
      FROM snmp_metrics
      WHERE host_id = ?
      AND timestamp > DATE_SUB(NOW(), INTERVAL ? HOUR)
    `;
    
    const params = [hostId, parseInt(hours)];
    
    if (metricKey) {
      query += ' AND metric_key = ?';
      params.push(metricKey);
    }
    
    // Für kurze Zeiträume brauchen wir eine sinnvolle Begrenzung
    // Bei 10-Sekunden-Intervall und multiplen Metriken:
    // 1h = 360 Datenpunkte pro Metrik, aber wir holen ALLE Metriken
    // Wenn wir z.B. 20 verschiedene Metriken haben, wären das 360 * 20 = 7200 Punkte!
    const pointsPerHour = 360; // bei 10-Sekunden-Intervall
    const expectedPointsPerMetric = pointsPerHour * parseInt(hours);
    // Wir setzen ein vernünftiges Maximum für ALLE Metriken zusammen
    const limit = Math.min(expectedPointsPerMetric * 50, 50000); // max 50 Metriken * Punkte oder 50k total
    
    query += ` ORDER BY timestamp ASC LIMIT ${limit}`;
    
    const [metrics] = await pool.execute(query, params);
    
    // Debug logging
    console.log(`[METRICS-HISTORY] Fetched ${metrics.length} data points for ${hours} hours`);
    if (metrics.length > 0) {
      const uniqueMetrics = [...new Set(metrics.map(m => m.metric_key))];
      console.log(`[METRICS-HISTORY] Unique metrics: ${uniqueMetrics.length} - ${uniqueMetrics.join(', ')}`);
      
      // Zeitspanne prüfen
      const timestamps = metrics.map(m => new Date(m.timestamp));
      const minTime = Math.min(...timestamps);
      const maxTime = Math.max(...timestamps);
      const actualHours = (maxTime - minTime) / (1000 * 60 * 60);
      console.log(`[METRICS-HISTORY] Actual time span: ${actualHours.toFixed(2)} hours`);
      console.log(`[METRICS-HISTORY] From: ${new Date(minTime).toISOString()} To: ${new Date(maxTime).toISOString()}`);
    }
    
    res.json({
      success: true,
      hostId: parseInt(hostId),
      metrics,
      count: metrics.length,
      hours: parseInt(hours),
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error getting metrics history:', error);
    res.status(500).json({ error: 'Failed to get metrics history' });
  }
});

module.exports = router;
