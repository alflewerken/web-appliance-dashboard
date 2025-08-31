// Server-Sent Events for real-time updates
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Store active SSE connections
const clients = new Set();

// SSE endpoint
router.get('/stream', (req, res) => {

  // Check authentication via query parameter
  const token = req.query.token;
  
  if (!token) {

    // Return JSON error for missing token
    res.status(401).json({ error: "No token provided" });
    return;
  }
  
  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Set user with id property for compatibility
    req.user = {
      id: decoded.userId,
      userId: decoded.userId,
      ...decoded
    };
  } catch (error) {
    // Return JSON error for invalid token
    res.status(403).json({ error: "Invalid token" });
    return;
  }
  
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Send initial connection message
  res.write(`event: connected\n`);
  res.write(`data: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);

  // Add client to active connections
  clients.add(res);

  // Handle client disconnect
  req.on('close', () => {
    clients.delete(res);

  });

  // Keep connection alive with periodic heartbeat
  const heartbeat = setInterval(() => {
    try {
      res.write(`event: heartbeat\n`);
      res.write(`data: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
    } catch (error) {
      // Connection closed, clean up
      clearInterval(heartbeat);
      clients.delete(res);
    }
  }, 30000); // Every 30 seconds

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

// Broadcast function to send updates to all connected clients
const broadcast = (eventType, data) => {
  const message = JSON.stringify(data);

  let sentCount = 0;
  clients.forEach(client => {
    try {
      // Send as named event, not as generic message
      client.write(`event: ${eventType}\n`);
      client.write(`data: ${message}\n\n`);
      sentCount++;
    } catch (error) {
      console.error('Error sending to client:', error);
      clients.delete(client);
    }
  });

};

// Debug endpoint to test token validation
router.get('/test-token', (req, res) => {

  const token = req.query.token;
  
  if (!token) {
    return res.status(401).json({ 
      error: "No token provided",
      debug: {
        url: req.originalUrl,
        query: req.query,
        hasQueryToken: !!req.query.token
      }
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({
      success: true,
      decoded,
      message: 'Token is valid'
    });
  } catch (error) {
    res.status(403).json({
      error: "Invalid token",
      message: error.message,
      name: error.name
    });
  }
});

// SSE Manager for sending events
const sseManager = {
  sendEvent: (eventType, data) => {
    broadcast(eventType, data);
  }
};

// Export router, broadcast function and sseManager
module.exports = { router, broadcast, sseManager };
