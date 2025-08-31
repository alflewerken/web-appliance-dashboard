const express = require('express');
const router = express.Router();
const { verifyToken } = require('../utils/auth');
const { executeSSHCommand } = require('../utils/ssh');
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { findRustDeskId } = require('../utils/rustdesk-id-finder');

// Initialize QueryBuilder
const db = new QueryBuilder(pool);

/**
 * POST /api/rustdeskInstall/:applianceId
 * Install RustDesk on an appliance
 */
router.post('/:applianceId', verifyToken, async (req, res) => {
  const { applianceId } = req.params;
  const { password } = req.body;
  
  // Set longer timeout for this specific route (5 minutes)
  req.setTimeout(300000);
  res.setTimeout(300000);
  
  // Import SSE manager
  const { sseManager } = require('./sse');
  
  try {

    // Get appliance details with host information
    const appliance = await db.findOneWithJoin({
      from: 'appliances',
      select: ['appliances.*', 'hosts.hostname', 'hosts.username', 'hosts.port', 'hosts.ssh_key_name'],
      joins: [{
        table: 'hosts',
        on: 'appliances.ssh_connection = CONCAT(hosts.username, "@", hosts.hostname, ":", hosts.port) OR appliances.ssh_connection = CONCAT(hosts.username, "@", hosts.hostname)',
        type: 'LEFT'
      }],
      where: { 'appliances.id': applianceId }
    });
    
    if (!appliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }
    
    // Check if already installed
    if (appliance.rustdesk_installed && appliance.rustdeskId) {
      return res.json({
        success: true,
        already_installed: true,
        rustdeskId: appliance.rustdeskId,
        message: 'RustDesk is already installed'
      });
    }
    
    // Build SSH config - use SSH host configuration if available
    let sshHost, sshUsername = 'root', sshPort = 22;
    let useHostname = false;
    
    // Check if we have host configuration from hosts table
    if (appliance.hosts_hostname) {
      // Use the hostname from hosts table
      sshHost = appliance.hosts_hostname;
      sshUsername = appliance.hosts_username;
      sshPort = appliance.hosts_port || 22;
      useHostname = true;
    } else if (appliance.sshConnection) {
      const sshParts = appliance.sshConnection.match(/^(?:([^@]+)@)?([^:]+)(?::(\d+))?$/);
      if (sshParts) {
        sshUsername = sshParts[1] || 'root';
        sshHost = sshParts[2];
        sshPort = parseInt(sshParts[3] || '22');
      }
    }
    
    const sshConfig = {
      host: sshHost,
      username: sshUsername,
      port: sshPort,
      hostname: appliance.hosts_hostname || null
    };
    
    // Validate that we have the necessary connection info
    if (!sshConfig.host || sshConfig.host === 'asdf' || sshConfig.host === 'localhost' || sshConfig.host === '127.0.0.1') {
      return res.status(400).json({ 
        error: 'RustDesk installation requires valid SSH connection',
        details: 'Please configure the SSH connection in the appliance settings (used for service control)'
      });
    }
    
    // Detect OS type
    let platform = 'linux';
    try {
      // Use IP address instead of hostname for better compatibility
      const actualHost = sshConfig.host || sshConfig.hostname;
      const keyName = appliance.ssh_key_name || 'dashboard';
      const sshCommand = useHostname && sshConfig.username && actualHost
        ? `ssh -i ~/.ssh/id_rsa_${keyName} -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${sshConfig.username}@${actualHost}`
        : `ssh -i ~/.ssh/id_rsa_dashboard -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${sshConfig.username}@${sshConfig.host} -p ${sshConfig.port || 22}`;
        
      const osResult = await executeSSHCommand(`${sshCommand} "uname -s"`);
      if (osResult.stdout.toLowerCase().includes('darwin')) {
        platform = 'darwin';
      } else if (osResult.stdout.toLowerCase().includes('mingw') || osResult.stdout.toLowerCase().includes('msys')) {
        platform = 'windows';
      }
    } catch (error) {

    }
    
    // Install RustDesk based on platform
    let rustdeskId = null;
    let rustdeskPassword = null;
    
    // Use password from request body first, then fall back to stored password
    if (password) {
      rustdeskPassword = password;

    } else if (appliance.remote_password_encrypted) {
      // Decrypt the stored password if available
      const { decrypt } = require('../utils/encryption');
      rustdeskPassword = decrypt(appliance.remote_password_encrypted);

    } else {

    }
    
    // Progress callback to send SSE updates
    const progressCallback = (progress, message) => {
      sseManager.sendEvent('rustdesk_progress', {
        applianceId,
        progress,
        message,
        timestamp: new Date().toISOString()
      });
    };

    if (platform === 'darwin') {

      rustdeskId = await installRustDeskMacOS(sshConfig, useHostname, appliance, rustdeskPassword, progressCallback);
    } else if (platform === 'linux') {

      rustdeskId = await installRustDeskLinux(sshConfig, useHostname, appliance, rustdeskPassword, progressCallback);
    } else {
      return res.status(400).json({ error: 'Unsupported platform: ' + platform });
    }
    
    // Check if manual ID is required
    if (rustdeskId === 'MANUAL_ID_REQUIRED') {
      // Mark as installed but without ID - frontend will show manual input
      await db.update('appliances', {
        rustdeskInstalled: true,
        rustdeskInstallationDate: new Date(),
        remoteDesktopType: 'rustdesk'
      }, { id: applianceId });
      
      return res.json({
        success: true,
        manual_id_required: true,
        message: 'RustDesk installed successfully, but ID must be entered manually'
      });
    }
    
    // Check if permissions are required
    let actualRustdeskId = rustdeskId;
    let permissionsRequired = false;
    
    if (typeof rustdeskId === 'object' && rustdeskId.id) {
      actualRustdeskId = rustdeskId.id;
      permissionsRequired = rustdeskId.permissionsRequired || false;
    }
    
    // Update database
    await db.update('appliances', {
      rustdeskInstalled: true,
      rustdeskId: actualRustdeskId,
      rustdeskInstallationDate: new Date(),
      remoteDesktopType: 'rustdesk'
    }, { id: applianceId });
    
    // Log the action
    await db.insert('audit_logs', {
      userId: req.user?.id || req.userId || 1,
      action: 'rustdesk_install',
      resourceType: 'appliance',
      resourceId: applianceId,
      details: JSON.stringify({ rustdeskId: actualRustdeskId, platform })
    });
    
    res.json({
      success: true,
      rustdeskId: actualRustdeskId,
      platform,
      permissions_required: permissionsRequired,
      message: permissionsRequired 
        ? 'RustDesk installiert! Bitte erlauben Sie die Berechtigungen in den Systemeinstellungen.'
        : 'RustDesk installed successfully'
    });
    
  } catch (error) {
    console.error('RustDesk installation error:', error);
    res.status(500).json({ 
      error: 'Failed to install RustDesk',
      details: error.message 
    });
  }
});

