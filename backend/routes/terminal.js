/**
 * Terminal WebSocket Route - Using QueryBuilder
 * Handles WebSocket connections for terminal sessions
 */

const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');
const terminalManager = require('../utils/terminal/terminal-manager');
const { createAuditLog } = require('../utils/auditLogger');

// Initialize QueryBuilder
const db = new QueryBuilder(pool);

// Hilfsfunktion zum Parsen der SSH-Konfiguration
function parseSSHConfig(appliance) {
  if (!appliance.sshConnection) return null;

  try {
    // Format: username@host:port
    const match = appliance.sshConnection.match(/^(.+)@(.+):(\d+)$/);
    if (match) {
      return {
        username: match[1],
        host: match[2],
        port: parseInt(match[3], 10),
        keyPath: appliance.sshKeyPath || '~/.ssh/id_rsa_dashboard',
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

  let session = null;
  let applianceData = null;

  // Async operations in einem Promise wrapper
  (async () => {
    try {
      // Hole Appliance-Details aus der Datenbank mit QueryBuilder
      applianceData = await db.findOne('appliances', { id: applianceId });

      if (!applianceData) {
        ws.send(
          JSON.stringify({
            type: 'error',
            data: 'Appliance not found',
          })
        );
        ws.close();
        return;
      }

      const sshConfig = parseSSHConfig(applianceData);

      // Erstelle Terminal-Session
      session = terminalManager.createSession(sessionId, applianceId, {
        metadata: {
          applianceName: applianceData.name,
          userId,
          ipAddress,
        },
        sshConfig,
        onData: (data) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'data', data }));
          }
        },
        onError: (error) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'error', data: error.message }));
          }
        },
        onClose: () => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'close' }));
            ws.close();
          }
        },
      });

      // Erfolgsmeldung senden
      ws.send(
        JSON.stringify({
          type: 'connected',
          sessionId,
          applianceName: applianceData.name,
        })
      );

      // Create audit log for terminal session start
      await createAuditLog(
        userId,
        'terminal_session_start',
        'appliances',
        applianceId,
        {
          session_id: sessionId,
          appliance_name: applianceData.name,
          ssh_connection: applianceData.sshConnection || 'local',
        },
        ipAddress
      );
    } catch (error) {
      console.error('Error setting up terminal session:', error);
      ws.send(
        JSON.stringify({
          type: 'error',
          data: `Failed to initialize terminal: ${error.message}`,
        })
      );
      ws.close();
    }
  })();

  // WebSocket message handler
  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);

      if (!session || !session.isActive()) {
        ws.send(JSON.stringify({ type: 'error', data: 'Session not active' }));
        return;
      }

      switch (msg.type) {
        case 'data':
        case 'input':
          session.write(msg.data);
          break;

        case 'resize':
          if (msg.cols && msg.rows) {
            session.resize(msg.cols, msg.rows);
          }
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        default:

      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  });

  // WebSocket close handler
  ws.on('close', async () => {

    if (session) {
      // Create audit log for terminal session end
      try {
        await createAuditLog(
          userId,
          'terminal_session_end',
          'appliances',
          applianceId,
          {
            session_id: sessionId,
            appliance_name: applianceData?.name || 'Unknown',
            duration_seconds: session.getDuration(),
          },
          ipAddress
        );
      } catch (error) {
        console.error('Error creating audit log:', error);
      }

      session.destroy();
    }
  });

  // WebSocket error handler
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    if (session) {
      session.destroy();
    }
  });
}

// Terminal health check endpoint
router.get('/health', (req, res) => {
  const stats = terminalManager.getStats();
  res.json({
    status: 'ok',
    ...stats,
  });
});

// Export both router and WebSocket handler
module.exports = {
  router,
  handleTerminalWebSocket,
};
