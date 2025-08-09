/**
 * Simple Terminal WebSocket Handler
 * Provides basic terminal functionality for testing
 */

const WebSocket = require('ws');
let pty;
try {
  pty = require('node-pty');
} catch (error) {
  console.warn('node-pty not available, terminal websocket will use child_process instead');
}
const { spawn: childSpawn } = require('child_process');
const pool = require('../../utils/database');
const QueryBuilder = require('../../utils/QueryBuilder');
const jwt = require('jsonwebtoken');

// Initialize QueryBuilder
const db = new QueryBuilder(pool);

// Store active terminal sessions
const terminals = new Map();

/**
 * Setup WebSocket server for terminal sessions
 */
function setupTerminalWebSocket(server) {
  const wss = new WebSocket.Server({
    noServer: true,
    path: '/api/terminalSession',
  });

  // Handle WebSocket upgrade
  server.on('upgrade', (request, socket, head) => {
    console.log('WebSocket upgrade request:', request.url);
    if (
      request.url === '/api/terminalSession' ||
      request.url.startsWith('/api/terminalSession')
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
            const appliances = await db.select('appliances', { id: data.applianceId });
            const appliance = appliances[0];

            if (!appliance) {
              ws.send(
                JSON.stringify({ type: 'error', error: 'Appliance not found' })
              );
              ws.close();
              return;
            }

            // Create PTY process or fallback to child_process
            if (pty) {
              ptyProcess = pty.spawn('/bin/bash', [], {
                name: 'xterm-color',
                cols: 80,
                rows: 30,
                cwd: process.env.HOME,
                env: process.env,
              });
            } else {
              // Fallback to child_process for ARM64 compatibility
              ptyProcess = childSpawn('/bin/bash', [], {
                cwd: process.env.HOME,
                env: process.env,
                stdio: ['pipe', 'pipe', 'pipe']
              });
              
              // Simulate PTY interface
              ptyProcess.write = (data) => ptyProcess.stdin.write(data);
              ptyProcess.resize = () => {}; // No-op for regular process
            }

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
            if (pty) {
              ptyProcess.on('data', data => {
                ws.send(data);
              });
            } else {
              // Handle stdout for child_process
              ptyProcess.stdout.on('data', data => {
                ws.send(data.toString());
              });
              ptyProcess.stderr.on('data', data => {
                ws.send(data.toString());
              });
            }

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
