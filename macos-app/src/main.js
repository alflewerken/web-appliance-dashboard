const { app, BrowserWindow, Menu, Tray, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const Store = require('electron-store');

// Docker Manager muss relativ zum src Ordner importiert werden
const dockerManager = require('./docker-manager');
const remoteDesktopHandler = require('./remoteDesktopHandler');
const TerminalManager = require('./terminalManager');

// Terminal Manager Instanz
const terminalManager = new TerminalManager();

// Standalone Installer importieren (falls vorhanden)
let StandaloneInstaller;
try {
  StandaloneInstaller = require('./standalone/installer');
} catch (e) {
  // Standalone Mode nicht verfügbar
  console.log('Running in normal mode (no standalone installer found)');
}

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
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
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
        console.log('Opening PWA-style window for URL:', url);
        console.log('Features:', features);
        
        // Erstelle ein neues Electron-Fenster für PWA-ähnliches Verhalten
        let pwaWindow = new BrowserWindow({
          width: 1200,
          height: 800,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            preload: path.join(__dirname, 'preload.js')
          },
          titleBarStyle: 'default', // Changed from 'hiddenInset' to 'default'
          frame: true,
          show: true,
          closable: true, // Explicitly allow closing
          minimizable: true,
          maximizable: true,
          minWidth: 400,
          minHeight: 300,
          backgroundColor: '#ffffff',
          icon: iconPath, // Verwende das App-Icon
          autoHideMenuBar: true, // Verstecke die Menüleiste automatisch
          // Remove trafficLightPosition as it's not needed with default titlebar
        });
        
        // Setze den Titel (wird in der Mitte der Titelleiste angezeigt)
        pwaWindow.webContents.on('page-title-updated', (event, title) => {
          pwaWindow.setTitle(title);
        });
        
        // Injiziere CSS für besseres Styling (optional)
        pwaWindow.webContents.on('did-finish-load', () => {
          // Kein spezielles CSS mehr nötig, da wir die Standard-Titelleiste verwenden
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
        
        
        // Debug: Log window creation
        console.log('Creating PWA window for URL:', url);
        
        // Verwende das aktuelle Anwendungsmenü auch für PWA-Fenster
        pwaWindow.setMenu(Menu.getApplicationMenu());
        
        // Make sure window is focusable and closable
        pwaWindow.setClosable(true);
        
        // Enable window closing with Cmd+W
        pwaWindow.webContents.on('before-input-event', (event, input) => {
          if (input.type === 'keyDown') {
            console.log('Key pressed:', input.key, 'Meta:', input.meta, 'Control:', input.control);
            // Cmd+W zum Schließen
            if (input.key === 'w' && (input.meta || input.control)) {
              console.log('Closing window via Cmd+W');
              event.preventDefault();
              pwaWindow.close();
            }
            // ESC zum Schließen (optional)
            if (input.key === 'Escape') {
              console.log('Closing window via ESC');
              event.preventDefault();
              pwaWindow.close();
            }
          }
        });
        
        // Ensure window can be closed - don't add any close handler
        // The window should close normally without any preventDefault
        
        // ABER: Intercepte den Close-Button für Terminal-Fenster
        if (url.includes('/terminal') || url.includes('ttyd')) {
          pwaWindow.on('close', (event) => {
            console.log('Terminal PWA window close button clicked - using destroy()');
            event.preventDefault();
            pwaWindow.destroy(); // Force close wie bei Cmd+Shift+W
          });
        }
        
        // Clean up reference when window is closed
        pwaWindow.on('closed', () => {
          console.log('PWA Window closed');
          // pwaWindow ist lokal und muss nicht auf null gesetzt werden
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
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')  // Preload Script hinzufügen!
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
    
    // Öffne DevTools im Development-Modus oder mit Env-Variable
    if (process.env.NODE_ENV === 'development' || process.env.ENABLE_DEVTOOLS === 'true') {
      dashboardWindow.webContents.openDevTools();
    }
  });
  
  // Aktiviere DevTools mit Keyboard Shortcut
  dashboardWindow.webContents.on('before-input-event', (event, input) => {
    // Cmd+Option+I oder F12 für DevTools
    if ((input.meta && input.alt && input.key === 'i') || input.key === 'F12') {
      dashboardWindow.webContents.openDevTools();
    }
  });
  
  // Erlaube Paste in DevTools
  dashboardWindow.webContents.on('devtools-opened', () => {
    dashboardWindow.webContents.devToolsWebContents.executeJavaScript(`
      console.log('%cPaste ist jetzt erlaubt!', 'color: green; font-weight: bold');
    `);
  });

  // Handle Nachrichten vom Renderer-Prozess für Terminal-Öffnung
  dashboardWindow.webContents.on('console-message', (event, level, message) => {
    if (message.includes('[Electron]')) {
      console.log('Renderer:', message);
    }
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
  dashboardWindow.webContents.setWindowOpenHandler(({ url, frameName, features }) => {
    console.log('Window open handler - URL:', url, 'Frame:', frameName, 'Features:', features);
    
    // Erlaube localhost:9081 URLs im gleichen Fenster
    if (url.includes('localhost:9081')) {
      return { action: 'allow' };
    }
    
    // Für externe URLs: Prüfe ob spezielle Features angefordert wurden
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Wenn features gesetzt sind (von der PWA-Logik), öffne in neuem Electron-Fenster
      if (features && (features.includes('toolbar=no') || features.includes('menubar=no'))) {
        console.log('Opening PWA-style window for URL:', url);
        console.log('Features:', features);
        
        // Erstelle ein neues Electron-Fenster für PWA-ähnliches Verhalten
        let pwaWindow = new BrowserWindow({
          width: 1200,
          height: 800,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            preload: path.join(__dirname, 'preload.js')
          },
          titleBarStyle: 'default', // Changed from 'hiddenInset' to 'default'
          frame: true,
          show: true,
          closable: true, // Explicitly allow closing
          minimizable: true,
          maximizable: true,
          minWidth: 400,
          minHeight: 300,
          backgroundColor: '#ffffff',
          icon: iconPath, // Verwende das App-Icon
          autoHideMenuBar: true, // Verstecke die Menüleiste automatisch
          // Remove trafficLightPosition as it's not needed with default titlebar
        });
        
        // Setze den Titel (wird in der Mitte der Titelleiste angezeigt)
        pwaWindow.webContents.on('page-title-updated', (event, title) => {
          pwaWindow.setTitle(title);
        });
        
        // Injiziere CSS für besseres Styling (optional)
        pwaWindow.webContents.on('did-finish-load', () => {
          // Kein spezielles CSS mehr nötig, da wir die Standard-Titelleiste verwenden
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
        
        
        // Debug: Log window creation
        console.log('Creating PWA window for URL:', url);
        
        // Verwende das aktuelle Anwendungsmenü auch für PWA-Fenster
        pwaWindow.setMenu(Menu.getApplicationMenu());
        
        // Make sure window is focusable and closable
        pwaWindow.setClosable(true);
        
        // Enable window closing with Cmd+W
        pwaWindow.webContents.on('before-input-event', (event, input) => {
          if (input.type === 'keyDown') {
            console.log('Key pressed:', input.key, 'Meta:', input.meta, 'Control:', input.control);
            // Cmd+W zum Schließen
            if (input.key === 'w' && (input.meta || input.control)) {
              console.log('Closing window via Cmd+W');
              event.preventDefault();
              pwaWindow.close();
            }
            // ESC zum Schließen (optional)
            if (input.key === 'Escape') {
              console.log('Closing window via ESC');
              event.preventDefault();
              pwaWindow.close();
            }
          }
        });
        
        // Ensure window can be closed - don't add any close handler
        // The window should close normally without any preventDefault
        
        // ABER: Intercepte den Close-Button für Terminal-Fenster
        if (url.includes('/terminal') || url.includes('ttyd')) {
          pwaWindow.on('close', (event) => {
            console.log('Terminal PWA window close button clicked - using destroy()');
            event.preventDefault();
            pwaWindow.destroy(); // Force close wie bei Cmd+Shift+W
          });
        }
        
        // Clean up reference when window is closed
        pwaWindow.on('closed', () => {
          console.log('PWA Window closed');
          // pwaWindow ist lokal und muss nicht auf null gesetzt werden
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
      webSecurity: false // Erlaubt das Laden lokaler Dateien
    },
    icon: iconPath,
    title: 'Benutzerdokumentation - Web Appliance Dashboard',
    show: false
  });

  // Bestimme Basispfad für Dokumentation
  const docsPath = path.join(__dirname, '..', 'docs', 'user-manual');
  const helpPath = path.join(docsPath, 'index.html');
  
  console.log('Help documentation path:', helpPath);
  console.log('Documentation exists:', fs.existsSync(helpPath));
  
  if (!fs.existsSync(helpPath)) {
    // Fehler wenn Dokumentation nicht gefunden
    const errorHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Fehler - Dokumentation nicht gefunden</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f5f5f5;
            color: #333;
            padding: 50px;
            text-align: center;
          }
          .error-container {
            background: white;
            border-radius: 10px;
            padding: 40px;
            max-width: 600px;
            margin: 0 auto;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 { color: #e74c3c; margin-bottom: 20px; }
          p { color: #666; line-height: 1.6; }
          code {
            background: #f0f0f0;
            padding: 15px;
            border-radius: 5px;
            display: block;
            margin: 20px 0;
            font-size: 0.9em;
            word-break: break-all;
          }
          .button {
            background: #3498db;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 5px;
            font-size: 16px;
            cursor: pointer;
            margin-top: 20px;
          }
          .button:hover {
            background: #2980b9;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>📚 Dokumentation nicht gefunden</h1>
          <p>Die Benutzerdokumentation konnte leider nicht geladen werden.</p>
          <p>Bitte stellen Sie sicher, dass die Dokumentation korrekt installiert wurde.</p>
          <code>${helpPath}</code>
          <button class="button" onclick="window.close()">Schließen</button>
        </div>
      </body>
      </html>
    `;
    
    helpWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHTML)}`);
  } else {
    // Lade HTML-Datei mit file:// Protokoll für korrekte Pfadauflösung
    helpWindow.loadURL(`file://${helpPath}`);
  }

  helpWindow.once('ready-to-show', () => {
    helpWindow.show();
  });

  // Fehlerbehandlung
  helpWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load help documentation:', errorDescription);
  });

  // Handle navigation
  helpWindow.webContents.on('will-navigate', (event, url) => {
    // Erlaube Navigation zu Ankern innerhalb der Seite
    if (url.includes('#') && url.includes('index.html')) {
      return;
    }
    // Öffne externe URLs im Browser
    if (url.startsWith('http://') || url.startsWith('https://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Handle new window requests
  helpWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

// Entwickler-Dokumentation Fenster erstellen
function createDeveloperDocWindow() {
  const iconPath = process.env.NODE_ENV === 'development'
    ? path.join(__dirname, '..', 'icons', 'AppIcon.icns')
    : path.join(process.resourcesPath, '..', 'icons', 'AppIcon.icns');

  const devWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Erlaubt das Laden lokaler Dateien
    },
    icon: iconPath,
    title: 'Entwickler-Dokumentation - Web Appliance Dashboard',
    show: false
  });

  // Bestimme Pfad für Entwickler-Dokumentation
  const devDocPath = path.join(__dirname, '..', 'docs', 'developer.html');
  
  console.log('Developer documentation path:', devDocPath);
  console.log('Developer documentation exists:', fs.existsSync(devDocPath));
  
  if (!fs.existsSync(devDocPath)) {
    // Fehler wenn Dokumentation nicht gefunden
    const errorHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Fehler - Dokumentation nicht gefunden</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f5f5f5;
            color: #333;
            padding: 50px;
            text-align: center;
          }
          .error-container {
            background: white;
            border-radius: 10px;
            padding: 40px;
            max-width: 600px;
            margin: 0 auto;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 { color: #e74c3c; margin-bottom: 20px; }
          p { color: #666; line-height: 1.6; }
          code {
            background: #f0f0f0;
            padding: 15px;
            border-radius: 5px;
            display: block;
            margin: 20px 0;
            font-size: 0.9em;
            word-break: break-all;
          }
          .button {
            background: #3498db;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 5px;
            font-size: 16px;
            cursor: pointer;
            margin-top: 20px;
          }
          .button:hover {
            background: #2980b9;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>👨‍💻 Entwickler-Dokumentation nicht gefunden</h1>
          <p>Die Entwickler-Dokumentation konnte leider nicht geladen werden.</p>
          <p>Bitte stellen Sie sicher, dass die Dokumentation korrekt installiert wurde.</p>
          <code>${devDocPath}</code>
          <button class="button" onclick="window.close()">Schließen</button>
        </div>
      </body>
      </html>
    `;
    
    devWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHTML)}`);
  } else {
    // Lade HTML-Datei mit file:// Protokoll
    devWindow.loadURL(`file://${devDocPath}`);
  }

  devWindow.once('ready-to-show', () => {
    devWindow.show();
  });

  // Fehlerbehandlung
  devWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load developer documentation:', errorDescription);
  });

  // Handle navigation
  devWindow.webContents.on('will-navigate', (event, url) => {
    // Öffne externe URLs im Browser
    if (url.startsWith('http://') || url.startsWith('https://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Handle new window requests
  devWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

// System Tray erstellen
function createTray() {
  // Icon-Pfad abhängig von Dev/Prod
  const trayIconPath = process.env.NODE_ENV === 'development' 
    ? path.join(__dirname, '..', 'icons', 'tray-icon.png')
    : path.join(process.resourcesPath, '..', 'icons', 'tray-icon.png');
    
  try {
    tray = new Tray(trayIconPath);
    updateTrayMenu();
    
    tray.on('click', () => {
      // Öffne Dashboard-Fenster bei Klick auf Tray-Icon
      createDashboardWindow();
    });
  } catch (error) {
    console.error('Failed to create tray:', error);
    // Fallback: Versuche alternative Pfade
    const altPaths = [
      path.join(__dirname, '..', 'icons', 'tray-icon.png'),
      path.join(__dirname, '..', 'assets', 'tray-icon.png'),
      path.join(process.resourcesPath, 'icons', 'tray-icon.png')
    ];
    
    for (const altPath of altPaths) {
      try {
        tray = new Tray(altPath);
        updateTrayMenu();
        tray.on('click', () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
          } else {
            checkAndStartServices();
          }
        });
        break;
      } catch (e) {
        console.error('Failed with path:', altPath);
      }
    }
  }
}

// Tray-Menü aktualisieren
let currentTrayMenu = null;

function updateTrayMenu() {
  currentTrayMenu = Menu.buildFromTemplate([
    {
      label: 'Dashboard anzeigen',
      click: () => {
        createDashboardWindow();
      }
    },
    { type: 'separator' },
    {
      label: 'Ansicht',
      submenu: [
        {
          label: 'Normal',
          type: 'radio',
          checked: true,
          click: () => {
            if (dashboardWindow && !dashboardWindow.isDestroyed()) {
              dashboardWindow.setSize(1400, 900);
              dashboardWindow.center();
              dashboardWindow.setAlwaysOnTop(false);
            }
          }
        },
        {
          label: 'Kompakt',
          type: 'radio',
          click: () => {
            if (dashboardWindow && !dashboardWindow.isDestroyed()) {
              dashboardWindow.setSize(800, 600);
              dashboardWindow.center();
              dashboardWindow.setAlwaysOnTop(false);
            }
          }
        },
        {
          label: 'Mini Widget',
          type: 'radio',
          click: () => {
            if (dashboardWindow && !dashboardWindow.isDestroyed()) {
              dashboardWindow.setSize(400, 300);
              // Positioniere in oberer rechter Ecke
              const { screen } = require('electron');
              const primaryDisplay = screen.getPrimaryDisplay();
              const { width, height } = primaryDisplay.workAreaSize;
              dashboardWindow.setPosition(width - 420, 20);
              dashboardWindow.setAlwaysOnTop(true);
            }
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: 'Docker Status',
      enabled: false,
      id: 'status'
    },
    { type: 'separator' },
    {
      label: 'Container neustarten',
      click: async () => {
        await dockerManager.restartContainers();
      }
    },
    {
      label: 'Container stoppen',
      click: async () => {
        await dockerManager.stopContainers();
      }
    },
    { type: 'separator' },
    {
      label: 'Erweiterte Einstellungen...',
      click: () => {
        // Öffne Management-Fenster nur auf explizite Anfrage
        if (managementWindow && !managementWindow.isDestroyed()) {
          managementWindow.show();
          managementWindow.focus();
        } else {
          createManagementWindow();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Hilfe',
      submenu: [
        {
          label: 'Benutzerdokumentation',
          click: () => {
            createHelpWindow();
          }
        },
        {
          label: 'Entwickler-Dokumentation',
          click: () => {
            createDeveloperDocWindow();
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: 'Beenden',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(currentTrayMenu);
  tray.setToolTip('Web Appliance Dashboard');
}

// Docker-Status im Tray aktualisieren
async function updateTrayStatus() {
  const status = await dockerManager.getStatus();
  
  if (!currentTrayMenu) return;
  
  const statusItem = currentTrayMenu.items.find(item => item.id === 'status');
  if (statusItem) {
    if (status.dockerInstalled === false) {
      statusItem.label = 'Docker Status: Nicht installiert';
    } else if (status.running) {
      statusItem.label = `Docker Status: Läuft (${status.containerCount} Container)`;
    } else {
      statusItem.label = 'Docker Status: Gestoppt';
    }
    
    // Menü neu erstellen um Änderungen anzuwenden
    updateTrayMenu();
  }
}

// Services prüfen und starten
async function checkAndStartServices() {
  const dockerRunning = await checkDockerRunning();
  
  if (!dockerRunning) {
    const result = await dialog.showMessageBox({
      type: 'error',
      title: 'Docker Desktop nicht gefunden',
      message: 'Docker Desktop muss installiert und gestartet sein.',
      buttons: ['Docker Desktop öffnen', 'Abbrechen'],
      defaultId: 0
    });
    
    if (result.response === 0) {
      shell.openExternal('https://www.docker.com/products/docker-desktop');
    }
    return;
  }

  // Zeige Splash-Screen oder Loading-Window
  const loadingWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Lade die index.html mit einem speziellen Parameter für den Loading-State
  loadingWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  try {
    // Docker Manager initialisieren
    dockerManager.initialize(loadingWindow);
    
    // Prüfe Container-Status
    const status = await dockerManager.getStatus();
    
    if (!status.running || status.containerCount === 0) {
      // Starte Container
      await dockerManager.startContainers();
      
      // Warte bis Services bereit sind
      await waitForServices();
    }
    
    // Schließe Loading-Window
    loadingWindow.close();
    
    // Öffne Management-Fenster statt des externen Frontends
    createManagementWindow();
    
    // Aktualisiere Tray-Status
    updateTrayStatus();
    
  } catch (error) {
    if (loadingWindow && !loadingWindow.isDestroyed()) {
      loadingWindow.close();
    }
    
    const errorMessage = error && error.message 
      ? error.message 
      : (error && error.toString ? error.toString() : 'Unbekannter Fehler beim Starten der Container');
    
    console.error('Fehler beim Starten:', error);
    
    dialog.showErrorBox(
      'Fehler beim Starten',
      `Die Docker-Container konnten nicht gestartet werden:\n${errorMessage}\n\nBitte prüfen Sie:\n1. Ob Docker Desktop läuft\n2. Ob die Container-Namen frei sind\n3. Die Docker-Logs für weitere Details`
    );
  }
}

// Warte bis Services bereit sind
async function waitForServices(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch('http://localhost:9081');
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // Service noch nicht bereit
    }
    
    // Warte 2 Sekunden
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('Services wurden nicht rechtzeitig bereit');
}

// Nur Docker-Services im Hintergrund starten (ohne UI)
async function checkAndStartDockerServices() {
  try {
    const dockerRunning = await checkDockerRunning();
    if (!dockerRunning) return;
    
    // Docker Manager initialisieren
    dockerManager.initialize();
    
    // Prüfe Container-Status
    const status = await dockerManager.getStatus();
    
    if (!status.running || status.containerCount === 0) {
      // Starte Container im Hintergrund
      await dockerManager.startContainers();
    } else {
      // Container laufen bereits, prüfe trotzdem ob Admin-User existiert
      console.log('Container laufen bereits, prüfe Admin-User...');
      setTimeout(async () => {
        try {
          await dockerManager.createAdminUserIfNeeded();
        } catch (error) {
          console.error('Fehler beim Prüfen/Erstellen des Admin-Users:', error);
        }
      }, 5000);
    }
    
    // Aktualisiere Tray-Status
    updateTrayStatus();
  } catch (error) {
    console.error('Fehler beim Starten der Docker-Services:', error);
  }
}

// Hauptstart-Funktion mit Ladebildschirm
async function startAppWithLoadingScreen() {
  // Erstelle ein Fenster für den Ladebildschirm
  const loadingWindow = new BrowserWindow({
    width: 600,
    height: 400,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    resizable: false,
    center: true,
    show: false,  // Wichtig: Erst anzeigen wenn bereit
    backgroundColor: '#1e3c72'  // Fallback-Hintergrundfarbe
  });

  // Lade den Loading-Screen als Data-URL für sofortige Anzeige
  const loadingHTML = `
  <!DOCTYPE html>
  <html>
  <head>
  <meta charset="UTF-8">
  <style>
  * {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  }
  body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  color: white;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-app-region: drag;
  user-select: none;
  overflow: hidden;
  }
  .loading-container {
  text-align: center;
  padding: 2rem;
  }
  .logo {
  width: 120px;
  height: 120px;
  margin: 0 auto 2rem;
  background: radial-gradient(circle, #8B80F8 0%, #6B5FC8 100%);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(139, 128, 248, 0.3);
  position: relative;
  overflow: hidden;
  }
  .logo::before {
  content: '';
  position: absolute;
  width: 60%;
  height: 60%;
  background: white;
  border-radius: 50%;
  opacity: 0.1;
  top: -20%;
  left: -20%;
  }
  .logo-icon {
  width: 70px;
  height: 70px;
  fill: white;
  z-index: 1;
  }
  h1 {
      font-size: 2rem;
      font-weight: 300;
  margin-bottom: 1rem;
  }
  .status {
      font-size: 1rem;
      opacity: 0.9;
  margin-bottom: 2rem;
  }
  .progress-bar {
      width: 300px;
      height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
  margin: 0 auto;
  }
  .progress-fill {
      height: 100%;
      background: white;
  border-radius: 2px;
  width: 0%;
  animation: progress 3s ease-in-out forwards;
  }
  @keyframes progress {
      0% { width: 0%; }
      30% { width: 30%; }
  60% { width: 60%; }
  100% { width: 100%; }
  }
  .info {
      margin-top: 3rem;
      font-size: 0.8rem;
  opacity: 0.6;
  }
  .copyright {
      margin-top: 1rem;
          font-size: 0.75rem;
              opacity: 0.5;
          }
  </style>
  </head>
  <body>
  <div class="loading-container">
  <div class="logo">
    <svg class="logo-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <!-- Simplified upgrade icon -->
      <g transform="translate(50, 50)">
        <!-- Main rocket body -->
        <path d="M -15 10 L -15 -20 Q -15 -30 -10 -35 L -5 -40 Q 0 -42 0 -42 Q 0 -42 5 -40 L 10 -35 Q 15 -30 15 -20 L 15 10 L 0 25 Z" fill="white" opacity="0.9"/>
        <!-- Window -->
        <circle cx="0" cy="-15" r="8" fill="#8B80F8" />
        <!-- Rocket flames -->
        <path d="M -12 10 L -8 20 L -4 15 L 0 22 L 4 15 L 8 20 L 12 10" fill="#F1BA38" opacity="0.8"/>
      </g>
    </svg>
  </div>
  <h1>Web Appliance Dashboard</h1>
  <p class="status" id="status">Docker-Container werden gestartet...</p>
  <div class="progress-bar">
          <div class="progress-fill"></div>
          </div>
          <p class="info">Das Dashboard öffnet sich automatisch im Browser</p>
            <p class="copyright">© 2025 by Alf Lewerken</p>
        </div>
    </body>
    </html>
  `;
  
  loadingWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(loadingHTML));
  loadingWindow.show();

  // Sende Status-Updates an das Loading-Window
  const updateLoadingStatus = (message) => {
    if (loadingWindow && !loadingWindow.isDestroyed()) {
      loadingWindow.webContents.executeJavaScript(`
        document.getElementById('status').textContent = '${message}';
      `);
    }
  };
  
  // Gib dem Fenster Zeit zu laden
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    // Prüfe Docker
    updateLoadingStatus('Prüfe Docker Desktop...');
    const dockerRunning = await checkDockerRunning();
    
    if (!dockerRunning) {
      loadingWindow.close();
      const result = await dialog.showMessageBox({
        type: 'error',
        title: 'Docker Desktop nicht gefunden',
        message: 'Docker Desktop muss installiert und gestartet sein.',
        buttons: ['Docker Desktop öffnen', 'Beenden'],
        defaultId: 0
      });
      
      if (result.response === 0) {
        shell.openExternal('https://www.docker.com/products/docker-desktop');
      }
      app.quit();
      return;
    }

    // Docker Manager initialisieren
    updateLoadingStatus('Initialisiere Docker Manager...');
    dockerManager.initialize();
    
    // Prüfe Container-Status
    updateLoadingStatus('Prüfe Container-Status...');
    const status = await dockerManager.getStatus();
    
    if (!status.running || status.containerCount === 0) {
      // Starte Container automatisch
      updateLoadingStatus('Starte Docker-Container...');
      await dockerManager.startContainers();
      
      // Warte bis Services bereit sind
      updateLoadingStatus('Warte auf Services...');
      await waitForServices();
    }
    
    updateLoadingStatus('Dashboard wird geöffnet...');
    
    // Kurze Pause damit der Nutzer die letzte Nachricht sieht
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Schließe Loading-Window
    loadingWindow.close();
    
    // Öffne Dashboard in einem Electron-Fenster
    createDashboardWindow();
    
    // Zeige Benachrichtigung
    const { Notification } = require('electron');
    if (Notification.isSupported()) {
      new Notification({
        title: 'Web Appliance Dashboard',
        body: 'Dashboard wurde erfolgreich gestartet.',
        icon: path.join(__dirname, '..', 'icons', 'AppIcon.icns')
      }).show();
    }
    
    // App läuft nun nur im System Tray
    updateTrayStatus();
    
  } catch (error) {
    if (loadingWindow && !loadingWindow.isDestroyed()) {
      loadingWindow.close();
    }
    
    console.error('Fehler beim Starten:', error);
    
    dialog.showErrorBox(
      'Fehler beim Starten',
      `Die Docker-Container konnten nicht gestartet werden:\n${error.message}\n\nSie können die Container manuell über das Tray-Menü verwalten.`
    );
  }
}

// App Menu erstellen
function createAppMenu() {
  const template = [
    {
      label: 'Web Appliance Dashboard',
      submenu: [
        {
          label: 'Über Web Appliance Dashboard',
          click: () => {
            const { dialog } = require('electron');
            const iconDataUrl = require('./icon-data-url');
            
            // Create custom about dialog
            const aboutWindow = new BrowserWindow({
              width: 500,
              height: 480,
              resizable: false,
              minimizable: false,
              maximizable: false,
              fullscreenable: false,
              modal: true,
              parent: mainWindow || dashboardWindow || managementWindow,
              webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
              },
              titleBarStyle: 'hiddenInset',
              backgroundColor: '#1a1a1a',
              vibrancy: 'dark',
              visualEffectState: 'active'
            });
            
            const aboutHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    html {
                        overflow-y: auto;
                        -webkit-overflow-scrolling: touch;
                    }
                    /* Custom scrollbar for dark theme */
                    ::-webkit-scrollbar {
                        width: 12px;
                    }
                    ::-webkit-scrollbar-track {
                        background: rgba(255, 255, 255, 0.05);
                        border-radius: 6px;
                    }
                    ::-webkit-scrollbar-thumb {
                        background: rgba(255, 255, 255, 0.2);
                        border-radius: 6px;
                        border: 2px solid transparent;
                        background-clip: content-box;
                    }
                    ::-webkit-scrollbar-thumb:hover {
                        background: rgba(255, 255, 255, 0.3);
                        background-clip: content-box;
                    }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: #1a1a1a;
                        color: #e0e0e0;
                        padding: 2rem;
                        padding-top: 3rem;
                        text-align: center;
                        -webkit-app-region: drag;
                        user-select: none;
                        overflow-y: auto;
                        height: 100vh;
                    }
                    .about-container {
                        background: rgba(255, 255, 255, 0.05);
                        backdrop-filter: blur(20px);
                        border-radius: 12px;
                        padding: 2rem;
                        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        -webkit-app-region: no-drag;
                    }
                    .app-icon {
                        width: 100px;
                        height: 100px;
                        margin: 0 auto 1.5rem;
                        background: url('${iconDataUrl}') no-repeat center;
                        background-size: contain;
                        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
                    }
                    h1 {
                        color: #ffffff;
                        font-size: 1.8rem;
                        font-weight: 500;
                        margin-bottom: 0.5rem;
                        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    }
                    .version {
                        color: #a0a0a0;
                        font-size: 1rem;
                        margin-bottom: 1.5rem;
                    }
                    .description {
                        color: #c0c0c0;
                        font-size: 0.95rem;
                        line-height: 1.8;
                        margin-bottom: 1.5rem;
                        text-align: left;
                        padding: 0 1rem;
                    }
                    .description p {
                        margin-bottom: 1rem;
                    }
                    .description p:last-child {
                        margin-bottom: 0;
                    }
                    .copyright {
                        color: #808080;
                        font-size: 0.9rem;
                        padding-top: 1.5rem;
                        border-top: 1px solid rgba(255, 255, 255, 0.1);
                    }
                    .features {
                        text-align: left;
                        margin: 1.5rem 0;
                        padding: 1rem;
                        background: rgba(255, 255, 255, 0.03);
                        border-radius: 8px;
                        border: 1px solid rgba(255, 255, 255, 0.05);
                    }
                    .features h3 {
                        color: #e0e0e0;
                        font-size: 0.9rem;
                        margin-bottom: 0.5rem;
                        font-weight: 600;
                    }
                    .features ul {
                        list-style: none;
                        padding: 0;
                    }
                    .features li {
                        color: #b0b0b0;
                        font-size: 0.85rem;
                        padding: 0.25rem 0;
                        padding-left: 1.2rem;
                        position: relative;
                    }
                    .features li:before {
                        content: "✓";
                        position: absolute;
                        left: 0;
                        color: #4CAF50;
                    }
                    .close-button {
                        margin-top: 1.5rem;
                        padding: 0.6rem 2rem;
                        background: #2196F3;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        font-size: 0.9rem;
                        cursor: pointer;
                        -webkit-app-region: no-drag;
                        transition: all 0.2s ease;
                        box-shadow: 0 2px 8px rgba(33, 150, 243, 0.3);
                    }
                    .close-button:hover {
                        background: #1976D2;
                        transform: translateY(-1px);
                        box-shadow: 0 4px 12px rgba(33, 150, 243, 0.4);
                    }
                    .close-button:active {
                        transform: translateY(0);
                    }
                </style>
            </head>
            <body>
                <div class="about-container">
                    <div class="app-icon"></div>
                    <h1>Web Appliance Dashboard</h1>
                    <p class="version">Version 1.0.0</p>
                    <div class="description">
                        <p>Ich habe diese Anwendung entwickelt, um endlich Herr über die vielen Web-Appliances und Services in meinem Homelab zu werden.</p>
                        <p>Ich wollte eine einzige zentrale Oberfläche, die ich als Administrations-Tool für alle Services in meinem Home-Netzwerk einsetzen kann. Sie sollte aber auch möglichst einfach und intuitiv sein. Sie sollte optisch "schön" sein.</p>
                        <p>Sie dient auch als kleines Verwaltungs-Panel für Web-URLs. Sie stellt ebenfalls einen Web-Server und REST API bereit, um von externen Geräten über Web UI oder Apps genutzt zu werden, die das REST API nutzen, welches diese Anwendung über das Netzwerk zur Verfügung stellt.</p>
                    </div>
                    <p class="copyright">© 2025 by Alf Lewerken<br>Alle Rechte vorbehalten.</p>
                    <button class="close-button" onclick="window.close()">OK</button>
                </div>
                <script>
                    // Close on ESC key
                    document.addEventListener('keydown', (e) => {
                        if (e.key === 'Escape') window.close();
                    });
                </script>
            </body>
            </html>
            `;
            
            aboutWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(aboutHTML));
            
            // Close when clicking OK or pressing ESC
            aboutWindow.webContents.on('ipc-message', (event, channel) => {
              if (channel === 'close-about') {
                aboutWindow.close();
              }
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Einstellungen',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            // Öffne Einstellungen im Dashboard
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                window.location.href = '/settings';
              `);
            }
          }
        },
        { type: 'separator' },
        { role: 'services', submenu: [] },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Fenster',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        { type: 'separator' },
        {
          label: 'Alle Terminal-Fenster schließen',
          accelerator: 'CmdOrCtrl+Shift+W',
          click: () => {
            // Schließe alle Fenster die Terminal enthalten
            BrowserWindow.getAllWindows().forEach(window => {
              const title = window.getTitle();
              if (!window.isDestroyed() && (title.includes('terminal') || title.includes('Terminal') || title.includes('ttyd'))) {
                console.log('Closing terminal window:', title);
                window.destroy();
              }
            });
          }
        },
        {
          label: 'Aktives Fenster schließen (Force)',
          accelerator: 'CmdOrCtrl+Alt+W',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed()) {
              console.log('Force closing window:', focusedWindow.getTitle());
              focusedWindow.destroy();
            }
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        {
          label: 'Entwicklertools',
          accelerator: 'CmdOrCtrl+Option+I',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed()) {
              focusedWindow.webContents.openDevTools();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Docker Management',
          click: () => {
            if (managementWindow && !managementWindow.isDestroyed()) {
              managementWindow.show();
            } else {
              createManagementWindow();
            }
          }
        }
      ]
    },
    {
      label: 'Hilfe',
      submenu: [
        {
          label: 'Benutzerdokumentation',
          accelerator: 'CmdOrCtrl+Shift+H',
          click: () => {
            createHelpWindow();
          }
        },
        {
          label: 'Entwickler-Dokumentation',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => {
            createDeveloperDocWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'Online-Dokumentation',
          click: () => {
            shell.openExternal('https://github.com/your-repo/web-appliance-dashboard');
          }
        },
        {
          label: 'Fehler melden',
          click: () => {
            shell.openExternal('https://github.com/your-repo/web-appliance-dashboard/issues');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handler
ipcMain.handle('docker:getStatus', async () => {
  return await dockerManager.getStatus();
});

ipcMain.handle('docker:start', async () => {
  const result = await dockerManager.startContainers();
  updateTrayStatus();
  return result;
});

ipcMain.handle('docker:stop', async () => {
  const result = await dockerManager.stopContainers();
  updateTrayStatus();
  return result;
});

ipcMain.handle('docker:restart', async () => {
  const result = await dockerManager.restartContainers();
  updateTrayStatus();
  return result;
});

ipcMain.handle('docker:getLogs', async (event, service) => {
  return await dockerManager.getLogs(service);
});

// Remote Desktop Handler
ipcMain.handle('remoteDesktop:open', async (event, config) => {
  try {
    remoteDesktopHandler.openRemoteDesktop(config);
    return { success: true };
  } catch (error) {
    console.error('Error opening remote desktop:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('remoteDesktop:close', async (event, applianceId) => {
  remoteDesktopHandler.closeRemoteWindow(applianceId);
  return { success: true };
});

ipcMain.handle('remoteDesktop:closeAll', async () => {
  remoteDesktopHandler.closeAllWindows();
  return { success: true };
});

ipcMain.handle('remoteDesktop:getOpenCount', async () => {
  return remoteDesktopHandler.getOpenWindowsCount();
});

// Terminal Handler werden jetzt automatisch vom TerminalManager registriert

// App Handler
ipcMain.handle('app:openExternal', async (event, url) => {
  shell.openExternal(url);
});

// App Events
app.whenReady().then(async () => {
  createAppMenu();
  createTray();
  
  // Prüfe auf Standalone-Installation
  if (StandaloneInstaller) {
    const installer = new StandaloneInstaller();
    const installed = await installer.checkAndInstall();
    
    if (!installed) {
      // Benutzer hat Installation abgebrochen
      app.quit();
      return;
    }
  }
  
  // Starte direkt mit dem automatischen Setup und Container-Start
  await startAppWithLoadingScreen();
  
  // Status-Updates im Hintergrund
  setInterval(updateTrayStatus, 10000); // Alle 10 Sekunden
});

app.on('window-all-closed', () => {
  // Auf macOS bleibt die App im Tray aktiv
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // Beim Aktivieren der App öffne das Dashboard-Fenster
  createDashboardWindow();
});

app.on('before-quit', async (event) => {
  if (!isQuitting) {
    event.preventDefault();
    
    // Schließe alle Remote Desktop Fenster
    remoteDesktopHandler.closeAllWindows();
    
    const result = await dialog.showMessageBox({
      type: 'question',
      title: 'Docker Container stoppen?',
      message: 'Möchten Sie die Docker Container beim Beenden stoppen?',
      buttons: ['Container laufen lassen', 'Container stoppen', 'Abbrechen'],
      defaultId: 0
    });
    
    if (result.response === 2) {
      // Abbrechen
      return;
    }
    
    isQuitting = true;
    
    if (result.response === 1) {
      // Container stoppen
      try {
        console.log('Stopping Docker containers...');
        await dockerManager.stopContainers();
        console.log('Docker containers stopped successfully');
        
        // Warte kurz, um sicherzustellen, dass alles sauber beendet wurde
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Error stopping containers:', error);
      }
    }
    
    app.quit();
  }
});

// Fehlerbehandlung
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('Unerwarteter Fehler', error.message);
});