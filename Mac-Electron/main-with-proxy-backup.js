const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

let mainWindow;
let proxyServer;

// Feste Konfiguration
const config = {
  apiHost: 'localhost',
  apiPort: '9080',
  apiProtocol: 'http'
};

// Starte lokalen Proxy-Server
function startProxyServer() {
  const proxyApp = express();
  const proxyPort = 9081;

  // Proxy alle API-Anfragen
  proxyApp.use('/api', createProxyMiddleware({
    target: `${config.apiProtocol}://${config.apiHost}:${config.apiPort}`,
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
      // Entferne problematische Header
      proxyReq.removeHeader('origin');
      proxyReq.removeHeader('referer');
    },
    onProxyRes: (proxyRes, req, res) => {
      // Füge CORS-Header hinzu
      proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    }
  }));

  // Starte Server
  proxyServer = proxyApp.listen(proxyPort, () => {
    console.log(`Proxy-Server läuft auf Port ${proxyPort}`);
  });

  return proxyPort;
}

function createWindow() {
  console.log('Creating main window with config:', config);
  
  // Starte Proxy
  const proxyPort = startProxyServer();
  
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

  mainWindow.webContents.on('did-finish-load', () => {
    // Verwende den lokalen Proxy statt direkte Verbindung
    const apiUrl = `http://localhost:${proxyPort}`;
    const wsUrl = `ws://localhost:${proxyPort}`;
    
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
      
      // Überschreibe axios baseURL falls vorhanden
      if (window.axios && window.axios.defaults) {
        window.axios.defaults.baseURL = '${apiUrl}';
      }
      
      console.log('API Konfiguration geladen (mit Proxy):', {
        API_URL: window.process.env.REACT_APP_API_URL,
        WS_URL: window.process.env.REACT_APP_WS_URL,
        Config: window.API_CONFIG
      });
    `);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (proxyServer) {
      proxyServer.close();
    }
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
  if (proxyServer) {
    proxyServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