/**
 * GET /api/rustdeskInstall/:applianceId/status
 * Check RustDesk installation status for an appliance
 */
router.get('/:applianceId/status', verifyToken, async (req, res) => {
  const { applianceId } = req.params;

  try {
    // Get appliance details with host information
    const appliance = await db.findOneWithJoin({
      from: 'appliances',
      select: ['appliances.*', 'hosts.hostname', 'hosts.username', 'hosts.port', 'hosts.ssh_key_name'],
      joins: [{
        table: 'hosts',
        on: 'appliances.ssh_connection = CONCAT(hosts.username, "@", hosts.hostname, ":", hosts.port) OR appliances.ssh_connection = CONCAT(hosts.username, "@", hosts.hostname)',
        type: 'LEFT'
      }],
      where: { 'appliances.id': applianceId }
    });

    if (!appliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    // Check if we have SSH connection info
    if (!appliance.sshConnection) {

      return res.json({
        success: true,
        installed: !!appliance.rustdeskInstalled,
        rustdeskId: appliance.rustdeskId
      });
    }
    
    // Parse SSH connection info
    let sshHost, sshUsername = 'root', sshPort = 22;
    
    if (appliance.hosts_hostname) {
      // Use the hostname from hosts table
      sshHost = appliance.hosts_hostname;
      sshUsername = appliance.hosts_username;
      sshPort = appliance.hosts_port || 22;
    } else if (appliance.sshConnection) {
      const sshParts = appliance.sshConnection.match(/^(?:([^@]+)@)?([^:]+)(?::(\d+))?$/);
      if (sshParts) {
        sshUsername = sshParts[1] || 'root';
        sshHost = sshParts[2];
        sshPort = parseInt(sshParts[3] || '22');
      }
    }
    
    if (!sshHost) {

      return res.json({
        success: true,
        installed: !!appliance.rustdeskInstalled,
        rustdeskId: appliance.rustdeskId
      });
    }

    // Build SSH command
    const keyName = appliance.hosts_sshKeyName || appliance.sshKeyName || 'dashboard';
    let sshCommand = `ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;
    
    // Add key if specified
    sshCommand += ` -i ~/.ssh/id_rsa_${keyName}`;
    sshCommand += ` ${sshUsername}@${sshHost} -p ${sshPort}`;
    
    try {
      // Check if RustDesk is installed on the host
      const checkCommand = `${sshCommand} '
        if command -v rustdesk &> /dev/null || [ -f /Applications/RustDesk.app/Contents/MacOS/RustDesk ]; then
          echo "INSTALLED"
          # Try to get the ID
          if [ -f /Applications/RustDesk.app/Contents/MacOS/RustDesk ]; then
            # macOS
            /Applications/RustDesk.app/Contents/MacOS/RustDesk --get-id 2>/dev/null | grep -E "^[0-9]{9}$" | head -1 || true
          else
            # Linux
            rustdesk --get-id 2>/dev/null | grep -E "^[0-9]{9}$" | head -1 || true
          fi
        else
          echo "NOT_INSTALLED"
        fi
      '`;
      
      const result = await executeSSHCommand(checkCommand);
      const output = (result.stdout || result || '').toString().trim();
      const lines = output.split('\n').filter(line => line.trim());

      const isInstalled = lines[0] === 'INSTALLED';
      let rustdeskId = null;
      
      if (isInstalled && lines.length > 1) {
        // Check if second line is a valid RustDesk ID
        if (/^\d{9}$/.test(lines[1])) {
          rustdeskId = lines[1];
        }
      }
      
      // If installed but no ID found via command, try other methods
      if (isInstalled && !rustdeskId) {

        // Check config files
        const configCommand = `${sshCommand} '
          # Check macOS config
          if [ -f "$HOME/Library/Preferences/com.carriez.rustdesk/RustDesk.toml" ]; then
            grep -E "^id = .+[0-9]{9}" "$HOME/Library/Preferences/com.carriez.rustdesk/RustDesk.toml" | sed "s/id = .\\([0-9]\\{9\\}\\).*/\\1/" || true
          fi
          # Check Linux config
          if [ -f "$HOME/.config/rustdesk/RustDesk.toml" ]; then
            grep -E "^id = .+[0-9]{9}" "$HOME/.config/rustdesk/RustDesk.toml" | sed "s/id = .\\([0-9]\\{9\\}\\).*/\\1/" || true
          fi
        '`;
        
        const configResult = await executeSSHCommand(configCommand);
        const configOutput = (configResult.stdout || '').toString().trim();
        if (/^\d{9}$/.test(configOutput)) {
          rustdeskId = configOutput;
        }
      }
      
      // Update database if status changed
      if (isInstalled && rustdeskId && rustdeskId !== appliance.rustdeskId) {
        await db.update('appliances', {
          rustdeskInstalled: true,
          rustdeskId: rustdeskId
        }, { id: applianceId });
      } else if (!isInstalled && appliance.rustdeskInstalled) {
        // RustDesk was uninstalled
        await db.update('appliances', {
          rustdeskInstalled: false,
          rustdeskId: null
        }, { id: applianceId });
      }
      
      res.json({
        success: true,
        installed: isInstalled,
        rustdeskId: rustdeskId
      });
      
    } catch (sshError) {
      console.error('[RUSTDESK STATUS] SSH Error:', sshError);
      // If SSH fails, return database status
      return res.json({
        success: true,
        installed: !!appliance.rustdeskInstalled,
        rustdeskId: appliance.rustdeskId,
        sshError: true
      });
    }
    
  } catch (error) {
    console.error('[RUSTDESK STATUS] Error:', error);
    console.error('[RUSTDESK STATUS] Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to check RustDesk status',
      details: error.message
    });
  }
});

/**
 * GET /api/rustdeskInstall/host/:hostId/status
 * Check RustDesk installation status on the actual host (for hosts table)
 */
