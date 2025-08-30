const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const EventEmitter = require('events');
const crypto = require('crypto');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * RustDesk Manager - Erweiterte Integration für Web Appliance Dashboard
 * 
 * Features:
 * - Vollautomatische Installation ohne Benutzerinteraktion
 * - Nahtlose Web-Client Integration
 * - Zero-Configuration für Endnutzer
 * - API-basierte Verwaltung
 */
class RustDeskManager extends EventEmitter {
  constructor() {
    super();
    this.config = {
      // Docker Service URLs
      serverHost: process.env.RUSTDESK_SERVER_HOST || 'localhost',
      idServerPort: 21116,
      relayPort: 21117,
      apiPort: 21119,
      webPort: 21121,
      wsPort: 21120,
      
      // Keys werden automatisch generiert
      publicKey: null,
      privateKey: null,
      
      // Installation settings
      autoApprove: true,
      directAccess: true,
      passwordLess: true
    };
    
    this.sessions = new Map();
    this.installations = new Map();
  }

  /**
   * Initialisiert den RustDesk Server
   */
  async initialize() {
    try {
      // Prüfe ob Server läuft
      const serverRunning = await this.checkServerStatus();
      
      if (!serverRunning) {

        await execAsync('docker-compose -f docker-compose.rustdesk.yml up -d');
        
        // Warte bis Server bereit ist
        await this.waitForServer();
      }
      
      // Lade Server Keys
      await this.loadServerKeys();
      
      this.emit('initialized', { 
        serverUrl: this.getServerUrl(),
        webUrl: this.getWebUrl() 
      });
      
    } catch (error) {
      console.error('Failed to initialize RustDesk:', error);
      throw error;
    }
  }

  /**
   * Installiert RustDesk auf einem Remote Host
   */
  async installOnHost(hostInfo, db, executeSSHCommand) {
    const { id, platform, sshConfig } = hostInfo;
    
    // Check if already installed
    if (this.installations.has(id)) {
      return this.installations.get(id);
    }
    
    const installation = {
      id,
      status: 'installing',
      progress: 0,
      rustdeskId: null
    };
    
    this.installations.set(id, installation);
    this.emit('install-start', { hostId: id });
    
    try {
      // Platform-spezifische Installation
      const installer = this.getInstaller(platform);
      const rustdeskId = await installer(sshConfig, executeSSHCommand, (progress) => {
        installation.progress = progress;
        this.emit('install-progress', { hostId: id, progress });
      });
      
      installation.status = 'installed';
      installation.rustdeskId = rustdeskId;
      
      // Update database if provided
      if (db && db.query) {
        await db.query(
          `UPDATE appliances SET 
           rustdesk_id = ?, 
           rustdesk_installed = 1,
           rustdesk_installation_date = NOW()
           WHERE id = ?`,
          [rustdeskId, id]
        );
      }
      
      this.emit('install-complete', { hostId: id, rustdeskId });
      return installation;
      
    } catch (error) {
      installation.status = 'failed';
      installation.error = error.message;
      this.emit('install-failed', { hostId: id, error: error.message });
      throw error;
    }
  }

  /**
   * Erstellt eine Web-Session für Remote Desktop
   */
  async createWebSession(hostId, options = {}) {
    const installation = this.installations.get(hostId);
    
    if (!installation || installation.status !== 'installed') {
      throw new Error('Host not ready for remote desktop');
    }
    
    const sessionId = crypto.randomBytes(16).toString('hex');
    const session = {
      id: sessionId,
      hostId,
      rustdeskId: installation.rustdeskId,
      created: new Date(),
      quality: options.quality || 'balanced',
      permissions: {
        keyboard: true,
        mouse: true,
        clipboard: true,
        fileTransfer: options.fileTransfer !== false,
        audio: options.audio !== false
      }
    };
    
    this.sessions.set(sessionId, session);
    
    // Generiere Web URL mit Session Token
    const token = await this.generateSessionToken(session);
    const webUrl = `${this.getWebUrl()}/connect?token=${token}`;
    
    return {
      sessionId,
      webUrl,
      embedUrl: `${webUrl}&embed=true`,
      rustdeskId: installation.rustdeskId
    };
  }

