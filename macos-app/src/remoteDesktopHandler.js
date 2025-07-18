const { BrowserWindow, shell } = require('electron');
const path = require('path');

class RemoteDesktopHandler {
  constructor() {
    this.remoteWindows = new Map();
  }

  /**
   * Öffnet ein Remote Desktop Fenster für eine Appliance
   * @param {Object} config - Konfiguration für die Remote Desktop Verbindung
   */
  openRemoteDesktop(config) {
    const { applianceId, applianceName, protocol, guacamoleUrl, token } = config;
    
    // Check ob bereits ein Fenster für diese Appliance existiert
    if (this.remoteWindows.has(applianceId)) {
      const existingWindow = this.remoteWindows.get(applianceId);
      if (existingWindow && !existingWindow.isDestroyed()) {
        existingWindow.focus();
        return;
      }
    }

    // Erstelle neues Fenster für Remote Desktop
    const remoteWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      title: `Remote Desktop - ${applianceName} (${protocol.toUpperCase()})`,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      },
      icon: this.getIconPath()
    });

    // Baue die Guacamole URL
    const guacUrl = this.buildGuacamoleUrl(guacamoleUrl, applianceId, token);
    
    // Lade die Guacamole Verbindung
    remoteWindow.loadURL(guacUrl);

    // Speichere Window Referenz
    this.remoteWindows.set(applianceId, remoteWindow);

    // Cleanup wenn Fenster geschlossen wird
    remoteWindow.on('closed', () => {
      this.remoteWindows.delete(applianceId);
    });

    // Optional: Öffne DevTools im Development Mode
    if (process.env.NODE_ENV === 'development') {
      remoteWindow.webContents.openDevTools({ mode: 'detach' });
    }

    // Handle externe Links
    remoteWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    return remoteWindow;
  }

  /**
   * Baut die Guacamole URL mit Token
   */
  buildGuacamoleUrl(baseUrl, connectionId, token) {
    // Wenn baseUrl auf Port 9070 zeigt, ändere es auf 9871 für die Mac App
    const macAppUrl = baseUrl.replace(':9070', ':9871');
    return `${macAppUrl}/#/client/${connectionId}?token=${encodeURIComponent(token)}`;
  }

  /**
   * Gibt den Pfad zum Icon zurück
   */
  getIconPath() {
    const iconName = process.platform === 'darwin' ? 'AppIcon.icns' : 'icon.png';
    return process.env.NODE_ENV === 'development'
      ? path.join(__dirname, '..', 'icons', iconName)
      : path.join(process.resourcesPath, '..', 'icons', iconName);
  }

  /**
   * Schließt ein spezifisches Remote Desktop Fenster
   */
  closeRemoteWindow(applianceId) {
    const window = this.remoteWindows.get(applianceId);
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }

  /**
   * Schließt alle Remote Desktop Fenster
   */
  closeAllWindows() {
    this.remoteWindows.forEach((window, id) => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    this.remoteWindows.clear();
  }

  /**
   * Gibt die Anzahl der offenen Remote Desktop Fenster zurück
   */
  getOpenWindowsCount() {
    let count = 0;
    this.remoteWindows.forEach((window) => {
      if (!window.isDestroyed()) {
        count++;
      }
    });
    return count;
  }
}

module.exports = new RemoteDesktopHandler();
