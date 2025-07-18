const { app, BrowserWindow, Menu, Tray, shell, dialog, ipcMain, protocol } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const Store = require('electron-store');

// Docker Manager muss relativ zum src Ordner importiert werden
const dockerManager = require('./docker-manager');

const store = new Store();
let mainWindow = null;
let dashboardWindow = null;
let managementWindow = null;
let tray = null;
let dockerProcess = null;
let isQuitting = false;

// Sichere Initialisierung inline
if (!global.initializationStarted) {
  global.initializationStarted = true;
  
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    if (dialog && dialog.showErrorBox) {
      try {
        dialog.showErrorBox('Unerwarteter Fehler', error.message);
      } catch (e) {
        console.error('Could not show error dialog:', e);
      }
    }
  });
}

// Prüfe ob Docker Desktop läuft
async function checkDockerRunning() {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      PATH: '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin',
      DOCKER_HOST: `unix://${process.env.HOME}/.docker/run/docker.sock`
    };
    
    exec('docker info', { env }, (error, stdout, stderr) => {
      if (error) {
        console.log('Docker check error:', error.message);
        exec('docker context use desktop-linux && docker info', { env, shell: true }, (error2) => {
          resolve(!error2);
        });
        return;
      }
      resolve(true);
    });
  });
}

// Hauptfenster erstellen (zeigt das Web Appliance Dashboard)
function createMainWindow() {
  // Verhindere mehrfache Fenster
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    return;
  }

  // Icon-Pfad abhängig von Dev/Prod
  const iconPath = process.env.NODE_ENV === 'development'
    ? path.join(__dirname, '..', 'icons', 'AppIcon.icns')
    : path.join(process.resourcesPath, '..', 'icons', 'AppIcon.icns');

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    icon: iconPath,
    title: 'Web Appliance Dashboard',
    show: false // Erst zeigen wenn geladen
  });

  // Lade das Frontend direkt
  mainWindow.loadURL('http://localhost:9081');
  
  // Zeige Fenster wenn Seite geladen ist
  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  // Fehlerbehandlung beim Laden
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorDescription);
    // Versuche es nach kurzer Wartezeit erneut
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL('http://localhost:9081');
      }
    }, 2000);
  });

  // Handle externe Links basierend auf den Einstellungen
  mainWindow.webContents.setWindowOpenHandler(({ url, features }) => {
    // Erlaube localhost URLs im gleichen Fenster
    if (url.includes('localhost:9081')) {
      return { action: 'allow' };
    }
    
    // Für externe URLs: Prüfe ob spezielle Features angefordert wurden
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Wenn features gesetzt sind (von der PWA-Logik), öffne in neuem Electron-Fenster
      if (features && (features.includes('toolbar=no') || features.includes('menubar=no'))) {
        // Erstelle ein neues Electron-Fenster für PWA-ähnliches Verhalten
        const pwaWindow = new BrowserWindow({
          width: 1200,
          height: 800,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true
          },
          titleBarStyle: 'hiddenInset', // Versteckte Titelleiste mit Traffic Lights
          frame: true,
          show: true,
          minWidth: 400,
          minHeight: 300,
          backgroundColor: '#ffffff',
          icon: iconPath, // Verwende das App-Icon
          trafficLightPosition: { x: 20, y: 20 } // Position der Window-Controls
        });
        
        // Setze den Titel (wird in der Mitte der Titelleiste angezeigt)
        pwaWindow.webContents.on('page-title-updated', (event, title) => {
          pwaWindow.setTitle(title);
        });
        
        // Injiziere CSS für draggable Bereich
        pwaWindow.webContents.on('did-finish-load', () => {
          pwaWindow.webContents.insertCSS(`
            /* Mache den oberen Bereich draggable */
            body::before {
              content: '';
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              height: 32px;
              -webkit-app-region: drag;
              z-index: 999999;
              pointer-events: none;
            }
            
            /* Ausnahme für die Traffic Lights */
            body::before {
              left: 80px; /* Platz für Traffic Lights lassen */
            }
            
            /* Optional: Füge etwas Padding oben hinzu */
            body {
              padding-top: 32px !important;
            }
          `);
        });
        
        pwaWindow.loadURL(url);
        
        // Handle navigation in the PWA window
        pwaWindow.webContents.setWindowOpenHandler(({ url: newUrl }) => {
          // Navigation innerhalb des PWA-Fensters erlauben
          if (newUrl.startsWith('http://') || newUrl.startsWith('https://')) {
            pwaWindow.loadURL(newUrl);
          }
          return { action: 'deny' };
        });
        
        return { action: 'deny' }; // Verhindere das Standard-Verhalten
      } else {
        // Standard: Öffne im externen Browser
        shell.openExternal(url);
      }
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Verhindere das Schließen und minimiere stattdessen
  mainWindow.on('close', (event) => {
    if (!isQuitting && process.platform === 'darwin') {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// Dashboard-Fenster erstellen (Native App Experience)
function createDashboardWindow() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show();
    dashboardWindow.focus();
    return;
  }

  const iconPath = process.env.NODE_ENV === 'development'
    ? path.join(__dirname, '..', 'icons', 'AppIcon.icns')
    : path.join(process.resourcesPath, 'icons', 'AppIcon.icns');

  dashboardWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 320,  // Kleine Mindestbreite für Widget-Modus
    minHeight: 240, // Kleine Mindesthöhe für Widget-Modus
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    icon: iconPath,
    title: 'Web Appliance Dashboard',
    show: false,
    titleBarStyle: 'default', // Zurück zur Standard-Titelleiste für bessere Verschiebbarkeit
    backgroundColor: '#f5f5f5',
    alwaysOnTop: false, // Kann bei Bedarf aktiviert werden für Widget-Modus
    resizable: true,
    fullscreenable: true
  });

  // Lade das Dashboard
  dashboardWindow.loadURL('http://localhost:9081');
  
  // Zeige Fenster wenn geladen
  dashboardWindow.once('ready-to-show', () => {
    dashboardWindow.show();
  });

  // Fehlerbehandlung
  dashboardWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load dashboard:', errorDescription);
    // Versuche es nach kurzer Wartezeit erneut
    setTimeout(() => {
      if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.loadURL('http://localhost:9081');
      }
    }, 2000);
  });

  // Handle externe Links basierend auf den Einstellungen
  dashboardWindow.webContents.setWindowOpenHandler(({ url, features }) => {
    // Erlaube localhost URLs im gleichen Fenster
    if (url.includes('localhost:9081')) {
      return { action: 'allow' };
    }
    
    // Für externe URLs: Prüfe ob spezielle Features angefordert wurden
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Wenn features gesetzt sind (von der PWA-Logik), öffne in neuem Electron-Fenster
      if (features && (features.includes('toolbar=no') || features.includes('menubar=no'))) {
        // Erstelle ein neues Electron-Fenster für PWA-ähnliches Verhalten
        const pwaWindow = new BrowserWindow({
          width: 1200,
          height: 800,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true
          },
          titleBarStyle: 'hiddenInset', // Versteckte Titelleiste mit Traffic Lights
          frame: true,
          show: true,
          minWidth: 400,
          minHeight: 300,
          backgroundColor: '#ffffff',
          icon: iconPath, // Verwende das App-Icon
          trafficLightPosition: { x: 20, y: 20 } // Position der Window-Controls
        });
        
        // Setze den Titel (wird in der Mitte der Titelleiste angezeigt)
        pwaWindow.webContents.on('page-title-updated', (event, title) => {
          pwaWindow.setTitle(title);
        });
        
        // Injiziere CSS für draggable Bereich
        pwaWindow.webContents.on('did-finish-load', () => {
          pwaWindow.webContents.insertCSS(`
            /* Mache den oberen Bereich draggable */
            body::before {
              content: '';
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              height: 32px;
              -webkit-app-region: drag;
              z-index: 999999;
              pointer-events: none;
            }
            
            /* Ausnahme für die Traffic Lights */
            body::before {
              left: 80px; /* Platz für Traffic Lights lassen */
            }
            
            /* Optional: Füge etwas Padding oben hinzu */
            body {
              padding-top: 32px !important;
            }
          `);
        });
        
        pwaWindow.loadURL(url);
        
        // Handle navigation in the PWA window
        pwaWindow.webContents.setWindowOpenHandler(({ url: newUrl }) => {
          // Navigation innerhalb des PWA-Fensters erlauben
          if (newUrl.startsWith('http://') || newUrl.startsWith('https://')) {
            pwaWindow.loadURL(newUrl);
          }
          return { action: 'deny' };
        });
        
        return { action: 'deny' }; // Verhindere das Standard-Verhalten
      } else {
        // Standard: Öffne im externen Browser
        shell.openExternal(url);
      }
    }
    return { action: 'deny' };
  });

  // Verhindere das Schließen und minimiere stattdessen (optional)
  dashboardWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      dashboardWindow.hide();
    }
  });

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });
}

