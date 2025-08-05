#!/bin/bash
# Improved SSH-Wrapper for ttyd that handles query parameters

clear

echo "=================================================================================="
echo "Web Appliance Dashboard Terminal" 
echo "=================================================================================="
echo ""

# Debug output
echo "Debug Info:"
echo "- Script arguments: $@"
echo "- QUERY_STRING: $QUERY_STRING"
echo "- REQUEST_URI: $REQUEST_URI"
echo ""

# ttyd übergibt Query-Parameter als Argumente wenn --arg verwendet wird
# Format: arg "key=value" "key2=value2"
for arg in "$@"; do
    case "$arg" in
        host=*) SSH_HOST="${arg#host=}" ;;
        user=*) SSH_USER="${arg#user=}" ;;
        port=*) SSH_PORT="${arg#port=}" ;;
        hostId=*) HOST_ID="${arg#hostId=}" ;;
    esac
done

# Fallback auf Environment-Variablen
SSH_HOST="${SSH_HOST:-$TTYD_SSH_HOST}"
SSH_USER="${SSH_USER:-$TTYD_SSH_USER}"
SSH_PORT="${SSH_PORT:-${TTYD_SSH_PORT:-22}}"

# Wenn wir immer noch keine Daten haben, prüfe Session-File
if [ -z "$SSH_HOST" ] || [ -z "$SSH_USER" ]; then
    SESSION_DIR="/tmp/terminal-sessions"
    MARKER_FILE="$SESSION_DIR/latest-session.conf"
    
    echo "Checking session file: $MARKER_FILE"
    
    if [ -f "$MARKER_FILE" ]; then
        file_age=$(($(date +%s) - $(stat -c %Y "$MARKER_FILE" 2>/dev/null || stat -f %m "$MARKER_FILE" 2>/dev/null || echo 0)))
        echo "Session file age: ${file_age}s"
        
        if [ $file_age -le 60 ]; then
            echo "Loading session data..."
            cat "$MARKER_FILE"
            source "$MARKER_FILE"
            # Don't delete the file yet, let multiple connections use it
            # rm -f "$MARKER_FILE" 
        else
            echo "Session file too old, ignoring"
            rm -f "$MARKER_FILE"
        fi
    else
        echo "No session file found"
    fi
fi

# Verbindung aufbauen wenn Daten vorhanden
if [ -n "$SSH_HOST" ] && [ -n "$SSH_USER" ]; then
    echo ""
    echo "Verbinde mit: $SSH_USER@$SSH_HOST:${SSH_PORT:-22}"
    echo ""
    
    # SSH-Verbindung mit besseren Optionen
    ssh -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o LogLevel=ERROR \
        -o ServerAliveInterval=30 \
        -o ServerAliveCountMax=3 \
        -o ConnectTimeout=10 \
        -o PasswordAuthentication=yes \
        -o PreferredAuthentications=password,publickey \
        -p "${SSH_PORT:-22}" \
        "$SSH_USER@$SSH_HOST"
    
    SSH_EXIT_CODE=$?
    
    if [ $SSH_EXIT_CODE -ne 0 ]; then
        echo ""
        echo "SSH-Verbindung beendet mit Code: $SSH_EXIT_CODE"
        echo ""
    fi
else
    echo "FEHLER: Keine SSH-Verbindungsdaten gefunden!"
    echo ""
    echo "Verfügbare Variablen:"
    echo "- SSH_HOST: '$SSH_HOST'"
    echo "- SSH_USER: '$SSH_USER'"  
    echo "- SSH_PORT: '$SSH_PORT'"
    echo "- Argumente: $@"
    echo ""
    echo "Bitte stellen Sie sicher, dass die Terminal-URL die notwendigen Parameter enthält:"
    echo "  /terminal/?host=hostname&user=username&port=22"
fi

# Interaktive Shell als Fallback
exec /bin/bash
