const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const EventEmitter = require('events');

/**
 * RustDesk Integration - Schneller Remote Desktop ohne Komplexität
 * 
 * Vorteile:
 * - Automatische Installation im Hintergrund
 * - Keine PIN/Passwort Eingabe nötig (API-basiert)
 * - Hardware-beschleunigtes Encoding
 * - Sehr niedrige Latenz
 * - Cross-Platform (Windows, Linux, macOS)
 */
class RustDeskController extends EventEmitter {
  constructor() {
    super();
    this.config = {
      serverUrl: process.env.RUSTDESK_SERVER || 'http://localhost:21114',
      apiPort: 21114,
      tcpPort: 21115,
      udpPort: 21116,
      webPort: 21118
    };
  }

  /**
   * Installiert RustDesk vollautomatisch im Hintergrund
   */
  async autoInstall(platform) {
    const installers = {
      linux: async () => {
        // Download latest RustDesk
        const response = await axios.get(
          'https://api.github.com/repos/rustdesk/rustdesk/releases/latest'
        );
        
        const asset = response.data.assets.find(a => 
          a.name.includes('x86_64.deb') || a.name.includes('x86_64.rpm')
        );
        
        if (!asset) throw new Error('No suitable installer found');
        
        // Download and install silently
        await this.downloadFile(asset.browser_download_url, '/tmp/rustdesk.deb');
        
        return new Promise((resolve, reject) => {
          exec('sudo dpkg -i /tmp/rustdesk.deb || sudo apt-get install -f -y', 
            (error, stdout, stderr) => {
              if (error && !stderr.includes('already installed')) {
                reject(error);
              } else {
                resolve({ success: true });
              }
            }
          );
        });
      },

      windows: async () => {
        const response = await axios.get(
          'https://api.github.com/repos/rustdesk/rustdesk/releases/latest'
        );
        
        const asset = response.data.assets.find(a => 
          a.name.includes('windows') && a.name.endsWith('.exe')
        );
        
        const installerPath = path.join(process.env.TEMP, 'rustdesk-installer.exe');
        await this.downloadFile(asset.browser_download_url, installerPath);
        
        // Silent install with custom config
        return new Promise((resolve, reject) => {
          exec(`"${installerPath}" --silent --config ${this.generateConfigString()}`,
            (error, stdout, stderr) => {
              if (error) reject(error);
              else resolve({ success: true });
            }
          );
        });
      },

      darwin: async () => {
        // macOS installation via Homebrew
        return new Promise((resolve, reject) => {
          exec('brew install --cask rustdesk', (error, stdout, stderr) => {
            if (error && !stderr.includes('already installed')) {
              reject(error);
            } else {
              resolve({ success: true });
            }
          });
        });
      }
    };

    const installer = installers[platform];
    if (!installer) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const result = await installer();
    
    // Configure RustDesk to use our server
    await this.configureClient();
    
    // Start service
    await this.startService();
    
    return result;
  }

  /**
   * Konfiguriert RustDesk für nahtlose Integration
   */
  async configureClient() {
    const config = {
      // Keine Passwort-Abfrage
      'allow-auto-disconnect': false,
      'allow-remote-config-modification': true,
      'approve-mode': 0, // Keine Bestätigung nötig
      
      // Performance
      'enable-file-transfer': true,
      'enable-tunnel': true,
      'codec-preference': 'h264', // oder 'h265' für bessere Qualität
      
      // Sicherheit (intern kontrolliert)
      'access-mode': 2, // Full access
      'enable-keyboard': true,
      'enable-clipboard': true,
      'enable-audio': true,
      'privacy-mode': false,
      
      // Custom server (optional)
      'custom-rendezvous-server': this.config.serverUrl,
      'key': this.generateSecureKey()
    };

    const configPath = this.getConfigPath();
    await fs.writeFile(
      path.join(configPath, 'RustDesk2.toml'),
      this.toToml(config)
    );
  }

  /**
   * Startet RustDesk Service im Hintergrund
   */
  async startService() {
    const platform = process.platform;
    
    if (platform === 'linux') {
      // Systemd service
      await this.createSystemdService();
      exec('sudo systemctl start rustdesk', (error) => {
        if (!error) this.emit('service-started');
      });
    } else if (platform === 'win32') {
      // Windows Service
      exec('sc start rustdesk', (error) => {
        if (!error) this.emit('service-started');
      });
    } else if (platform === 'darwin') {
      // macOS LaunchAgent
      exec('launchctl load ~/Library/LaunchAgents/com.rustdesk.plist', (error) => {
        if (!error) this.emit('service-started');
      });
    }
  }

  /**
   * Erstellt eine Web-basierte Verbindung (ohne Installation beim Client)
   */
  async createWebSession(targetId) {
    // RustDesk Web Client Integration
    const sessionConfig = {
      target: targetId,
      quality: 'balanced', // 'best', 'balanced', 'fast'
      codec: 'h264',
      password: '', // Kein Passwort nötig
      permissions: {
        keyboard: true,
        mouse: true,
        clipboard: true,
        file_transfer: true,
        audio: true
      }
    };

    // Generiere Session Token
    const token = await this.generateSessionToken(sessionConfig);
    
    // Return embeddable URL
    return {
      url: `${this.config.serverUrl}/web/?token=${token}`,
      sessionId: token,
      embedCode: `<iframe src="${this.config.serverUrl}/web/?token=${token}" 
                   width="100%" height="100%" frameborder="0"></iframe>`
    };
  }

  /**
   * Holt die ID des lokalen RustDesk Clients
   */
  async getLocalId() {
    try {
      const configPath = path.join(this.getConfigPath(), 'RustDesk.toml');
      const content = await fs.readFile(configPath, 'utf8');
      const match = content.match(/id = '(\d+)'/);
      return match ? match[1] : null;
    } catch (error) {
      // Fallback: Get from running process
      return new Promise((resolve) => {
        exec('rustdesk --get-id', (error, stdout) => {
          if (!error) {
            resolve(stdout.trim());
          } else {
            resolve(null);
          }
        });
      });
    }
  }

  /**
   * Helper: Config Pfad je nach Platform
   */
  getConfigPath() {
    const platform = process.platform;
    const home = process.env.HOME || process.env.USERPROFILE;
    
    if (platform === 'win32') {
      return path.join(process.env.APPDATA, 'RustDesk', 'config');
    } else if (platform === 'darwin') {
      return path.join(home, 'Library', 'Preferences', 'com.carriez.rustdesk');
    } else {
      return path.join(home, '.config', 'rustdesk');
    }
  }

  /**
   * Helper: Download Datei
   */
  async downloadFile(url, destPath) {
    const writer = require('fs').createWriteStream(destPath);
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream'
    });
    
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  /**
   * Helper: TOML Generator
   */
  toToml(obj) {
    return Object.entries(obj)
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key} = '${value}'`;
        } else if (typeof value === 'boolean') {
          return `${key} = ${value}`;
        } else {
          return `${key} = ${value}`;
        }
      })
      .join('\n');
  }

  generateSecureKey() {
    return require('crypto').randomBytes(32).toString('base64');
  }

  async generateSessionToken(config) {
    // Simplified - würde echte JWT/Session Logik verwenden
    return Buffer.from(JSON.stringify(config)).toString('base64');
  }
}

module.exports = RustDeskController;
