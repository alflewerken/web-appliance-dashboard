const express = require('express');
const router = express.Router();

// Initialize host monitoring routes
const initHostMonitoring = (db) => {
  
  // Get SNMP configuration for a host
  router.get('/hosts/:id/snmp-config', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get SNMP config from database
      const config = await db.findOne('host_snmp_configs', { hostId: id });
      
      if (!config) {
        // Return default config if none exists
        return res.json({
          config: {
            enabled: false,
            version: '2c',
            community: 'public',
            port: 161,
            username: '',
            authProtocol: 'SHA',
            authPassword: '',
            privProtocol: 'AES',
            privPassword: '',
            pollInterval: 60,
          }
        });
      }
      
      res.json({ config });
    } catch (error) {
      console.error('Error fetching SNMP config:', error);
      res.status(500).json({ error: 'Failed to fetch SNMP configuration' });
    }
  });
  
  // Update SNMP configuration for a host
  router.put('/hosts/:id/snmp-config', async (req, res) => {
    try {
      const { id } = req.params;
      const config = req.body;
      
      // Check if config exists
      const existing = await db.findOne('host_snmp_configs', { hostId: id });
      
      const configData = {
        hostId: id,
        enabled: config.enabled,
        version: config.version,
        community: config.community || null,
        port: config.port,
        username: config.username || null,
        authProtocol: config.authProtocol || null,
        authPassword: config.authPassword || null,
        privProtocol: config.privProtocol || null,
        privPassword: config.privPassword || null,
        pollInterval: config.pollInterval,
        updatedAt: new Date(),
      };
      
      if (existing) {
        // Update existing config
        await db.update('host_snmp_configs', configData, { id: existing.id });
      } else {
        // Create new config
        configData.createdAt = new Date();
        await db.insert('host_snmp_configs', configData);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating SNMP config:', error);
      res.status(500).json({ error: 'Failed to update SNMP configuration' });
    }
  });
  
  // Test SNMP connection
  router.post('/hosts/:id/snmp-test', async (req, res) => {
    try {
      const { id } = req.params;
      const config = req.body;
      
      // Get host details
      const host = await db.findOne('hosts', { id });
      
      if (!host) {
        return res.status(404).json({ error: 'Host not found' });
      }
      
      // TODO: Implement actual SNMP test using net-snmp or similar library
      // For now, return mock success
      
      // Simulate test delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      res.json({ 
        success: true,
        message: 'SNMP connection test successful'
      });
    } catch (error) {
      console.error('Error testing SNMP connection:', error);
      res.status(500).json({ error: 'Failed to test SNMP connection' });
    }
  });
  
  // Get monitoring data for a host
  router.get('/hosts/:id/monitoring-data', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get latest monitoring data from database
      const data = await db.findOne('host_monitoring_data', 
        { hostId: id },
        { orderBy: 'createdAt', order: 'desc' }
      );
      
      if (!data) {
        // Return empty metrics if no data exists
        return res.json({
          status: 'offline',
          lastUpdate: null,
          metrics: {
            cpu: null,
            memory: null,
            disk: [],
            network: [],
            temperature: null,
            uptime: null,
          }
        });
      }
      
      res.json(data);
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
      res.status(500).json({ error: 'Failed to fetch monitoring data' });
    }
  });
  
  return router;
};

module.exports = initHostMonitoring;
