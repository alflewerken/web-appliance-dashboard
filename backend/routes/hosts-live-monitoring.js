// Live monitoring data route - NO AUDIT LOGGING
router.get('/:id/live-monitoring', async (req, res) => {
  try {
    const hostId = parseInt(req.params.id);
    
    // Check if user has access to this host
    const host = await db.findOne('hosts', { id: hostId });
    if (!host) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    // Get SNMP config
    const snmpConfig = await db.findOne('host_snmp_configs', { hostId: hostId });
    
    if (!snmpConfig || !snmpConfig.enabled) {
      // No SNMP configured or disabled - return cached data from DB
      const latestData = await db.select('host_monitoring_data', 
        { hostId: hostId },
        { 
          orderBy: 'createdAt', 
          order: 'desc', 
          limit: 1 
        }
      );
      
      if (latestData && latestData.length > 0) {
        let metrics = latestData[0].metrics;
        if (typeof metrics === 'string') {
          try {
            metrics = JSON.parse(metrics);
          } catch (e) {
            logger.error('Failed to parse metrics JSON:', e);
          }
        }
        
        return res.json({
          success: true,
          source: 'cache',
          status: latestData[0].status || 'online',
          lastUpdate: latestData[0].lastUpdate || latestData[0].createdAt,
          metrics: metrics
        });
      } else {
        return res.json({
          success: false,
          source: 'cache',
          status: 'no-data',
          message: 'No cached monitoring data available'
        });
      }
    }
    
    // SNMP is enabled - fetch live data
    const SNMPMonitor = require('../services/SNMPMonitor');
    const snmpMonitor = new SNMPMonitor(db);
    
    const testConfig = {
      ip: host.hostname,
      port: snmpConfig.port || 161,
      community: snmpConfig.community || 'public',
      version: snmpConfig.version || '2c',
      timeout: 5000,
      hostId: hostId
    };
    
    // Get live metrics
    const metricsResult = await snmpMonitor.pollHost(testConfig);
    
    if (metricsResult.success) {
      // Update cache in database (no audit log)
      try {
        // Check if record exists
        const existing = await db.select('host_monitoring_data', { hostId: hostId });
        
        if (existing && existing.length > 0) {
          // Update existing record
          await db.update('host_monitoring_data', 
            {
              status: 'online',
              lastUpdate: new Date(),
              metrics: JSON.stringify(metricsResult.metrics),
              updatedAt: new Date()
            },
            { hostId: hostId }
          );
        } else {
          // Insert new record
          await db.insert('host_monitoring_data', {
            hostId: hostId,
            status: 'online',
            lastUpdate: new Date(),
            metrics: JSON.stringify(metricsResult.metrics),
            createdAt: new Date()
          });
        }
      } catch (dbErr) {
        logger.error('Failed to update metrics cache:', dbErr);
      }
      
      res.json({
        success: true,
        source: 'live',
        status: 'online',
        lastUpdate: new Date(),
        metrics: metricsResult.metrics,
        timestamp: metricsResult.timestamp
      });
    } else {
      // SNMP failed - return cached data if available
      const latestData = await db.select('host_monitoring_data', 
        { hostId: hostId },
        { 
          orderBy: 'createdAt', 
          order: 'desc', 
          limit: 1 
        }
      );
      
      if (latestData && latestData.length > 0) {
        let metrics = latestData[0].metrics;
        if (typeof metrics === 'string') {
          try {
            metrics = JSON.parse(metrics);
          } catch (e) {
            logger.error('Failed to parse metrics JSON:', e);
          }
        }
        
        res.json({
          success: false,
          source: 'cache',
          status: 'offline',
          error: metricsResult.error,
          lastUpdate: latestData[0].lastUpdate || latestData[0].createdAt,
          metrics: metrics
        });
      } else {
        res.json({
          success: false,
          source: 'error',
          status: 'offline',
          error: metricsResult.error,
          message: 'SNMP connection failed and no cached data available'
        });
      }
    }
    
    // NO AUDIT LOG FOR LIVE MONITORING!
    
  } catch (error) {
    logger.error(`Error fetching live monitoring for host ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Live monitoring failed', 
      message: error.message 
    });
  }
});

