// Server-Sent Events Service for real-time updates


class SSEService {
  constructor() {
    this.eventSource = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = Infinity; // Unbegrenzte Reconnect-Versuche
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000; // Maximaler Delay von 30 Sekunden
    this.listeners = new Map();
    this.isConnected = false;
    this.connectionPromise = null;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.lastHeartbeat = Date.now();
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
          // console.log('[SSE] Connection established');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.notifyListeners('connection', { status: 'connected' });
          
          // Start heartbeat monitoring
          this.startHeartbeatMonitor();
          
          resolve();
        };

        this.eventSource.onerror = error => {
          // console.error('[SSE] Connection error:', error);
          this.isConnected = false;
          this.notifyListeners('connection', { status: 'disconnected' });
          
          // Stop heartbeat monitoring
          this.stopHeartbeatMonitor();
          
          // Always try to reconnect with exponential backoff
          this.scheduleReconnect();
        };

        // Add heartbeat event handler
        this.eventSource.addEventListener('heartbeat', event => {
          this.lastHeartbeat = Date.now();
          // console.log('[SSE] Heartbeat received');
        });

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
          'host_ping_status', // New event for host ping status
          'user_created',
          'user_updated',
          'user_deleted',
          'user_activated',
          'user_deactivated',
          'user_status_changed',
          'user_restore',
          'user_restored',
          'user_reverted',
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
              // Removed host event logging

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
    // console.log('[SSE] Disconnecting...');
    this.stopHeartbeatMonitor();
    this.cancelReconnect();
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      this.connectionPromise = null;
      this.notifyListeners('connection', { status: 'disconnected' });
    }
  }
  
  scheduleReconnect() {
    // Cancel any existing reconnect timer
    this.cancelReconnect();
    
    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    
    // console.log(`[SSE] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      // console.log(`[SSE] Reconnecting... (attempt ${this.reconnectAttempts})`);
      this.connect().catch(error => {
        // console.error('[SSE] Reconnect failed:', error);
      });
    }, delay);
  }
  
  cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  
  startHeartbeatMonitor() {
    this.stopHeartbeatMonitor();
    this.lastHeartbeat = Date.now();
    
    // Check for heartbeat every 30 seconds
    this.heartbeatTimer = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;
      
      // If no heartbeat for 60 seconds, assume connection is dead
      if (timeSinceLastHeartbeat > 60000) {
        // console.warn('[SSE] No heartbeat for 60 seconds, reconnecting...');
        this.disconnect();
        this.scheduleReconnect();
      }
    }, 30000);
  }
  
  stopHeartbeatMonitor() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
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