  /**
   * Platform-spezifische Installer
   */
  getInstaller(platform) {
    const installers = {
      linux: async (sshConfig, executeSSHCommand, onProgress) => {
        onProgress(10);
        
        // Download Script
        const installScript = `
#!/bin/bash
set -e

# RustDesk Installation Script
echo "Installing RustDesk..."

# Detect distribution
if [ -f /etc/debian_version ]; then
    # Debian/Ubuntu
    wget -q https://github.com/rustdesk/rustdesk/releases/download/1.2.3/rustdesk-1.2.3-x86_64.deb
    sudo dpkg -i rustdesk-1.2.3-x86_64.deb || sudo apt-get install -f -y
    rm rustdesk-1.2.3-x86_64.deb
elif [ -f /etc/redhat-release ]; then
    # RHEL/CentOS/Fedora
    wget -q https://github.com/rustdesk/rustdesk/releases/download/1.2.3/rustdesk-1.2.3.rpm
    sudo rpm -i rustdesk-1.2.3.rpm
    rm rustdesk-1.2.3.rpm
else
    echo "Unsupported distribution"
    exit 1
fi

# Configure RustDesk
mkdir -p ~/.config/rustdesk
cat > ~/.config/rustdesk/RustDesk2.toml << EOF
rendezvous_server = '${this.config.serverHost}:${this.config.idServerPort}'
nat_type = 1
serial = 0

[options]
custom-rendezvous-server = '${this.config.serverHost}:${this.config.idServerPort}'
relay-server = '${this.config.serverHost}:${this.config.relayPort}'
api-server = 'http://${this.config.serverHost}:${this.config.apiPort}'
key = '${this.config.publicKey}'
custom-rendezvous-server = '${this.config.serverHost}'
direct-server = 'Y'
direct-access-port = '21118'
EOF

# Start RustDesk service
sudo systemctl enable rustdesk
sudo systemctl start rustdesk

# Get ID
sleep 2
rustdesk --get-id
`;
        
        onProgress(30);
        
        // Write script to remote host
        await executeSSHCommand('echo \'' + installScript.replace(/'/g, "'\\''") + '\' > /tmp/install-rustdesk.sh', sshConfig);
        await executeSSHCommand('chmod +x /tmp/install-rustdesk.sh', sshConfig);
        
        onProgress(50);
        const result = await executeSSHCommand('/tmp/install-rustdesk.sh', sshConfig);
        
        onProgress(80);
        
        // Extract RustDesk ID from output
        const idMatch = result.stdout.match(/\d{9}/);
        if (!idMatch) {
          throw new Error('Failed to get RustDesk ID');
        }
        
        onProgress(100);
        return idMatch[0];
      },
      
      windows: async (ssh, onProgress) => {
        onProgress(10);
        
        const psScript = `
# RustDesk Silent Installation
$url = "https://github.com/rustdesk/rustdesk/releases/download/1.2.3/rustdesk-1.2.3-setup.exe"
$installer = "$env:TEMP\\rustdesk-installer.exe"

# Download
Invoke-WebRequest -Uri $url -OutFile $installer

# Install silently
Start-Process -FilePath $installer -ArgumentList "/S", "--config", "server=${this.config.serverHost}" -Wait

# Configure
$configPath = "$env:APPDATA\\RustDesk\\config\\RustDesk2.toml"
$config = @"
rendezvous_server = '${this.config.serverHost}:${this.config.idServerPort}'
nat_type = 1
serial = 0

[options]
custom-rendezvous-server = '${this.config.serverHost}:${this.config.idServerPort}'
relay-server = '${this.config.serverHost}:${this.config.relayPort}'
key = '${this.config.publicKey}'
direct-server = 'Y'
"@

New-Item -Path (Split-Path $configPath) -ItemType Directory -Force
Set-Content -Path $configPath -Value $config

# Get ID
Start-Sleep -Seconds 2
& "$env:ProgramFiles\\RustDesk\\rustdesk.exe" --get-id
`;
        
        onProgress(30);
        const result = await ssh.exec(`powershell -Command "${psScript}"`);
        
        onProgress(80);
        const idMatch = result.match(/\d{9}/);
        if (!idMatch) {
          throw new Error('Failed to get RustDesk ID');
        }
        
        onProgress(100);
        return idMatch[0];
      },
      
      darwin: async (sshConfig, executeSSHCommand, onProgress) => {
        onProgress(10);
        
        const installScript = `
#!/bin/bash
# RustDesk macOS Installation with automatic setup

# Function to check if RustDesk is already installed
check_rustdesk() {
    if [ -d "/Applications/RustDesk.app" ]; then
        echo "RustDesk already installed, checking ID..."
        # Try to get existing ID
        if pgrep -x "RustDesk" > /dev/null; then
            sleep 2
            EXISTING_ID=$(/Applications/RustDesk.app/Contents/MacOS/RustDesk --get-id 2>/dev/null | grep -E '^[0-9]{9}$' | head -1)
            if [ -n "$EXISTING_ID" ]; then
                echo "Found existing ID: $EXISTING_ID"
                echo "$EXISTING_ID"
                exit 0
            fi
        fi
    fi
    return 1
}

# Check if already installed
if check_rustdesk; then
    exit 0
fi

echo "Installing RustDesk for macOS..."

# Install via Homebrew if available
if command -v brew &> /dev/null; then
    echo "Installing via Homebrew..."
    brew install --cask rustdesk
else
    # Direct download
    echo "Downloading RustDesk..."
    curl -L https://github.com/rustdesk/rustdesk/releases/download/1.2.3/rustdesk-1.2.3.dmg -o /tmp/rustdesk.dmg
    
    echo "Mounting DMG..."
    hdiutil attach /tmp/rustdesk.dmg -nobrowse -quiet
    
    echo "Copying to Applications..."
    cp -R /Volumes/RustDesk/RustDesk.app /Applications/
    
    echo "Unmounting DMG..."
    hdiutil detach /Volumes/RustDesk -quiet
    rm /tmp/rustdesk.dmg
fi

# Configure RustDesk
echo "Configuring RustDesk..."
CONFIG_DIR="$HOME/Library/Preferences/com.carriez.rustdesk"
mkdir -p "$CONFIG_DIR"

cat > "$CONFIG_DIR/RustDesk2.toml" << EOF
rendezvous_server = '${this.config.serverHost}:${this.config.idServerPort}'
nat_type = 1
serial = 0

[options]
custom-rendezvous-server = '${this.config.serverHost}:${this.config.idServerPort}'
relay-server = '${this.config.serverHost}:${this.config.relayPort}'
key = '${this.config.publicKey || ''}'
direct-server = 'Y'
direct-access-port = '21118'
EOF

# Kill any existing RustDesk process
pkill -x RustDesk 2>/dev/null || true
sleep 2

# Start RustDesk in background
echo "Starting RustDesk..."
open -a RustDesk --hide

# Wait for RustDesk to start and generate ID
echo "Waiting for RustDesk to initialize..."
sleep 5

# Try multiple times to get the ID
for i in {1..10}; do
    RUSTDESK_ID=$(/Applications/RustDesk.app/Contents/MacOS/RustDesk --get-id 2>/dev/null | grep -E '^[0-9]{9}$' | head -1)
    if [ -n "$RUSTDESK_ID" ]; then
        echo "RustDesk ID: $RUSTDESK_ID"
        echo "$RUSTDESK_ID"
        exit 0
    fi
    echo "Attempt $i: Waiting for ID generation..."
    sleep 2
done

echo "ERROR: Failed to get RustDesk ID"
exit 1
`;
        
        onProgress(30);
        
        // Create temporary script on remote host
        const scriptPath = '/tmp/install-rustdesk.sh';
        await executeSSHCommand(`cat > ${scriptPath} << 'EOFSCRIPT'
${installScript}
EOFSCRIPT`, sshConfig);
        
        await executeSSHCommand(`chmod +x ${scriptPath}`, sshConfig);
        
        onProgress(50);
        
        // Execute installation script
        const result = await executeSSHCommand(`bash ${scriptPath}`, sshConfig);
        
        onProgress(80);
        
        // Extract RustDesk ID from output
        const output = result.stdout || '';
        const idMatch = output.match(/\b\d{9}\b/);
        
        if (!idMatch) {
          console.error('RustDesk installation output:', output);
          throw new Error('Failed to get RustDesk ID from installation');
        }
        
        onProgress(90);
        
        // Clean up
        await executeSSHCommand(`rm -f ${scriptPath}`, sshConfig);
        
        onProgress(100);
        return idMatch[0];
      }
    };
    
    return installers[platform] || installers.linux;
  }
  /**
   * Prüft Server Status
   */
  async checkServerStatus() {
    try {
      const response = await axios.get(
        `http://${this.config.serverHost}:${this.config.apiPort}/api/status`,
        { timeout: 5000 }
      );
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wartet bis Server bereit ist
   */
  async waitForServer(maxRetries = 30) {
    for (let i = 0; i < maxRetries; i++) {
      if (await this.checkServerStatus()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('RustDesk server did not start in time');
  }

  /**
   * Lädt Server Keys
   */
  async loadServerKeys() {
    try {
      // Keys aus Docker Volume laden
      const keyPath = './rustdesk/data/id_ed25519.pub';
      this.config.publicKey = await fs.readFile(keyPath, 'utf8');
      this.config.publicKey = this.config.publicKey.trim();
    } catch (error) {

      // Keys werden automatisch beim ersten Start generiert
    }
  }

  /**
   * Generiert Session Token
   */
  async generateSessionToken(session) {
    const payload = {
      sid: session.id,
      rid: session.rustdeskId,
      exp: Date.now() + (3600 * 1000), // 1 hour
      perm: session.permissions
    };
    
    // Simplified - würde JWT verwenden in Produktion
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  /**
   * Validiert Session Token
   */
  validateSessionToken(token) {
    try {
      const payload = JSON.parse(
        Buffer.from(token, 'base64url').toString()
      );
      
      if (payload.exp < Date.now()) {
        return null;
      }
      
      return payload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Beendet eine Session
   */
  async endSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    this.sessions.delete(sessionId);
    this.emit('session-ended', { sessionId });
    
    return true;
  }

  /**
   * Holt Installation Status
   */
  getInstallationStatus(hostId) {
    return this.installations.get(hostId) || null;
  }

  /**
   * Holt alle aktiven Sessions
   */
  getActiveSessions() {
    return Array.from(this.sessions.values());
  }

  /**
   * URLs
   */
  getServerUrl() {
    return `${this.config.serverHost}:${this.config.idServerPort}`;
  }

  getWebUrl() {
    return `http://${this.config.serverHost}:${this.config.webPort}`;
  }

  getApiUrl() {
    return `http://${this.config.serverHost}:${this.config.apiPort}`;
  }

  /**
   * Cleanup
   */
  async cleanup() {
    // Beende alle Sessions
    for (const sessionId of this.sessions.keys()) {
      await this.endSession(sessionId);
    }
    
    this.removeAllListeners();
  }
}

module.exports = RustDeskManager;
