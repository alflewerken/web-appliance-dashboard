/**
 * SSH Terminal WebSocket Handler
 * Provides real SSH terminal functionality with proper host connection
 * Uses child_process spawn with shell for better PTY emulation
 */

const WebSocket = require('ws');
const { spawn } = require('child_process');
const pool = require('../../utils/database');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs').promises;

// Store active terminal sessions
const terminals = new Map();

/**
 * Get SSH connection details for an appliance or direct SSH host
 */
async function getSSHConnectionDetails(applianceId) {
  try {
    // Check if this is a direct SSH host connection
    if (
      typeof applianceId === 'string' &&
      applianceId.startsWith('ssh_host_')
    ) {
      const hostId = applianceId.replace('ssh_host_', '');

      // Get SSH host details directly
      const [sshHosts] = await pool.execute(
        `
        SELECT * FROM ssh_hosts WHERE id = ?
      `,
        [hostId]
      );

      if (!sshHosts.length) {
        throw new Error('SSH host not found');
      }

      const sshHost = sshHosts[0];

      return {
        host: sshHost.host,
        port: sshHost.port || 22,
        username: sshHost.username,
        keyName: sshHost.key_name,
        applianceName:
          sshHost.hostname || `${sshHost.username}@${sshHost.host}`,
      };
    }

    // Otherwise, get appliance details as before
    const [appliances] = await pool.execute(
      `
      SELECT * FROM appliances WHERE id = ?
    `,
      [applianceId]
    );

    if (!appliances.length || !appliances[0].ssh_connection) {
      throw new Error('No SSH connection configured for this appliance');
    }

    const appliance = appliances[0];
    const sshConnectionString = appliance.ssh_connection;

    // Parse the connection string format: username@host:port
    const match = sshConnectionString.match(/^(.+)@(.+):(\d+)$/);
    if (!match) {
      throw new Error('Invalid SSH connection format');
    }

    const [, username, host, port] = match;

    // Try to find matching SSH host to get the key name
    const [sshHosts] = await pool.execute(
      `
      SELECT * FROM ssh_hosts 
      WHERE host = ? AND username = ? AND port = ?
      LIMIT 1
    `,
      [host, username, port]
    );

    if (!sshHosts.length) {
      throw new Error('SSH host configuration not found');
    }

    const sshHost = sshHosts[0];

    return {
      host: sshHost.host,
      port: sshHost.port || 22,
      username: sshHost.username,
      keyName: sshHost.key_name,
      applianceName: appliance.name,
    };
  } catch (error) {
    console.error('Error getting SSH connection details:', error);
    throw error;
  }
}

/**
 * Setup WebSocket server for SSH terminal sessions
 */
