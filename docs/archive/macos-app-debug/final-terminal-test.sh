#!/bin/bash
# Final Terminal Fix Test

cd "$(dirname "$0")"

echo "================================"
echo "Final Terminal Fix Test"
echo "================================"
echo ""

# Stoppe App
echo "1. Stoppe App..."
pkill -f "Electron.*Web Appliance" 2>/dev/null || true
sleep 2

# Starte App
echo "2. Starte App neu..."
npm start &
APP_PID=$!

echo "   Warte auf Start..."
sleep 5

echo ""
echo "3. Test-Anleitung:"
echo "=================="
echo ""
echo "OPTION A - Terminal Test:"
echo "1. Gehe zu SSH Hosts"
echo "2. Klicke auf 'Terminal' bei einem Host"
echo ""
echo "OPTION B - Test-Seite:"
echo "1. Navigiere zu: http://localhost:9081/terminal-test.html"
echo "2. Teste Button 1 (Direkte URL Port 9081)"
echo "3. Teste Button 2 (Terminal-Pfad)"
echo ""
echo "ERWARTETES VERHALTEN:"
echo "- Terminal öffnet sich in neuem Electron-Fenster"
echo "- KEIN Modal erscheint"
echo "- ttyd läuft im Terminal"
echo ""
echo "Console zeigt:"
echo "- [Simple Terminal Opener] Öffne Terminal für: {...}"
echo "- Window open handler - URL: http://localhost:9081/terminal/..."
echo "- Terminal URL erkannt, erlaube öffnen"
echo ""

wait $APP_PID
