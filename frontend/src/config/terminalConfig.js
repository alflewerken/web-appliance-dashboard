// Configuration for terminal behavior in different environments
export const terminalConfig = {
  // Force terminal to open in same window when in Electron
  forceInlineTerminal: window.electronAPI !== undefined,
  
  // Check if we're in Electron environment
  isElectron: window.electronAPI !== undefined,
  
  // Terminal window features for non-Electron environments
  windowFeatures: {
    width: 1200,
    height: 800,
    menubar: 'no',
    toolbar: 'no',
    location: 'no',
    directories: 'no',
    status: 'no',
    scrollbars: 'no',
    resizable: 'yes',
    copyhistory: 'no'
  }
};
