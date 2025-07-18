/**
 * Simple Terminal WebSocket Handler
 * Provides basic terminal functionality for testing
 */

const WebSocket = require('ws');
const { spawn } = require('node-pty');
const pool = require('../../utils/database');
const jwt = require('jsonwebtoken');

// Store active terminal sessions
const terminals = new Map();

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
    console.log('Terminal WebSocket connection established');
    let ptyProcess = null;
    let sessionId = null;

    ws.on('message', async message => {
      try {
        const data = JSON.parse(message);
        console.log('Terminal message received:', data.type);

        switch (data.type) {
          case 'init':
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

            // Get appliance details
            const [appliances] = await pool.execute(
              'SELECT * FROM appliances WHERE id = ?',
              [data.applianceId]
            );
            const appliance = appliances[0];

            if (!appliance) {
              ws.send(
                JSON.stringify({ type: 'error', error: 'Appliance not found' })
              );
              ws.close();
              return;
            }

            // Create PTY process
            ptyProcess = spawn('/bin/bash', [], {
              name: 'xterm-color',
              cols: 80,
              rows: 30,
              cwd: process.env.HOME,
              env: process.env,
            });

            // Store session
            terminals.set(sessionId, {
              ptyProcess,
              ws,
              applianceId: data.applianceId,
            });

            // Send connection success
            ws.send(
              JSON.stringify({
                type: 'connected',
                hostname: 'local',
              })
            );

            // Handle PTY output
            ptyProcess.on('data', data => {
              ws.send(data);
            });

            break;

          case 'input':
            if (ptyProcess) {
              ptyProcess.write(data.data);
            }
            break;

          case 'resize':
            if (ptyProcess && data.cols && data.rows) {
              ptyProcess.resize(data.cols, data.rows);
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
      if (ptyProcess) {
        ptyProcess.kill();
      }
      if (sessionId) {
        terminals.delete(sessionId);
      }
    });
  });

  return wss;
}

module.exports = {
  setupTerminalWebSocket,
};
