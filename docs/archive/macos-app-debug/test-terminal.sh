#!/bin/bash
# Test-Script für Terminal-Funktionalität in der Electron App

echo "Terminal Test Script für Web Appliance Dashboard"
echo "================================================"
echo ""

# Aktuelle Container prüfen
echo "1. Prüfe Docker Container Status..."
docker ps --filter "name=web-appliance" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# ttyd Prozess prüfen
echo "2. Prüfe ttyd Prozess..."
docker exec web-appliance-ttyd-app-1 ps aux | grep ttyd
echo ""

# Port-Verfügbarkeit prüfen
echo "3. Prüfe Port-Verfügbarkeit..."
echo "   Port 7682 (ttyd für App):"
lsof -i :7682 || echo "   Port 7682 ist frei oder von Docker verwendet"
echo ""

# Test-URL ausgeben
echo "4. Test-URLs:"
echo "   - Direct ttyd: http://localhost:7682/terminal/"
echo "   - With params: http://localhost:7682/terminal/?host=host.docker.internal&user=alflewerken&port=22"
echo ""

# Electron App Status
echo "5. Prüfe Electron App..."
ps aux | grep -i "web.*appliance" | grep -v grep || echo "   Electron App läuft nicht"
echo ""

echo "Test abgeschlossen!"
echo ""
echo "Nächste Schritte:"
echo "1. Starte die App neu mit: npm start"
echo "2. Öffne das Dashboard"
echo "3. Klicke auf 'Terminal' bei einem SSH-Host"
echo "4. Prüfe die Console-Logs in den DevTools (Cmd+Option+I)"
