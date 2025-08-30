/**
 * Terminal Window Utilities
 * Hilfsunktionen zum Öffnen des Terminals in einem neuen PWA-Fenster
 * Version: 1.2 - Added session creation for new windows
 */

import axios from '../utils/axiosConfig';

export const openTerminalInNewWindow = async (terminalData = {}) => {
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
  
  // Create terminal session first if we have SSH data
  if (terminalData.hostId || (terminalData.host && terminalData.user)) {
    try {
      const sessionData = {};
      if (terminalData.hostId) {
        sessionData.hostId = terminalData.hostId;
      } else if (terminalData.host && terminalData.user) {
        // Create SSH connection string
        sessionData.sshConnection = `${terminalData.user}@${terminalData.host}:${terminalData.port || 22}`;
      }
      
      const response = await axios.post('/api/terminal/session', sessionData);

      // Wait a bit for session file to be written
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Failed to create terminal session for new window:', error);
    }
  }
  
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

  // Öffne das Terminal in einem neuen Tab/Fenster
  try {
    // Verwende window.open mit expliziten Fenster-Features für ein neues Fenster
    const windowFeatures = 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes';
    const newWindow = window.open(terminalUrl, '_blank', windowFeatures);
    
    if (newWindow) {

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
export const moveTerminalToNewWindow = async (terminalData, onCloseModal) => {
  // Schließe das Modal IMMER, auch wenn das Fenster nicht geöffnet werden kann
  if (onCloseModal) {
    // Schließe das Modal sofort
    onCloseModal();
  }
  
  // Öffne das neue Fenster
  const newWindow = await openTerminalInNewWindow(terminalData);
  
  if (!newWindow) {

  }
  
  return newWindow;
};
