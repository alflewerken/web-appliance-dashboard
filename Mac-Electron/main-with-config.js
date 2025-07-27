const { app, BrowserWindow, Menu, shell, dialog, ipcMain, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');

let mainWindow;
let configWindow;

// Konfigurationspfad
const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'config.json');

// Standard-Konfiguration
const defaultConfig = {
  apiHost: 'localhost',
  apiPort: '3000',
  apiProtocol: 'http'
};

// Konfiguration laden
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Fehler beim Laden der Konfiguration:', error);
  }
  return null;
}

// Konfiguration speichern
function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Fehler beim Speichern der Konfiguration:', error);
    return false;
  }
}

// Konfigurationsfenster erstellen
function createConfigWindow() {
  configWindow = new BrowserWindow({
    width: 500,
    height: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload-config.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'default',
    resizable: false,
    minimizable: false,
    maximizable: false
  });

  const configPath = path.join(__dirname, 'config.html');
  console.log('Loading config from:', configPath);
  console.log('File exists:', fs.existsSync(configPath));
  console.log('__dirname:', __dirname);
  
  configWindow.loadFile(configPath).catch(err => {
    console.error('Failed to load config.html:', err);
    dialog.showErrorBox('Fehler', `Konnte Konfigurationsdialog nicht laden:\n${err.message}\n\nPfad: ${configPath}`);
  });

  configWindow.on('closed', () => {
    configWindow = null;
    // Wenn kein Hauptfenster existiert und Config geschlossen wird, App beenden
    if (!mainWindow) {
      app.quit();
    }
  });
  
  // Debug-Ausgabe
  console.log('Config window created');
}

function createWindow() {
  const config = loadConfig();
  
  console.log('createWindow called, config:', config);
  
  // Wenn keine Konfiguration vorhanden, zeige Konfigurationsdialog
  if (!config) {
    console.log('No config found, showing config dialog');
    createConfigWindow();
    return;
  }

  console.log('Creating main window with config:', config);

  // Erstelle das Browser-Fenster
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,  // Temporär für Entwicklung
      allowRunningInsecureContent: true
    },
    titleBarStyle: 'hiddenInset',
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  // Prüfe ob Frontend gebaut wurde
  const frontendPath = path.join(__dirname, 'frontend-build', 'index.html');
  if (!fs.existsSync(frontendPath)) {
    dialog.showErrorBox(
      'Frontend nicht gefunden',
      'Das Frontend wurde noch nicht gebaut.\n\nBitte führen Sie folgende Befehle aus:\n\n' +
      '1. cd Mac-Electron\n' +
      '2. npm run build-frontend\n\n' +
      'oder verwenden Sie:\n' +
      './prepare-build.sh'
    );
    app.quit();
    return;
  }

  // Lade das Frontend mit API-Konfiguration
  mainWindow.loadFile(frontendPath);

  // Content Security Policy setzen
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [`
          default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: file:;
          script-src 'self' 'unsafe-inline' 'unsafe-eval';
          style-src 'self' 'unsafe-inline';
          img-src 'self' data: blob: file: https:;
          connect-src 'self' ${config.apiProtocol}://${config.apiHost}:${config.apiPort} ws://${config.apiHost}:${config.apiPort} wss://${config.apiHost}:${config.apiPort};
          font-src 'self' data:;
          media-src 'self' data: blob:;
          frame-src 'self';
        `.replace(/\s+/g, ' ').trim()]
      }
    });
  });

  // Blockiere Chrome-spezifische Requests
  mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    if (details.url.includes('chromewebdata') || 
        details.url.includes('chrome-extension://') ||
        details.url.includes('devtools://')) {
      callback({ cancel: true });
    } else {
      callback({});
    }
  });

  // Intercepte file:// Requests und korrigiere absolute Pfade
  mainWindow.webContents.on('did-finish-load', () => {
    // Erstelle die API URLs basierend auf der Konfiguration
    const apiUrl = `${config.apiProtocol}://${config.apiHost}:${config.apiPort}`;
    const wsUrl = `ws://${config.apiHost}:${config.apiPort}`;
    
    mainWindow.webContents.executeJavaScript(`
      // Setze die API-Konfiguration global
      window.API_CONFIG = ${JSON.stringify(config)};
      
      // Stelle sicher, dass process.env existiert
      window.process = window.process || {};
      window.process.env = window.process.env || {};
      
      // Überschreibe die React App Umgebungsvariablen
      window.process.env.REACT_APP_API_URL = '${apiUrl}';
      window.process.env.REACT_APP_WS_URL = '${wsUrl}';
      window.process.env.REACT_APP_TERMINAL_URL = '${apiUrl}/terminal';
      
      // Globale Variablen für Legacy-Support
      window.REACT_APP_API_URL = '${apiUrl}';
      window.REACT_APP_WS_URL = '${wsUrl}';
      window.REACT_APP_TERMINAL_URL = '${apiUrl}/terminal';
      
      // Für Axios Default Base URL (falls verwendet)
      if (window.axios && window.axios.defaults) {
        window.axios.defaults.baseURL = '${apiUrl}';
      }
      
      console.log('API Konfiguration geladen:', {
        API_URL: window.process.env.REACT_APP_API_URL,
        WS_URL: window.process.env.REACT_APP_WS_URL,
        TERMINAL_URL: window.process.env.REACT_APP_TERMINAL_URL,
        Config: window.API_CONFIG
      });
    `);
  });

  // Öffne externe Links im Browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handler für Konfiguration
