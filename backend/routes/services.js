// Services compatibility routes
const express = require('express');
const router = express.Router();
const statusChecker = require('../utils/statusChecker');
const pool = require('../utils/database');
const {
  mapServiceDbToJs,
  getServiceSelectColumns,
  mapServiceStatus
} = require('../utils/dbFieldMappingServices');

// GET /api/services - Get all services with their current status
router.get('/', async (req, res) => {
  try {
    // Get all appliances with their service status
    const [appliances] = await pool.execute(`
      SELECT ${getServiceSelectColumns()}
      FROM appliances
      ORDER BY name
    `);

    // Map to services format with camelCase
    const services = appliances.map(mapServiceDbToJs);

    res.json({
      success: true,
      services,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ 
      error: 'Failed to fetch services',
      details: error.message 
    });
  }
});

// POST /api/services/check-all - Trigger status check for all services
router.post('/checkAll', async (req, res) => {
  try {
    console.log('🔄 Service check requested');
    
    // Clear host cache to force fresh checks
    statusChecker.clearHostCache();
    
    // Run the check
    await statusChecker.forceCheck();
    
    res.json({
      message: 'Status check initiated',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in service check:', error);
    res.status(500).json({ error: 'Failed to check services' });
  }
});

// GET /api/services/:id/status - Get status for a specific service
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [[appliance]] = await pool.execute(
      'SELECT service_status, last_status_check FROM appliances WHERE id = ?',
      [id]
    );
    
    if (!appliance) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    res.json({
      success: true,
      status: appliance.service_status || 'unknown',
      lastChecked: appliance.last_status_check
    });
  } catch (error) {
    console.error('Error fetching service status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch service status',
      details: error.message 
    });
  }
});

module.exports = router;
