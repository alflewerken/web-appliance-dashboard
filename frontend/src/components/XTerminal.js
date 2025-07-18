/**
 * XTerminal Component - Professional Terminal Emulator
 * Uses xterm.js for full terminal emulation with color support
 */

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { useTheme } from '@mui/material/styles';
import { useSettings } from '../hooks/useSettings';
import 'xterm/css/xterm.css';
import './XTerminal.css';

const XTerminal = ({
  applianceId,
  applianceName,
  hostId,
  hostInfo,
  isSSH,
  sessionId,
  onClose,
  onError,
  authToken,
  initialCommand,
}) => {
  const terminalRef = useRef(null);
  const terminal = useRef(null);
  const ws = useRef(null);
  const fitAddon = useRef(null);
  const searchAddon = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const theme = useTheme();
  const { currentTheme } = useSettings();

  // Define terminal themes based on MUI theme and currentTheme
  const getTerminalTheme = () => {
    // Check currentTheme from settings first, then fall back to MUI theme
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
        // ANSI colors for light theme
        black: '#000000',
        red: '#cd3131',
        green: '#00bc00',
        yellow: '#949800',
        blue: '#0451a5',
        magenta: '#bc05bc',
        cyan: '#0598bc',
        white: '#555555',
        // Bright ANSI colors for light theme
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
        // ANSI colors for dark theme
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        // Bright ANSI colors for dark theme
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
      allowProposedApi: true,
      windowOptions: {
        setWinSizePixels: true,
      },
      theme: getTerminalTheme(),
    });

    // Load addons
    fitAddon.current = new FitAddon();
    searchAddon.current = new SearchAddon();
    terminal.current.loadAddon(fitAddon.current);
    terminal.current.loadAddon(searchAddon.current);
    terminal.current.loadAddon(new WebLinksAddon());

    // Mount terminal
    if (terminalRef.current) {
      terminal.current.open(terminalRef.current);

      // Force a layout reflow to ensure dimensions are calculated
      terminalRef.current.style.height = '100%';

      // Initial fit with multiple attempts to ensure proper sizing
      const performFit = () => {
        if (fitAddon.current) {
          try {
            fitAddon.current.fit();
            const dims = fitAddon.current.proposeDimensions();
            if (dims) {
              }
          } catch (error) {
            console.error('Error fitting terminal:', error);
          }
        }
      };

      // Immediate fit
      performFit();

      // Delayed fits to handle any async rendering issues
      setTimeout(performFit, 50);
      setTimeout(performFit, 100);
      setTimeout(performFit, 250);
    }

    // WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/terminal-session`;

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setIsConnecting(false);
      setIsConnected(true);

      // Send init message with auth token and appliance/host info
      const initData = {
        type: 'init',
        authToken,
      };

      // Add SSH host info if this is an SSH connection
      if (isSSH && hostInfo) {
        initData.isSSH = true;
        initData.hostId = hostId;
        initData.sshHost = {
          id: hostInfo.id,
          hostname: hostInfo.hostname,
          host: hostInfo.host,
          username: hostInfo.username,
          port: hostInfo.port || 22,
        };
      } else if (applianceId) {
        // Only add applianceId if it's NOT an SSH connection
        initData.applianceId = applianceId;
      }

      console.log('Sending init data:', initData);
      ws.current.send(JSON.stringify(initData));
    };

    ws.current.onmessage = event => {
      const { data } = event;

      if (typeof data === 'string') {
        try {
          const message = JSON.parse(data);

          switch (message.type) {
            case 'connected':
              terminal.current.writeln(
                `\r\n\x1b[32m✅ Connected to ${message.hostname || 'local'}\x1b[0m`
              );
              if (message.metadata?.applianceName) {
                terminal.current.writeln(
                  `\x1b[36m📋 Terminal ready for ${message.metadata.applianceName}\x1b[0m`
                );
                if (message.metadata?.username && message.metadata?.host) {
                  terminal.current.writeln(
                    `\x1b[33m👤 ${message.metadata.username}@${message.metadata.host}:${message.metadata.port || 22}\x1b[0m\r\n`
                  );
                }
              }

              // If initial command provided, copy to clipboard
              if (initialCommand) {
                try {
                  navigator.clipboard
                    .writeText(initialCommand)
                    .then(() => {
                      terminal.current.writeln(
                        `\x1b[33m📋 Command copied to clipboard. Press Ctrl+V (or Cmd+V) to paste:\x1b[0m`
                      );
                      terminal.current.writeln(
                        `\x1b[36m   ${initialCommand}\x1b[0m\r\n`
                      );
                    })
                    .catch(err => {
                      console.error('Failed to copy command:', err);
                      terminal.current.writeln(
                        `\x1b[31m❌ Could not copy command to clipboard\x1b[0m\r\n`
                      );
                    });
                } catch (err) {
                  console.error('Clipboard API not available:', err);
                  terminal.current.writeln(
                    `\x1b[31m❌ Clipboard access not available\x1b[0m\r\n`
                  );
                }
              }
              break;

            case 'output':
              terminal.current.write(message.data);
              // Remove all the auto-typing logic
              break;

            case 'error':
              terminal.current.writeln(
                `\r\n\x1b[31m❌ ${message.error || message.data}\x1b[0m`
              );
              break;

            case 'info':
              terminal.current.writeln(`\r\n\x1b[33m💡 ${message.data}\x1b[0m`);
              break;

            case 'pong':
              // Keep-alive response
              break;

            default:
              // If it's not a recognized message type, treat as raw output
              terminal.current.write(data);
          }
        } catch (error) {
          // If it's not JSON, write it as raw terminal output
          terminal.current.write(data);
        }
      } else {
        // Binary data or other types
        terminal.current.write(data);
      }
    };

    ws.current.onerror = error => {
      console.error('❌ WebSocket error:', error);
      setIsConnected(false);
      terminal.current.writeln('\r\n\x1b[31m❌ Connection error\x1b[0m');
      if (onError) {
        onError('WebSocket connection failed');
      }
    };

    ws.current.onclose = event => {
      setIsConnected(false);
      terminal.current.writeln('\r\n\x1b[33m🔌 Connection closed\x1b[0m');
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
      if (fitAddon.current && terminal.current) {
        try {
          // Fit the terminal to the container
          fitAddon.current.fit();

          // Get the new dimensions
          const dims = fitAddon.current.proposeDimensions();
          if (dims) {
            }
        } catch (error) {
          console.error('Error during terminal resize:', error);
        }
      }
    };
    window.addEventListener('resize', handleResize);

    // ResizeObserver for container size changes
    let resizeObserver;
    if (terminalRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(entries => {
        // Use requestAnimationFrame for smoother resizing
        window.requestAnimationFrame(() => {
          if (fitAddon.current && terminal.current) {
            try {
              fitAddon.current.fit();
              const dims = fitAddon.current.proposeDimensions();
              if (dims) {
                }
            } catch (error) {
              console.error('Error during ResizeObserver fit:', error);
            }
          }
        });
      });
      resizeObserver.observe(terminalRef.current);
    }

    // Keep-alive ping every 30 seconds
    const pingInterval = setInterval(() => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    // Cleanup
    return () => {
      clearInterval(pingInterval);
      window.removeEventListener('resize', handleResize);

      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      if (terminal.current) {
        terminal.current.dispose();
      }

      if (ws.current) {
        ws.current.close();
      }
    };
  }, [applianceId, sessionId, authToken]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = e => {
      // Ctrl+Shift+F for search
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        if (searchAddon.current) {
          searchAddon.current.findNext(prompt('Search:'));
        }
      }

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
    <div className="xterminal-container">
      <div className="xterminal-header">
        <div className="xterminal-title">
          <span className="terminal-icon">💻</span>
          <span>{applianceName || 'Terminal'}</span>
          <span
            className={`connection-indicator ${isConnected ? 'connected' : isConnecting ? 'connecting' : 'disconnected'}`}
          >
            {isConnected
              ? '● Connected'
              : isConnecting
                ? '● Connecting...'
                : '● Disconnected'}
          </span>
        </div>
        <div className="xterminal-controls">
          <button
            className="terminal-button"
            onClick={() => {
              if (fitAddon.current && terminal.current) {
                fitAddon.current.fit();
                // Force a re-render
                terminal.current.refresh(0, terminal.current.rows - 1);
              }
            }}
            title="Fit to window"
          >
            ⊡
          </button>
          <button
            className="terminal-button"
            onClick={() => terminal.current?.clear()}
            title="Clear terminal"
          >
            🗑️
          </button>
          <button
            className="terminal-button close"
            onClick={onClose}
            title="Close terminal"
          >
            ✕
          </button>
        </div>
      </div>
      <div
        ref={terminalRef}
        className="xterminal-body xterm-container"
        style={{ position: 'relative', width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default XTerminal;
