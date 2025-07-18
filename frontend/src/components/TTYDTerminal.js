import React from 'react';
import ReactDOM from 'react-dom';
import { X, Maximize2, Minimize2, RefreshCw, ExternalLink } from 'lucide-react';
import './TTYDTerminal.css';
import { moveTerminalToNewWindow } from '../utils/terminalWindow';

const TTYDTerminal = ({ show, onHide, hostId = null, appliance = null, host = null, title = 'Terminal' }) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  if (!show) return null;

  // Extrahiere SSH-Verbindungsdaten
  let sshData = {};
  
  // Priorität 1: Direkte Host-Daten (von SSH-Manager)
  if (host) {
    sshData = {
      hostId: host.id || hostId,
      host: host.hostname || host.host || '',
      user: host.username || host.user || '',
      port: host.port || 22
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
            port: parseInt(match[3], 10)
          };
        }
      }
      // Fallback: Verwende SSH-Host-ID wenn verfügbar
      else if (appliance.ssh_host_id && appliance.ssh_host) {
        sshData = {
          hostId: appliance.ssh_host_id,
          host: appliance.ssh_host.hostname || appliance.ssh_host.name || '',
          user: appliance.ssh_host.username || '',
          port: appliance.ssh_host.port || 22
        };
      } else if (appliance.sshHost) {
        // Alternative Property-Namen
        sshData = {
          hostId: appliance.sshHostId || appliance.ssh_host_id || '',
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
      console.error('Error extracting SSH data:', error);
      sshData = {};
    }
  }

  // Für die Mac-App verwenden wir den ttyd-Service über Nginx Proxy
  // Füge die SSH-Parameter zur URL hinzu
  const params = new URLSearchParams();
  
  // Priorisiere hostId wenn verfügbar
  if (hostId) {
    params.append('hostId', hostId);
  }
  
  // Füge SSH-Daten hinzu
  if (sshData.host) {
    params.append('host', sshData.host);
  }
  if (sshData.user) {
    params.append('user', sshData.user);
  }
  if (sshData.port && sshData.port !== 22) {
    params.append('port', sshData.port);
  }
  
  // Terminal läuft über nginx proxy auf /terminal/
  const terminalUrl = `/terminal/${params.toString() ? '?' + params.toString() : ''}`;
  
  // Debug-Ausgabe
  console.log('TTYDTerminal Debug:', {
    terminalUrl,
    params: params.toString(),
    sshData,
    appliance,
    host,
    hostId
  });

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleRefresh = () => {
    const iframe = document.getElementById('ttyd-terminal-iframe');
    if (iframe) {
      iframe.src = iframe.src;
    }
  };

  const handleOpenInNewWindow = () => {
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
            <span className="terminal-icon">_</span>
            {title}
          </h3>
          <div className="terminal-controls">
            <button
              className="control-btn new-window"
              onClick={handleOpenInNewWindow}
              title="In neuem Fenster öffnen"
            >
              <ExternalLink size={16} />
            </button>
            <button
              className="control-btn refresh"
              onClick={handleRefresh}
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
            <button
              className="control-btn maximize"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Restore' : 'Maximize'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              className="control-btn close"
              onClick={onHide}
              title="Close"
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
              console.log('Terminal iframe loaded:', e.target.src);
            }}
            onError={(e) => {
              console.error('Terminal iframe error:', e);
            }}
          />
        </div>
      </div>
    </div>,
    portalTarget
  );
};

export default TTYDTerminal;
