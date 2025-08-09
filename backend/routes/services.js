// Services compatibility routes - Using QueryBuilder
const express = require('express');
const router = express.Router();
const statusChecker = require('../utils/statusChecker');
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');
const { executeSSHCommand } = require('../utils/ssh');
const { createAuditLog } = require('../utils/auditLogger');

// Initialize QueryBuilder
const db = new QueryBuilder(pool);

// GET /api/services - Get all services with their current status
router.get('/', async (req, res) => {
  try {
    // Get all appliances with their service status
    const appliances = await db.select(
      'appliances',
      {},
      { orderBy: 'name' }
    );

    // Map to services format with proper field names
    const services = appliances.map(appliance => ({
      id: appliance.id,
      name: appliance.name,
      url: appliance.url,
      icon: appliance.icon,
      color: appliance.color,
      category: appliance.category,
      description: appliance.description,
      statusCommand: appliance.statusCommand,
      startCommand: appliance.startCommand,
      stopCommand: appliance.stopCommand,
      serviceStatus: appliance.serviceStatus || 'unknown',
      lastStatusCheck: appliance.lastStatusCheck,
      autoStart: appliance.autoStart,
      sshConnection: appliance.sshConnection
    }));

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
    
    const appliance = await db.findOne('appliances', { id });
    
    if (!appliance) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    res.json({
      success: true,
      status: appliance.serviceStatus || 'unknown',
      lastChecked: appliance.lastStatusCheck
    });
  } catch (error) {
    console.error('Error fetching service status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch service status',
      details: error.message 
    });
  }
});

// POST /api/services/:id/start - Start a service
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get appliance with SSH connection info
    const appliance = await db.findOneWithJoin({
      from: 'appliances',
      select: ['appliances.*', 'hosts.hostname', 'hosts.username', 'hosts.port', 'hosts.ssh_key_name'],
      joins: [{
        table: 'hosts',
        on: 'appliances.ssh_connection = CONCAT(hosts.username, "@", hosts.hostname, ":", hosts.port) OR appliances.ssh_connection = CONCAT(hosts.username, "@", hosts.hostname)',
        type: 'LEFT'
      }],
      where: { 'appliances.id': id }
    });
    
    if (!appliance) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    if (!appliance.startCommand) {
      return res.status(400).json({ error: 'No start command configured' });
    }
    
    console.log(`🚀 Starting service: ${appliance.name}`);
    
    let commandToExecute = appliance.startCommand;
    
    // If we have SSH connection info, build the proper SSH command
    if (appliance.sshConnection) {
      let username = 'root', host, port = 22, sshKeyName = 'dashboard';
      
      if (appliance.hosts_hostname) {
        // Use host info from JOIN
        host = appliance.hosts_hostname;
        username = appliance.hosts_username;
        port = appliance.hosts_port || 22;
        sshKeyName = appliance.hosts_sshKeyName || 'dashboard';
      } else {
        // Parse SSH connection string
        const sshParts = appliance.sshConnection.match(/^(?:([^@]+)@)?([^:]+)(?::(\d+))?$/);
        if (sshParts) {
          username = sshParts[1] || 'root';
          host = sshParts[2];
          port = parseInt(sshParts[3] || '22');
        }
      }
      
      if (host) {
        // Extract base command (remove any ssh prefix if present)
        let baseCommand = appliance.startCommand;
        const sshRegex = /^ssh\s+.*?\s+['"]?(.+?)['"]?$/;
        const match = baseCommand.match(sshRegex);
        if (match) {
          baseCommand = match[1];
        }
        
        // Build SSH command
        const keyPath = `-i ~/.ssh/id_rsa_${sshKeyName}`;
        commandToExecute = `ssh ${keyPath} -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${username}@${host} -p ${port} "${baseCommand}"`;
        
        console.log(`📡 Using SSH connection: ${username}@${host}:${port}`);
      }
    }
    
    // Execute the start command
    const result = await executeSSHCommand(commandToExecute);
    
    // Update service status
    await db.update('appliances', {
      serviceStatus: 'running',
      lastStatusCheck: new Date()
    }, { id });
    
    // Create audit log entry
    const userId = req.user ? req.user.id : null;
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    await createAuditLog(
      userId,
      'service_started',
      'appliances',
      appliance.id,
      {
        appliance_name: appliance.name,
        command: appliance.startCommand,
        ssh_connection: appliance.sshConnection,
        output: result.stdout ? result.stdout.substring(0, 500) : 'Command executed successfully'
      },
      ipAddress,
      appliance.name
    );
    
    console.log(`✅ Service "${appliance.name}" started and logged to audit`);
    
    // Trigger immediate status check after a short delay
    setTimeout(() => {
      statusChecker.forceCheck();
    }, 2000);
    
    res.json({
      success: true,
      message: 'Start command executed',
      output: result.stdout || result
    });
    
  } catch (error) {
    console.error('Error starting service:', error);
    
    // Log failed start attempt
    try {
      const userId = req.user ? req.user.id : null;
      const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      
      // Get service name for logging
      const appliance = await db.findOne('appliances', { id: req.params.id });
      
      await createAuditLog(
        userId,
        'service_start_failed',
        'appliances',
        req.params.id,
        {
          appliance_name: appliance ? appliance.name : 'Unknown',
          error: error.message,
          command: appliance ? appliance.startCommand : 'N/A'
        },
        ipAddress,
        appliance ? appliance.name : null
      );
    } catch (logError) {
      console.error('Failed to create audit log for failed start:', logError);
    }
    
    res.status(500).json({ 
      error: 'Failed to start service',
      details: error.message 
    });
  }
});

