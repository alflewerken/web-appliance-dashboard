#!/bin/bash
# Dynamic SSH-Wrapper für ttyd - Mac App Version
# Liest Parameter aus der URL Query-String

# Hole Query-Parameter aus der Umgebungsvariable QUERY_STRING
# ttyd setzt diese Variable automatisch
QUERY_STRING="${QUERY_STRING:-}"

# Standard-Werte für Mac-Verbindungen
DEFAULT_HOST="host.docker.internal"
DEFAULT_USER="$USER"  # Aktueller macOS Benutzer
DEFAULT_PORT="22"

# Funktion zum Parsen von Query-Parametern
get_query_param() {
    local param=$1
    echo "$QUERY_STRING" | grep -oE "(^|&)$param=([^&]*)" | cut -d= -f2 | sed 's/%20/ /g' | sed 's/%40/@/g'
}

# Parse URL-Parameter oder verwende Umgebungsvariablen als Fallback
URL_HOST=$(get_query_param "host")
URL_USER=$(get_query_param "user")
URL_PORT=$(get_query_param "port")
URL_HOST_ID=$(get_query_param "hostId")

# Verwende URL-Parameter, dann Umgebungsvariablen, dann Defaults
HOST="${URL_HOST:-${SSH_HOST:-$DEFAULT_HOST}}"
USER="${URL_USER:-${SSH_USER:-$DEFAULT_USER}}"
PORT="${URL_PORT:-${SSH_PORT:-$DEFAULT_PORT}}"
HOST_ID="${URL_HOST_ID:-}"

# Spezialbehandlung für Mac/Localhost
if [ "$HOST" = "mac" ] || [ "$HOST" = "localhost" ] || [ "$HOST" = "127.0.0.1" ]; then
    HOST="host.docker.internal"
fi

# Spezialbehandlung wenn gar keine Parameter übergeben wurden
# (z.B. bei "Nextcloud-Mac" ohne SSH-Config)
if [ -z "$HOST" ] || [ "$HOST" = "hostname" ]; then
    HOST="host.docker.internal"
    USER="${USER:-alflewerken}"  # Default macOS User
    echo "Info: Keine Host-Parameter gefunden, verwende Mac-Defaults"
fi

# Verwende die SSH-Keys aus dem Volume
export HOME=/root

# Clear screen
clear

# Zeige Verbindungsinformationen
echo "=================================================================================="
echo "Web Appliance Dashboard Terminal (Mac App)"
echo "=================================================================================="
echo ""
echo "Verbinde mit: $USER@$HOST:$PORT"
if [ -n "$HOST_ID" ]; then
    echo "Host ID: $HOST_ID"
fi
echo ""

# Debug-Info
if [ -n "$QUERY_STRING" ]; then
    echo "Query Parameter: $QUERY_STRING"
    echo ""
fi

# Prüfe ob es einen SSH-Config-Eintrag für diesen Host gibt
if [ -n "$HOST_ID" ] && grep -q "^Host appliance-$HOST_ID$" /root/.ssh/config 2>/dev/null; then
    echo "Verwende SSH-Konfiguration für: appliance-$HOST_ID"
    echo ""
    # Verwende die SSH-Config mit Host-ID
    exec ssh -o LogLevel=ERROR "appliance-$HOST_ID"
elif grep -q "^Host $HOST$" /root/.ssh/config 2>/dev/null; then
    echo "Verwende SSH-Konfiguration für Host: $HOST"
    echo ""
    # Verwende die SSH-Config
    exec ssh -o LogLevel=ERROR "$HOST"
else
    echo "Verwende direkte SSH-Verbindung"
    echo ""
    # Direkte SSH-Verbindung
    exec ssh -o StrictHostKeyChecking=no \
             -o UserKnownHostsFile=/dev/null \
             -o LogLevel=ERROR \
             -p "$PORT" \
             "$USER@$HOST"
fi
