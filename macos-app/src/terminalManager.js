// Terminal window creation with proper close handling
const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

class TerminalManager {
  constructor() {
    this.terminals = new Map();
    this.setupIPC();
  }

  setupIPC() {
    // Handler für Terminal öffnen
    ipcMain.handle('terminal:openNew', async (event, data) => {
      return this.createTerminal(data);
    });

    // Handler für Terminal schließen
    ipcMain.handle('terminal:closeWindow', async (event, id) => {
      return this.closeTerminal(id);
    });

    // Handler für alle Terminals schließen
    ipcMain.handle('terminal:closeAll', async () => {
      return this.closeAllTerminals();
    });
  }

  createTerminal(data = {}) {
    try {
      const terminal = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 600,
        minHeight: 400,
        frame: true,
        titleBarStyle: 'default',
        closable: true,
        minimizable: true,
        maximizable: true,
        fullscreenable: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: true,
          preload: path.join(__dirname, 'preload.js')
        },
        backgroundColor: '#000000',
        title: `Terminal${data.host ? ' - ' + data.host : ''}`,
        icon: process.platform === 'darwin' ? undefined : path.join(__dirname, '../icons/terminal.png')
      });

      const id = terminal.id;
      this.terminals.set(id, terminal);

      // URL mit Parametern erstellen
      const params = new URLSearchParams();
      if (data.host) params.append('host', data.host);
      if (data.user) params.append('user', data.user);
      if (data.port) params.append('port', data.port);
      if (data.hostId) params.append('hostId', data.hostId);

      const url = `http://localhost:9081/terminal/${params.toString() ? '?' + params.toString() : ''}`;
      terminal.loadURL(url);

      // Event Handler
      terminal.on('closed', () => {
        this.terminals.delete(id);
        console.log(`Terminal ${id} closed`);
      });

      // WICHTIG: Intercepte den Close-Button und nutze destroy() statt close()
      terminal.on('close', (event) => {
        console.log(`Terminal ${id} close button clicked - using destroy()`);
        event.preventDefault(); // Verhindere das normale Schließen
        terminal.destroy(); // Force close wie bei Cmd+Shift+W
      });

      // macOS spezifisch: Stelle sicher, dass das Fenster schließbar ist
      if (process.platform === 'darwin') {
        terminal.setClosable(true);
      }

      // Öffne DevTools nur im Development
      if (process.env.NODE_ENV === 'development') {
        terminal.webContents.openDevTools();
      }

      terminal.once('ready-to-show', () => {
        terminal.show();
      });

      console.log(`Terminal ${id} created successfully`);
      return { success: true, id };

    } catch (error) {
      console.error('Error creating terminal:', error);
      return { success: false, error: error.message };
    }
  }

  closeTerminal(id) {
    const terminal = this.terminals.get(id);
    if (terminal && !terminal.isDestroyed()) {
      terminal.destroy(); // Force close
      this.terminals.delete(id);
      return { success: true };
    }
    return { success: false, error: 'Terminal not found or already closed' };
  }

  closeAllTerminals() {
    let count = 0;
    this.terminals.forEach((terminal, id) => {
      if (!terminal.isDestroyed()) {
        terminal.destroy();
        count++;
      }
    });
    this.terminals.clear();
    return { success: true, count };
  }

  getTerminalCount() {
    return this.terminals.size;
  }
}

module.exports = TerminalManager;
