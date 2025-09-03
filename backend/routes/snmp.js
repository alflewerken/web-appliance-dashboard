const express = require('express');
const router = express.Router();
const SNMPMonitor = require('../services/SNMPMonitor');
const { verifyToken } = require('../utils/auth');

// SNMP Monitor Instanz
let snmpMonitor;
let db;

// Initialize SNMP Monitor with database
const initSNMPMonitor = (queryBuilder) => {
  db = queryBuilder;
  snmpMonitor = new SNMPMonitor(db);
  return router;
};

// Middleware für Authentication
router.use(verifyToken);

/**
 * GET /api/snmp/metrics
 * Aktuelle Metriken für alle SNMP-fähigen Hosts abrufen
 */
router.get('/metrics', async (req, res) => {
  try {
    const results = await snmpMonitor.pollAllHosts();
    res.json(results);
  } catch (error) {
    console.error('Error fetching SNMP metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch SNMP metrics',
      message: error.message 
    });
  }
});

/**
 * GET /api/snmp/metrics/:hostId
 * Metriken für einen spezifischen Host abrufen
 */
router.get('/metrics/:hostId', async (req, res) => {
  try {
    const { hostId } = req.params;
    
    // Host aus DB laden
    const host = await db.findOne('hosts', { id: hostId });
    
    if (!host) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    if (!host.snmpEnabled) {
      return res.status(400).json({ 
        error: 'SNMP not enabled for this host' 
      });
    }
    
    const result = await snmpMonitor.pollHost(host);
    res.json(result);
    
  } catch (error) {
    console.error(`Error fetching metrics for host ${req.params.hostId}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch host metrics',
      message: error.message 
    });
  }
});

/**
 * GET /api/snmp/history/:hostId
 * Historische Daten für einen Host
 */
router.get('/history/:hostId', async (req, res) => {
  try {
    const { hostId } = req.params;
    const { hours = 24 } = req.query;
    
    const history = await snmpMonitor.getHistoricalData(
      hostId, 
      parseInt(hours)
    );
    
    res.json({
      hostId,
      hours: parseInt(hours),
      dataPoints: history.length,
      data: history
    });
    
  } catch (error) {
    console.error(`Error fetching history for host ${req.params.hostId}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch historical data',
      message: error.message 
    });
  }
});

/**
 * POST /api/snmp/test
 * SNMP-Verbindung testen mit verbessertem Error Handling
 */
router.post('/test', async (req, res) => {
  try {
    const { ip, port = 161, community = 'public', version = 'v2c', osType = 'linux' } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP address required' });
    }
    
    // Temporären Host für Test erstellen
    const testHost = {
      id: 'test',
      name: 'Test Host',
      hostname: 'Test Host',
      ip,
      snmpPort: port,
      snmpCommunity: community,
      snmpVersion: version,
      snmpEnabled: true,
      osType: osType
    };
    
    const result = await snmpMonitor.pollHost(testHost);
    
    res.json({
      success: result.success,
      message: result.success ? 
        'SNMP connection successful' : 
        `SNMP connection failed: ${result.errorType || 'Unknown error'}`,
      data: result,
      recommendations: result.success ? null : getErrorRecommendations(result.errorType)
    });
    
  } catch (error) {
    console.error('Error testing SNMP connection:', error);
    res.status(500).json({ 
      error: 'Test failed',
      message: error.message 
    });
  }
});

// Helper function for error recommendations
function getErrorRecommendations(errorType) {
  const recommendations = {
    'TIMEOUT': [
      'Check if the host is reachable (ping)',
      'Verify SNMP port (default: 161)',
      'Check firewall rules',
      'Increase timeout value'
    ],
    'AUTH_FAILED': [
      'Verify SNMP community string',
      'Check SNMP version compatibility',
      'For SNMPv3, verify username and auth protocols'
    ],
    'NO_SUCH_OBJECT': [
      'Device may not support requested OIDs',
      'Try different OS type setting',
      'Check if SNMP agent is properly configured'
    ],
    'NETWORK_ERROR': [
      'Verify IP address is correct',
      'Check network connectivity',
      'Ensure device is powered on'
    ],
    'NO_RESPONSE': [
      'SNMP service may not be running',
      'Check if SNMP is enabled on the device',
      'Verify SNMP configuration on target device'
    ]
  };
  
  return recommendations[errorType] || ['Check device SNMP configuration'];
}

