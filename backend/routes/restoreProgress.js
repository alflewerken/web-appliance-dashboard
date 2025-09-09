const express = require('express');
const router = express.Router();

// Store für aktive Restore-Sessions
const restoreSessions = new Map();

// SSE endpoint für Restore-Progress
router.get('/restore-progress/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  
  // Send initial connection
  res.write('event: connected\n');
  res.write(`data: ${JSON.stringify({ connected: true, sessionId })}\n\n`);
  
  // Store connection
  if (!restoreSessions.has(sessionId)) {
    restoreSessions.set(sessionId, {
      connections: new Set(),
      progress: 0,
      currentStep: null,
      isComplete: false,
      logs: []
    });
  }
  
  const session = restoreSessions.get(sessionId);
  session.connections.add(res);
  
  // Send current state immediately
  if (session.currentStep) {
    res.write('event: progress\n');
    res.write(`data: ${JSON.stringify({
      progress: session.progress,
      currentStep: session.currentStep,
      isComplete: session.isComplete,
      logs: session.logs
    })}\n\n`);
  }
  
  // Handle disconnect
  req.on('close', () => {
    if (restoreSessions.has(sessionId)) {
      const session = restoreSessions.get(sessionId);
      session.connections.delete(res);
      
      // Clean up if no more connections and restore is complete
      if (session.connections.size === 0 && session.isComplete) {
        setTimeout(() => {
          restoreSessions.delete(sessionId);
        }, 60000); // Clean up after 1 minute
      }
    }
  });
});

// Helper function to send progress updates
function sendRestoreProgress(sessionId, data) {
  const session = restoreSessions.get(sessionId);
  if (!session) return;
  
  // Update session state
  if (data.progress !== undefined) session.progress = data.progress;
  if (data.currentStep !== undefined) session.currentStep = data.currentStep;
  if (data.isComplete !== undefined) session.isComplete = data.isComplete;
  if (data.log) session.logs.push(data.log);
  
  // Send to all connected clients
  const message = JSON.stringify(data);
  session.connections.forEach(res => {
    try {
      res.write('event: progress\n');
      res.write(`data: ${message}\n\n`);
    } catch (error) {
      console.error('Error sending restore progress:', error);
      session.connections.delete(res);
    }
  });
}

// Export for use in backup.js
module.exports = {
  router,
  sendRestoreProgress,
  restoreSessions
};
