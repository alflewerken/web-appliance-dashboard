#!/bin/bash
# SSH-Wrapper for ttyd - SSH Key Only Version

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

# Check session file if no arguments
if [ -z "$SSH_HOST" ] || [ -z "$SSH_USER" ]; then
    SESSION_FILE="/tmp/terminal-sessions/latest-session.conf"
    if [ -f "$SESSION_FILE" ]; then
        source "$SESSION_FILE"
    fi
fi

SSH_PORT="${SSH_PORT:-22}"

if [ -n "$SSH_HOST" ] && [ -n "$SSH_USER" ]; then
    echo "Verbinde mit: $SSH_USER@$SSH_HOST:$SSH_PORT"
    
    # Determine SSH key to use
    SSH_KEY="/root/.ssh/id_rsa_dashboard"  # Default key
    
    # Check if we have a hostname-specific key
    if [ -n "$SSH_HOSTNAME" ]; then
        SPECIFIC_KEY="/root/.ssh/id_rsa_${SSH_HOSTNAME,,}"
        if [ -f "$SPECIFIC_KEY" ]; then
            SSH_KEY="$SPECIFIC_KEY"
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