// Management-Fenster erstellen (Docker-Kontrolle)
function createManagementWindow() {
  // Icon-Pfad abhängig von Dev/Prod
  const iconPath = process.env.NODE_ENV === 'development'
    ? path.join(__dirname, '..', 'icons', 'AppIcon.icns')
    : path.join(process.resourcesPath, '..', 'icons', 'AppIcon.icns');

  managementWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: iconPath,
    title: 'Docker Management - Web Appliance Dashboard',
    show: false
  });

  managementWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  
  managementWindow.once('ready-to-show', () => {
    managementWindow.show();
  });

  managementWindow.on('closed', () => {
    managementWindow = null;
  });
}

// Hilfe-Fenster erstellen
function createHelpWindow() {
  const iconPath = process.env.NODE_ENV === 'development'
    ? path.join(__dirname, '..', 'icons', 'AppIcon.icns')
    : path.join(process.resourcesPath, '..', 'icons', 'AppIcon.icns');

  const helpWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    },
    icon: iconPath,
    title: 'Benutzerdokumentation - Web Appliance Dashboard',
    show: false
  });

  // Bestimme Pfade
  const helpPath = path.join(__dirname, '..', 'docs', 'user-manual', 'index.html');
  
  console.log('Loading help from:', helpPath);
  console.log('File exists:', fs.existsSync(helpPath));
  
  if (!fs.existsSync(helpPath)) {
    helpWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Fehler</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            padding: 50px;
            text-align: center;
            background: #f5f5f5;
          }
          h1 { color: #e74c3c; }
          p { color: #555; margin: 20px 0; }
          code {
            background: #fff;
            padding: 10px;
            border-radius: 5px;
            display: block;
            margin: 10px auto;
            max-width: 600px;
            word-break: break-all;
            border: 1px solid #ddd;
          }
        </style>
      </head>
      <body>
        <h1>Dokumentation nicht gefunden</h1>
        <p>Die Hilfedokumentation konnte nicht geladen werden.</p>
        <p>Gesuchter Pfad:</p>
        <code>${helpPath}</code>
        <p>Bitte stellen Sie sicher, dass die Dokumentation korrekt installiert wurde.</p>
      </body>
      </html>
    `)}`);
  } else {
    helpWindow.loadFile(helpPath);
  }

  helpWindow.once('ready-to-show', () => {
    helpWindow.show();
  });

  // Handle externe Links
  helpWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

// System Tray erstellen
function createTray() {