ipcMain.handle('get-config', () => {
  return loadConfig() || defaultConfig;
});

ipcMain.handle('save-config', (event, config) => {
  const success = saveConfig(config);
  if (success) {
    if (configWindow) {
      configWindow.close();
      configWindow = null;
    }
    // Erstelle das Hauptfenster nach dem Speichern
    if (!mainWindow) {
      createWindow();
    }
  }
  return success;
});

ipcMain.handle('test-connection', async (event, config) => {
  const url = `${config.apiProtocol}://${config.apiHost}:${config.apiPort}/api/health`;
  
  try {
    const response = await fetch(url, { 
      method: 'GET',
      timeout: 5000 
    });
    
    return {
      success: response.ok,
      status: response.status,
      message: response.ok ? 'Verbindung erfolgreich' : `Fehler: ${response.status}`
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: `Verbindungsfehler: ${error.message}`
    };
  }
});

// App Menu für macOS
function createMenu() {
  const template = [
    {
      label: app.getName(),
      submenu: [
        { label: 'Über ' + app.getName(), role: 'about' },
        { type: 'separator' },
        { 
          label: 'Einstellungen...', 
          accelerator: 'Cmd+,',
          click: () => {
            if (!configWindow) {
              createConfigWindow();
            } else {
              configWindow.focus();
            }
          }
        },
        { type: 'separator' },
        { label: 'Dienste', role: 'services', submenu: [] },
        { type: 'separator' },
        { label: app.getName() + ' ausblenden', role: 'hide' },
        { label: 'Andere ausblenden', role: 'hideothers' },
        { label: 'Alle anzeigen', role: 'unhide' },
        { type: 'separator' },
        { label: 'Beenden', role: 'quit' }
      ]
    },
    {
      label: 'Bearbeiten',
      submenu: [
        { label: 'Rückgängig', role: 'undo' },
        { label: 'Wiederholen', role: 'redo' },
        { type: 'separator' },
        { label: 'Ausschneiden', role: 'cut' },
        { label: 'Kopieren', role: 'copy' },
        { label: 'Einfügen', role: 'paste' },
        { label: 'Alles auswählen', role: 'selectall' }
      ]
    },
    {
      label: 'Ansicht',
      submenu: [
        { label: 'Neu laden', role: 'reload' },
        { label: 'Erzwungenes Neuladen', role: 'forcereload' },
        { label: 'Entwicklertools', role: 'toggledevtools' },
        { type: 'separator' },
        { label: 'Tatsächliche Größe', role: 'resetzoom' },
        { label: 'Vergrößern', role: 'zoomin' },
        { label: 'Verkleinern', role: 'zoomout' },
        { type: 'separator' },
        { label: 'Vollbild', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Fenster',
      submenu: [
        { label: 'Minimieren', role: 'minimize' },
        { label: 'Schließen', role: 'close' }
      ]
    },
    {
      label: 'Hilfe',
      submenu: [
        {
          label: 'Mehr erfahren',
          click: () => { 
            shell.openExternal('https://github.com/alflewerken/web-appliance-dashboard');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App-Events
app.whenReady().then(() => {
  // Registriere Protocol für das Laden von lokalen Dateien
  protocol.interceptFileProtocol('file', (request, callback) => {
    const parsedUrl = url.parse(request.url);
    let filePath = decodeURI(parsedUrl.pathname);
    
    // Korrigiere absolute Pfade für macOS
    if (process.platform === 'darwin' && filePath.startsWith('//')) {
      filePath = filePath.substring(1);
    }
    
    // Wenn der Pfad mit / beginnt (absoluter Pfad im HTML), 
    // mache ihn relativ zum frontend-build Ordner
    if (filePath.startsWith('/') && !filePath.includes('frontend-build')) {
      const basePath = path.join(__dirname, 'frontend-build');
      filePath = path.join(basePath, filePath);
    }
    
    callback({ path: filePath });
  });

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

// Verhindere Navigation zu externen URLs
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    if (parsedUrl.origin !== 'file://') {
      event.preventDefault();
    }
  });
});
