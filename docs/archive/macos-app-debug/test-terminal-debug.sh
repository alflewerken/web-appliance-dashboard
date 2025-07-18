#!/bin/bash
# Terminal Debug Test

cd "$(dirname "$0")"

echo "================================"
echo "Terminal Handler Debug Test"
echo "================================"
echo ""

# Stoppe App
echo "1. Stoppe alte App..."
pkill -f "Electron.*Web Appliance" 2>/dev/null || true
sleep 2

# Prüfe ttyd
echo "2. Prüfe ttyd Status..."
docker ps | grep ttyd || echo "   ⚠️  ttyd Container läuft nicht!"
echo ""

# Starte App
echo "3. Starte App..."
npm start &
APP_PID=$!

echo "   Warte auf Start..."
sleep 5

echo ""
echo "TEST-INSTRUKTIONEN:"
echo "==================="
echo ""
echo "1. Öffne DevTools mit Cmd+Option+I"
echo "2. Gehe zur Console"
echo "3. Gehe zu 'SSH Hosts'"
echo "4. Klicke auf 'Terminal' bei einem Host"
echo ""
echo "ERWARTETE CONSOLE-AUSGABEN:"
echo "- [Debug Terminal Handler] ========== TERMINAL OPEN =========="
echo "- [Debug Terminal Handler] Target: {...}"
echo "- [Debug Terminal Handler] electronAPI verfügbar?: true/false"
echo "- [Debug Terminal Handler] Verwende IPC-Methode ODER window.open"
echo "- Window open handler - URL: http://localhost:7682/terminal/..."
echo ""
echo "ERGEBNIS:"
echo "- Browser-Tab sollte sich mit ttyd öffnen"
echo "- KEIN Modal sollte erscheinen"
echo ""
echo "Wenn ttyd sich nicht öffnet, prüfe:"
echo "- Popup-Blocker im Browser"
echo "- ttyd Container Status: docker ps | grep ttyd"
echo "- Port 7682: lsof -i :7682"
echo ""
echo "Drücke Ctrl+C zum Beenden"

# Halte Script am Laufen
wait $APP_PID
