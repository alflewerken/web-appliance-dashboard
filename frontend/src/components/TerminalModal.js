import React from 'react';
import './TerminalModal.css';

const TerminalModal = ({ isOpen, onClose, terminalUrl }) => {
  if (!isOpen) return null;

  return (
    <div className="terminal-modal-overlay" onClick={onClose}>
      <div className="terminal-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="terminal-modal-header">
          <h3>Terminal</h3>
          <button className="terminal-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="terminal-modal-body">
          <iframe
            src={terminalUrl}
            className="terminal-iframe"
            title="Terminal"
            frameBorder="0"
          />
        </div>
      </div>
    </div>
  );
};

export default TerminalModal;
