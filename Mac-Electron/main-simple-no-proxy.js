const { app, BrowserWindow, Menu, shell } = require('electron');
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
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      allowRunningInsecureContent: true
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

  mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    // Füge CORS-Header hinzu
    details.requestHeaders['Origin'] = 'http://localhost:9080';
    callback({ requestHeaders: details.requestHeaders });
  });

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    // Erlaube CORS
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, OPTIONS'],
        'Access-Control-Allow-Headers': ['Content-Type, Authorization']
      }
    });
  });

  mainWindow.webContents.on('did-finish-load', () => {
    const apiUrl = `${config.apiProtocol}://${config.apiHost}:${config.apiPort}`;
    const wsUrl = `ws://${config.apiHost}:${config.apiPort}`;
    
    mainWindow.webContents.executeJavaScript(`
      window.API_CONFIG = ${JSON.stringify(config)};
      window.process = window.process || {};
      window.process.env = window.process.env || {};
      window.process.env.REACT_APP_API_URL = '${apiUrl}';
      window.process.env.REACT_APP_WS_URL = '${wsUrl}';
      window.process.env.REACT_APP_TERMINAL_URL = '${apiUrl}/terminal';
      window.REACT_APP_API_URL = '${apiUrl}';
      window.REACT_APP_WS_URL = '${wsUrl}';
      window.REACT_APP_TERMINAL_URL = '${apiUrl}/terminal';
      
      console.log('API Konfiguration geladen:', {
        API_URL: window.process.env.REACT_APP_API_URL,
        WS_URL: window.process.env.REACT_APP_WS_URL,
        Config: window.API_CONFIG
      });
    `);
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
