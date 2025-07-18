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
    // Return proper error response for missing token
    res.status(401).send('event: error\ndata: {"error": "No token provided"}\n\n');
    return;
  }
  
  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (error) {
    // Return proper error response for invalid token
    res.status(403).send('event: error\ndata: {"error": "Invalid token"}\n\n');
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
  console.log(`✅ SSE client connected. Total clients: ${clients.size}`);

  // Handle client disconnect
  req.on('close', () => {
    clients.delete(res);
    console.log(`❌ SSE client disconnected. Total clients: ${clients.size}`);
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

  console.log(`📡 Broadcasting ${eventType} to ${clients.size} clients:`, data);

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

  console.log(
    `✅ Successfully sent ${eventType} to ${sentCount}/${clients.size} clients`
  );
};

// Export router and broadcast function
module.exports = { router, broadcast };
