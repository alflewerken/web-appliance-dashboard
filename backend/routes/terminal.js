/**
 * Terminal WebSocket Route
 * Handles WebSocket connections for terminal sessions
 */

const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const terminalManager = require('../utils/terminal/terminal-manager');
const { createAuditLog } = require('../utils/auditLogger');

// Hilfsfunktion zum Parsen der SSH-Konfiguration
function parseSSHConfig(appliance) {
  if (!appliance.ssh_connection) return null;

  try {
    // Format: username@host:port
    const match = appliance.ssh_connection.match(/^(.+)@(.+):(\d+)$/);
    if (match) {
      return {
        username: match[1],
        host: match[2],
        port: parseInt(match[3], 10),
        keyPath: appliance.ssh_key_path || '~/.ssh/id_rsa_dashboard',
      };
    }
  } catch (error) {
    console.error('Error parsing SSH config:', error);
  }

  return null;
}

// REST API für Terminal-Management
router.get('/sessions', async (req, res) => {
  try {
    const sessions = terminalManager.getActiveSessions();
    res.json({ sessions });
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    terminalManager.destroySession(sessionId);

    res.json({ message: 'Session destroyed' });
  } catch (error) {
    console.error('Error destroying session:', error);
    res.status(500).json({ error: 'Failed to destroy session' });
  }
});

// WebSocket handler muss außerhalb definiert werden
function handleTerminalWebSocket(ws, req) {
  const { applianceId } = req.params;
  const sessionId =
    req.query.sessionId ||
    `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const userId = req.user?.id || null;
  const ipAddress = req.clientIp;

  console.log(
    `🔌 New terminal WebSocket connection for appliance ${applianceId}, session ${sessionId}`
  );

  let session = null;
  let applianceData = null;

  // Async operations in einem Promise wrapper
  (async () => {
    try {
      // Hole Appliance-Details aus der Datenbank
      const [rows] = await pool.execute(
        'SELECT * FROM appliances WHERE id = ?',
        [applianceId]
      );

      if (rows.length === 0) {
        ws.send(
          JSON.stringify({
            type: 'error',
            data: 'Appliance not found',
          })
        );
        ws.close();
        return;
      }

      applianceData = rows[0];
      const sshConfig = parseSSHConfig(applianceData);

      // Erstelle Terminal-Session
      session = terminalManager.createSession(sessionId, applianceId, {
        metadata: {
          applianceName: applianceData.name,
          userId,
          ipAddress,
        },
        sshConfig,
        cols: 80,
        rows: 30,
      });

      // Sende initiale Willkommensnachricht
      ws.send(
        JSON.stringify({
          type: 'connected',
          data: `Connected to terminal for ${applianceData.name}`,
          sessionId,
          metadata: {
            applianceName: applianceData.name,
            hasSSH: !!sshConfig,
          },
        })
      );

      // PTY Output Handler
      session.onData(data => {
        try {
          if (ws.readyState === ws.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'output',
                data,
              })
            );
          }
        } catch (error) {
          console.error('Error sending PTY data:', error);
        }
      });

      // WebSocket Message Handler
      ws.on('message', async msg => {
        try {
          const message = JSON.parse(msg);

          switch (message.type) {
            case 'input':
              // Schreibe Input zum Terminal
              terminalManager.writeToSession(sessionId, message.data);
              break;

            case 'resize':
              // Resize Terminal
              if (message.cols && message.rows) {
                terminalManager.resizeSession(
                  sessionId,
                  message.cols,
                  message.rows
                );
              }
              break;

            case 'command':
              // Führe speziellen Befehl aus
              terminalManager.executeCommand(sessionId, message.command);

              // Audit-Log für spezielle Befehle
              await createAuditLog(
                userId,
                'terminal_command',
                'appliances',
                parseInt(applianceId),
                {
                  name: applianceData.name,
                  sessionId,
                  command: message.command,
                  applianceName: applianceData.name,
                  appliance_name: applianceData.name,
                },
                null, // ipAddress
                applianceData.name // resourceName
              );
              break;

            case 'ping':
              // Keep-alive ping
              ws.send(JSON.stringify({ type: 'pong' }));
              break;

            default:
              console.warn(`Unknown message type: ${message.type}`);
          }
        } catch (error) {
          console.error('Terminal message error:', error);
          ws.send(
            JSON.stringify({
              type: 'error',
              data: 'Invalid message format',
            })
          );
        }
      });

      // Error Handler
      ws.on('error', error => {
        console.error(`WebSocket error for session ${sessionId}:`, error);
      });

      // Cleanup bei Disconnect
      ws.on('close', async () => {
        console.log(`🔌 Terminal WebSocket closed for session ${sessionId}`);

        // Zerstöre Terminal-Session
        if (session) {
          terminalManager.destroySession(sessionId);
        }

        // Audit-Log für Session-Ende
        await createAuditLog(
          userId,
          'terminal_disconnect',
          'appliances',
          parseInt(applianceId),
          {
            name: applianceData?.name || 'Unknown',
            sessionId,
            applianceName: applianceData?.name || 'Unknown',
            appliance_name: applianceData?.name || 'Unknown',
          },
          null, // ipAddress
          applianceData?.name || 'Terminal' // resourceName
        );
      });
    } catch (error) {
      console.error('Terminal WebSocket setup error:', error);
      ws.send(
        JSON.stringify({
          type: 'error',
          data: `Failed to setup terminal: ${error.message}`,
        })
      );
      ws.close();
    }
  })();
}

module.exports = {
  router,
  handleTerminalWebSocket,
};
