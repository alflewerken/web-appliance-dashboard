/**
 * SimpleTerminal Component - Terminal interface without PTY
 * Uses a simple command execution model with colored output
 */

import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Command } from 'lucide-react';
import AnsiToHtml from 'ansi-to-html';
import './SimpleTerminal.css';

const ansiConverter = new AnsiToHtml({
  fg: '#FFF',
  bg: '#000',
  newline: true,
  escapeXML: true,
  stream: false,
});

const SimpleTerminal = ({ appliance, onClose, authToken }) => {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [output, setOutput] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const inputRef = useRef(null);
  const outputRef = useRef(null);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    // Scroll to bottom when new output is added
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const executeCommand = async cmd => {
    if (!cmd.trim()) return;

    setIsExecuting(true);

    // Add command to output
    setOutput(prev => [
      ...prev,
      {
        type: 'command',
        content: cmd,
        timestamp: new Date().toISOString(),
      },
    ]);

    // Add to history
    setHistory(prev => [...prev, cmd]);
    setHistoryIndex(-1);

    try {
      const response = await fetch(`/api/commands/execute-direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          command: cmd,
          applianceId: appliance.id,
        }),
      });

      const result = await response.json();

      // Convert ANSI to HTML
      const htmlOutput = ansiConverter.toHtml(
        result.output || result.error || ''
      );

      setOutput(prev => [
        ...prev,
        {
          type: result.success ? 'output' : 'error',
          content: result.output || result.error,
          htmlContent: htmlOutput,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      setOutput(prev => [
        ...prev,
        {
          type: 'error',
          content: `Error: ${error.message}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsExecuting(false);
      setCommand('');
    }
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeCommand(command);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCommand(history[history.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(history[history.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand('');
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setOutput([]);
    }
  };

  const clearTerminal = () => {
    setOutput([]);
  };

  return (
    <div className="simple-terminal-overlay" onClick={onClose}>
      <div
        className="simple-terminal-container"
        onClick={e => e.stopPropagation()}
      >
        <div className="simple-terminal-header">
          <div className="terminal-title">
            <Terminal size={16} />
            <span>Terminal - {appliance.name}</span>
          </div>
          <div className="terminal-controls">
            <button onClick={clearTerminal} title="Clear (Ctrl+L)">
              Clear
            </button>
            <button onClick={onClose} className="close-btn">
              ×
            </button>
          </div>
        </div>

        <div className="simple-terminal-body">
          <div ref={outputRef} className="terminal-output">
            {output.map((item, index) => (
              <div key={index} className={`output-item ${item.type}`}>
                {item.type === 'command' ? (
                  <div className="command-line">
                    <span className="prompt">$</span>
                    <span className="command-text">{item.content}</span>
                  </div>
                ) : (
                  <div
                    className="output-text"
                    dangerouslySetInnerHTML={{
                      __html: item.htmlContent || item.content,
                    }}
                  />
                )}
              </div>
            ))}
            {isExecuting && (
              <div className="output-item executing">
                <span className="spinner">⠋</span> Executing...
              </div>
            )}
          </div>

          <div className="terminal-input-line">
            <span className="prompt">$</span>
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={e => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isExecuting}
              placeholder="Enter command..."
              className="terminal-input"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleTerminal;
