#!/bin/bash
# Test-Wrapper für ttyd debugging mit Datei-Output

# Schreibe Debug-Info in eine Datei
DEBUG_FILE="/tmp/ttyd-debug.log"

{
    echo "=================================================================================="
    echo "DEBUG: Test ttyd wrapper - $(date)"
    echo "=================================================================================="
    echo ""
    echo "Raw Information:"
    echo "----------------"
    echo "Number of arguments: $#"
    echo "All arguments: '$@'"
    echo ""
    echo "Individual arguments:"
    for i in "$@"; do
        echo "  Arg: '$i'"
    done
    echo ""
    echo "Environment variables:"
    echo "  QUERY_STRING: '$QUERY_STRING'"
    echo "  REQUEST_URI: '$REQUEST_URI'"
    echo "  REQUEST_METHOD: '$REQUEST_METHOD'"
    echo ""
    echo "HTTP headers (env | grep HTTP):"
    env | grep HTTP || echo "  (keine HTTP headers gefunden)"
    echo ""
} > "$DEBUG_FILE" 2>&1

# Zeige die Ausgabe auch im Terminal
cat "$DEBUG_FILE"

echo ""
echo "Debug-Informationen wurden in $DEBUG_FILE gespeichert."
echo ""
echo "Keine SSH-Verbindungsinformationen gefunden!"
echo ""
echo "Press ENTER to exit..."
read
