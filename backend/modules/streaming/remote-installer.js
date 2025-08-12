const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { Client } = require('ssh2');
const EventEmitter = require('events');

class RemoteSunshineInstaller extends EventEmitter {
  constructor() {
    super();
    this.sshClient = new Client();
  }

  /**
   * Installiert Sunshine remote über SSH ohne Benutzerinteraktion
   */
  async installRemote(hostConfig) {
    const { host, port, username, privateKey, password, sudoPassword } = hostConfig;
    
    return new Promise((resolve, reject) => {
      this.sshClient.on('ready', async () => {
        try {
          // Detect OS first
          const osType = await this.detectOS();
          
          // Prepare installation script
          const installScript = this.generateInstallScript(osType, sudoPassword);
          
          // Upload and execute script
          await this.uploadScript(installScript);
          await this.executeScript(sudoPassword);
          
          // Configure Sunshine
          await this.configureSunshine();
          
          // Setup auto-start
          await this.setupAutoStart(osType);
          
          resolve({ success: true, message: 'Sunshine installed successfully' });
        } catch (error) {
          reject(error);
        } finally {
          this.sshClient.end();
        }
      });

      this.sshClient.on('error', (err) => {
        reject(new Error(`SSH connection failed: ${err.message}`));
      });

      // Connect via SSH
      const connectionConfig = {
        host,
        port: port || 22,
        username,
        privateKey: privateKey || undefined,
        password: password || undefined
      };

      this.sshClient.connect(connectionConfig);
    });
  }
