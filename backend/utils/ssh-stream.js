// SSH command execution with streaming support for very large outputs
const { spawn } = require('child_process');
const { Readable } = require('stream');

/**
 * Execute SSH command with streaming support
 * @param {string} command - The SSH command to execute
 * @param {Object} options - Options for execution
 * @param {number} options.timeout - Command timeout in milliseconds
 * @param {Function} options.onData - Callback for stdout data chunks
 * @param {Function} options.onError - Callback for stderr data chunks
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
const executeSSHCommandStream = async (command, options = {}) => {
  const {
    timeout = 30000,
    onData = null,
    onError = null,
  } = options;

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Parse the command to extract SSH components
    const args = command.split(' ').filter(arg => arg.length > 0);
    
    // Spawn the process
    const proc = spawn(args[0], args.slice(1), {
      shell: false,
      env: { ...process.env, TERM: 'xterm-256color' },
    });

    // Set up timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    // Handle stdout
    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      
      // Call the data callback if provided
      if (onData && typeof onData === 'function') {
        onData(chunk);
      }
    });

    // Handle stderr
    proc.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      
      // Call the error callback if provided
      if (onError && typeof onError === 'function') {
        onError(chunk);
      }
    });

    // Handle process exit
    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      
      if (!timedOut) {
        resolve({
          stdout,
          stderr,
          code: code || 0,
        });
      }
    });

    // Handle process error
    proc.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
};

/**
 * Execute SSH command and return a readable stream
 * @param {string} command - The SSH command to execute
 * @param {Object} options - Options for execution
 * @returns {Readable} Stream of command output
 */
const executeSSHCommandAsStream = (command, options = {}) => {
  const stream = new Readable({
    read() {},
  });

  executeSSHCommandStream(command, {
    ...options,
    onData: (chunk) => {
      stream.push(chunk);
    },
    onError: (chunk) => {
      stream.push(`STDERR: ${chunk}`);
    },
  })
    .then((result) => {
      stream.push(null); // End the stream
    })
    .catch((error) => {
      stream.emit('error', error);
    });

  return stream;
};

module.exports = {
  executeSSHCommandStream,
  executeSSHCommandAsStream,
};
