// Server-Sent Events Service for real-time updates


class SSEService {
  constructor() {
    this.eventSource = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.isConnected = false;
    this.connectionPromise = null;
  }

  connect() {
    if (
      this.eventSource &&
      this.eventSource.readyState !== EventSource.CLOSED
    ) {
      return Promise.resolve();
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        // Check if user is authenticated before connecting
        const token = localStorage.getItem('token');
        if (!token) {
          reject(new Error('Not authenticated'));
          return;
        }

        // Use the correct SSE endpoint through nginx proxy
        const SSE_URL = `/api/sse/stream?token=${encodeURIComponent(token)}`;
        this.eventSource = new EventSource(SSE_URL);

        this.eventSource.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.notifyListeners('connection', { status: 'connected' });
          resolve();
        };

        this.eventSource.onerror = error => {
          this.isConnected = false;
          this.notifyListeners('connection', { status: 'disconnected' });

          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
              this.reconnectAttempts++;
              this.connect();
            }, this.reconnectDelay * this.reconnectAttempts);
          }
        };

        // Remove generic message handler - we'll use specific event handlers only
        // This prevents double processing of events

        // Specific event handlers
        const events = [
          'connected',
          'heartbeat',
          'appliance_created',
          'appliance_updated',
          'appliance_patched',
          'appliance_deleted',
          'appliance_opened', // Added missing event
          'appliance_restored',
          'appliance_undeleted',
          'category_created',
          'category_updated',
          'category_deleted',
          'category_restored',
          'category_reverted',
          'categories_reordered',
          'setting_update', // Single setting update
          'settings_updated', // Legacy - kept for compatibility
          'settings_bulk_update', // Bulk settings update
          'background_changed',
          'background_uploaded',
          'background_activated',
          'background_deleted',
          'background_disabled',
          'service_status',
          'service_status_changed', // This is our important event
          'service_started',
          'service_stopped',
          'user_created',
          'user_updated',
          'user_deleted',
          'user_activated',
          'user_deactivated',
          'user_status_changed',
          'user_login',
          'user_logout',
          'login_failed',
          'failed_login',
          'backup_created',
          'backup_restored',
          'ssh_key_created',
          'ssh_key_deleted',
          'ssh_host_created',
          'ssh_host_updated',
          'ssh_host_deleted',
          'ssh_host_restored',
          'ssh_host_reverted',
          'host_created',
          'host_updated',
          'host_deleted',
          'host_restored',
          'host_reverted',
          'command_executed',
          'command_execute_failed',
          'ssh_connection_test',
          'terminal_connect',
          'terminal_disconnect',
          'password_change',
          'audit_logs_deleted',
          'audit_log_created',
          'restore_completed',
          'service_accessed',
        ];

        events.forEach(eventType => {
          this.eventSource.addEventListener(eventType, event => {
            try {
              const data = JSON.parse(event.data);
              // Log to debugger
              if (eventType.includes('host_')) {
                console.log(`🔔 SSE Event received: ${eventType}`, data);
              }

              this.notifyListeners(eventType, data);
            } catch (error) {
              console.error(`Failed to parse SSE event ${eventType}:`, error);
            }
          });
        });
      } catch (error) {
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      this.connectionPromise = null;
      this.notifyListeners('connection', { status: 'disconnected' });
    }
  }

  addEventListener(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType).add(callback);

    return () => {
      this.removeEventListener(eventType, callback);
    };
  }

  removeEventListener(eventType, callback) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).delete(callback);
    }
  }

  notifyListeners(eventType, data) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          // Silently ignore listener errors
        }
      });
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      readyState: this.eventSource ? this.eventSource.readyState : null,
    };
  }

  // Debug helper - removed logging
  debugListeners() {
    // Debug method kept but silent
  }
}

// Create singleton instance
const sseService = new SSEService();

// Make available for debugging
if (typeof window !== 'undefined') {
  window.sseService = sseService;
}

// Export as default
export default sseService;
