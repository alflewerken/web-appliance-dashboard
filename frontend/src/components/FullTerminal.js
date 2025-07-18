/**
 * FullTerminal Component - Full ANSI Terminal with SSH support
 * Uses xterm.js for real terminal emulation
 */

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { useTheme } from '@mui/material/styles';
import { useSettings } from '../hooks/useSettings';
import 'xterm/css/xterm.css';
import './FullTerminal.css';

const FullTerminal = ({ appliance, command, onClose, authToken }) => {
  const terminalRef = useRef(null);
  const terminal = useRef(null);
  const ws = useRef(null);
  const fitAddon = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const theme = useTheme();
  const { currentTheme } = useSettings();

  // Define terminal themes based on currentTheme
  const getTerminalTheme = () => {
    const isDarkMode = currentTheme === 'dark' || 
                      (currentTheme === 'auto' && theme.palette.mode === 'dark');
    
    if (!isDarkMode) {
      return {
        background: '#ffffff',
        foreground: '#000000',
        cursor: '#000000',
        cursorAccent: '#ffffff',
        cursorBlink: true,
        selection: 'rgba(0, 0, 0, 0.3)',
        black: '#000000',
        red: '#cd3131',
        green: '#00bc00',
        yellow: '#949800',
        blue: '#0451a5',
        magenta: '#bc05bc',
        cyan: '#0598bc',
        white: '#555555',
        brightBlack: '#686868',
        brightRed: '#cd3131',
        brightGreen: '#00bc00',
        brightYellow: '#949800',
        brightBlue: '#0451a5',
        brightMagenta: '#bc05bc',
        brightCyan: '#0598bc',
        brightWhite: '#a5a5a5',
      };
    } else {
      return {
        background: '#1a1a1a',
        foreground: '#ffffff',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        cursorBlink: true,
        selection: 'rgba(255, 255, 255, 0.3)',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      };
    }
  };

  // Update terminal theme when currentTheme changes
  useEffect(() => {
    if (terminal.current) {
      const newTheme = getTerminalTheme();
      terminal.current.options.theme = newTheme;
      // Force refresh to apply new theme
      terminal.current.refresh(0, terminal.current.rows - 1);
    }
  }, [currentTheme, theme.palette.mode]);

  useEffect(() => {
    // Initialize Terminal
    terminal.current = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", "Courier New", monospace',
      scrollback: 10000,
      tabStopWidth: 4,
      theme: getTerminalTheme(),
    });

    // Load addons
    fitAddon.current = new FitAddon();
    terminal.current.loadAddon(fitAddon.current);
    terminal.current.loadAddon(new WebLinksAddon());

    // Mount terminal
    if (terminalRef.current) {
      terminal.current.open(terminalRef.current);
      fitAddon.current.fit();
    }

    // WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/terminal-session`;

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setIsConnecting(false);
      setIsConnected(true);

      // Send initial connection data
      const initData = {
        type: 'init',
        applianceId: appliance.id,
        sshConnection: command.ssh_host_id
          ? {
              id: command.ssh_host_id,
              hostname: command.ssh_hostname,
              host: command.ssh_host,
              username: command.ssh_username,
              port: command.ssh_port,
            }
          : null,
        authToken,
      };

      ws.current.send(JSON.stringify(initData));

      // Send terminal size
      const { cols, rows } = terminal.current;
      ws.current.send(
        JSON.stringify({
          type: 'resize',
          cols,
          rows,
        })
      );
    };

    ws.current.onmessage = event => {
      const { data } = event;

      if (typeof data === 'string') {
        try {
          const message = JSON.parse(data);

          switch (message.type) {
            case 'connected':
              terminal.current.writeln(
                `\x1b[32m✓ Connected to ${message.hostname || 'local'}\x1b[0m\r\n`
              );

              // Pre-fill command if provided
              if (command && command.command) {
                terminal.current.write(command.command);
              }
              break;

            case 'error':
              terminal.current.writeln(`\r\n\x1b[31m✗ ${message.error}\x1b[0m`);
              break;

            default:
              // Raw terminal data
              terminal.current.write(data);
          }
        } catch (e) {
          // Not JSON, treat as raw terminal data
          terminal.current.write(data);
        }
      } else {
        // Binary data
        terminal.current.write(new Uint8Array(data));
      }
    };

    ws.current.onerror = error => {
      console.error('❌ WebSocket error:', error);
      setIsConnected(false);
      terminal.current.writeln('\r\n\x1b[31m✗ Connection error\x1b[0m');
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      terminal.current.writeln('\r\n\x1b[33m⚠ Connection closed\x1b[0m');
    };

    // Terminal input handler
    terminal.current.onData(data => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(
          JSON.stringify({
            type: 'input',
            data,
          })
        );
      }
    });

    // Handle resize
    terminal.current.onResize(({ cols, rows }) => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(
          JSON.stringify({
            type: 'resize',
            cols,
            rows,
          })
        );
      }
    });

    // Window resize handler
    const handleResize = () => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);

      if (terminal.current) {
        terminal.current.dispose();
      }

      if (ws.current) {
        ws.current.close();
      }
    };
  }, [appliance, command, authToken]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = e => {
      // Ctrl+C to copy
      if (e.ctrlKey && e.key === 'c' && terminal.current.hasSelection()) {
        e.preventDefault();
        navigator.clipboard.writeText(terminal.current.getSelection());
      }

      // Ctrl+V to paste
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        navigator.clipboard.readText().then(text => {
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(
              JSON.stringify({
                type: 'input',
                data: text,
              })
            );
          }
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="full-terminal-overlay" onClick={onClose}>
      <div
        className="full-terminal-container"
        onClick={e => e.stopPropagation()}
      >
        <div className="terminal-header">
          <div className="terminal-title">
            <span>Terminal - {appliance.name}</span>
            {command.ssh_host_id && command.ssh_hostname && (
              <span className="terminal-ssh-badge">
                SSH: {command.ssh_hostname}
              </span>
            )}
            <span
              className={`connection-status ${isConnected ? 'connected' : isConnecting ? 'connecting' : 'disconnected'}`}
            >
              {isConnected
                ? '● Connected'
                : isConnecting
                  ? '● Connecting...'
                  : '● Disconnected'}
            </span>
          </div>
          <div className="terminal-controls">
            <button
              onClick={() => fitAddon.current?.fit()}
              title="Fit to window"
            >
              ⊡
            </button>
            <button onClick={() => terminal.current?.clear()} title="Clear">
              🗑
            </button>
            <button onClick={onClose} className="close-btn">
              ✕
            </button>
          </div>
        </div>
        <div ref={terminalRef} className="terminal-body" />
      </div>
    </div>
  );
};

export default FullTerminal;
