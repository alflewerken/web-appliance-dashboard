// SSH command execution utilities with enhanced color support
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const { forceColorInCommand } = require('./colorHelper');

const execAsync = promisify(exec);

// Default max buffer size: 10MB (can handle large outputs)
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024; // 10MB

// Helper function to execute SSH commands with color support
const executeSSHCommand = async (command, timeout = 30000, maxBuffer = DEFAULT_MAX_BUFFER) => {
  // Environment variables to force color output
  const colorEnv = {
    ...process.env,
    TERM: 'xterm-256color',
    FORCE_COLOR: '1',
    COLORTERM: 'truecolor',
    CLICOLOR: '1',
    CLICOLOR_FORCE: '1',
  };

  // First check if it's a simple SSH command (not the ssh:// format)
  if (command.startsWith('ssh ')) {
    // Direct SSH command execution
    console.log(
      `🔗 Executing direct SSH command: ${command.substring(0, 100)}...`
    );

    try {
      const result = await execAsync(command, {
        timeout,
        encoding: 'utf8',
        maxBuffer,
        env: colorEnv,
      });
      return result;
    } catch (error) {
      // Enhance error message
      if (error.code === 'ETIMEDOUT') {
        error.message = `SSH command timed out after ${timeout}ms`;
      } else if (error.message && error.message.includes('maxBuffer')) {
        error.message = `Command output exceeded buffer limit of ${maxBuffer} bytes. Consider using streaming for large outputs.`;
      }
      throw error;
    }
  }

  // Parse SSH command format: ssh://user@host:port/command (legacy format)
  const sshMatch = command.match(
    /^ssh:\/\/([^@]+)@([^:\/]+)(?::(\d+))?\/(.+)$/
  );

  if (sshMatch) {
    const [, user, host, port = '22', remoteCommand] = sshMatch;

    // Force color in the remote command
    const coloredCommand = forceColorInCommand(remoteCommand);

    // Use SSH key authentication with pseudo-TTY for color support
    // -t forces pseudo-TTY allocation which enables color output
    const sshCommand = `ssh -t -i ~/.ssh/id_rsa_dashboard -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p ${port} ${user}@${host} "${coloredCommand}"`;

    console.log(`🔗 Executing SSH command on ${host}: ${coloredCommand}`);

    return await execAsync(sshCommand, {
      timeout,
      encoding: 'utf8',
      maxBuffer,
      env: colorEnv,
    });
  } else {
    // Regular local command
    return await execAsync(command, {
      timeout,
      encoding: 'utf8',
      maxBuffer,
      env: colorEnv,
    });
  }
};

// Get SSH connection object for terminal sessions
const getSSHConnection = async (sshHostId) => {
  const pool = require('./database');
  
  // Get SSH host details
  const [hosts] = await pool.execute(
    'SELECT * FROM ssh_hosts WHERE id = ? AND is_active = TRUE',
    [sshHostId]
  );
  
  const host = hosts[0];
  if (!host) {
    throw new Error('SSH Host not found');
  }
  
  // Return a connection object with exec method
  return {
    exec: async (command, options = {}) => {
      const keyName = host.key_name || 'dashboard';
      
      // Force color in the command
      const coloredCommand = forceColorInCommand(command);
      
      // Use -t flag for pseudo-TTY to preserve colors
      const sshCommand = `ssh -t -i ~/.ssh/id_rsa_${keyName} -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p ${host.port} ${host.username}@${host.host} "${coloredCommand}"`;
      
      console.log(`🔗 Executing SSH command on ${host.hostname}: ${coloredCommand}`);
      
      // Environment variables to force color output
      const colorEnv = {
        ...process.env,
        TERM: 'xterm-256color',
        FORCE_COLOR: '1',
        COLORTERM: 'truecolor',
        CLICOLOR: '1',
        CLICOLOR_FORCE: '1',
        ...(options.env || {}),
      };
      
      try {
        const result = await execAsync(sshCommand, {
          timeout: options.timeout || 30000,
          encoding: 'utf8',
          env: colorEnv,
          maxBuffer: options.maxBuffer || DEFAULT_MAX_BUFFER,
        });
        
        return {
          stdout: result.stdout,
          stderr: result.stderr,
        };
      } catch (error) {
        // Better error handling for buffer overflow
        if (error.message && error.message.includes('maxBuffer')) {
          return {
            stdout: '',
            stderr: `Command output exceeded buffer limit. Consider using streaming for large outputs or increase maxBuffer.`,
          };
        }
        
        return {
          stdout: '',
          stderr: error.message || error.stderr || 'Command failed',
        };
      }
    },
  };
};

module.exports = {
  executeSSHCommand,
  execAsync,
  getSSHConnection,
};
