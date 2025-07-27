const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

// Electron Store für persistente Konfiguration
const store = new Store();

let mainWindow;
let configWindow;

// Standard-Konfiguration
const defaultConfig = {
  apiHost: 'localhost',
  apiPort: '9080',
  apiProtocol: 'http'
};

// Konfiguration laden
function loadConfig() {
  return store.get('apiConfig', null);
}

// Konfiguration speichern
function saveConfig(config) {
  store.set('apiConfig', config);
  return true;
}

// Konfigurationsfenster erstellen (inline HTML)
function createConfigWindow() {
  configWindow = new BrowserWindow({
    width: 500,
    height: 450,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true
    },
    titleBarStyle: 'default',
    resizable: false,
    minimizable: false,
    maximizable: false
  });

  // Inline HTML für Konfiguration
  const configHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Backend Konfiguration</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #1976d2;
            font-size: 24px;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
        }
        input, select {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
        }
        button {
            width: 48%;
            padding: 10px;
            border: none;
            border-radius: 5px;
            font-size: 14px;
            cursor: pointer;
        }
        .btn-primary {
            background: #1976d2;
            color: white;
        }
        .btn-secondary {
            background: #f5f5f5;
            border: 1px solid #ddd;
        }
        .button-group {
            display: flex;
            justify-content: space-between;
            margin-top: 30px;
        }
        #status {
            margin-top: 20px;
            padding: 10px;
            border-radius: 5px;
            text-align: center;
            display: none;
        }
        .success { background: #e8f5e9; color: #2e7d32; }
        .error { background: #ffebee; color: #c62828; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Backend Konfiguration</h1>
        <p class="subtitle">Verbinden Sie sich mit Ihrem Web Appliance Server</p>
        
        <div class="form-group">
            <label>Protokoll</label>
            <select id="protocol">
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
            </select>
        </div>
        
        <div class="form-group">
            <label>Host / IP-Adresse</label>
            <input id="host" type="text" placeholder="z.B. 192.168.1.100 oder kunde.example.com" value="localhost">
        </div>
        
        <div class="form-group">
            <label>Port</label>
            <input id="port" type="number" placeholder="z.B. 9080" value="9080" min="1" max="65535">
        </div>
        
        <div id="status"></div>
        
        <div class="button-group">
            <button class="btn-secondary" onclick="testConnection()">Verbindung testen</button>
            <button class="btn-primary" onclick="saveConfiguration()">Speichern</button>
        </div>
    </div>
    
    <script>
        const { ipcRenderer } = require('electron');
        
        // Lade bestehende Konfiguration
        ipcRenderer.send('get-config');
        ipcRenderer.on('config-data', (event, config) => {
            if (config) {
                document.getElementById('protocol').value = config.apiProtocol || 'http';
                document.getElementById('host').value = config.apiHost || 'localhost';
                document.getElementById('port').value = config.apiPort || '9080';
            }
        });
        
        function showStatus(message, type) {
            const status = document.getElementById('status');
            status.textContent = message;
            status.className = type;
            status.style.display = 'block';
        }
        
        async function testConnection() {
            const config = {
                apiProtocol: document.getElementById('protocol').value,
                apiHost: document.getElementById('host').value,
                apiPort: document.getElementById('port').value
            };
            
            const url = config.apiProtocol + '://' + config.apiHost + ':' + config.apiPort + '/api/health';
            
            try {
                const response = await fetch(url, { 
                    method: 'GET',
                    mode: 'no-cors',
                    timeout: 5000 
                });
                showStatus('Verbindung möglich! (CORS verhindert genaue Prüfung)', 'success');
            } catch (error) {
                showStatus('Verbindung fehlgeschlagen: ' + error.message, 'error');
            }
        }
        
        function saveConfiguration() {
            const config = {
                apiProtocol: document.getElementById('protocol').value,
                apiHost: document.getElementById('host').value,
                apiPort: document.getElementById('port').value
            };
            
            ipcRenderer.send('save-config', config);
            showStatus('Konfiguration gespeichert!', 'success');
            
            setTimeout(() => {
                window.close();
            }, 1000);
        }
    </script>
</body>
</html>
  `;

  configWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(configHTML)}`);

  configWindow.on('closed', () => {
    configWindow = null;
    if (!mainWindow) {
      app.quit();
    }
  });
}

function createWindow() {
  const config = loadConfig();
  
  if (!config) {
    createConfigWindow();
    return;
  }

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
      partition: 'persist:main' // Persistente Session für Cookies
    },
    titleBarStyle: 'hiddenInset',
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  const frontendPath = path.join(__dirname, 'frontend-build', 'index.html');
  if (!fs.existsSync(frontendPath)) {
    dialog.showErrorBox(
      'Frontend nicht gefunden',
      'Das Frontend wurde noch nicht gebaut.\n\nBitte führen Sie aus:\nnpm run build-frontend'
    );
    app.quit();
    return;
  }

  mainWindow.loadFile(frontendPath);

  // Injiziere die Backend-Konfiguration
  mainWindow.webContents.on('did-finish-load', () => {
    const apiUrl = `${config.apiProtocol}://${config.apiHost}:${config.apiPort}`;
    const wsProtocol = config.apiProtocol === 'https' ? 'wss' : 'ws';
    const wsUrl = `${wsProtocol}://${config.apiHost}:${config.apiPort}`;
    
    // Cookie-Unterstützung für Cross-Origin Requests
    const session = mainWindow.webContents.session;
    
    // Setze Request-Header für CORS
    session.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['Origin'] = apiUrl;
      details.requestHeaders['Referer'] = apiUrl;
      callback({ requestHeaders: details.requestHeaders });
    });
    
    mainWindow.webContents.executeJavaScript(`
      console.log('Backend wurde bereits konfiguriert:', {
        API: window.API_BASE_URL,
        WebSocket: window.WS_URL
      });
    `);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handler
ipcMain.on('get-config', (event) => {
  event.reply('config-data', loadConfig() || defaultConfig);
});

ipcMain.on('get-backend-config-sync', (event) => {
  const config = loadConfig();
  event.reply('backend-config-data', config);
});

ipcMain.on('save-config', (event, config) => {
  saveConfig(config);
  if (configWindow) {
    configWindow.close();
  }
  if (!mainWindow) {
    createWindow();
  }
});

// App Menu
function createMenu() {
  const template = [
    {
      label: app.getName(),
      submenu: [
        { label: 'Über ' + app.getName(), role: 'about' },
        { type: 'separator' },
        { 
          label: 'Backend-Einstellungen...', 
          accelerator: 'Cmd+,',
          click: () => {
            if (!configWindow) {
              createConfigWindow();
            }
          }
        },
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
        { label: 'Einfügen', role: 'paste' }
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

// App Events
app.whenReady().then(() => {
  createWindow();
  createMenu();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Certificate Fehler für selbst-signierte Zertifikate ignorieren
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});
