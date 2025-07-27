/**
 * Terminal Session Fix - Alternative Approach
 * 
 * Dieses Script bietet eine alternative Lösung für das Terminal-Session-Problem
 * durch direkte URL-Parameter-Übertragung statt Session-Files
 */

const fs = require('fs').promises;
const path = require('path');

async function implementTerminalFix() {
  console.log('🔧 Implementing Terminal Session Fix...\n');
  
  // 1. Update ttyd wrapper script to accept URL parameters directly
  const ttydWrapperPath = path.join(__dirname, '../../scripts/ttyd-ssh-wrapper-fixed.sh');
  
  const ttydWrapperContent = `#!/bin/bash
# SSH-Wrapper für ttyd - Fixed Version with Direct URL Parameters

clear

echo "=================================================================================="
echo "Web Appliance Dashboard Terminal"
echo "=================================================================================="
echo ""

# Parse query string from TTYD_ARG if available
# ttyd passes the query string as an environment variable
if [ -n "$TTYD_ARG" ]; then
    echo "Debug: TTYD_ARG = $TTYD_ARG"
    
    # Parse query parameters
    IFS='&' read -ra PARAMS <<< "$TTYD_ARG"
    for param in "\${PARAMS[@]}"; do
        IFS='=' read -ra KV <<< "$param"
        case "\${KV[0]}" in
            host) SSH_HOST="\${KV[1]}" ;;
            user) SSH_USER="\${KV[1]}" ;;
            port) SSH_PORT="\${KV[1]}" ;;
        esac
    done
fi

# Alternative: Check command line arguments
if [ $# -ge 3 ]; then
    SSH_HOST="$1"
    SSH_USER="$2"
    SSH_PORT="$3"
    echo "Using command line arguments"
fi

# Fallback: Check environment variables
SSH_HOST=\${SSH_HOST:-\${TTYD_SSH_HOST}}
SSH_USER=\${SSH_USER:-\${TTYD_SSH_USER}}
SSH_PORT=\${SSH_PORT:-\${TTYD_SSH_PORT:-22}}

# Final check for session file as last resort
if [ -z "$SSH_HOST" ] || [ -z "$SSH_USER" ]; then
    SESSION_DIR="/tmp/terminal-sessions"
    MARKER_FILE="$SESSION_DIR/latest-session.conf"
    
    if [ -f "$MARKER_FILE" ]; then
        file_age=$(($(date +%s) - $(stat -c %Y "$MARKER_FILE" 2>/dev/null || echo 0)))
        if [ $file_age -le 30 ]; then
            source "$MARKER_FILE"
        fi
    fi
fi

# Connect if we have the required information
if [ -n "$SSH_HOST" ] && [ -n "$SSH_USER" ]; then
    echo "Verbinde mit: $SSH_USER@$SSH_HOST:$SSH_PORT"
    echo ""
    
    ssh -o StrictHostKeyChecking=no \\
        -o UserKnownHostsFile=/dev/null \\
        -o LogLevel=ERROR \\
        -o ServerAliveInterval=30 \\
        -o ServerAliveCountMax=3 \\
        -o ConnectTimeout=10 \\
        -p "$SSH_PORT" \\
        "$SSH_USER@$SSH_HOST"
else
    echo "FEHLER: Keine SSH-Verbindungsdaten gefunden!"
    echo ""
    echo "Debug-Informationen:"
    echo "- TTYD_ARG: $TTYD_ARG"
    echo "- SSH_HOST: $SSH_HOST"
    echo "- SSH_USER: $SSH_USER"
    echo "- SSH_PORT: $SSH_PORT"
    echo "- Args: $@"
fi

exec /bin/bash
`;

  await fs.writeFile(ttydWrapperPath, ttydWrapperContent, { mode: 0o755 });
  console.log('✅ Created fixed ttyd wrapper script');
  
  // 2. Update docker-compose to use environment variables
  const dockerComposeUpdatePath = path.join(__dirname, '../../docker-compose.override.yml');
  
  const dockerComposeOverride = `# Docker Compose Override for Terminal Fix
version: '3.8'

services:
  ttyd:
    environment:
      # Pass query parameters to the container
      TTYD_ENABLE_QUERY_ARGS: "true"
    command: >
      ttyd
      --writable
      --port 7681
      --base-path /
      --terminal-type xterm-256color
      --arg
      /scripts/ttyd-ssh-wrapper-fixed.sh
`;

  await fs.writeFile(dockerComposeUpdatePath, dockerComposeOverride);
  console.log('✅ Created docker-compose override file');
  
  // 3. Create nginx location fix
  const nginxFixPath = path.join(__dirname, '../../nginx/conf.d/terminal-fix.conf');
  
  const nginxFix = `# Terminal Query Parameter Pass-through
location ~ ^/terminal/(.*)$ {
    proxy_pass http://ttyd:7681/$1$is_args$args;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Pass query parameters
    proxy_set_header X-Original-URI $request_uri;
    
    # WebSocket specific
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;
    
    # Buffering
    proxy_buffering off;
}
`;

  await fs.writeFile(nginxFixPath, nginxFix);
  console.log('✅ Created nginx configuration fix');
  
  console.log('\n📋 Next steps:');
  console.log('1. Copy the fixed wrapper script:');
  console.log('   cp scripts/ttyd-ssh-wrapper-fixed.sh scripts/ttyd-ssh-wrapper.sh');
  console.log('2. Restart the containers:');
  console.log('   docker-compose down && docker-compose up -d');
  console.log('3. Test the terminal connection');
}

// Run the fix
implementTerminalFix().catch(console.error);
