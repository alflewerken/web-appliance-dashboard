// SSE Manager - Central module for server-sent events
const { broadcast } = require('../routes/sse');

const sseManager = {
  broadcast: data => {
    console.log('📡 SSE Manager: Broadcasting event:', data.type);
    console.log('📡 SSE Manager: Event data:', JSON.stringify(data, null, 2));
    // Fix: Pass type and data as separate parameters
    broadcast(data.type, data.data || data);
  },

  // Convenience methods for common event types
  sendAuditEvent: (action, details) => {
    const eventType = 'audit_log_created';
    const eventData = {
      action,
      details,
      timestamp: new Date().toISOString(),
    };
    console.log('📡 SSE Manager: Sending audit event:', eventType, eventData);
    broadcast(eventType, eventData);
  },

  sendSSHHostEvent: (eventType, data) => {
    const eventData = {
      ...data,
      timestamp: new Date().toISOString(),
    };
    console.log(
      '📡 SSE Manager: Sending SSH host event:',
      eventType,
      eventData
    );
    broadcast(eventType, eventData);
  },
};

module.exports = sseManager;
