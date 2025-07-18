const { app, BrowserWindow } = require('electron');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'default', // Standard-Titelleiste für bessere Kontrolle
    frame: true, // Fensterrahmen aktiviert
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    // Füge Tastenkombinationen für das Schließen hinzu
    closable: true,
    minimizable: true,
    maximizable: true
  });

  // Lade die Terminal-URL
  mainWindow.loadURL('http://localhost:9080/terminal/');

  // Füge Tastenkombination zum Schließen hinzu (Cmd+W)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'w' && (input.meta || input.control)) {
      event.preventDefault();
      mainWindow.close();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
