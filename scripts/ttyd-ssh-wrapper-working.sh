#!/bin/bash
# SSH-Wrapper for ttyd - Working Version

clear

echo "=================================================================================="
echo "Web Appliance Dashboard Terminal" 
echo "=================================================================================="
echo ""

# Parse arguments
for arg in "$@"; do
    case "$arg" in
        host=*) SSH_HOST="${arg#host=}" ;;
        user=*) SSH_USER="${arg#user=}" ;;
        port=*) SSH_PORT="${arg#port=}" ;;
        hostId=*) HOST_ID="${arg#hostId=}" ;;
    esac
done

# Check session file
if [ -z "$SSH_HOST" ] || [ -z "$SSH_USER" ]; then
    SESSION_FILE="/tmp/terminal-sessions/latest-session.conf"
    if [ -f "$SESSION_FILE" ]; then
        source "$SESSION_FILE"
    fi
fi

SSH_PORT="${SSH_PORT:-22}"

if [ -n "$SSH_HOST" ] && [ -n "$SSH_USER" ]; then
    echo "Verbinde mit: $SSH_USER@$SSH_HOST:$SSH_PORT"
    echo ""
    
    # Check if we have a specific SSH key for this host
    SSH_KEY=""
    if [ -n "$SSH_HOSTNAME" ]; then
        # Try to find a matching key
        KEY_PATH="/root/.ssh/id_rsa_${SSH_HOSTNAME,,}"
        if [ -f "$KEY_PATH" ]; then
            SSH_KEY="-i $KEY_PATH"
            echo "Verwende SSH-Schlüssel: $KEY_PATH"
        fi
    fi
    
    # If no specific key found, try default dashboard key
    if [ -z "$SSH_KEY" ] && [ -f "/root/.ssh/id_rsa_dashboard" ]; then
        SSH_KEY="-i /root/.ssh/id_rsa_dashboard"
        echo "Verwende Standard-Dashboard-Schlüssel"
    fi
    
    echo ""
    
    # SSH with both key and password authentication enabled
    exec ssh -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o LogLevel=ERROR \
        -o ServerAliveInterval=30 \
        -o ServerAliveCountMax=3 \
        -o ConnectTimeout=10 \
        -o PasswordAuthentication=yes \
        -o PubkeyAuthentication=yes \
        -o PreferredAuthentications=publickey,keyboard-interactive,password \
        $SSH_KEY \
        -p "$SSH_PORT" \
        "$SSH_USER@$SSH_HOST"
else
    echo "FEHLER: Keine SSH-Verbindungsdaten gefunden!"
    echo ""
    exec /bin/bash
fi
