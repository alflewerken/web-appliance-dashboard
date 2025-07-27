#!/bin/bash
# Fixed SSH-Wrapper for ttyd - Version 2

clear

echo "=================================================================================="
echo "Web Appliance Dashboard Terminal" 
echo "=================================================================================="
echo ""

# Parse arguments from ttyd
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

# Default port
SSH_PORT="${SSH_PORT:-22}"

# Connect if we have the required information
if [ -n "$SSH_HOST" ] && [ -n "$SSH_USER" ]; then
    echo "Verbinde mit: $SSH_USER@$SSH_HOST:$SSH_PORT"
    echo ""
    
    # Try SSH with different authentication methods
    # First try with keys, then fall back to password
    ssh -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o LogLevel=ERROR \
        -o ServerAliveInterval=30 \
        -o ServerAliveCountMax=3 \
        -o ConnectTimeout=10 \
        -o PreferredAuthentications=publickey,password \
        -p "$SSH_PORT" \
        "$SSH_USER@$SSH_HOST"
    
    SSH_EXIT_CODE=$?
    
    if [ $SSH_EXIT_CODE -ne 0 ]; then
        echo ""
        echo "SSH-Verbindung beendet (Exit Code: $SSH_EXIT_CODE)"
        echo ""
        
        # Provide helpful error messages
        case $SSH_EXIT_CODE in
            255) echo "Verbindungsfehler - Host nicht erreichbar oder Authentifizierung fehlgeschlagen" ;;
            1) echo "Allgemeiner SSH-Fehler" ;;
            2) echo "SSH-Protokollfehler" ;;
            *) echo "Unbekannter Fehler" ;;
        esac
    fi
else
    echo "FEHLER: Keine SSH-Verbindungsdaten gefunden!"
    echo ""
    echo "Bitte schließen Sie dieses Fenster und versuchen Sie es erneut."
fi

# Keep terminal open
echo ""
echo "Drücken Sie Enter um das Terminal zu schließen..."
read -r

# Alternative: Start bash shell
# exec /bin/bash
