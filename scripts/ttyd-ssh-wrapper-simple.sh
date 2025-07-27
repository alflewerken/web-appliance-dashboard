#!/bin/bash
# SSH-Wrapper für ttyd - Version 4.0
# Verwendet Backend-API für SSH-Verbindungsdaten

# Clear screen
clear

echo "=================================================================================="
echo "Web Appliance Dashboard Terminal"
echo "=================================================================================="
echo ""

# Prüfe ob eine Host-ID als Parameter übergeben wurde
HOST_ID="$1"

if [ -z "$HOST_ID" ]; then
    echo "Lade SSH-Hosts..."
    echo ""
    
    # Hole Token aus Datei (muss vom Backend bereitgestellt werden)
    TOKEN_FILE="/tmp/terminal-token"
    if [ -f "$TOKEN_FILE" ]; then
        TOKEN=$(cat "$TOKEN_FILE")
        rm -f "$TOKEN_FILE"
    fi
    
    if [ -z "$TOKEN" ]; then
        echo "FEHLER: Keine Authentifizierung möglich"
        echo ""
        echo "Bitte öffnen Sie das Terminal über die Web-Oberfläche."
        exec /bin/bash
    fi
    
    # Hole SSH-Hosts vom Backend
    RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" http://backend:3001/api/ssh/hosts)
    
    if [ $? -ne 0 ]; then
        echo "FEHLER: Konnte keine Verbindung zum Backend herstellen"
        exec /bin/bash
    fi
    
    # Parse die Hosts (vereinfachte Darstellung)
    echo "Verfügbare SSH-Hosts:"
    echo "$RESPONSE" | grep -o '"hostname":"[^"]*"' | cut -d'"' -f4 | nl
    echo ""
    echo "Bitte wählen Sie einen Host (Nummer eingeben):"
    read -r SELECTION
    
    # Hier würde normalerweise die Auswahl verarbeitet werden
    echo "Diese Funktion ist noch nicht implementiert."
    exec /bin/bash
else
    # Direkte Verbindung mit übergebener Host-ID
    echo "Verbinde mit Host-ID: $HOST_ID"
    echo ""
    
    # Hier würden wir die SSH-Config aus /root/.ssh/config lesen
    # oder die Daten vom Backend holen
    
    # Für den Moment verwenden wir eine einfache Lösung:
    # Prüfe ob es eine SSH-Config für diese Host-ID gibt
    if grep -q "^Host appliance-$HOST_ID$" /root/.ssh/config 2>/dev/null; then
        echo "Verwende SSH-Konfiguration für: appliance-$HOST_ID"
        exec ssh -o LogLevel=ERROR "appliance-$HOST_ID"
    else
        echo "FEHLER: Keine SSH-Konfiguration für Host-ID $HOST_ID gefunden"
        echo ""
        echo "Verfügbare Hosts in SSH-Config:"
        grep "^Host " /root/.ssh/config 2>/dev/null | sed 's/Host /  - /' || echo "  (keine)"
        exec /bin/bash
    fi
fi
