// SSH Setup Fallback - Alternative SSH-Key-Installation ohne ssh-copy-id
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class SSHSetupFallback {
  constructor() {
    this.sshDir = '/root/.ssh';
  }

  // Alternative SSH-Setup ohne ssh-copy-id
  async setupSSHFallback(
    hostname,
    host,
    username,
    password,
    port = 22,
    keyName = 'dashboard'
  ) {
    try {
      console.log('🔄 Using fallback SSH setup method...');

      // 1. Stelle sicher, dass SSH-Keys existieren
      const keyPath = path.join(this.sshDir, `id_rsa_${keyName}`);
      const pubKeyPath = path.join(this.sshDir, `id_rsa_${keyName}.pub`);

      let publicKey;
      try {
        publicKey = await fs.readFile(pubKeyPath, 'utf8');
      } catch (error) {
        throw new Error(
          'SSH public key not found. Please generate SSH keys first.'
        );
      }

      // 2. Verwende ssh und sshpass für die manuelle Installation
      return new Promise(resolve => {
        const sshCommand = [
          '-o',
          'StrictHostKeyChecking=no',
          '-o',
          'UserKnownHostsFile=/dev/null',
          '-o',
          'ConnectTimeout=10',
          '-p',
          port.toString(),
          `${username}@${host}`,
          `mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '${publicKey.trim()}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo 'SSH key installed successfully'`,
        ];

        console.log('📡 Installing SSH key via direct SSH connection...');

        const sshProcess = spawn('sshpass', [
          '-p',
          password,
          'ssh',
          ...sshCommand,
        ]);

        let stdout = '';
        let stderr = '';

        sshProcess.stdout.on('data', data => {
          stdout += data.toString();
        });

        sshProcess.stderr.on('data', data => {
          stderr += data.toString();
        });

        sshProcess.on('close', code => {
          if (code === 0 && stdout.includes('SSH key installed successfully')) {
            resolve({
              success: true,
              message: 'SSH key installed successfully using fallback method',
              method: 'direct_ssh',
              hostname,
              details: stdout,
            });
          } else {
            resolve({
              success: false,
              error: 'Failed to install SSH key using fallback method',
              details: stderr || stdout,
              exit_code: code,
            });
          }
        });

        sshProcess.on('error', error => {
          resolve({
            success: false,
            error: 'SSH process failed',
            details: error.message,
          });
        });
      });
    } catch (error) {
      return {
        success: false,
        error: 'Fallback SSH setup failed',
        details: error.message,
      };
    }
  }

  // Test SSH connection ohne externe Tools
  async testSSHConnection(host, username, keyName = 'dashboard', port = 22) {
    return new Promise(resolve => {
      const keyPath = path.join(this.sshDir, `id_rsa_${keyName}`);

      const sshTest = spawn('ssh', [
        '-o',
        'ConnectTimeout=5',
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'UserKnownHostsFile=/dev/null',
        '-o',
        'BatchMode=yes',
        '-i',
        keyPath,
        '-p',
        port.toString(),
        `${username}@${host}`,
        'echo "Connection successful"',
      ]);

      let stdout = '';
      let stderr = '';

      sshTest.stdout.on('data', data => {
        stdout += data.toString();
      });

      sshTest.stderr.on('data', data => {
        stderr += data.toString();
      });

      sshTest.on('close', code => {
        const success = code === 0 && stdout.includes('Connection successful');
        resolve({
          success,
          message: success
            ? 'SSH connection successful'
            : 'SSH connection failed',
          details: success ? stdout : stderr,
          exit_code: code,
        });
      });
    });
  }

  // Prüfe verfügbare SSH-Tools
  async checkSSHTools() {
    const tools = ['ssh', 'ssh-copy-id', 'sshpass'];
    const availability = {};

    for (const tool of tools) {
      try {
        await new Promise((resolve, reject) => {
          const process = spawn('which', [tool]);
          process.on('close', code => {
            availability[tool] = code === 0;
            resolve();
          });
          process.on('error', () => {
            availability[tool] = false;
            resolve();
          });
        });
      } catch (error) {
        availability[tool] = false;
      }
    }

    return {
      ssh: availability.ssh || false,
      ssh_copy_id: availability['ssh-copy-id'] || false,
      sshpass: availability.sshpass || false,
      fallback_available: availability.ssh && availability.sshpass,
    };
  }

  // Installiere SSH-Tools automatisch (wenn möglich)
  async installSSHTools() {
    return new Promise(resolve => {
      console.log('📦 Attempting to install SSH tools...');

      // Versuche verschiedene Package Manager
      const installCommands = [
        // Alpine
        ['apk', 'add', 'openssh-client', 'sshpass'],
        // Debian/Ubuntu
        [
          'apt-get',
          'update',
          '&&',
          'apt-get',
          'install',
          '-y',
          'openssh-client',
          'sshpass',
        ],
        // RedHat/CentOS
        ['yum', 'install', '-y', 'openssh-clients', 'sshpass'],
      ];

      let commandIndex = 0;

      const tryInstall = () => {
        if (commandIndex >= installCommands.length) {
          resolve({
            success: false,
            error: 'No suitable package manager found',
          });
          return;
        }

        const cmd = installCommands[commandIndex];
        const process = spawn(cmd[0], cmd.slice(1), { shell: true });

        process.on('close', code => {
          if (code === 0) {
            resolve({
              success: true,
              message: 'SSH tools installed successfully',
              package_manager: cmd[0],
            });
          } else {
            commandIndex++;
            tryInstall();
          }
        });

        process.on('error', () => {
          commandIndex++;
          tryInstall();
        });
      };

      tryInstall();
    });
  }
}

module.exports = SSHSetupFallback;
