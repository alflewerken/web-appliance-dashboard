#!/bin/bash
# Dynamic SSH-Wrapper für ttyd
# Liest Parameter aus der URL Query-String

# Hole Query-Parameter aus der Umgebungsvariable QUERY_STRING
# ttyd setzt diese Variable automatisch
QUERY_STRING="${QUERY_STRING:-}"

# Standard-Werte aus Umgebungsvariablen
DEFAULT_HOST="${SSH_HOST:-}"
DEFAULT_USER="${SSH_USER:-}"
DEFAULT_PORT="${SSH_PORT:-22}"

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
HOST="${URL_HOST:-${DEFAULT_HOST}}"
USER="${URL_USER:-${DEFAULT_USER}}"
PORT="${URL_PORT:-${DEFAULT_PORT}}"
HOST_ID="${URL_HOST_ID:-}"

# Verwende die SSH-Keys aus dem Volume
export HOME=/root

# Clear screen
clear

# Zeige Verbindungsinformationen
echo "=================================================================================="
echo "Web Appliance Dashboard Terminal"
echo "=================================================================================="
echo ""

# Wenn Host-Informationen vorhanden sind, verbinde direkt
if [ -n "$HOST" ] && [ -n "$USER" ]; then
    echo "Verbinde mit: $USER@$HOST:$PORT"
    if [ -n "$HOST_ID" ]; then
        echo "Host ID: $HOST_ID"
    fi
    echo ""
    
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
else
    # Keine Host-Informationen - zeige Hilfe
    echo "HINWEIS: Keine Host-Informationen übermittelt."
    echo ""
    echo "Sie können manuell eine SSH-Verbindung herstellen mit:"
    echo "  ssh benutzername@hostname"
    echo ""
    echo "Oder öffnen Sie das Terminal über einen konfigurierten Service"
    echo "in der Web Appliance Dashboard Oberfläche."
    echo ""
    echo "Debug-Info:"
    echo "  QUERY_STRING: $QUERY_STRING"
    echo "  SSH_HOST: $SSH_HOST"
    echo "  SSH_USER: $SSH_USER"
    echo ""
    # Starte eine interaktive Shell
    exec /bin/bash
fi
