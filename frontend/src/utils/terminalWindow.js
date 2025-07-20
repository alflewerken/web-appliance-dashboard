/**
 * Terminal Window Utilities
 * Hilfsunktionen zum Öffnen des Terminals in einem neuen PWA-Fenster
 * Version: 1.1 - Fixed HTTP/HTTPS handling
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

  // Verwende die gleiche URL-Basis wie die aktuelle Seite
  const currentLocation = window.location;
  const protocol = currentLocation.protocol; // sollte "http:" oder "https:" sein
  const hostname = currentLocation.hostname;
  const port = currentLocation.port;
  
  // Konstruiere die Terminal-URL basierend auf der aktuellen URL
  // Stelle sicher, dass das Protokoll korrekt ist
  let terminalUrl = protocol.includes(':') ? protocol : protocol + ':';
  terminalUrl += `//${hostname}`;
  if (port) {
    terminalUrl += `:${port}`;
  }
  terminalUrl += '/terminal/';
  if (params.toString()) {
    terminalUrl += '?' + params.toString();
  }
  
  console.log('Terminal URL construction (v1.1):', {
    protocol: protocol,
    hostname: hostname,
    port: port,
    fullUrl: terminalUrl,
    windowLocationHref: window.location.href,
    timestamp: new Date().toISOString()
  });
  
  // Öffne das Terminal in einem neuen Tab/Fenster
  try {
    // Verwende window.open mit expliziten Fenster-Features für ein neues Fenster
    const windowFeatures = 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes';
    const newWindow = window.open(terminalUrl, '_blank', windowFeatures);
    
    if (newWindow) {
      console.log('Terminal window opened successfully:', terminalUrl);
      newWindow.focus();
      return newWindow;
    } else {
      console.error('Failed to open terminal window - popup blocker may be active');
      
      // Fallback: Erstelle einen Link und klicke ihn
      const link = document.createElement('a');
      link.href = terminalUrl;
      link.target = 'terminal_window_' + Date.now(); // Eindeutiger Fenstername
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      
      // Versuche mit onclick ein neues Fenster zu erzwingen
      link.onclick = function(e) {
        e.preventDefault();
        window.open(this.href, this.target, 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes');
        return false;
      };
      
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 100);
      
      console.log('Terminal opened via link click:', terminalUrl);
    }
  } catch (error) {
    console.error('Error opening terminal window:', error);
    alert('Fehler beim Öffnen des Terminals: ' + error.message);
  }
  
  return null;
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
