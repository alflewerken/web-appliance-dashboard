/**
 * Remote Desktop Window Manager für PWA
 * Öffnet Guacamole in einem separaten Fenster
 */

class RemoteDesktopWindowManager {
  constructor() {
    this.windows = new Map();
  }

  /**
   * Öffnet ein neues Remote Desktop Fenster
   * @param {Object} config - Konfiguration für die Verbindung
   * @param {string} config.applianceId - ID der Appliance
   * @param {string} config.applianceName - Name für den Titel
   * @param {string} config.protocol - 'vnc' oder 'rdp'
   * @param {string} config.guacamoleUrl - Basis URL zu Guacamole
   * @param {string} config.token - Auth Token
   */
  async openRemoteDesktop(config) {
    const { applianceId, applianceName, protocol, guacamoleUrl, token } = config;
    
    // Check if window already exists
    if (this.windows.has(applianceId)) {
      const existingWindow = this.windows.get(applianceId);
      if (!existingWindow.closed) {
        existingWindow.focus();
        return existingWindow;
      }
    }

    // Window Features für optimale Darstellung
    const windowFeatures = {
      width: 1280,
      height: 800,
      x: 100,
      y: 100,
      type: 'window'
    };

    // Erstelle die Guacamole URL mit Authentication
    const guacUrl = this.buildGuacamoleUrl(guacamoleUrl, applianceId, token);

    try {
      // PWA Window API (Chrome 109+)
      if ('windowControlsOverlay' in navigator && window.launchQueue) {
        const remoteWindow = await window.open(
          guacUrl,
          `remote-desktop-${applianceId}`,
          `width=${windowFeatures.width},height=${windowFeatures.height},left=${windowFeatures.x},top=${windowFeatures.y}`
        );
        
        this.windows.set(applianceId, remoteWindow);
        this.setupWindowHandlers(remoteWindow, applianceId);
        
        return remoteWindow;
      } else {
        // Fallback für normale Browser
        return this.openStandardWindow(guacUrl, applianceId, windowFeatures);
      }
    } catch (error) {
      console.error('Fehler beim Öffnen des Remote Desktop Fensters:', error);
      // Fallback
      return this.openStandardWindow(guacUrl, applianceId, windowFeatures);
    }
  }

  /**
   * Baut die Guacamole URL mit Token
   */
  buildGuacamoleUrl(baseUrl, connectionId, token) {
    // Beispiel URL Format für Guacamole
    return `${baseUrl}/#/client/${connectionId}?token=${encodeURIComponent(token)}`;
  }

  /**
   * Standard window.open Fallback
   */
  openStandardWindow(url, id, features) {
    const featureString = `width=${features.width},height=${features.height},left=${features.x},top=${features.y},toolbar=no,menubar=no,location=no,status=no`;
    
    const newWindow = window.open(url, `remote-desktop-${id}`, featureString);
    this.windows.set(id, newWindow);
    this.setupWindowHandlers(newWindow, id);
    
    return newWindow;
  }

  /**
   * Setup Event Handlers für das Fenster
   */
  setupWindowHandlers(remoteWindow, applianceId) {
    if (!remoteWindow) return;

    // Cleanup wenn Fenster geschlossen wird
    const checkInterval = setInterval(() => {
      if (remoteWindow.closed) {
        clearInterval(checkInterval);
        this.windows.delete(applianceId);
        this.onWindowClosed(applianceId);
      }
    }, 1000);

    // Optional: PostMessage Communication
    window.addEventListener('message', (event) => {
      if (event.source === remoteWindow) {
        this.handleRemoteMessage(event.data, applianceId);
      }
    });
  }

  /**
   * Callback wenn Fenster geschlossen wird
   */
  onWindowClosed(applianceId) {
    console.log(`Remote Desktop Fenster für ${applianceId} wurde geschlossen`);
    // Hier können Cleanup-Aktionen durchgeführt werden
  }

  /**
   * Handle Messages vom Remote Window
   */
  handleRemoteMessage(data, applianceId) {
    console.log(`Message von Remote Desktop ${applianceId}:`, data);
    // Hier können Messages vom Guacamole iFrame verarbeitet werden
  }

  /**
   * Schließt ein spezifisches Fenster
   */
  closeWindow(applianceId) {
    const window = this.windows.get(applianceId);
    if (window && !window.closed) {
      window.close();
      this.windows.delete(applianceId);
    }
  }

  /**
   * Schließt alle offenen Fenster
   */
  closeAllWindows() {
    this.windows.forEach((window, id) => {
      if (!window.closed) {
        window.close();
      }
    });
    this.windows.clear();
  }
}

export default new RemoteDesktopWindowManager();