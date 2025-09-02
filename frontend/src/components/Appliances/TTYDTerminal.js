import React from 'react';
import ReactDOM from 'react-dom';
import { X, Maximize2, Minimize2, RefreshCw, ExternalLink } from 'lucide-react';
import TerminalIcon from '@mui/icons-material/Terminal';
import { useTranslation } from 'react-i18next';
import './TTYDTerminal.css';
import { moveTerminalToNewWindow } from '../../utils/terminalWindow';
import axios from '../../utils/axiosConfig';
import '../../utils/terminalErrorSuppressor';

const TTYDTerminal = ({ show, onHide, hostId = null, appliance = null, host = null, title = 'Terminal' }) => {
  const { t } = useTranslation();
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  if (!show) return null;

  // Extrahiere SSH-Verbindungsdaten
  let sshData = {};
  
  // Priorität 1: Direkte Host-Daten (von SSH-Manager)
  if (host) {
    sshData = {
      hostId: host.id || hostId,
      host: host.host || '',  // host.host ist die tatsächliche IP-Adresse
      user: host.username || '',
      port: host.port || 22,
      sessionId: host.sessionId || null  // Session-ID wenn vorhanden
    };
  }
  // Priorität 2: Appliance-Daten
  else if (appliance) {
    try {
      // Parse ssh_connection string if available (format: user@host:port)
      if (appliance.ssh_connection) {
        const match = appliance.ssh_connection.match(/^(.+)@(.+):(\d+)$/);
        if (match) {
          sshData = {
            hostId: appliance.id,
            user: match[1],
            host: match[2],
            port: parseInt(match[3], 10),
            // SSH-Schlüssel-Name hinzufügen
            keyName: appliance.sshKeyName || appliance.ssh_key_name || 'dashboard'
          };
        }
      }
      // Fallback: Verwende SSH-Host-ID wenn verfügbar
      else if (appliance.sshHostId && appliance.ssh_host) {
        sshData = {
          hostId: appliance.sshHostId,
          host: appliance.ssh_host.hostname || appliance.ssh_host.name || '',
          user: appliance.ssh_host.username || '',
          port: appliance.ssh_host.port || 22
        };
      } else if (appliance.sshHost) {
        // Alternative Property-Namen
        sshData = {
          hostId: appliance.sshHostId || appliance.sshHostId || '',
          host: appliance.sshHost || '',
          user: appliance.sshUser || '',
          port: appliance.sshPort || 22
        };
      } else if (appliance.ssh_config) {
        // Fallback auf direkte SSH-Config wenn vorhanden
        sshData = {
          host: appliance.ssh_config.host || '',
          user: appliance.ssh_config.user || '',
          port: appliance.ssh_config.port || 22
        };
      }
    } catch (error) {
      // Silently handle SSH data extraction errors
      sshData = {};
    }
  }

  // Für die Mac-App verwenden wir den ttyd-Service über Nginx Proxy
  // Füge die SSH-Parameter zur URL hinzu
  const params = new URLSearchParams();
  
  // Session-ID hat höchste Priorität
  if (host && host.sessionId) {
    params.append('session', host.sessionId);
  } else if (sshData.sessionId) {
    params.append('session', sshData.sessionId);
  }
  
  // Füge alle SSH-Daten hinzu, auch hostId aus sshData
  if (sshData.hostId || hostId) {
    params.append('hostId', sshData.hostId || hostId);
  }
  
  // Füge SSH-Daten hinzu
  if (sshData.host) {
    params.append('host', sshData.host);
  }
  if (sshData.user) {
    params.append('user', sshData.user);
  }
  if (sshData.port) {
    params.append('port', sshData.port);
  }
  // SSH-Schlüssel-Name hinzufügen
  if (sshData.keyName) {
    params.append('keyName', sshData.keyName);
  }
  
  // Terminal läuft über nginx proxy auf /terminal/
  const terminalUrl = `/terminal/${params.toString() ? '?' + params.toString() : ''}`;
  
  // Erstelle den Anzeige-Titel
  const displayTitle = (() => {
    if (host && host.name) {
      return `Terminal - ${host.name}`;
    } else if (sshData.host) {
      // Versuche den Hostname aus den Daten zu extrahieren
      return `Terminal - ${sshData.host}`;
    } else if (appliance && appliance.name) {
      return `Terminal - ${appliance.name}`;
    }
    return title;
  })();
  // Debug-Ausgabe

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleRefresh = () => {
    const iframe = document.getElementById('ttyd-terminal-iframe');
    if (iframe) {
      iframe.src = iframe.src;
    }
  };

  const handleOpenInNewWindow = async () => {
    // Create session before opening new window
    if (sshData.hostId || (sshData.host && sshData.user)) {
      try {
        const sessionData = {};
        if (sshData.hostId) {
          sessionData.hostId = sshData.hostId;
        } else if (sshData.host && sshData.user) {
          sessionData.sshConnection = `${sshData.user}@${sshData.host}:${sshData.port || 22}`;
        }
        
        const response = await axios.post('/api/terminal/session', sessionData);

        // Wait for session file to be written
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('Failed to create terminal session:', error);
      }
    }
    
    // Now open the window
    moveTerminalToNewWindow(sshData, onHide);
  };

  // Stelle sicher, dass das Portal-Target existiert
  const portalTarget = document.body;
  if (!portalTarget) {
    console.error('Portal target (document.body) not found');
    return null;
  }

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onHide}>
      <div
        className={`terminal-modal-container ${isFullscreen ? 'fullscreen' : ''}`}
        onClick={e => e.stopPropagation()}
        data-host-id={sshData.hostId || ''}
        data-host={sshData.host || ''}
        data-user={sshData.user || ''}
        data-port={sshData.port || '22'}
      >
        <div className="terminal-header">
          <h3 className="terminal-title">
            <TerminalIcon style={{ fontSize: 20, marginRight: 8, verticalAlign: 'middle' }} />
            {displayTitle}
          </h3>
          <div className="terminal-controls">
            <button
              className="control-btn new-window"
              onClick={handleOpenInNewWindow}
              title={t('services.openInNewWindow')}
            >
              <ExternalLink size={16} />
            </button>
            <button
              className="control-btn refresh"
              onClick={handleRefresh}
              title={t('services.refresh')}
            >
              <RefreshCw size={16} />
            </button>
            <button
              className="control-btn maximize"
              onClick={toggleFullscreen}
              title={isFullscreen ? t('terminal.restore') : t('terminal.maximize')}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              className="control-btn close"
              onClick={onHide}
              title={t('common.close')}
            >
              <X size={16} />
            </button>
          </div>
        </div>
        
        <div className="terminal-body">
          <iframe
            id="ttyd-terminal-iframe"
            src={terminalUrl}
            className="terminal-iframe"
            title="Web Terminal"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: '#000'
            }}
            onLoad={(e) => {
              // Check if we're in light mode and inject styles
              const isLightMode = document.body.classList.contains('theme-light');
              if (isLightMode) {
                try {
                  const iframe = e.target;
                  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                  
                  // Inject light mode styles for terminal
                  const style = iframeDoc.createElement('style');
                  style.textContent = `
                    /* Light mode terminal styles */
                    body {
                      background: #ffffff !important;
                      filter: invert(1) hue-rotate(180deg) !important;
                    }
                    .terminal {
                      background: #ffffff !important;
                    }
                    /* Invert the terminal colors for light mode */
                    #terminal-container {
                      filter: invert(1) hue-rotate(180deg) !important;
                    }
                  `;
                  iframeDoc.head.appendChild(style);
                } catch (err) {
                  // Cross-origin restrictions, can't inject styles
                  console.log('Cannot inject styles into terminal iframe (cross-origin)');
                }
              }
            }}
            onError={(e) => {
              // Silently handle iframe errors - terminal still works
            }}
          />
        </div>
      </div>
    </div>,
    portalTarget
  );
};

export default TTYDTerminal;
