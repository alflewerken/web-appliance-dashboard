// SSE Debug utility to check if events are being received
export const sseDebugger = {
  logAllEvents: false,
  eventLog: [],

  enable() {
    this.logAllEvents = true;
    },

  disable() {
    this.logAllEvents = false;
    },

  logEvent(eventType, data) {
    if (this.logAllEvents) {
      const entry = {
        timestamp: new Date().toISOString(),
        type: eventType,
        data,
      };
      this.eventLog.push(entry);
      }
  },

  showLog() {
    console.table(this.eventLog);
  },

  clearLog() {
    this.eventLog = [];
    },
};

// Make it globally available for debugging
if (typeof window !== 'undefined') {
  window.sseDebugger = sseDebugger;
}
