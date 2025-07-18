const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  // Create main window
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadURL(`data:text/html,
    <html>
      <body>
        <h1>Test Window Close</h1>
        <button onclick="openChild()">Open Child Window</button>
        <button onclick="closeAllWindows()">Close All Windows</button>
        <script>
          const { BrowserWindow } = require('electron').remote || require('@electron/remote');
          
          let childWindow;
          
          function openChild() {
            childWindow = new BrowserWindow({
              width: 600,
              height: 400,
              parent: require('electron').remote.getCurrentWindow()
            });
            
            childWindow.loadURL('data:text/html,<h1>Child Window</h1><button onclick="window.close()">Close Me</button>');
          }
          
          function closeAllWindows() {
            if (childWindow && !childWindow.isDestroyed()) {
              childWindow.close();
            }
          }
        </script>
      </body>
    </html>
  `);
});

app.on('window-all-closed', () => {
  app.quit();
});
