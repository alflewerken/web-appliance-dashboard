// SSE Manager Service for real-time metric updates
// Manages Server-Sent Events connections for live monitoring data

const EventEmitter = require('events');

class SSEManager extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map(); // Map of hostId -> Set of response objects
    this.setMaxListeners(100); // Allow many connections
  }

  // Add a new SSE connection for a host
  addConnection(hostId, response) {

    if (!this.connections.has(hostId)) {
      this.connections.set(hostId, new Set());
    }
    
    this.connections.get(hostId).add(response);

    // Set headers for SSE
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable nginx buffering
    });
    
    // Send initial connection message
    response.write('event: connected\n');
    response.write(`data: ${JSON.stringify({ connected: true, hostId })}\n\n`);
    
    // Handle client disconnect
    response.on('close', () => {
      this.removeConnection(hostId, response);
    });
  }

  // Remove a connection
  removeConnection(hostId, response) {
    const connections = this.connections.get(hostId);
    if (connections) {
      connections.delete(response);
      if (connections.size === 0) {
        this.connections.delete(hostId);
      }
    }
  }

  // Send metrics update to all connected clients for a host
  sendMetricsUpdate(hostId, metrics) {
    const connections = this.connections.get(hostId);

    if (!connections || connections.size === 0) {

      return;
    }
    
    const data = JSON.stringify({
      timestamp: new Date().toISOString(),
      hostId,
      metrics
    });
    
    // Send to all connected clients
    connections.forEach(response => {
      try {
        response.write('event: metrics\n');
        response.write(`data: ${data}\n\n`);

      } catch (error) {
        console.error('Error sending SSE update:', error);
        this.removeConnection(hostId, response);
      }
    });
  }

  // Send status update
  sendStatusUpdate(hostId, status) {
    const connections = this.connections.get(hostId);
    if (!connections || connections.size === 0) {
      return;
    }
    
    const data = JSON.stringify({
      timestamp: new Date().toISOString(),
      hostId,
      status
    });
    
    connections.forEach(response => {
      try {
        response.write('event: status\n');
        response.write(`data: ${data}\n\n`);
      } catch (error) {
        console.error('Error sending SSE status:', error);
        this.removeConnection(hostId, response);
      }
    });
  }

  // Keep connections alive with heartbeat
  startHeartbeat() {
    setInterval(() => {
      this.connections.forEach((responses, hostId) => {
        responses.forEach(response => {
          try {
            response.write(':heartbeat\n\n');
          } catch (error) {
            this.removeConnection(hostId, response);
          }
        });
      });
    }, 30000); // Every 30 seconds
  }

  // Get connection count for monitoring
  getConnectionCount() {
    let total = 0;
    this.connections.forEach(responses => {
      total += responses.size;
    });
    return total;
  }
}

// Export singleton instance
module.exports = new SSEManager();
