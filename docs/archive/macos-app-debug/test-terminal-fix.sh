#!/bin/bash
# Terminal Fix Test Script

cd "$(dirname "$0")"

echo "================================"
echo "Terminal Modal Fix Test"
echo "================================"
echo ""

# Stoppe App
echo "1. Stoppe alte App-Instanzen..."
pkill -f "Electron.*Web Appliance" 2>/dev/null || true
sleep 2

# Starte App neu
echo "2. Starte App neu..."
npm start > app.log 2>&1 &
APP_PID=$!

echo "   App PID: $APP_PID"
echo ""

# Warte auf Start
echo "3. Warte auf App-Start..."
sleep 5

# Instruktionen
echo ""
echo "TEST-ANLEITUNG:"
echo "==============="
echo ""
echo "1. Dashboard sollte sich öffnen"
echo "2. Gehe zu 'SSH Hosts' im Menü"
echo "3. Klicke auf 'Terminal' bei einem Host (z.B. Nextcloud-Mac)"
echo ""
echo "ERWARTETES VERHALTEN:"
echo "- KEIN Modal sollte erscheinen"
echo "- Stattdessen sollte sich ein neues Browser-Fenster/Tab mit ttyd öffnen"
echo "- URL sollte so aussehen: http://localhost:7682/terminal/?host=..."
echo ""
echo "DEBUGGING:"
echo "- Öffne DevTools mit Cmd+Option+I"
echo "- Schaue in die Console für Handler-Meldungen:"
echo "  - [CSS Modal Hider] ✓ CSS injiziert"
echo "  - [Early Electron Handler] ✓ Frühe Installation abgeschlossen"
echo "  - [IPC Test] ✓ electronAPI verfügbar"
echo "  - [Safe Proxy Handler] ✓ Installation abgeschlossen"
echo ""
echo "App-Logs werden gespeichert in: app.log"
echo ""
echo "Drücke Ctrl+C zum Beenden"

# Zeige Log-Output
tail -f app.log