router.get('/host/:hostId/status', verifyToken, async (req, res) => {
  const { hostId } = req.params;
  let host = null; // Define host outside try block

  try {
    // Get host details
    const hosts = await db.select('hosts', 
      { id: hostId },
      { limit: 1 }
    );

    if (!hosts.length) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    host = hosts[0];

    // If RustDesk ID already exists in DB, verify it's still valid
    if (host.rustdeskId) {

    }
    
    // Check if we have SSH connection info
    if (!host.hostname || !host.username) {

      return res.json({
        success: true,
        installed: !!host.rustdeskId, // Installed if rustdeskId exists
        rustdeskId: host.rustdeskId
      });
    }
    
    // Prepare SSH configuration  
    // For user-specific keys, use the user prefix format
    const userId = host.created_by || 1;
    const sshConfig = {
      host: host.hostname,
      username: host.username,
      port: host.port || 22,
      privateKeyPath: host.ssh_key_name 
        ? `/root/.ssh/id_rsa_user${userId}_${host.ssh_key_name}` 
        : `/root/.ssh/id_rsa_user${userId}_dashboard`
    };

    // Build SSH command
    let sshCommand = 'ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null';
    
    if (sshConfig.privateKeyPath) {
      sshCommand += ` -i ${sshConfig.privateKeyPath}`;
    }
    
    sshCommand += ` ${sshConfig.username}@${sshConfig.host} -p ${sshConfig.port}`;
    
    // Check if RustDesk is installed on the host
    const checkCommand = `${sshCommand} '
      if command -v rustdesk &> /dev/null || [ -f /Applications/RustDesk.app/Contents/MacOS/RustDesk ]; then
        echo "INSTALLED"
      else
        echo "NOT_INSTALLED"
      fi
    '`;
    
    const result = await executeSSHCommand(checkCommand);
    const output = (result.stdout || result || '').toString();
    const installStatus = output.trim();

    const isInstalled = installStatus === 'INSTALLED';
    let rustdeskId = null;
    
    // If installed, try to find the ID using enhanced methods
    if (isInstalled) {
      // First check if we have an ID in the database
      rustdeskId = host.rustdeskId;
      
      // If no ID in DB or we want to verify it, use the enhanced finder
      if (!rustdeskId || rustdeskId === 'manual_required') {

        // Detect platform
        const platformCheck = await executeSSHCommand(`${sshCommand} "uname -s"`);
        const platformOutput = (platformCheck.stdout || platformCheck || '').toString();
        const platform = platformOutput.toLowerCase().includes('darwin') ? 'darwin' : 'linux';
        
        // Use enhanced ID finder
        rustdeskId = await findRustDeskId(sshCommand, platform);
        
        if (rustdeskId) {

        } else {

        }
      }
    }
    
    // Update database with current status
    if (isInstalled) {
      if (rustdeskId) {
        await db.update('hosts', 
          { rustdeskId: rustdeskId },
          { id: hostId }
        );
      }
      // If installed but no ID found, we keep the existing ID in the database
    } else {
      // RustDesk was uninstalled
      await db.update('hosts', 
        { rustdeskId: null },
        { id: hostId }
      );
    }
    
    res.json({
      success: true,
      installed: isInstalled,
      rustdeskId: rustdeskId
    });
    
  } catch (error) {
    console.error('[RUSTDESK STATUS] Error:', error);
    console.error('[RUSTDESK STATUS] Error stack:', error.stack);
    console.error('[RUSTDESK STATUS] Host data:', {
      id: hostId,
      hostname: host?.hostname,
      username: host?.username,
      sshKeyName: host?.ssh_key_name,
      created_by: host?.created_by
    });
    res.status(500).json({ 
      error: 'Failed to check RustDesk status',
      details: error.message,
      hostId: hostId
    });
  }
});

/**
 * Install RustDesk on macOS
 */