// POST /api/services/:id/stop - Stop a service
router.post('/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get appliance with SSH connection info
    const appliance = await db.findOneWithJoin({
      from: 'appliances',
      select: ['appliances.*', 'hosts.hostname', 'hosts.username', 'hosts.port', 'hosts.ssh_key_name'],
      joins: [{
        table: 'hosts',
        on: 'appliances.ssh_connection = CONCAT(hosts.username, "@", hosts.hostname, ":", hosts.port) OR appliances.ssh_connection = CONCAT(hosts.username, "@", hosts.hostname)',
        type: 'LEFT'
      }],
      where: { 'appliances.id': id }
    });
    
    if (!appliance) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    if (!appliance.stopCommand) {
      return res.status(400).json({ error: 'No stop command configured' });
    }
    
    console.log(`🛑 Stopping service: ${appliance.name}`);
    
    let commandToExecute = appliance.stopCommand;
    
    // If we have SSH connection info, build the proper SSH command
    if (appliance.sshConnection) {
      let username = 'root', host, port = 22, sshKeyName = 'dashboard';
      
      if (appliance.hosts_hostname) {
        // Use host info from JOIN
        host = appliance.hosts_hostname;
        username = appliance.hosts_username;
        port = appliance.hosts_port || 22;
        sshKeyName = appliance.hosts_sshKeyName || 'dashboard';
      } else {
        // Parse SSH connection string
        const sshParts = appliance.sshConnection.match(/^(?:([^@]+)@)?([^:]+)(?::(\d+))?$/);
        if (sshParts) {
          username = sshParts[1] || 'root';
          host = sshParts[2];
          port = parseInt(sshParts[3] || '22');
        }
      }
      
      if (host) {
        // Extract base command (remove any ssh prefix if present)
        let baseCommand = appliance.stopCommand;
        const sshRegex = /^ssh\s+.*?\s+['"]?(.+?)['"]?$/;
        const match = baseCommand.match(sshRegex);
        if (match) {
          baseCommand = match[1];
        }
        
        // Build SSH command
        const keyPath = `-i ~/.ssh/id_rsa_${sshKeyName}`;
        commandToExecute = `ssh ${keyPath} -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${username}@${host} -p ${port} "${baseCommand}"`;
        
        console.log(`📡 Using SSH connection: ${username}@${host}:${port}`);
      }
    }
    
    // Execute the stop command
    const result = await executeSSHCommand(commandToExecute);
    
    // Update service status
    await db.update('appliances', {
      serviceStatus: 'stopped',
      lastStatusCheck: new Date()
    }, { id });
    
    // Create audit log entry
    const userId = req.user ? req.user.id : null;
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    await createAuditLog(
      userId,
      'service_stopped',
      'appliances',
      appliance.id,
      {
        appliance_name: appliance.name,
        command: appliance.stopCommand,
        ssh_connection: appliance.sshConnection,
        output: result.stdout ? result.stdout.substring(0, 500) : 'Command executed successfully'
      },
      ipAddress,
      appliance.name
    );
    
    console.log(`✅ Service "${appliance.name}" stopped and logged to audit`);
    
    // Trigger immediate status check after a short delay
    setTimeout(() => {
      statusChecker.forceCheck();
    }, 2000);
    
    res.json({
      success: true,
      message: 'Stop command executed',
      output: result.stdout || result
    });
    
  } catch (error) {
    console.error('Error stopping service:', error);
    
    // Log failed stop attempt
    try {
      const userId = req.user ? req.user.id : null;
      const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      
      // Get service name for logging
      const appliance = await db.findOne('appliances', { id: req.params.id });
      
      await createAuditLog(
        userId,
        'service_stop_failed',
        'appliances',
        req.params.id,
        {
          appliance_name: appliance ? appliance.name : 'Unknown',
          error: error.message,
          command: appliance ? appliance.stopCommand : 'N/A'
        },
        ipAddress,
        appliance ? appliance.name : null
      );
    } catch (logError) {
      console.error('Failed to create audit log for failed stop:', logError);
    }
    
    res.status(500).json({ 
      error: 'Failed to stop service',
      details: error.message 
    });
  }
});

module.exports = router;
