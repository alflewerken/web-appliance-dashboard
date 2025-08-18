#!/bin/bash
# SSH-Wrapper for ttyd - SSH Key Only Version
# Version: 1.0.1 - Fixed missing script in Docker image

echo "=================================================================================="
echo "Web Appliance Dashboard Terminal" 
echo "=================================================================================="
echo ""

# Initialize variables
SSH_HOST=""
SSH_USER=""
SSH_PORT=""
SSH_KEY=""
HOST_ID=""

# Parse arguments (not used by ttyd, but kept for compatibility)
for arg in "$@"; do
    case "$arg" in
        host=*) SSH_HOST="${arg#host=}" ;;
        user=*) SSH_USER="${arg#user=}" ;;
        port=*) SSH_PORT="${arg#port=}" ;;
        hostId=*) HOST_ID="${arg#hostId=}" ;;
    esac
done

# Always check session file first (ttyd doesn't pass query parameters as arguments)
SESSION_FILE="/tmp/terminal-sessions/latest-session.conf"
if [ -f "$SESSION_FILE" ]; then
    source "$SESSION_FILE"
    # Map variables from session file - these are the correct values
    SSH_HOST="${host}"
    SSH_USER="${user}"
    SSH_PORT="${port:-22}"
    SSH_KEY="${keyPath}"
fi

# Fallback to default port if not set
SSH_PORT="${SSH_PORT:-22}"

if [ -n "$SSH_HOST" ] && [ -n "$SSH_USER" ]; then
    echo "Verbinde mit: $SSH_USER@$SSH_HOST:$SSH_PORT"
    
    # Use SSH key from session file if available, otherwise determine it
    if [ -z "$SSH_KEY" ]; then
        SSH_KEY="/root/.ssh/id_rsa_dashboard"  # Default key
        
        # Check if we have a hostname-specific key
        if [ -n "$SSH_HOSTNAME" ]; then
            SPECIFIC_KEY="/root/.ssh/id_rsa_${SSH_HOSTNAME,,}"
            if [ -f "$SPECIFIC_KEY" ]; then
                SSH_KEY="$SPECIFIC_KEY"
            fi
        fi
    fi
    
    if [ ! -f "$SSH_KEY" ]; then
        echo "❌ FEHLER: SSH-Schlüssel nicht gefunden: $SSH_KEY"
        echo ""
        echo "Verfügbare Schlüssel:"
        ls -la /root/.ssh/id_rsa* 2>/dev/null
        exit 1
    fi
    
    echo "Verwende SSH-Schlüssel: $SSH_KEY"
    echo ""
    
    # Connect using SSH key only - no password authentication
    exec ssh -tt \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o LogLevel=ERROR \
        -o ServerAliveInterval=30 \
        -o ServerAliveCountMax=3 \
        -o ConnectTimeout=10 \
        -o PasswordAuthentication=no \
        -o PubkeyAuthentication=yes \
        -o IdentitiesOnly=yes \
        -i "$SSH_KEY" \
        -p "$SSH_PORT" \
        "$SSH_USER@$SSH_HOST"
else
    echo "❌ FEHLER: Keine SSH-Verbindungsdaten gefunden!"
    echo ""
    echo "Debug-Info:"
    echo "- SESSION_FILE: /tmp/terminal-sessions/latest-session.conf"
    ls -la /tmp/terminal-sessions/ 2>/dev/null
    echo ""
    # Fallback to bash
    exec /bin/bash
fi