async function installRustDeskMacOS(sshConfig, useHostname = false, appliance = {}, password = null, progressCallback = null) {
  const installScript = `
#!/bin/bash
# RustDesk macOS Installation with automatic setup

# Progress reporting function
report_progress() {
    echo "PROGRESS:$1:$2"
}

report_progress "10" "Starting RustDesk installation..."

# Set PATH to include Homebrew locations
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Function to check if RustDesk is already installed
check_rustdesk() {
    if [ -d "/Applications/RustDesk.app" ]; then
        report_progress "15" "RustDesk already installed, checking ID..."
        echo "RustDesk already installed, checking ID..."
        # Try to get existing ID using different methods
        
        # Method 1: Try direct command
        if [ -f "/Applications/RustDesk.app/Contents/MacOS/RustDesk" ]; then
            # Kill RustDesk if running to ensure clean state
            pkill -f RustDesk 2>/dev/null || true
            sleep 2
            
            ID_ATTEMPT=$(/Applications/RustDesk.app/Contents/MacOS/RustDesk --get-id 2>&1 | grep -E '^[0-9]{9}$' | head -1)
            if [ -n "$ID_ATTEMPT" ]; then
                echo "Found ID via direct command: $ID_ATTEMPT"
                echo "RUSTDESK_ID:$ID_ATTEMPT"
                exit 0
            fi
        fi
        
        # Method 2: Check config file
        CONFIG_FILE="$HOME/Library/Preferences/com.carriez.rustdesk/RustDesk.toml"
        if [ -f "$CONFIG_FILE" ]; then
            ID_FROM_CONFIG=$(grep -E "^id = '[0-9]{9}'" "$CONFIG_FILE" | sed "s/id = '\\([0-9]\\{9\\}\\)'/\\1/")
            if [ -n "$ID_FROM_CONFIG" ]; then
                echo "Found ID in config: $ID_FROM_CONFIG"
                echo "RUSTDESK_ID:$ID_FROM_CONFIG"
                exit 0
            fi
        fi
        
        # Method 3: Check alternative config location
        ALT_CONFIG="$HOME/.config/rustdesk/RustDesk.toml"
        if [ -f "$ALT_CONFIG" ]; then
            ID_FROM_ALT=$(grep -E "^id = '[0-9]{9}'" "$ALT_CONFIG" | sed "s/id = '\\([0-9]\\{9\\}\\)'/\\1/")
            if [ -n "$ID_FROM_ALT" ]; then
                echo "Found ID in alt config: $ID_FROM_ALT"
                echo "RUSTDESK_ID:$ID_FROM_ALT"
                exit 0
            fi
        fi
        
        # If installed but no ID found, try to start it to generate one
        echo "RustDesk installed but no ID found. Starting RustDesk to generate ID..."
        open -a RustDesk
        sleep 5
        
        # Try again after starting
        ID_ATTEMPT=$(/Applications/RustDesk.app/Contents/MacOS/RustDesk --get-id 2>&1 | grep -E '^[0-9]{9}$' | head -1)
        if [ -n "$ID_ATTEMPT" ]; then
            echo "Found ID after starting: $ID_ATTEMPT"
            echo "RUSTDESK_ID:$ID_ATTEMPT"
            exit 0
        fi
        
        echo "MANUAL_ID_REQUIRED"
        exit 0
    fi
    return 1
}

# Check if already installed
if check_rustdesk; then
    exit 0
fi

report_progress "20" "Installing RustDesk for macOS..."
echo "Installing RustDesk for macOS..."

# Disable Homebrew auto-update for faster installation
export HOMEBREW_NO_AUTO_UPDATE=1

# Install via Homebrew if available
if [ -f "/opt/homebrew/bin/brew" ]; then
    report_progress "25" "Installing via Homebrew (Apple Silicon)..."
    echo "Installing via Homebrew (Apple Silicon)..."
    /opt/homebrew/bin/brew install --cask rustdesk 2>&1
    if [ $? -ne 0 ]; then
        echo "Homebrew installation failed, trying direct download..."
        HOMEBREW_FAILED=true
    fi
elif [ -f "/usr/local/bin/brew" ]; then
    report_progress "25" "Installing via Homebrew (Intel)..."
    echo "Installing via Homebrew (Intel)..."
    /usr/local/bin/brew install --cask rustdesk 2>&1
    if [ $? -ne 0 ]; then
        echo "Homebrew installation failed, trying direct download..."
        HOMEBREW_FAILED=true
    fi
elif command -v brew &> /dev/null; then
    echo "Installing via Homebrew..."
    brew install --cask rustdesk 2>&1
    if [ $? -ne 0 ]; then
        echo "Homebrew installation failed, trying direct download..."
        HOMEBREW_FAILED=true
    fi
else
    HOMEBREW_FAILED=true
fi

# Remove quarantine after successful Homebrew installation
if [ "$HOMEBREW_FAILED" != "true" ] && [ -d "/Applications/RustDesk.app" ]; then
    echo "Removing quarantine attributes from Homebrew installation..."
    sudo xattr -r -d com.apple.quarantine /Applications/RustDesk.app 2>/dev/null || true
    sudo spctl --add /Applications/RustDesk.app 2>/dev/null || true
fi

# If Homebrew failed or not available, use direct download
if [ "$HOMEBREW_FAILED" = "true" ] || [ ! -d "/Applications/RustDesk.app" ]; then
    # Direct download
    echo "Downloading RustDesk directly..."
    # Get the latest RustDesk version for macOS
    curl -L https://github.com/rustdesk/rustdesk/releases/download/1.4.0/rustdesk-1.4.0-aarch64.dmg -o /tmp/rustdesk.dmg
    
    echo "Mounting DMG..."
    hdiutil attach /tmp/rustdesk.dmg -nobrowse -quiet
    
    # List contents to see what's actually there
    echo "DMG contents:"
    ls -la /Volumes/RustDesk* || ls -la /Volumes/
    
    echo "Copying to Applications..."
    # Try different possible locations
    if [ -d "/Volumes/RustDesk/RustDesk.app" ]; then
        cp -R /Volumes/RustDesk/RustDesk.app /Applications/
    elif [ -d "/Volumes/RustDesk 1.4.0/RustDesk.app" ]; then
        cp -R "/Volumes/RustDesk 1.4.0/RustDesk.app" /Applications/
    elif [ -d "/Volumes/RustDesk-1.4.0/RustDesk.app" ]; then
        cp -R "/Volumes/RustDesk-1.4.0/RustDesk.app" /Applications/
    else
        # Find any RustDesk.app in mounted volumes
        RUSTDESK_APP=$(find /Volumes -name "RustDesk.app" -type d 2>/dev/null | head -1)
        if [ -n "$RUSTDESK_APP" ]; then
            echo "Found RustDesk at: $RUSTDESK_APP"
            cp -R "$RUSTDESK_APP" /Applications/
        else
            echo "ERROR: Could not find RustDesk.app in mounted DMG"
            ls -la /Volumes/*/
            exit 1
        fi
    fi
    
    echo "Unmounting DMG..."
    # Unmount all RustDesk volumes
    hdiutil detach /Volumes/RustDesk* 2>/dev/null || hdiutil detach "/Volumes/RustDesk 1.4.0" 2>/dev/null || true
    rm /tmp/rustdesk.dmg
fi

# Remove quarantine attribute to bypass Gatekeeper
echo "Removing quarantine attributes..."
sudo xattr -r -d com.apple.quarantine /Applications/RustDesk.app 2>/dev/null || true
sudo spctl --add /Applications/RustDesk.app 2>/dev/null || true

# Verify installation
if [ ! -d "/Applications/RustDesk.app" ]; then
    echo "ERROR: RustDesk installation failed!"
    exit 1
fi

# Configure RustDesk
echo "Configuring RustDesk..."
CONFIG_DIR="$HOME/Library/Preferences/com.carriez.rustdesk"
mkdir -p "$CONFIG_DIR"

# Note: Configure with your RustDesk server details if available
cat > "$CONFIG_DIR/RustDesk2.toml" << EOF
rendezvous_server = ''
nat_type = 1
serial = 0

[options]
direct-server = 'Y'
EOF

# Check and request permissions
echo "Checking macOS permissions..."

# Check if RustDesk has Screen Recording permission
if ! sqlite3 "/Library/Application Support/com.apple.TCC/TCC.db" "SELECT allowed FROM access WHERE service='kTCCServiceScreenCapture' AND client='com.carriez.rustdesk';" 2>/dev/null | grep -q 1; then
    echo "WARNING: Screen Recording permission not granted"
    echo "Opening System Preferences for Screen Recording..."
    # Open Screen Recording preferences
    open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
    NEEDS_PERMISSIONS=true
fi

# Check if RustDesk has Accessibility permission
if ! sqlite3 "/Library/Application Support/com.apple.TCC/TCC.db" "SELECT allowed FROM access WHERE service='kTCCServiceAccessibility' AND client='com.carriez.rustdesk';" 2>/dev/null | grep -q 1; then
    echo "WARNING: Accessibility permission not granted"
    echo "Opening System Preferences for Accessibility..."
    # Open Accessibility preferences
    open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
    NEEDS_PERMISSIONS=true
fi

# If permissions are needed, notify the user
if [ "$NEEDS_PERMISSIONS" = "true" ]; then
    echo "PERMISSIONS_REQUIRED"
    # Create a notification script
    osascript -e 'display notification "Bitte erlauben Sie RustDesk in den Systemeinstellungen Zugriff auf Bildschirmaufnahme und Bedienungshilfen" with title "RustDesk Berechtigungen erforderlich" sound name "Glass"'
fi

# Kill any existing RustDesk process
pkill -x RustDesk 2>/dev/null || true
sleep 2

# Start RustDesk in background to generate ID
echo "Starting RustDesk to generate ID..."
# Try to run RustDesk without GUI
/Applications/RustDesk.app/Contents/MacOS/RustDesk --service 2>/dev/null &
RUSTDESK_PID=$!
sleep 5

# Try multiple methods to get the ID
echo "Attempting to retrieve RustDesk ID..."

# Method 1: Direct command
RUSTDESK_ID=$(/Applications/RustDesk.app/Contents/MacOS/RustDesk --get-id 2>&1 | grep -E '^[0-9]{9}$' | head -1)

# Method 2: Check config files if direct command fails
if [ -z "$RUSTDESK_ID" ]; then
    echo "Direct command failed, checking config files..."
    for config in "$HOME/Library/Preferences/com.carriez.rustdesk/RustDesk.toml" "$HOME/.config/rustdesk/RustDesk.toml"; do
        if [ -f "$config" ]; then
            RUSTDESK_ID=$(grep -E "^id = '[0-9]{9}'" "$config" | sed "s/id = '\\([0-9]\\{9\\}\\)'/\\1/")
            if [ -n "$RUSTDESK_ID" ]; then
                echo "Found ID in config: $config"
                break
            fi
        fi
    done
fi

# Kill the service we started
kill $RUSTDESK_PID 2>/dev/null || true

if [ -n "$RUSTDESK_ID" ]; then
    echo "RustDesk ID: $RUSTDESK_ID"
    
    # Set password if provided
    if [ -n "$RUSTDESK_PASSWORD" ]; then
        echo "Setting RustDesk password..."
        
        # First ensure RustDesk is not running
        pkill -x RustDesk 2>/dev/null || true
        sleep 2
        
        # Find the RustDesk config file
        CONFIG_FILE="$HOME/Library/Preferences/com.carriez.rustdesk/RustDesk2.toml"
        
        if [ ! -f "$CONFIG_FILE" ]; then
            # Try alternative location
            CONFIG_FILE="$HOME/.config/rustdesk/RustDesk2.toml"
        fi
        
        if [ -f "$CONFIG_FILE" ]; then
            echo "Found config file at: $CONFIG_FILE"
            
            # Use the RustDesk CLI to set the password properly
            /Applications/RustDesk.app/Contents/MacOS/RustDesk --password "$RUSTDESK_PASSWORD" 2>/dev/null
            sleep 2
            
            # Verify the password was set (check if password field exists in config)
            if grep -q "password" "$CONFIG_FILE"; then
                echo "Password appears to be set in config"
            else
                echo "WARNING: Password might not be set correctly"
                # Try alternative method - directly modify config
                # But this requires knowing the hash format
            fi
        else
            echo "WARNING: Could not find RustDesk config file"
            # Try to set password anyway
            /Applications/RustDesk.app/Contents/MacOS/RustDesk --password "$RUSTDESK_PASSWORD" 2>/dev/null
        fi
        
        echo "Password setting attempted"
    fi
    
    # Add RustDesk to Login Items for auto-start
    echo "Adding RustDesk to Login Items..."
    osascript -e 'tell application "System Events" to make login item at end with properties {path:"/Applications/RustDesk.app", hidden:false}' 2>/dev/null || {
        echo "Alternative method: Adding to LaunchAgents..."
        # Create LaunchAgent as fallback
        mkdir -p "$HOME/Library/LaunchAgents"
        cat > "$HOME/Library/LaunchAgents/com.rustdesk.launcher.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.rustdesk.launcher</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/RustDesk.app/Contents/MacOS/RustDesk</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>
PLIST
        launchctl load "$HOME/Library/LaunchAgents/com.rustdesk.launcher.plist" 2>/dev/null || true
    }
    
    # Start RustDesk now
    echo "Starting RustDesk..."
    # Try to start RustDesk - this might not work over SSH without GUI session
    if [ -n "$DISPLAY" ]; then
        open -a RustDesk 2>/dev/null || /Applications/RustDesk.app/Contents/MacOS/RustDesk &
    else
        echo "Note: RustDesk will start automatically at next login"
        # Try to start it anyway in background
        nohup /Applications/RustDesk.app/Contents/MacOS/RustDesk > /dev/null 2>&1 &
    fi
    
    # Open System Preferences to grant permissions
    echo "Opening System Preferences for permission setup..."
    osascript -e 'tell application "System Preferences"
        activate
        reveal anchor "Privacy" of pane id "com.apple.preference.security"
    end tell' 2>/dev/null || echo "Please manually grant Screen Recording and Accessibility permissions to RustDesk"
    
    echo "RUSTDESK_ID:$RUSTDESK_ID"
    exit 0
else
    # Last resort: manual ID required
    echo "WARNING: Could not retrieve RustDesk ID, but installation completed"
    echo "Manual ID retrieval may be required"
    echo "MANUAL_ID_REQUIRED"
    exit 0
fi
`;
  
  // Create temporary script on remote host
  const scriptPath = '/tmp/install-rustdesk.sh';
  
  // Build proper SSH command - use hostname if available
  let sshCommand;
  if (useHostname && sshConfig.hostname) {
    // Use the actual host IP instead of hostname for better compatibility
    const actualHost = sshConfig.host || sshConfig.hostname;
    const keyName = appliance.key_name || 'dashboard';
    sshCommand = `ssh -i ~/.ssh/id_rsa_${keyName} -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${sshConfig.username}@${actualHost}`;
  } else {
    // For other hosts, use the dashboard key
    sshCommand = `ssh -i ~/.ssh/id_rsa_dashboard -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${sshConfig.username}@${sshConfig.host} -p ${sshConfig.port || 22}`;
  }
  
  // First, save the script to a local temp file
  const localScriptPath = path.join(os.tmpdir(), `rustdesk-install-${Date.now()}.sh`);
  
  try {
    // Write script to local file
    await fs.writeFile(localScriptPath, installScript, 'utf8');
    
    // Copy the script file to remote host using scp
    let scpCommand;
    if (useHostname && sshConfig.hostname) {
      const actualHost = sshConfig.host || sshConfig.hostname;
      const keyName = appliance.ssh_key_name || 'dashboard';
      scpCommand = `scp -i ~/.ssh/id_rsa_${keyName} -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${localScriptPath} ${sshConfig.username}@${actualHost}:${scriptPath}`;
    } else {
      scpCommand = `scp -i ~/.ssh/id_rsa_dashboard -o StrictHostKeyChecking=no -o ConnectTimeout=10 -P ${sshConfig.port || 22} ${localScriptPath} ${sshConfig.username}@${sshConfig.host}:${scriptPath}`;
    }
    
    await executeSSHCommand(scpCommand, 60000); // 1 minute timeout for file transfer
    
    // Clean up local temp file
    await fs.unlink(localScriptPath).catch(() => {});
  } catch (error) {
    // Fallback: try to create script using echo commands if scp fails

    // Create empty file first
    await executeSSHCommand(`${sshCommand} "touch ${scriptPath}"`);
    
    // Write script line by line (split into smaller chunks)
    const lines = installScript.split('\n');
    const chunkSize = 50; // Write 50 lines at a time
    
    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, i + chunkSize).join('\n');
      const escapedChunk = chunk.replace(/'/g, "'\"'\"'");
      await executeSSHCommand(`${sshCommand} "echo '${escapedChunk}' >> ${scriptPath}"`, 30000);
    }
  }
  
  await executeSSHCommand(`${sshCommand} "chmod +x ${scriptPath}"`);
  
  // Execute installation script with extended timeout for Homebrew
  // Pass password as environment variable if available
  let bashCommand = `bash ${scriptPath}`;
  if (password) {
    // Escape the password for shell and export it
    const escapedPassword = password.replace(/'/g, "'\\''");
    bashCommand = `export RUSTDESK_PASSWORD='${escapedPassword}' && ${bashCommand}`;
  }
  // Execute with progress callback
  const progressHandler = (data) => {
    const progressMatch = data.match(/PROGRESS:(\d+):(.+)/);
    if (progressMatch && progressCallback) {
      progressCallback(parseInt(progressMatch[1]), progressMatch[2]);
    }
  };
  
  // For now, disable progress callback to fix the issue
  const result = await executeSSHCommand(`${sshCommand} "${bashCommand}"`, 300000); // 5 minutes timeout - needed for Homebrew updates
  
  // Parse progress from result output
  if (result.stdout && progressCallback) {
    const lines = result.stdout.split('\n');
    for (const line of lines) {
      progressHandler(line);
    }
  }
  
  // Extract RustDesk ID from output
  const output = result.stdout || '';

  // Look for ID in the special format RUSTDESK_ID:123456789
  let idMatch = output.match(/RUSTDESK_ID:(\d{9})/);
  
  if (!idMatch) {
    // Try other patterns as fallback
    const idPatterns = [
      /\b\d{9}\b/,
      /Found ID[^:]*: (\d{9})/,
      /RustDesk ID: (\d{9})/,
      /^(\d{9})$/m
    ];
    
    for (const pattern of idPatterns) {
      const match = output.match(pattern);
      if (match) {
        idMatch = [match[0], match[1] || match[0]];
        break;
      }
    }
  }
  
  if (!idMatch) {
    console.error('Failed to extract ID from output');
    // Check if permissions are required
    if (output.includes('PERMISSIONS_REQUIRED')) {
      // Still try to extract the ID if possible
      const idPatterns = [
        /RUSTDESK_ID:(\d{9})/,
        /RustDesk ID: (\d{9})/,
        /\b\d{9}\b/
      ];
      
      for (const pattern of idPatterns) {
        const match = output.match(pattern);
        if (match) {
          // Return object with ID and permission flag
          return {
            id: match[1] || match[0],
            permissionsRequired: true
          };
        }
      }
    }
    // Check if manual ID is required
    if (output.includes('MANUAL_ID_REQUIRED')) {
      return 'MANUAL_ID_REQUIRED';
    }
    // For any installation issues, return manual ID required
    if (output.includes('RustDesk already installed') || output.includes('Starting RustDesk') || output.includes('Configuring RustDesk')) {
      return 'MANUAL_ID_REQUIRED';
    }
    throw new Error('Failed to get RustDesk ID from installation');
  }
  
  // Check if permissions are required even if ID was found
  if (output.includes('PERMISSIONS_REQUIRED')) {
    return {
      id: idMatch[1],
      permissionsRequired: true
    };
  }
  
  // Clean up
  await executeSSHCommand(`${sshCommand} "rm -f ${scriptPath}"`).catch(() => {});
  
  return idMatch[1];
}

