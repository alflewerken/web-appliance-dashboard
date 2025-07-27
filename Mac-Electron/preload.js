const { contextBridge, ipcRenderer } = require('electron');

// Hole die Backend-Konfiguration synchron
let backendConfig = null;
ipcRenderer.send('get-backend-config-sync');
ipcRenderer.on('backend-config-data', (event, config) => {
  backendConfig = config;
});

// Expose geschützte Methoden, die das Frontend benötigt
contextBridge.exposeInMainWorld('electronAPI', {
  // Version und Platform Info
  getVersion: () => process.versions.electron,
  getPlatform: () => process.platform,
  
  // Backend Konfiguration
  getBackendConfig: () => backendConfig,
  
  // API Konfiguration
  getApiConfig: () => ipcRenderer.invoke('get-api-config'),
  
  // Für zukünftige Erweiterungen
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates')
});

// API-Konfiguration beim Start injizieren
window.addEventListener('DOMContentLoaded', async () => {
  // Warte kurz, damit das Frontend initialisiert ist
  setTimeout(() => {
    // Prüfe ob window.API_CONFIG bereits vom main process gesetzt wurde
    if (window.API_CONFIG) {
      console.log('API Konfiguration verfügbar:', window.API_CONFIG);
      
      // Setze die API URL für Axios oder andere HTTP-Clients
      if (window.localStorage) {
        window.localStorage.setItem('API_URL', 
          `${window.API_CONFIG.apiProtocol}://${window.API_CONFIG.apiHost}:${window.API_CONFIG.apiPort}`
        );
      }
    }
  }, 100);
});
