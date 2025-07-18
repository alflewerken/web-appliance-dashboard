/**
 * Terminal Window Utilities
 * Hilfsunktionen zum Öffnen des Terminals in einem neuen PWA-Fenster
 */

/**
 * Terminal Window Utilities
 * Hilfsunktionen zum Öffnen des Terminals in einem neuen PWA-Fenster
 */

export const openTerminalInNewWindow = (terminalData = {}) => {
  // Prüfe ob wir in Electron sind
  const isElectron = window.electronAPI !== undefined;
  
  if (isElectron && window.electronAPI.terminal && window.electronAPI.terminal.openNew) {
    // In Electron: Nutze den nativen Terminal-Handler
    window.electronAPI.terminal.openNew({
      host: terminalData.host,
      user: terminalData.user,
      port: terminalData.port,
      hostId: terminalData.hostId
    }).then(result => {
      if (result.success) {
        console.log('Terminal opened with ID:', result.id);
      } else {
        console.error('Failed to open terminal:', result.error);
        alert('Fehler beim Öffnen des Terminals: ' + result.error);
      }
    }).catch(error => {
      console.error('Error calling terminal API:', error);
      alert('Fehler beim Öffnen des Terminals');
    });
    return;
  }
  
  // Fallback für Browser
  const params = new URLSearchParams();
  
  if (terminalData.hostId) {
    params.append('hostId', terminalData.hostId);
  }
  if (terminalData.host) {
    params.append('host', terminalData.host);
  }
  if (terminalData.user) {
    params.append('user', terminalData.user);
  }
  if (terminalData.port && terminalData.port !== 22) {
    params.append('port', terminalData.port);
  }

  const terminalUrl = `/terminal${params.toString() ? '?' + params.toString() : ''}`;
  window.open(terminalUrl, '_blank');
};

/**
 * Öffnet das aktuelle Terminal Modal in einem neuen Fenster
 * und schließt das Modal
 */
export const moveTerminalToNewWindow = (terminalData, onCloseModal) => {
  // Schließe das Modal IMMER, auch wenn das Fenster nicht geöffnet werden kann
  if (onCloseModal) {
    // Schließe das Modal sofort
    onCloseModal();
  }
  
  // Öffne das neue Fenster
  const newWindow = openTerminalInNewWindow(terminalData);
  
  if (!newWindow) {
    console.warn('Terminal window could not be opened, but modal was closed');
  }
  
  return newWindow;
};