/**
 * Install RustDesk on Linux
 */
async function installRustDeskLinux(sshConfig, useHostname = false, appliance = {}, password = null, progressCallback = null) {
  const installScript = `
#!/bin/bash
set -e

# RustDesk Linux Installation Script with progress reporting

# Progress reporting function
report_progress() {
    echo "PROGRESS:$1:$2"
}

report_progress "10" "Starting RustDesk installation on Linux..."
echo "Installing RustDesk on Linux..."

# Check if already installed
if command -v rustdesk &> /dev/null; then
    report_progress "15" "RustDesk already installed, getting ID..."
    echo "RustDesk already installed, getting ID..."
    EXISTING_ID=$(rustdesk --get-id 2>/dev/null | grep -E '^[0-9]{9}$' | head -1)
    if [ -n "$EXISTING_ID" ]; then
        echo "$EXISTING_ID"
        exit 0
    fi
fi

report_progress "20" "Detecting Linux distribution..."
# Detect distribution
if [ -f /etc/debian_version ]; then
    # Debian/Ubuntu
    echo "Detected Debian/Ubuntu"
    report_progress "30" "Downloading RustDesk for Debian/Ubuntu..."
    wget -q https://github.com/rustdesk/rustdesk/releases/download/1.2.3/rustdesk-1.2.3-x86_64.deb
    report_progress "50" "Installing RustDesk package..."
    sudo dpkg -i rustdesk-1.2.3-x86_64.deb || sudo apt-get install -f -y
    rm rustdesk-1.2.3-x86_64.deb
elif [ -f /etc/redhat-release ]; then
    # RHEL/CentOS/Fedora
    echo "Detected RHEL/CentOS/Fedora"
    report_progress "30" "Downloading RustDesk for RHEL/CentOS/Fedora..."
    wget -q https://github.com/rustdesk/rustdesk/releases/download/1.2.3/rustdesk-1.2.3.rpm
    report_progress "50" "Installing RustDesk package..."
    sudo rpm -i rustdesk-1.2.3.rpm
    rm rustdesk-1.2.3.rpm
else
    echo "Unsupported distribution"
    exit 1
fi

report_progress "70" "Configuring RustDesk..."
# Configure RustDesk
mkdir -p ~/.config/rustdesk
cat > ~/.config/rustdesk/RustDesk2.toml << EOF
rendezvous_server = ''
nat_type = 1
serial = 0

[options]
direct-server = 'Y'
EOF

# For headless systems, we need to run rustdesk in a virtual display
if ! command -v X &> /dev/null && ! [ -n "$DISPLAY" ]; then
    echo "No X server detected, installing virtual display..."
    if [ -f /etc/debian_version ]; then
        sudo apt-get update
        sudo apt-get install -y xvfb
    elif [ -f /etc/redhat-release ]; then
        sudo yum install -y xorg-x11-server-Xvfb
    fi
    
    # Start virtual display
    Xvfb :99 -screen 0 1024x768x16 &
    export DISPLAY=:99
    sleep 2
fi

# Start RustDesk service if systemd is available
report_progress "80" "Configuring auto-start..."
if command -v systemctl &> /dev/null; then
    # Create systemd service file
    sudo tee /etc/systemd/system/rustdesk.service > /dev/null << SYSTEMD
[Unit]
Description=RustDesk Remote Desktop
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/rustdesk
Restart=on-failure
RestartSec=10
User=$USER
Environment="DISPLAY=:0"

[Install]
WantedBy=multi-user.target
SYSTEMD
    
    sudo systemctl daemon-reload
    sudo systemctl enable rustdesk 2>/dev/null || true
    sudo systemctl start rustdesk 2>/dev/null || true
    echo "RustDesk service configured for auto-start"
else
    # Fallback for non-systemd systems
    echo "Adding RustDesk to user autostart..."
    mkdir -p ~/.config/autostart
    cat > ~/.config/autostart/rustdesk.desktop << DESKTOP
[Desktop Entry]
Type=Application
Name=RustDesk
Exec=/usr/bin/rustdesk
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
DESKTOP
fi

# Ensure RustDesk is running now
report_progress "85" "Starting RustDesk..."
if pgrep -x rustdesk > /dev/null; then
    echo "RustDesk is already running"
else
    rustdesk > /dev/null 2>&1 &
    echo "RustDesk started"
fi

# Get ID
report_progress "90" "Retrieving RustDesk ID..."
sleep 2
RUSTDESK_ID=$(rustdesk --get-id 2>/dev/null | grep -E '^[0-9]{9}$' | head -1)

if [ -n "$RUSTDESK_ID" ]; then
    echo "RustDesk ID: $RUSTDESK_ID"
    echo "$RUSTDESK_ID"
else
    echo "ERROR: Failed to get RustDesk ID"
    exit 1
fi
`;
  
  // Create temporary script on remote host
  const scriptPath = '/tmp/install-rustdesk.sh';
  
  // Build proper SSH command - use hostname if available
  let sshCommand;
  if (useHostname && sshConfig.hostname) {
    // Use the actual host IP instead of hostname for better compatibility
    const actualHost = sshConfig.host || sshConfig.hostname;
    const keyName = appliance.key_name || 'dashboard';
    sshCommand = `ssh -i ~/.ssh/id_rsa_${keyName} -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${sshConfig.username}@${actualHost}`;
  } else {
    // For other hosts, use the dashboard key
    sshCommand = `ssh -i ~/.ssh/id_rsa_dashboard -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${sshConfig.username}@${sshConfig.host} -p ${sshConfig.port || 22}`;
  }
  
  // First, save the script to a local temp file
  const localScriptPath = path.join(os.tmpdir(), `rustdesk-install-linux-${Date.now()}.sh`);
  
  try {
    // Write script to local file
    await fs.writeFile(localScriptPath, installScript, 'utf8');
    
    // Copy the script file to remote host using scp
    let scpCommand;
    if (useHostname && sshConfig.hostname) {
      const actualHost = sshConfig.host || sshConfig.hostname;
      const keyName = appliance.ssh_key_name || 'dashboard';
      scpCommand = `scp -i ~/.ssh/id_rsa_${keyName} -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${localScriptPath} ${sshConfig.username}@${actualHost}:${scriptPath}`;
    } else {
      scpCommand = `scp -i ~/.ssh/id_rsa_dashboard -o StrictHostKeyChecking=no -o ConnectTimeout=10 -P ${sshConfig.port || 22} ${localScriptPath} ${sshConfig.username}@${sshConfig.host}:${scriptPath}`;
    }
    
    await executeSSHCommand(scpCommand, 60000); // 1 minute timeout for file transfer
    
    // Clean up local temp file
    await fs.unlink(localScriptPath).catch(() => {});
  } catch (error) {
    // Fallback: try to create script using echo commands if scp fails

    // Create empty file first
    await executeSSHCommand(`${sshCommand} "touch ${scriptPath}"`);
    
    // Write script line by line (split into smaller chunks)
    const lines = installScript.split('\n');
    const chunkSize = 50; // Write 50 lines at a time
    
    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, i + chunkSize).join('\n');
      const escapedChunk = chunk.replace(/'/g, "'\"'\"'");
      await executeSSHCommand(`${sshCommand} "echo '${escapedChunk}' >> ${scriptPath}"`, 30000);
    }
  }
  
  await executeSSHCommand(`${sshCommand} "chmod +x ${scriptPath}"`);
  
  // Execute installation script with extended timeout for Homebrew
  // Pass password as environment variable if available
  let bashCommand = `bash ${scriptPath}`;
  if (password) {
    // Escape the password for shell and export it
    const escapedPassword = password.replace(/'/g, "'\\''");
    bashCommand = `export RUSTDESK_PASSWORD='${escapedPassword}' && ${bashCommand}`;
  }
  // Execute with progress callback
  const progressHandler = (data) => {
    const progressMatch = data.match(/PROGRESS:(\d+):(.+)/);
    if (progressMatch && progressCallback) {
      progressCallback(parseInt(progressMatch[1]), progressMatch[2]);
    }
  };
  
  // For now, disable progress callback to fix the issue
  const result = await executeSSHCommand(`${sshCommand} "${bashCommand}"`, 300000); // 5 minutes timeout - needed for Homebrew updates
  
  // Parse progress from result output
  if (result.stdout && progressCallback) {
    const lines = result.stdout.split('\n');
    for (const line of lines) {
      progressHandler(line);
    }
  }
  
  // Extract RustDesk ID from output
  const output = result.stdout || '';

  // Look for ID in the special format RUSTDESK_ID:123456789
  let idMatch = output.match(/RUSTDESK_ID:(\d{9})/);
  
  if (!idMatch) {
    // Try other patterns as fallback
    const idPatterns = [
      /\b\d{9}\b/,
      /Found ID[^:]*: (\d{9})/,
      /RustDesk ID: (\d{9})/,
      /^(\d{9})$/m
    ];
    
    for (const pattern of idPatterns) {
      const match = output.match(pattern);
      if (match) {
        idMatch = [match[0], match[1] || match[0]];
        break;
      }
    }
  }
  
  if (!idMatch) {
    console.error('Failed to extract ID from output');
    // Check if manual ID is required
    if (output.includes('MANUAL_ID_REQUIRED')) {
      return 'MANUAL_ID_REQUIRED';
    }
    // For any installation issues, return manual ID required
    if (output.includes('RustDesk already installed') || output.includes('Starting RustDesk') || output.includes('Configuring RustDesk')) {
      return 'MANUAL_ID_REQUIRED';
    }
    throw new Error('Failed to get RustDesk ID from installation');
  }
  
  // Clean up
  await executeSSHCommand(`${sshCommand} "rm -f ${scriptPath}"`).catch(() => {});
  
  return idMatch[1];
}

