/**
 * PTY Helper for better terminal emulation
 * Uses a bash wrapper to ensure proper PTY handling
 */

const { spawn } = require('child_process');

/**
 * Create a PTY-enabled SSH connection
 */
function createPTYSession(command, args, options = {}) {
  // Use script command to force PTY allocation
  const isLinux = process.platform === 'linux';
  const isMac = process.platform === 'darwin';

  let ptyCommand;
  let ptyArgs;

  if (isMac) {
    // macOS version of script command
    ptyCommand = 'script';
    ptyArgs = ['-q', '/dev/null', command, ...args];
  } else if (isLinux) {
    // Linux version of script command
    ptyCommand = 'script';
    ptyArgs = ['-qc', `${command} ${args.join(' ')}`, '/dev/null'];
  } else {
    // Fallback to direct command
    ptyCommand = command;
    ptyArgs = args;
  }

  const ptyProcess = spawn(ptyCommand, ptyArgs, {
    env: {
      ...process.env,
      ...options.env,
      TERM: 'xterm-256color',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Set stdin to raw mode for better terminal handling
  if (ptyProcess.stdin.setRawMode) {
    ptyProcess.stdin.setRawMode(true);
  }

  return ptyProcess;
}

module.exports = {
  createPTYSession,
};
