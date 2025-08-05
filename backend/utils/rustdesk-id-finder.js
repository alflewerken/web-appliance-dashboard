/**
 * RustDesk ID Finder Utility
 * Enhanced methods to find RustDesk ID on different platforms
 */

const { executeSSHCommand } = require('./ssh-utils');

/**
 * Try multiple methods to find RustDesk ID on macOS
 */
async function findRustDeskIdMacOS(sshCommand) {
  const methods = [
    // Method 1: Direct command
    {
      name: 'Direct command',
      command: `${sshCommand} "/Applications/RustDesk.app/Contents/MacOS/RustDesk --get-id 2>/dev/null | grep -E '^[0-9]{9}$' | head -1"`
    },
    
    // Method 2: Check plist files
    {
      name: 'Plist file (defaults)',
      command: `${sshCommand} "defaults read com.carriez.rustdesk 2>/dev/null | grep -E 'id.*=.*[0-9]{9}' | grep -oE '[0-9]{9}'"`
    },
    
    // Method 3: Check all RustDesk config files
    {
      name: 'Config files',
      command: `${sshCommand} "find ~/Library -name '*rustdesk*' -type f 2>/dev/null | xargs grep -l '[0-9]{9}' 2>/dev/null | head -5 | xargs grep -oE '[0-9]{9}' 2>/dev/null | grep -E '^[0-9]{9}$' | head -1"`
    },
    
    // Method 4: Check specific config locations
    {
      name: 'RustDesk.toml',
      command: `${sshCommand} "for f in ~/Library/Preferences/com.carriez.rustdesk/RustDesk.toml ~/Library/Preferences/com.carriez.rustdesk/RustDesk2.toml ~/.config/rustdesk/RustDesk.toml; do [ -f \\$f ] && grep -E 'id.*=.*[0-9]{9}' \\$f | grep -oE '[0-9]{9}' | head -1; done | head -1"`
    },
    
    // Method 5: Check running process
    {
      name: 'Process arguments',
      command: `${sshCommand} "ps aux | grep -i rustdesk | grep -oE 'id:[0-9]{9}' | cut -d: -f2 | head -1"`
    },
    
    // Method 6: Check log files
    {
      name: 'Log files',
      command: `${sshCommand} "find ~/Library/Logs -name '*rustdesk*' -type f 2>/dev/null | xargs grep -oE 'ID:.*[0-9]{9}' 2>/dev/null | grep -oE '[0-9]{9}' | head -1"`
    },
    
    // Method 7: Binary strings search
    {
      name: 'Binary search',
      command: `${sshCommand} "strings /Applications/RustDesk.app/Contents/MacOS/RustDesk 2>/dev/null | grep -E '^[0-9]{9}$' | head -1"`
    },
    
    // Method 8: Check Application Support
    {
      name: 'Application Support',
      command: `${sshCommand} "find ~/Library/Application\\ Support -name '*rustdesk*' -type f 2>/dev/null | xargs grep -oE '[0-9]{9}' 2>/dev/null | grep -E '^[0-9]{9}$' | head -1"`
    }
  ];

  console.log('[RUSTDESK ID FINDER] Trying to find RustDesk ID on macOS...');
  
  for (const method of methods) {
    try {
      console.log(`[RUSTDESK ID FINDER] Trying ${method.name}...`);
      const result = await executeSSHCommand(method.command, 10000);
      const output = (result.stdout || result || '').toString().trim();
      
      if (output && /^\d{9}$/.test(output)) {
        console.log(`[RUSTDESK ID FINDER] Success with ${method.name}: ${output}`);
        return output;
      }
    } catch (error) {
      console.log(`[RUSTDESK ID FINDER] ${method.name} failed:`, error.message);
    }
  }
  
  console.log('[RUSTDESK ID FINDER] All methods failed to find ID');
  return null;
}

/**
 * Try multiple methods to find RustDesk ID on Linux
 */
async function findRustDeskIdLinux(sshCommand) {
  const methods = [
    // Method 1: Direct command
    {
      name: 'Direct command',
      command: `${sshCommand} "rustdesk --get-id 2>/dev/null | grep -E '^[0-9]{9}$' | head -1"`
    },
    
    // Method 2: Check config files
    {
      name: 'Config files',
      command: `${sshCommand} "for f in ~/.config/rustdesk/RustDesk.toml ~/.config/rustdesk/RustDesk2.toml; do [ -f \\$f ] && grep -E 'id.*=.*[0-9]{9}' \\$f | grep -oE '[0-9]{9}' | head -1; done | head -1"`
    },
    
    // Method 3: Check systemd logs
    {
      name: 'Systemd logs',
      command: `${sshCommand} "journalctl -u rustdesk --no-pager 2>/dev/null | grep -oE 'ID:.*[0-9]{9}' | grep -oE '[0-9]{9}' | head -1"`
    },
    
    // Method 4: Check process
    {
      name: 'Process info',
      command: `${sshCommand} "ps aux | grep -i rustdesk | grep -oE 'id:[0-9]{9}' | cut -d: -f2 | head -1"`
    },
    
    // Method 5: Check all config locations
    {
      name: 'All configs',
      command: `${sshCommand} "find ~ -name '*rustdesk*' -type f 2>/dev/null | xargs grep -l '[0-9]{9}' 2>/dev/null | head -5 | xargs grep -oE '[0-9]{9}' 2>/dev/null | grep -E '^[0-9]{9}$' | head -1"`
    }
  ];

  console.log('[RUSTDESK ID FINDER] Trying to find RustDesk ID on Linux...');
  
  for (const method of methods) {
    try {
      console.log(`[RUSTDESK ID FINDER] Trying ${method.name}...`);
      const result = await executeSSHCommand(method.command, 10000);
      const output = (result.stdout || result || '').toString().trim();
      
      if (output && /^\d{9}$/.test(output)) {
        console.log(`[RUSTDESK ID FINDER] Success with ${method.name}: ${output}`);
        return output;
      }
    } catch (error) {
      console.log(`[RUSTDESK ID FINDER] ${method.name} failed:`, error.message);
    }
  }
  
  console.log('[RUSTDESK ID FINDER] All methods failed to find ID');
  return null;
}

/**
 * Main function to find RustDesk ID
 */
async function findRustDeskId(sshCommand, platform) {
  if (platform === 'darwin' || platform === 'macos') {
    return await findRustDeskIdMacOS(sshCommand);
  } else if (platform === 'linux') {
    return await findRustDeskIdLinux(sshCommand);
  } else {
    console.log(`[RUSTDESK ID FINDER] Unsupported platform: ${platform}`);
    return null;
  }
}

module.exports = {
  findRustDeskId,
  findRustDeskIdMacOS,
  findRustDeskIdLinux
};
