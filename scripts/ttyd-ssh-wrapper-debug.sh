#!/bin/bash
# Debug SSH-Wrapper for ttyd

echo "=================================================================================="
echo "Web Appliance Dashboard Terminal - DEBUG MODE" 
echo "=================================================================================="
echo ""
echo "Arguments received:"
echo "  \$0: $0"
echo "  \$1: $1"
echo "  \$2: $2"
echo "  \$3: $3"
echo "  \$4: $4"
echo "  \$@: $@"
echo ""
echo "Query String: $QUERY_STRING"
echo ""

# Try parsing from QUERY_STRING if no arguments
if [ -z "$1" ] && [ -n "$QUERY_STRING" ]; then
    echo "Parsing from QUERY_STRING..."
    # Parse QUERY_STRING
    for pair in ${QUERY_STRING//&/ }; do
        IFS='=' read -r key value <<< "$pair"
        case "$key" in
            hostId) HOST_ID="$value" ;;
            host) SSH_HOST="$value" ;;
            user) SSH_USER="$value" ;;
            port) SSH_PORT="$value" ;;
        esac
    done
    
    echo "Parsed values:"
    echo "  HOST_ID: $HOST_ID"
    echo "  SSH_HOST: $SSH_HOST"
    echo "  SSH_USER: $SSH_USER"
    echo "  SSH_PORT: $SSH_PORT"
fi

# Parse arguments
for arg in "$@"; do
    case "$arg" in
        host=*) SSH_HOST="${arg#host=}" ;;
        user=*) SSH_USER="${arg#user=}" ;;
        port=*) SSH_PORT="${arg#port=}" ;;
        hostId=*) HOST_ID="${arg#hostId=}" ;;
    esac
done

echo ""
echo "Final values:"
echo "  HOST_ID: $HOST_ID"
echo "  SSH_HOST: $SSH_HOST"
echo "  SSH_USER: $SSH_USER"
echo "  SSH_PORT: $SSH_PORT"
echo ""

# If we have hostId, look up the host details from the backend
if [ -n "$HOST_ID" ] && [ -z "$SSH_HOST" ]; then
    echo "Looking up host details for ID: $HOST_ID"
    # This would need to call the backend API
fi

# Check session file if no arguments
if [ -z "$SSH_HOST" ] || [ -z "$SSH_USER" ]; then
    SESSION_FILE="/tmp/terminal-sessions/latest-session.conf"
    echo "Checking session file: $SESSION_FILE"
    if [ -f "$SESSION_FILE" ]; then
        echo "Session file found, loading..."
        cat "$SESSION_FILE"
        source "$SESSION_FILE"
        # Map variables from session file
        SSH_HOST="${host:-$SSH_HOST}"
        SSH_USER="${user:-$SSH_USER}"
        SSH_PORT="${port:-$SSH_PORT}"
        SSH_KEY="${keyPath:-$SSH_KEY}"
    else
        echo "No session file found"
    fi
fi

SSH_PORT="${SSH_PORT:-22}"

echo ""
echo "Connection parameters:"
echo "  Host: $SSH_HOST"
echo "  User: $SSH_USER"
echo "  Port: $SSH_PORT"
echo ""

if [ -n "$SSH_HOST" ] && [ -n "$SSH_USER" ]; then
    echo "Would connect to: $SSH_USER@$SSH_HOST:$SSH_PORT"
    
    # Use SSH key from session file if available, otherwise determine it
    if [ -z "$SSH_KEY" ]; then
        SSH_KEY="/root/.ssh/id_rsa_dashboard"  # Default key
    fi
    
    if [ ! -f "$SSH_KEY" ]; then
        echo "❌ FEHLER: SSH-Schlüssel nicht gefunden: $SSH_KEY"
        echo ""
        echo "Verfügbare Schlüssel:"
        ls -la /root/.ssh/ 2>/dev/null
        exit 1
    fi
    
    echo "Verwende SSH-Schlüssel: $SSH_KEY"
    echo ""
    
    # For debugging, just start bash instead of SSH
    echo "DEBUG MODE: Starting bash instead of SSH connection"
    exec /bin/bash
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
