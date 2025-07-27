const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// Feste Konfiguration
const config = {
  apiHost: 'localhost',
  apiPort: '9080',
  apiProtocol: 'http'
};

function createWindow() {
  console.log('Creating main window with config:', config);
  
  // CORS komplett deaktivieren
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    // Entferne Origin header um CORS zu umgehen
    delete details.requestHeaders['Origin'];
    delete details.requestHeaders['Referer'];
    callback({ requestHeaders: details.requestHeaders });
  });

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,  // WICHTIG: Deaktiviert Web Security für lokale Entwicklung
      allowRunningInsecureContent: true,
      webviewTag: true
    },
    titleBarStyle: 'hiddenInset'
  });

  const frontendPath = path.join(__dirname, 'frontend-build', 'index.html');
  if (!fs.existsSync(frontendPath)) {
    console.error('Frontend nicht gefunden:', frontendPath);
    app.quit();
    return;
  }

  mainWindow.loadFile(frontendPath);

  // Warte etwas länger bevor wir die Konfiguration injizieren
  mainWindow.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      const apiUrl = `${config.apiProtocol}://${config.apiHost}:${config.apiPort}`;
      const wsUrl = `ws://${config.apiHost}:${config.apiPort}`;
      
      mainWindow.webContents.executeJavaScript(`
        // Debugging
        console.log('Injiziere API Konfiguration...');
        
        // Setze globale Variablen
        window.API_CONFIG = ${JSON.stringify(config)};
        window.API_BASE_URL = '${apiUrl}';
        
        // React Environment Variables
        window.process = window.process || {};
        window.process.env = window.process.env || {};
        window.process.env.REACT_APP_API_URL = '${apiUrl}';
        window.process.env.REACT_APP_WS_URL = '${wsUrl}';
        window.process.env.REACT_APP_TERMINAL_URL = '${apiUrl}/terminal';
        
        // Legacy Support
        window.REACT_APP_API_URL = '${apiUrl}';
        window.REACT_APP_WS_URL = '${wsUrl}';
        window.REACT_APP_TERMINAL_URL = '${apiUrl}/terminal';
        
        // Wenn axios existiert, setze baseURL
        if (window.axios) {
          window.axios.defaults.baseURL = '${apiUrl}';
          console.log('Axios baseURL gesetzt:', window.axios.defaults.baseURL);
        }
        
        // Überschreibe fetch um API URLs zu korrigieren
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
          // Korrigiere relative API URLs
          if (typeof url === 'string' && url.startsWith('/api')) {
            url = '${apiUrl}' + url;
            console.log('Fetch URL korrigiert zu:', url);
          }
          
          // Füge Credentials hinzu
          options.credentials = 'include';
          
          return originalFetch(url, options);
        };
        
        console.log('API Konfiguration vollständig:', {
          API_URL: window.process.env.REACT_APP_API_URL,
          Config: window.API_CONFIG,
          BaseURL: window.API_BASE_URL
        });
      `);
    }, 500); // Warte 500ms
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: app.getName(),
      submenu: [
        { label: 'Über ' + app.getName(), role: 'about' },
        { type: 'separator' },
        { label: 'Beenden', role: 'quit' }
      ]
    },
    {
      label: 'Ansicht',
      submenu: [
        { label: 'Neu laden', role: 'reload' },
        { label: 'Entwicklertools', role: 'toggledevtools' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Deaktiviere Certificate Errors für lokale Entwicklung
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('disable-web-security');

app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Behandle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});