function setupSSHTerminalWebSocket(server) {
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
    console.log('SSH Terminal WebSocket connection established');
    let sshProcess = null;
    let sessionId = null;
    let sshConnection = null;
    const inputBuffer = '';
    let isAuthenticated = false;

    ws.on('message', async message => {
      try {
        const data = JSON.parse(message);
        console.log('Terminal message received:', data.type);

        switch (data.type) {
          case 'init':
            console.log('Init message received:', JSON.stringify(data, null, 2));
            
            // Verify auth token
            try {
              const decoded = jwt.verify(
                data.authToken,
                process.env.JWT_SECRET ||
                  'your-secret-key-change-this-in-production'
              );
              sessionId = `${decoded.id}-${Date.now()}`;
              isAuthenticated = true;
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

            try {
              // Get SSH connection details
              console.log('Checking SSH mode - isSSH:', data.isSSH, 'sshHost:', data.sshHost);
              if (data.isSSH && data.sshHost) {
                // Direct SSH host connection
                sshConnection = {
                  host: data.sshHost.host,
                  port: data.sshHost.port || 22,
                  username: data.sshHost.username,
                  keyName: 'dashboard', // Default key name for SSH hosts
                  applianceName: data.sshHost.hostname,
                };
                
                // Verify the SSH host exists in database
                const [sshHosts] = await pool.execute(
                  `SELECT * FROM ssh_hosts WHERE id = ? AND is_active = 1`,
                  [data.sshHost.id]
                );
                
                if (sshHosts.length > 0) {
                  sshConnection.keyName = sshHosts[0].key_name;
                }
              } else if (data.applianceId) {
                // Appliance connection
                sshConnection = await getSSHConnectionDetails(data.applianceId);
              } else {
                throw new Error('No connection target specified (neither SSH host nor appliance)');
              }
              console.log('SSH Connection details:', sshConnection);

              // Check if SSH key exists
              const keyPath = `/root/.ssh/id_rsa_${sshConnection.keyName}`;
              try {
                await fs.access(keyPath);
              } catch (error) {
                ws.send(
                  JSON.stringify({
                    type: 'error',
                    error: `SSH key not found: ${sshConnection.keyName}`,
                  })
                );
                ws.close();
                return;
              }

              // Build SSH command with full PTY support
              const sshCommand = `ssh -tt -o RequestTTY=force -i ${keyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=QUIET -o ConnectTimeout=10 -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -p ${sshConnection.port} ${sshConnection.username}@${sshConnection.host}`;

              console.log('Spawning SSH with PTY support using script command');

              // Use script command to force PTY allocation (Alpine Linux compatible)
              sshProcess = spawn('script', ['-qfc', sshCommand, '/dev/null'], {
                env: {
                  ...process.env,
                  TERM: 'xterm-256color',
                  LANG: 'en_US.UTF-8',
                  LC_ALL: 'en_US.UTF-8',
                  COLUMNS: '80',
                  LINES: '24',
                },
                stdio: ['pipe', 'pipe', 'pipe'],
              });

              // Store session
              terminals.set(sessionId, {
                sshProcess,
                ws,
                applianceId: data.applianceId,
                sshConnection,
              });

              // Send connection success with metadata
              ws.send(
                JSON.stringify({
                  type: 'connected',
                  hostname: sshConnection.host,
                  metadata: {
                    applianceName: sshConnection.applianceName,
                    username: sshConnection.username,
                    host: sshConnection.host,
                    port: sshConnection.port,
                  },
                })
              );

              // Handle SSH stdout
              sshProcess.stdout.on('data', data => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(
                    JSON.stringify({
                      type: 'output',
                      data: data.toString('utf8'),
                    })
                  );
                }
              });

              // Handle SSH stderr
              sshProcess.stderr.on('data', data => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(
                    JSON.stringify({
                      type: 'output',
                      data: data.toString('utf8'),
                    })
                  );
                }
              });

              // Handle SSH exit
              sshProcess.on('exit', (exitCode, signal) => {
                console.log(
                  `SSH process exited with code ${exitCode}, signal ${signal}`
                );
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(
                    JSON.stringify({
                      type: 'error',
                      error: `SSH connection closed (exit code: ${exitCode})`,
                    })
                  );
                  ws.close();
                }
                terminals.delete(sessionId);
              });

              // Handle SSH error
              sshProcess.on('error', error => {
                console.error('SSH process error:', error);
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(
                    JSON.stringify({
                      type: 'error',
                      error: `SSH error: ${error.message}`,
                    })
                  );
                  ws.close();
                }
              });
            } catch (error) {
              console.error('Failed to establish SSH connection:', error);
              ws.send(
                JSON.stringify({
                  type: 'error',
                  error: `Failed to connect: ${error.message}`,
                })
              );
              ws.close();
              return;
            }
            break;

          case 'input':
            if (sshProcess && sshProcess.stdin) {
              sshProcess.stdin.write(data.data);
            }
            break;

          case 'resize':
            // Send resize escape sequence to the terminal
            if (sshProcess && sshProcess.stdin && data.cols && data.rows) {
              // Send terminal resize escape sequence
              const resizeSequence = `\x1b[8;${data.rows};${data.cols}t`;
              sshProcess.stdin.write(resizeSequence);
            }
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
        }
      } catch (error) {
        console.error('Terminal WebSocket error:', error);
        ws.send(JSON.stringify({ type: 'error', error: error.message }));
      }
    });

    ws.on('close', () => {
      console.log('Terminal WebSocket closed');
      if (sshProcess) {
        try {
          sshProcess.kill('SIGTERM');
        } catch (error) {
          console.error('Error killing SSH process:', error);
        }
      }
      if (sessionId) {
        terminals.delete(sessionId);
      }
    });

    ws.on('error', error => {
      console.error('WebSocket error:', error);
    });
  });

  return wss;
}

// Cleanup function for graceful shutdown
function cleanupTerminals() {
  console.log('Cleaning up active terminal sessions...');
  for (const [sessionId, session] of terminals) {
    try {
      if (session.sshProcess) {
        session.sshProcess.kill('SIGTERM');
      }
      if (session.ws && session.ws.readyState === WebSocket.OPEN) {
        session.ws.close();
      }
    } catch (error) {
      console.error(`Error cleaning up session ${sessionId}:`, error);
    }
  }
  terminals.clear();
}

// Handle process termination
process.on('SIGINT', cleanupTerminals);
process.on('SIGTERM', cleanupTerminals);

module.exports = {
  setupSSHTerminalWebSocket,
  cleanupTerminals,
};
