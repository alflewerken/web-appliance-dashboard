#!/bin/bash
# Schneller Test nach Fix

cd "$(dirname "$0")"

echo "Teste App nach SyntaxError Fix..."
echo ""

# Stoppe alte Instanz
pkill -f "Electron.*Web Appliance" 2>/dev/null || true
sleep 1

# Starte neu
echo "Starte App..."
npm start &

sleep 5

# Prüfe ob App läuft
if pgrep -f "Electron.*Web Appliance" > /dev/null; then
    echo "✅ App läuft!"
    echo ""
    echo "Teste jetzt das Terminal:"
    echo "1. Gehe zu SSH Hosts"
    echo "2. Klicke auf Terminal"
    echo "3. Es sollte ttyd öffnen, KEIN Modal!"
else
    echo "❌ App ist nicht gestartet"
    echo "Prüfe die Logs mit: tail -f ~/Library/Logs/Web\\ Appliance\\ Dashboard/main.log"
fi
