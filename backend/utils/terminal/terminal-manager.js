/**
 * Terminal Manager - Simple Fallback without PTY
 * Temporary solution until PTY issues are resolved
 */

const { exec, spawn } = require('child_process');
const EventEmitter = require('events');

class SimpleTerminalManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
  }

  createSession(sessionId, applianceId, options = {}) {
    if (this.sessions.has(sessionId)) {
      console.log(`📋 Session ${sessionId} already exists`);
      return this.sessions.get(sessionId);
    }

    console.log(`🚀 Creating simple terminal session: ${sessionId}`);

    const session = {
      id: sessionId,
      applianceId,
      process: null,
      output: [],
      connected: true,
      createdAt: new Date(),
      lastActivity: new Date(),
      metadata: options.metadata || {},
      onData: callback => {
        session.dataCallback = callback;
      },
    };

    // Create a simple shell process
    const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash';
    session.process = spawn(shell, [], {
      env: { ...process.env, TERM: 'xterm-256color' },
      shell: true,
    });

    // Handle output
    session.process.stdout.on('data', data => {
      const output = data.toString();
      session.output.push(output);
      if (session.dataCallback) {
        session.dataCallback(output);
      }
    });

    session.process.stderr.on('data', data => {
      const output = data.toString();
      session.output.push(output);
      if (session.dataCallback) {
        session.dataCallback(output);
      }
    });

    // Handle exit
    session.process.on('exit', code => {
      console.log(`💀 Session ${sessionId} exited with code ${code}`);
      this.destroySession(sessionId);
    });

    this.sessions.set(sessionId, session);

    // Auto-connect to SSH if config provided
    if (options.sshConfig) {
      this.connectSSH(sessionId, options.sshConfig);
    }

    return session;
  }

  connectSSH(sessionId, sshConfig) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const { host, port = 22, username } = sshConfig;
    const sshCommand = `ssh -o StrictHostKeyChecking=no -p ${port} ${username}@${host}\n`;

    console.log(`🔗 Connecting to SSH: ${sshCommand.trim()}`);
    this.writeToSession(sessionId, sshCommand);
  }

  writeToSession(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.process) {
      console.warn(`⚠️ Session ${sessionId} not found`);
      return false;
    }

    try {
      session.process.stdin.write(data);
      session.lastActivity = new Date();
      return true;
    } catch (error) {
      console.error(`❌ Error writing to session: ${error.message}`);
      return false;
    }
  }

  resizeSession(sessionId, cols, rows) {
    // Not supported in simple mode
    console.log(`📐 Resize not supported in simple mode`);
    return true;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  destroySession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      if (session.process) {
        session.process.kill();
      }
      this.sessions.delete(sessionId);
      console.log(`🗑️ Destroyed session ${sessionId}`);
    } catch (error) {
      console.error(`❌ Error destroying session: ${error.message}`);
    }
  }

  getActiveSessions() {
    const sessions = [];
    for (const [id, session] of this.sessions) {
      sessions.push({
        id,
        applianceId: session.applianceId,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        connected: session.connected,
      });
    }
    return sessions;
  }

  cleanupDeadSessions() {
    // Cleanup inactive sessions
    const now = new Date();
    const maxInactivity = 30 * 60 * 1000; // 30 minutes

    for (const [id, session] of this.sessions) {
      const inactivityTime = now - session.lastActivity;
      if (inactivityTime > maxInactivity) {
        console.log(`🧹 Cleaning up inactive session ${id}`);
        this.destroySession(id);
      }
    }
  }

  executeCommand(sessionId, command) {
    return this.writeToSession(sessionId, command + '\n');
  }
}

// Export singleton instance
module.exports = new SimpleTerminalManager();