/**
 * PUT /api/snmp/hosts/:hostId/enable
 * SNMP für einen Host aktivieren
 */
router.put('/hosts/:hostId/enable', async (req, res) => {
  try {
    const { hostId } = req.params;
    const { community = 'public', port = 161 } = req.body;
    
    await db.update('hosts',
      { id: hostId },
      {
        snmpEnabled: 1,
        snmpCommunity: community,
        snmpPort: port,
        snmpStatus: 'pending'
      }
    );
    
    res.json({ 
      success: true,
      message: 'SNMP enabled for host' 
    });
    
  } catch (error) {
    console.error(`Error enabling SNMP for host ${req.params.hostId}:`, error);
    res.status(500).json({ 
      error: 'Failed to enable SNMP',
      message: error.message 
    });
  }
});

/**
 * PUT /api/snmp/hosts/:hostId/disable
 * SNMP für einen Host deaktivieren
 */
router.put('/hosts/:hostId/disable', async (req, res) => {
  try {
    const { hostId } = req.params;
    
    await db.update('hosts',
      { id: hostId },
      {
        snmpEnabled: 0,
        snmpStatus: 'disabled'
      }
    );
    
    res.json({ 
      success: true,
      message: 'SNMP disabled for host' 
    });
    
  } catch (error) {
    console.error(`Error disabling SNMP for host ${req.params.hostId}:`, error);
    res.status(500).json({ 
      error: 'Failed to disable SNMP',
      message: error.message 
    });
  }
});

/**
 * GET /api/snmp/metrics/:hostId/detailed
 * Detaillierte Metriken inklusive Disk und Network für einen Host
 */
router.get('/metrics/:hostId/detailed', async (req, res) => {
  try {
    const { hostId } = req.params;
    
    // Host aus DB laden
    const host = await db.findOne('hosts', { id: hostId });
    
    if (!host) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    if (!host.snmpEnabled) {
      return res.status(400).json({ 
        error: 'SNMP not enabled for this host' 
      });
    }
    
    // Detaillierte Metriken abrufen
    const result = await snmpMonitor.pollHost(host);
    
    // Zusätzlich historische Daten laden
    const history = await snmpMonitor.getHistoricalData(hostId, 1); // Letzte Stunde
    
    res.json({
      current: result,
      history: history,
      errorCount: snmpMonitor.errorCounts.get(`${host.ip}:${host.snmpPort || 161}`) || 0
    });
    
  } catch (error) {
    console.error(`Error fetching detailed metrics for host ${req.params.hostId}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch detailed metrics',
      message: error.message 
    });
  }
});

/**
 * GET /api/snmp/status
 * Status aller SNMP-überwachten Hosts
 */
router.get('/status', async (req, res) => {
  try {
    const hosts = await db.raw(`
      SELECT 
        h.id,
        h.hostname as name,
        h.ip,
        h.snmp_enabled as snmpEnabled,
        h.snmp_status as status,
        h.last_snmp_check as lastCheck,
        h.last_snmp_error as lastError,
        JSON_EXTRACT(h.last_metrics, '$.cpu.percent') as cpuPercent,
        JSON_EXTRACT(h.last_metrics, '$.memory.usedPercent') as memoryPercent,
        JSON_EXTRACT(h.last_metrics, '$.uptime.formatted') as uptime
      FROM hosts h
      WHERE h.snmp_enabled = 1
      ORDER BY h.hostname
    `);
    
    res.json({
      total: hosts.length,
      online: hosts.filter(h => h.status === 'online').length,
      offline: hosts.filter(h => h.status === 'offline').length,
      hosts
    });
    
  } catch (error) {
    console.error('Error fetching SNMP status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch status',
      message: error.message 
    });
  }
});

// Cleanup on server shutdown
process.on('SIGINT', () => {
  if (snmpMonitor) {
    snmpMonitor.closeAllSessions();
  }
});

module.exports = initSNMPMonitor;