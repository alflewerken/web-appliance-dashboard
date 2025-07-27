const { contextBridge, ipcRenderer } = require('electron');

// Expose API für Konfigurationsdialog
contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  testConnection: (config) => ipcRenderer.invoke('test-connection', config)
});
