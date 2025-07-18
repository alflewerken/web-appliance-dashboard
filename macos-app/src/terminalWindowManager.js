// Terminal Window Manager for Electron
// This module manages terminal windows and ensures they can be closed

const { BrowserWindow } = require('electron');
const path = require('path');

class TerminalWindowManager {
  constructor() {
    this.windows = new Map();
  }

  createTerminalWindow(url) {
    const terminalWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        // Wichtig: Erlaube das Schließen von Fenstern
        allowRunningInsecureContent: false,
        webSecurity: true
      },
      // Normale Fenster-Controls
      frame: true,
      titleBarStyle: 'default',
      closable: true,
      minimizable: true,
      maximizable: true,
      backgroundColor: '#000000',
      title: 'Terminal',
      // Kein spezielles Menü
      autoHideMenuBar: true
    });

    // Track window
    const id = terminalWindow.id;
    this.windows.set(id, terminalWindow);

    // Load URL
    terminalWindow.loadURL(url);

    // Handle close
    terminalWindow.on('closed', () => {
      this.windows.delete(id);
    });

    // Enable DevTools for debugging
    terminalWindow.webContents.openDevTools();

    return terminalWindow;
  }

  closeWindow(id) {
    const window = this.windows.get(id);
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }

  closeAllWindows() {
    this.windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
  }

  getWindowCount() {
    return this.windows.size;
  }
}

module.exports = new TerminalWindowManager();
