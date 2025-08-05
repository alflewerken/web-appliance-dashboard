const express = require('express');
const router = express.Router();
const SunshineController = require('../modules/streaming/sunshine-controller');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Sunshine controller instance per host
const sunshineInstances = new Map();

// Install Sunshine on a host
router.post('/install/:applianceId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { applianceId } = req.params;
    const { platform } = req.body;
    
    const controller = new SunshineController();
    const result = await controller.installSunshine(platform);
    
    res.json({ 
      success: true, 
      message: 'Sunshine installed successfully',
      output: result 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to install Sunshine', 
      details: error.message 
    });
  }
});

// Start streaming session
router.post('/start/:applianceId', authenticateToken, async (req, res) => {
  try {
    const { applianceId } = req.params;
    const { config } = req.body;
    
    // Get or create controller for this appliance
    let controller = sunshineInstances.get(applianceId);
    if (!controller) {
      controller = new SunshineController();
      sunshineInstances.set(applianceId, controller);
    }
    
    const pid = await controller.startSunshine(config);
    
    res.json({ 
      success: true, 
      pid,
      streamUrl: `rtsp://localhost:${controller.config.port}`,
      webUI: `https://localhost:${controller.config.webPort}`
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to start streaming', 
      details: error.message 
    });
  }
});

// Stop streaming session
router.post('/stop/:applianceId', authenticateToken, async (req, res) => {
  try {
    const { applianceId } = req.params;
    const controller = sunshineInstances.get(applianceId);
    
    if (!controller) {
      return res.status(404).json({ error: 'No active streaming session' });
    }
    
    const stopped = await controller.stopSunshine();
    if (stopped) {
      sunshineInstances.delete(applianceId);
    }
    
    res.json({ success: stopped });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to stop streaming', 
      details: error.message 
    });
  }
});

// Get streaming status
router.get('/status/:applianceId', authenticateToken, async (req, res) => {
  try {
    const { applianceId } = req.params;
    const controller = sunshineInstances.get(applianceId);
    
    if (!controller) {
      return res.json({ running: false });
    }
    
    const status = await controller.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get status', 
      details: error.message 
    });
  }
});

// Pair Moonlight client
router.post('/pair/:applianceId', authenticateToken, async (req, res) => {
  try {
    const { applianceId } = req.params;
    const { pin } = req.body;
    const controller = sunshineInstances.get(applianceId);
    
    if (!controller) {
      return res.status(404).json({ error: 'No active streaming session' });
    }
    
    const result = await controller.pairClient(pin);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to pair client', 
      details: error.message 
    });
  }
});

// WebSocket endpoint for streaming data
router.ws('/stream/:applianceId', (ws, req) => {
  const { applianceId } = req.params;
  const controller = sunshineInstances.get(applianceId);
  
  if (!controller) {
    ws.send(JSON.stringify({ error: 'No active streaming session' }));
    ws.close();
    return;
  }
  
  // Forward Sunshine logs to WebSocket
  controller.on('log', (data) => {
    ws.send(JSON.stringify({ type: 'log', data }));
  });
  
  controller.on('error', (data) => {
    ws.send(JSON.stringify({ type: 'error', data }));
  });
  
  ws.on('close', () => {
    controller.removeAllListeners();
  });
});

module.exports = router;
