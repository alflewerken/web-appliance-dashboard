import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, Maximize2, Minimize2, RefreshCw, ExternalLink } from 'lucide-react';
import proxyService from '../services/proxyService';
import './TerminalModal.css';

const TerminalModal = ({ show, onHide, appliance = null, title = 'Terminal' }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const iframeRef = useRef(null);

  if (!show || !appliance) return null;

  // WebSocket-URL für Terminal über Proxy
  const terminalUrl = proxyService.getTerminalWebSocketUrl(appliance.id);
  
  // Für iframe brauchen wir eine HTTP-URL, nicht WebSocket
  // Das Backend sollte eine HTTP-Seite bereitstellen, die dann WebSocket nutzt
  const iframeUrl = proxyService.getProxyUrl(appliance.id, '/terminal');

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsConnecting(true);
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const handleOpenInNewWindow = () => {
    proxyService.openInNewTab(appliance, '/terminal');
    onHide();
  };

  const handleIframeLoad = () => {
    setIsConnecting(false);

  };

  const handleIframeError = (e) => {
    setIsConnecting(false);
    console.error('[Terminal] Connection error:', e);
  };

  // Portal target
  const portalTarget = document.getElementById('terminal-portal');
  if (!portalTarget) {
    console.error('Terminal portal target not found');
    return null;
  }

  return ReactDOM.createPortal(
    <div className={`terminal-modal ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="terminal-backdrop" onClick={onHide} />
      <div className="terminal-window">
        <div className="terminal-header">
          <div className="terminal-title">
            <span>{title} - {appliance.name}</span>
          </div>
          <div className="terminal-controls">
            <button
              className="terminal-control-btn"
              onClick={handleOpenInNewWindow}
              title="Open in new window"
            >
              <ExternalLink size={16} />
            </button>
            <button
              className="terminal-control-btn"
              onClick={handleRefresh}
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
            <button
              className="terminal-control-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              className="terminal-control-btn close-btn"
              onClick={onHide}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="terminal-body">
          {isConnecting && (
            <div className="terminal-connecting">
              <div className="terminal-spinner" />
              <p>Connecting to {appliance.name}...</p>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={iframeUrl}
            className="terminal-iframe"
            title={`${appliance.name} Terminal`}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: '#000',
              display: isConnecting ? 'none' : 'block'
            }}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        </div>
      </div>
    </div>,
    portalTarget
  );
};

export default TerminalModal;
