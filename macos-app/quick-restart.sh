#!/bin/bash
# Schneller Neustart der Electron App mit Terminal-Fix

cd "$(dirname "$0")"

echo "Stoppe Electron App..."
pkill -f "Electron.*Web Appliance" || true
pkill -f "node.*main.js" || true

echo "Warte kurz..."
sleep 2

echo "Starte App neu..."
npm start &

echo ""
echo "App wird neu gestartet..."
echo "Warte auf Dashboard unter http://localhost:9081"
echo ""
echo "Terminal-Test:"
echo "1. Öffne Dashboard"
echo "2. Gehe zu 'SSH Hosts'"
echo "3. Klicke auf 'Terminal' bei einem Host"
echo "4. Es sollte sich ein neues Fenster/Tab mit ttyd öffnen (kein Modal!)"
