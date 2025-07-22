// Service Control API routes
const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const { executeSSHCommand } = require('../utils/ssh');
const { broadcast } = require('./sse');
const { createAuditLog } = require('../utils/auth');

// Service Control: Start Service
router.post('/:id/start', async (req, res) => {
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);
  console.log(`[DEBUG] Start service endpoint called - Request ID: ${requestId}, Service ID: ${req.params.id} at ${new Date().toISOString()}`);
  
  // Simple debounce mechanism
  const debounceKey = `start_${req.params.id}`;
  const lastRequest = global.lastServiceRequests?.[debounceKey];
  const now = Date.now();
  
  if (lastRequest && (now - lastRequest) < 1000) {
    console.log(`[DEBUG] Ignoring duplicate start request within 1 second - Request ID: ${requestId}`);
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }
  
  if (!global.lastServiceRequests) global.lastServiceRequests = {};
  global.lastServiceRequests[debounceKey] = now;
  
  try {
    const { id } = req.params;

    // Get appliance details including start command
    const [rows] = await pool.execute(
      'SELECT id, name, start_command FROM appliances WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const appliance = rows[0];

    if (!appliance.start_command) {
      return res
        .status(400)
        .json({ error: 'No start command configured for this service' });
    }

    console.log(
      `🚀 Starting service "${appliance.name}" with command: ${appliance.start_command}`
    );

    try {
      // Execute the start command (supports SSH)
      const { stdout, stderr } = await executeSSHCommand(
        appliance.start_command,
        30000
      );

      // Update service status in database
      await pool.execute(
        'UPDATE appliances SET service_status = ?, last_status_check = NOW() WHERE id = ?',
        ['running', id]
      );

      // Broadcast SSE event
      broadcast('service_status_changed', {
        id: parseInt(id),
        name: appliance.name,
        status: 'running',
        previousStatus: 'stopped',
        timestamp: new Date().toISOString(),
      });

      console.log(`✅ Service "${appliance.name}" started successfully`);

      // Create audit log
      const ipAddress = req.clientIp;
      await createAuditLog(
        req.user?.id || null,
        'service_start',
        'appliance',
        parseInt(id),
        {
          name: appliance.name,
          command: appliance.start_command,
          stdout: stdout, // Vollständige Ausgabe speichern
          stderr: stderr, // Vollständige Fehlerausgabe speichern
          success: true,
        },
        ipAddress
      );

      // Broadcast service started event
      broadcast('service_started', {
        id: parseInt(id),
        name: appliance.name,
        startedBy: req.user?.username || 'unknown',
        timestamp: new Date().toISOString(),
      });

      res.json({
        message: `Service "${appliance.name}" started successfully`,
        command: appliance.start_command,
        output: stdout,
        error_output: stderr || null,
        status: 'running',
      });
    } catch (execError) {
      console.error(
        `❌ Failed to start service "${appliance.name}":`,
        execError.message
      );

      // Update service status to error
      await pool.execute(
        'UPDATE appliances SET service_status = ?, last_status_check = NOW() WHERE id = ?',
        ['error', id]
      );

      // Broadcast SSE event
      broadcast('service_status_changed', {
        id: parseInt(id),
        name: appliance.name,
        status: 'error',
        previousStatus: 'stopped',
        timestamp: new Date().toISOString(),
      });

      // Create audit log for failure
      const ipAddress = req.clientIp;
      await createAuditLog(
        req.user?.id || null,
        'service_start_failed',
        'appliance',
        parseInt(id),
        {
          name: appliance.name,
          command: appliance.start_command,
          error: execError.message,
          stdout: execError.stdout, // Vollständige Ausgabe
          stderr: execError.stderr, // Vollständige Fehlerausgabe
          success: false,
        },
        ipAddress
      );

      // Broadcast audit log update
      broadcast('audit_log_created', {
        action: 'service_start_failed',
        resource_type: 'appliance',
        resource_id: parseInt(id),
      });

      res.status(500).json({
        error: `Failed to start service "${appliance.name}"`,
        command: appliance.start_command,
        details: execError.message,
        output: execError.stdout || null,
        error_output: execError.stderr || null,
        status: 'error',
      });
    }
  } catch (error) {
    console.error('Error in start service endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Service Control: Stop Service
router.post('/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;

    // Get appliance details including stop command
    const [rows] = await pool.execute(
      'SELECT id, name, stop_command FROM appliances WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const appliance = rows[0];

    if (!appliance.stop_command) {
      return res
        .status(400)
        .json({ error: 'No stop command configured for this service' });
    }

    console.log(
      `🛑 Stopping service "${appliance.name}" with command: ${appliance.stop_command}`
    );

    try {
      // Execute the stop command (supports SSH)
      const { stdout, stderr } = await executeSSHCommand(
        appliance.stop_command,
        30000
      );

      // Update service status in database
      await pool.execute(
        'UPDATE appliances SET service_status = ?, last_status_check = NOW() WHERE id = ?',
        ['stopped', id]
      );

      // Broadcast SSE event
      broadcast('service_status_changed', {
        id: parseInt(id),
        name: appliance.name,
        status: 'stopped',
        previousStatus: 'running',
        timestamp: new Date().toISOString(),
      });

      console.log(`✅ Service "${appliance.name}" stopped successfully`);

      // Create audit log
      const ipAddress = req.clientIp;
      await createAuditLog(
        req.user?.id || null,
        'service_stop',
        'appliance',
        parseInt(id),
        {
          name: appliance.name,
          command: appliance.stop_command,
          stdout: stdout, // Vollständige Ausgabe
          stderr: stderr, // Vollständige Fehlerausgabe
          success: true,
        },
        ipAddress
      );

      // Broadcast service stopped event
      broadcast('service_stopped', {
        id: parseInt(id),
        name: appliance.name,
        stoppedBy: req.user?.username || 'unknown',
        timestamp: new Date().toISOString(),
      });

      res.json({
        message: `Service "${appliance.name}" stopped successfully`,
        command: appliance.stop_command,
        output: stdout,
        error_output: stderr || null,
        status: 'stopped',
      });
    } catch (execError) {
      console.error(
        `❌ Failed to stop service "${appliance.name}":`,
        execError.message
      );

      // Update service status to error
      await pool.execute(
        'UPDATE appliances SET service_status = ?, last_status_check = NOW() WHERE id = ?',
        ['error', id]
      );

      // Broadcast SSE event
      broadcast('service_status_changed', {
        id: parseInt(id),
        name: appliance.name,
        status: 'error',
        previousStatus: 'running',
        timestamp: new Date().toISOString(),
      });

      // Create audit log for failure
      const ipAddress = req.clientIp;
      await createAuditLog(
        req.user?.id || null,
        'service_stop_failed',
        'appliance',
        parseInt(id),
        {
          name: appliance.name,
          command: appliance.stop_command,
          error: execError.message,
          stdout: execError.stdout, // Vollständige Ausgabe
          stderr: execError.stderr, // Vollständige Fehlerausgabe
          success: false,
        },
        ipAddress
      );

      // Broadcast audit log update
      broadcast('audit_log_created', {
        action: 'service_stop_failed',
        resource_type: 'appliance',
        resource_id: parseInt(id),
      });

      res.status(500).json({
        error: `Failed to stop service "${appliance.name}"`,
        command: appliance.stop_command,
        details: execError.message,
        output: execError.stdout || null,
        error_output: execError.stderr || null,
        status: 'error',
      });
    }
  } catch (error) {
    console.error('Error in stop service endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Service Control: Check Service Status
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    // Get appliance details including status command
    const [rows] = await pool.execute(
      'SELECT id, name, status_command, service_status FROM appliances WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const appliance = rows[0];

    if (!appliance.status_command) {
      return res.json({
        message: 'No status command configured',
        status: appliance.service_status || 'unknown',
        last_check: null,
      });
    }

    console.log(
      `🔍 Checking status for service "${appliance.name}" with command: ${appliance.status_command}`
    );

    try {
      // Execute the status command (supports SSH)
      const { stdout, stderr } = await executeSSHCommand(
        appliance.status_command,
        15000
      );

      // Simple status determination based on exit code (successful = running)
      const status = 'running';

      // Update service status in database
      await pool.execute(
        'UPDATE appliances SET service_status = ?, last_status_check = NOW() WHERE id = ?',
        [status, id]
      );

      // Broadcast SSE event if status changed
      if (appliance.service_status !== status) {
        broadcast('service_status_changed', {
          id: parseInt(id),
          name: appliance.name,
          status,
          previousStatus: appliance.service_status,
          timestamp: new Date().toISOString(),
        });
      }

      res.json({
        message: `Status check completed for "${appliance.name}"`,
        command: appliance.status_command,
        output: stdout,
        error_output: stderr || null,
        status,
        last_check: new Date().toISOString(),
      });
    } catch (execError) {
      // Command failed, likely means service is stopped or error
      const status = 'stopped';

      await pool.execute(
        'UPDATE appliances SET service_status = ?, last_status_check = NOW() WHERE id = ?',
        [status, id]
      );

      // Broadcast SSE event if status changed
      if (appliance.service_status !== status) {
        broadcast('service_status_changed', {
          id: parseInt(id),
          name: appliance.name,
          status,
          previousStatus: appliance.service_status,
          timestamp: new Date().toISOString(),
        });
      }

      res.json({
        message: `Status check completed for "${appliance.name}"`,
        command: appliance.status_command,
        output: execError.stdout || null,
        error_output: execError.stderr || null,
        status,
        last_check: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error in status check endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Log service access
router.post('/:id/access', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    // Get appliance details
    const [rows] = await pool.execute(
      'SELECT id, name FROM appliances WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const appliance = rows[0];

    // Update last accessed time
    await pool.execute(
      'UPDATE appliances SET lastUsed = NOW() WHERE id = ?',
      [id]
    );

    // Create audit log entry
    await createAuditLog(
      userId,
      'service_accessed',
      'appliance',
      id,
      {
        service_name: appliance.name,
        access_time: new Date().toISOString()
      },
      ipAddress
    );

    // Broadcast SSE event for real-time updates
    broadcast('service_accessed', {
      id: parseInt(id),
      name: appliance.name,
      userId,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Access logged for service "${appliance.name}"`
    });

  } catch (error) {
    console.error('Error logging service access:', error);
    res.status(500).json({ error: 'Failed to log service access' });
  }
});

// Check all services status
router.post('/check-all', async (req, res) => {
  try {
    console.log('📊 Triggering status check for all services...');
    
    // Import status checker
    const statusChecker = require('../utils/statusChecker');
    
    // Trigger async status check (don't wait for completion)
    statusChecker.checkAllServices().catch(error => {
      console.error('Error in background status check:', error);
    });
    
    res.json({
      success: true,
      message: 'Status check initiated for all services'
    });
  } catch (error) {
    console.error('Error initiating status check:', error);
    res.status(500).json({ 
      error: 'Failed to initiate status check',
      details: error.message 
    });
  }
});

module.exports = router;
