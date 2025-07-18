const { contextBridge, ipcRenderer } = require('electron');

// Exponiere sichere APIs für das Frontend
contextBridge.exposeInMainWorld('electronAPI', {
  // Docker APIs
  docker: {
    getStatus: () => ipcRenderer.invoke('docker:getStatus'),
    start: () => ipcRenderer.invoke('docker:start'),
    stop: () => ipcRenderer.invoke('docker:stop'),
    restart: () => ipcRenderer.invoke('docker:restart'),
    getLogs: (service) => ipcRenderer.invoke('docker:getLogs', service)
  },
  
  // Remote Desktop APIs
  remoteDesktop: {
    open: (config) => ipcRenderer.invoke('remoteDesktop:open', config),
    close: (applianceId) => ipcRenderer.invoke('remoteDesktop:close', applianceId),
    closeAll: () => ipcRenderer.invoke('remoteDesktop:closeAll'),
    getOpenCount: () => ipcRenderer.invoke('remoteDesktop:getOpenCount')
  },
  
  // Terminal APIs
  terminal: {
    openNew: (config) => ipcRenderer.invoke('terminal:openNew', config),
    closeWindow: (id) => ipcRenderer.invoke('terminal:closeWindow', id),
    closeAll: () => ipcRenderer.invoke('terminal:closeAll')
  },
  
  // App APIs
  app: {
    openExternal: (url) => ipcRenderer.invoke('app:openExternal', url)
  },
  
  // Platform info
  platform: process.platform
});