/**
 * PUT /api/rustdesk-install/:applianceId/id
 * Update only the RustDesk ID
 */
router.put('/:applianceId/id', verifyToken, async (req, res) => {
  const { applianceId } = req.params;
  const { rustdeskId } = req.body;
  
  if (!rustdeskId || rustdeskId.length !== 9) {
    return res.status(400).json({ error: 'Invalid RustDesk ID format' });
  }
  
  try {
    await db.update('appliances', {
      rustdeskId: rustdeskId,
      rustdeskInstalled: true,
      rustdeskInstallationDate: new Date()
    }, { id: applianceId });
    
    res.json({ success: true, rustdeskId });
  } catch (error) {
    console.error('Error updating RustDesk ID:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/rustdesk-install/:applianceId/password
 * Update RustDesk password to match remote password
 */
router.put('/:applianceId/password', verifyToken, async (req, res) => {
  const { applianceId } = req.params;
  
  try {
    // Get appliance details with SSH connection info
    const appliance = await db.findOneWithJoin({
      from: 'appliances',
      select: ['appliances.*', 'hosts.hostname', 'hosts.username', 'hosts.port', 'hosts.ssh_key_name'],
      joins: [{
        table: 'hosts',
        on: 'appliances.ssh_connection = CONCAT(hosts.username, "@", hosts.hostname, ":", hosts.port) OR appliances.ssh_connection = CONCAT(hosts.username, "@", hosts.hostname)',
        type: 'LEFT'
      }],
      where: { 'appliances.id': applianceId }
    });
    
    if (!appliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }
    
    // Check if RustDesk is installed
    if (!appliance.rustdesk_installed || !appliance.rustdeskId) {
      return res.status(400).json({ error: 'RustDesk is not installed on this appliance' });
    }
    
    // Decrypt the remote password
    const { decrypt } = require('../utils/encryption');
    const password = decrypt(appliance.remote_password_encrypted);
    
    if (!password) {
      return res.status(400).json({ error: 'No remote password configured' });
    }
    
    // Build SSH config
    let sshHost, sshUsername = 'root', sshPort = 22;
    let useHostname = false;
    
    if (appliance.hosts_hostname) {
      sshHost = appliance.hosts_hostname;
      sshUsername = appliance.hosts_username;
      sshPort = appliance.hosts_port || 22;
      useHostname = true;
    } else if (appliance.sshConnection) {
      const sshParts = appliance.sshConnection.match(/^(?:([^@]+)@)?([^:]+)(?::(\d+))?$/);
      if (sshParts) {
        sshUsername = sshParts[1] || 'root';
        sshHost = sshParts[2];
        sshPort = parseInt(sshParts[3] || '22');
      }
    }
    
    // Build SSH command
    let sshCommand;
    const actualHost = appliance.host || appliance.hosts_hostname;
    const keyName = appliance.keyName || 'dashboard';
    
    if (useHostname && appliance.hosts_hostname) {
      sshCommand = `ssh -i ~/.ssh/id_rsa_${keyName} -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${sshUsername}@${actualHost}`;
    } else {
      sshCommand = `ssh -i ~/.ssh/id_rsa_dashboard -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${sshUsername}@${sshHost} -p ${sshPort || 22}`;
    }
    
    // Update RustDesk password via SSH
    const escapedPassword = password.replace(/'/g, "'\\''");
    const updateScript = `pkill -x RustDesk 2>/dev/null || true; sleep 2; /Applications/RustDesk.app/Contents/MacOS/RustDesk --password '${escapedPassword}' & sleep 3; pkill -x RustDesk 2>/dev/null || true; echo "Password updated successfully"`;
    
    await executeSSHCommand(`${sshCommand} "${updateScript}"`);
    
    res.json({
      success: true,
      message: 'RustDesk password updated successfully'
    });
    
  } catch (error) {
    console.error('RustDesk password update error:', error);
    res.status(500).json({ 
      error: 'Failed to update RustDesk password',
      details: error.message 
    });
  }
});

/**
 * POST /api/rustdeskInstall/host/:hostId
 * Install RustDesk on a host
 */
router.post('/host/:hostId', verifyToken, async (req, res) => {
  const { hostId } = req.params;
  const { password } = req.body;

  try {
    // Get host details
    const hosts = await db.select('hosts', 
      { id: hostId },
      { limit: 1 }
    );
    
    if (hosts.length === 0) {
      return res.status(404).json({ error: 'Host not found' });
    }
    
    const host = hosts[0];

    // Build SSH config
    const sshConfig = {
      host: host.hostname,
      username: host.username,
      port: host.port || 22,
      privateKey: null
    };
    
    // Get SSH key if specified
    if (host.ssh_key_name) {

      const keys = await db.select('ssh_keys',
        { key_name: host.ssh_key_name },
        { limit: 1 }
      );
      
      if (keys.length > 0) {
        sshConfig.privateKey = keys[0].private_key;
      }
    } else {
      // Use dashboard key as default

      const keys = await db.select('ssh_keys',
        { key_name: 'dashboard' },
        { limit: 1 }
      );
      
      if (keys.length > 0) {
        sshConfig.privateKey = keys[0].private_key;
      }
    }
    
    // Install RustDesk based on platform
    let result;
    const platform = host.platform || 'mac';
    
    if (platform === 'mac' || platform === 'darwin') {

      result = await installRustDeskMacOS(sshConfig, true, host, password);
    } else if (platform === 'linux') {

      result = await installRustDeskLinux(sshConfig, true, host, password);
    } else {
      return res.status(400).json({ 
        error: 'Unsupported platform',
        platform: platform 
      });
    }
    
    // Update host with RustDesk info if installation was successful
    if (result && result.rustdeskId) {
      await db.update('hosts',
        { 
          rustdesk_installed: true,
          rustdesk_id: result.rustdeskId,
          rustdesk_password: password || null
        },
        { id: hostId }
      );

      res.json({
        success: true,
        installed: true,
        rustdeskId: result.rustdeskId,
        message: 'RustDesk installed successfully'
      });
    } else {
      res.json({
        success: true,
        installed: true,
        message: 'RustDesk installed but ID retrieval pending'
      });
    }
    
  } catch (error) {
    console.error('[RUSTDESK INSTALL] Error:', error);
    res.status(500).json({ 
      error: 'Failed to install RustDesk',
      details: error.message 
    });
  }
});

module.exports = router;
