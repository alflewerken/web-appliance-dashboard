#!/bin/bash

# Debug-Script für Terminal-Problem in macOS App
# Dieses Script hilft bei der Diagnose des Terminal-Fenster-Problems

echo "=== Web Appliance Dashboard Terminal Debug ==="
echo ""

# 1. Prüfe ob Docker läuft
echo "1. Prüfe Docker Status..."
if docker info &> /dev/null; then
    echo "   ✓ Docker läuft"
else
    echo "   ✗ Docker läuft nicht! Bitte starten Sie Docker Desktop."
    exit 1
fi

# 2. Prüfe Container Status
echo ""
echo "2. Prüfe Container Status..."
docker ps --filter "name=wad_app" --format "table {{.Names}}\t{{.Status}}"

# 3. Prüfe ob ttyd erreichbar ist
echo ""
echo "3. Prüfe ttyd Terminal Service..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:7682/terminal/ | grep -q "200\|302"; then
    echo "   ✓ ttyd ist erreichbar auf Port 7682"
else
    echo "   ✗ ttyd ist nicht erreichbar auf Port 7682"
fi

# 4. Prüfe ob Frontend erreichbar ist
echo ""
echo "4. Prüfe Frontend..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:9081/ | grep -q "200"; then
    echo "   ✓ Frontend ist erreichbar auf Port 9081"
else
    echo "   ✗ Frontend ist nicht erreichbar auf Port 9081"
fi

# 5. Prüfe ob terminal-dynamic.html existiert
echo ""
echo "5. Prüfe terminal-dynamic.html..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:9081/terminal-dynamic.html | grep -q "200"; then
    echo "   ✓ terminal-dynamic.html ist erreichbar"
else
    echo "   ✗ terminal-dynamic.html ist nicht erreichbar"
fi

# 6. Container Logs
echo ""
echo "6. Letzte Logs von ttyd Container:"
docker logs --tail 10 wad_app_ttyd 2>&1

echo ""
echo "=== Terminal Test ==="
echo ""
echo "Öffne Test-Terminal in neuem Fenster..."
echo "URL: http://localhost:9081/terminal-dynamic.html?host=localhost&user=root&port=22"
echo ""

# Öffne Test-URL im Browser
open "http://localhost:9081/terminal-dynamic.html?host=localhost&user=root&port=22"

echo ""
echo "=== Empfohlene Schritte ==="
echo ""
echo "1. Starten Sie die macOS App neu:"
echo "   cd /Users/alflewerken/Desktop/web-appliance-dashboard/macos-app"
echo "   npm start"
echo ""
echo "2. Öffnen Sie die Developer Tools in der App (Cmd+Option+I)"
echo ""
echo "3. Suchen Sie in der Console nach '[Terminal Fix]' Meldungen"
echo ""
echo "4. Klicken Sie auf einen Terminal-Button und prüfen Sie die Console-Ausgabe"
echo ""
