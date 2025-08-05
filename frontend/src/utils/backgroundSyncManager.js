// Centralized background settings sync manager
// Prevents feedback loops and ensures consistent updates across all clients

class BackgroundSyncManager {
  constructor() {
    this.isUpdating = false;
    this.lastUpdate = 0;
    this.updateThrottle = 100; // ms
    this.listeners = new Set();
    this.lastKnownSettings = null;
  }

  // Register a listener for settings changes
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Notify all listeners of a settings change
  notifyListeners(settings, source) {
    if (this.isUpdating) return; // Prevent feedback loops

    // Check if settings actually changed
    if (JSON.stringify(settings) === JSON.stringify(this.lastKnownSettings)) {
      return;
    }

    this.lastKnownSettings = { ...settings };
    this.listeners.forEach(callback => {
      try {
        callback(settings, source);
      } catch (error) {
        console.error('Error in background sync listener:', error);
      }
    });
  }

  // Handle incoming SSE update
  handleSSEUpdate(key, value) {
    // Throttle updates
    const now = Date.now();
    if (now - this.lastUpdate < this.updateThrottle) {
      return;
    }
    this.lastUpdate = now;

    // Build settings object
    const settings = { ...this.lastKnownSettings };

    switch (key) {
      case 'background_opacity':
        settings.opacity = parseFloat(value);
        break;
      case 'background_blur':
        settings.blur = parseInt(value);
        break;
      case 'background_position':
        settings.position = value;
        break;
      case 'backgroundEnabled':
        settings.enabled = value === 'true';
        break;
      default:
        return; // Not a background setting
    }

    this.notifyListeners(settings, 'sse');
  }

  // Handle local update (from UI)
  handleLocalUpdate(settings) {
    this.isUpdating = true;
    this.lastKnownSettings = { ...settings };

    // Notify listeners except the source
    this.notifyListeners(settings, 'local');

    // Reset flag after a delay
    setTimeout(() => {
      this.isUpdating = false;
    }, 200);
  }

  // Set initial settings
  setInitialSettings(settings) {
    this.lastKnownSettings = { ...settings };
  }
}

// Create singleton instance
export const backgroundSyncManager = new BackgroundSyncManager();
