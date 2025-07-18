/**
 * Terminal Session WebSocket Handler
 * Simple implementation that executes commands directly
 */

const WebSocket = require('ws');
const { spawn, exec } = require('child_process');
const pool = require('./database');
const jwt = require('jsonwebtoken');
const { getSSHConnection } = require('./ssh');

// Store active terminal sessions
const terminalSessions = new Map();

/**
 * Setup WebSocket server for terminal sessions
 */
function setupTerminalWebSocket(server) {
  const wss = new WebSocket.Server({
    noServer: true,
    path: '/api/terminal-session',
  });

  // Handle WebSocket upgrade
  server.on('upgrade', (request, socket, head) => {
    console.log('WebSocket upgrade request:', request.url);
    if (
      request.url === '/api/terminal-session' ||
      request.url.startsWith('/api/terminal-session')
    ) {
      wss.handleUpgrade(request, socket, head, ws => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async ws => {
    let sessionId = null;
    const commandBuffer = '';
    let sshConnectionId = null;
    let applianceId = null;

    ws.on('message', async message => {
      try {
        const data = JSON.parse(message);

        switch (data.type) {
          case 'init':
            console.log(
              'Terminal init received:',
              JSON.stringify(data, null, 2)
            );

            // Verify auth token
            try {
              const decoded = jwt.verify(
                data.authToken,
                process.env.JWT_SECRET ||
                  'your-secret-key-change-this-in-production'
              );
              sessionId = `${decoded.id}-${Date.now()}`;
            } catch (err) {
              console.error('Auth verification failed:', err);
              ws.send(
                JSON.stringify({
                  type: 'error',
                  error: 'Authentication failed',
                })
              );
              ws.close();
              return;
            }

            // Store appliance and SSH info
            applianceId = data.applianceId;
            
            // Check if this is an SSH host terminal (format: ssh_host_123)
            let isSSHHost = false;
            let sshHostId = null;
            
            if (applianceId && applianceId.toString().startsWith('ssh_host_')) {
              isSSHHost = true;
              sshHostId = applianceId.toString().replace('ssh_host_', '');
              console.log('SSH Host Terminal detected, host ID:', sshHostId);
            } else if (data.sshConnection && data.sshConnection.id) {
              sshConnectionId = data.sshConnection.id;
            }

            // Handle SSH Host terminals differently
            if (isSSHHost) {
              // Get SSH host details
              const [sshHosts] = await pool.execute(
                'SELECT * FROM ssh_hosts WHERE id = ? AND is_active = TRUE',
                [sshHostId]
              );
              const sshHost = sshHosts[0];
              
              if (!sshHost) {
                ws.send(
                  JSON.stringify({ type: 'error', error: 'SSH Host not found' })
                );
                ws.close();
                return;
              }
              
              // Set the SSH connection ID for this host
              sshConnectionId = sshHostId;
              
              // Send connection info specific to SSH host
              ws.send(
                JSON.stringify({
                  type: 'connected',
                  hostname: sshHost.hostname || sshHost.host,
                  metadata: {
                    applianceName: sshHost.hostname,
                    username: sshHost.username,
                    host: sshHost.host,
                    port: sshHost.port
                  }
                })
              );
            } else {
              // Normal appliance handling
              const [appliances] = await pool.execute(
                'SELECT * FROM appliances WHERE id = ?',
                [applianceId]
              );
              const appliance = appliances[0];

              if (!appliance) {
                ws.send(
                  JSON.stringify({ type: 'error', error: 'Appliance not found' })
                );
                ws.close();
                return;
              }
              
              // Send connection success
              if (sshConnectionId) {
                const [sshHosts] = await pool.execute(
                  'SELECT * FROM ssh_hosts WHERE id = ?',
                  [sshConnectionId]
                );
                const sshHost = sshHosts[0];

                ws.send(
                  JSON.stringify({
                    type: 'connected',
                    hostname: sshHost ? sshHost.hostname : 'unknown',
                  })
                );
              } else {
                ws.send(
                  JSON.stringify({
                    type: 'connected',
                    hostname: 'local',
                  })
                );
              }
            }

            // Send initial prompt
            ws.send('\x1b[32m$\x1b[0m ');

            // Store session
            terminalSessions.set(sessionId, {
              commandBuffer: '',
              sshConnectionId,
              applianceId,
            });

            break;

          case 'input':
            const session = terminalSessions.get(sessionId);
            if (!session) break;

            const char = data.data;

            if (char === '\r' || char === '\n') {
              // Execute command
              const command = session.commandBuffer.trim();

              if (command) {
                ws.send('\r\n');

                try {
                  if (session.sshConnectionId) {
                    // Execute via SSH using existing infrastructure
                    const sshConnection = await getSSHConnection(
                      session.sshConnectionId
                    );

                    // Execute command
                    const result = await sshConnection.exec(command, {
                      stream: 'both',
                      env: {
                        TERM: 'xterm-256color',
                        FORCE_COLOR: '1',
                        COLORTERM: 'truecolor',
                      },
                    });

                    // Send output
                    if (result.stdout) {
                      ws.send(result.stdout);
                    }
                    if (result.stderr) {
                      ws.send(`\x1b[31m${result.stderr}\x1b[0m`);
                    }
                  } else {
                    // Local execution
                    exec(
                      command,
                      {
                        env: {
                          ...process.env,
                          TERM: 'xterm-256color',
                          FORCE_COLOR: '1',
                          COLORTERM: 'truecolor',
                        },
                      },
                      (error, stdout, stderr) => {
                        if (stdout) {
                          ws.send(stdout);
                        }
                        if (stderr) {
                          ws.send(`\x1b[31m${stderr}\x1b[0m`);
                        }
                        if (error && !stderr) {
                          ws.send(`\x1b[31mError: ${error.message}\x1b[0m\r\n`);
                        }
                        ws.send('\r\n\x1b[32m$\x1b[0m ');
                      }
                    );

                    // Don't send prompt here for async exec
                    session.commandBuffer = '';
                    return;
                  }
                } catch (error) {
                  ws.send(`\x1b[31mError: ${error.message}\x1b[0m\r\n`);
                }

                ws.send('\r\n\x1b[32m$\x1b[0m ');
              } else {
                ws.send('\r\n\x1b[32m$\x1b[0m ');
              }

              session.commandBuffer = '';
            } else if (char === '\x7f' || char === '\b') {
              // Backspace
              if (session.commandBuffer.length > 0) {
                session.commandBuffer = session.commandBuffer.slice(0, -1);
                ws.send('\b \b');
              }
            } else if (char === '\x03') {
              // Ctrl+C - cancel current input
              ws.send('^C\r\n\x1b[32m$\x1b[0m ');
              session.commandBuffer = '';
            } else if (char >= ' ' && char <= '~') {
              // Printable character
              session.commandBuffer += char;
              ws.send(char);
            }
            break;

          case 'resize':
            // Handle resize if needed
            break;
        }
      } catch (error) {
        console.error('Terminal message error:', error);
        ws.send(
          JSON.stringify({
            type: 'error',
            error: error.message,
          })
        );
      }
    });

    ws.on('close', () => {
      if (sessionId) {
        terminalSessions.delete(sessionId);
      }
    });
  });

  return wss;
}

module.exports = {
  setupTerminalWebSocket,
};
