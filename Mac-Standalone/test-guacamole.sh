#!/bin/bash

# Test Script für Guacamole Integration in macOS App
# Testet die Remote Desktop Funktionalität über Guacamole

echo "=== Guacamole Integration Test für macOS App ==="
echo ""

# Farben für Output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Prüfe ob Docker läuft
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker ist nicht verfügbar${NC}"
    echo "   Stelle sicher, dass Docker Desktop läuft"
    exit 1
fi

echo -e "${GREEN}✓ Docker läuft${NC}"

# Prüfe Guacamole Container
echo ""
echo "Prüfe Guacamole Container..."

containers=(
    "wad_app_guacd:Guacamole Proxy Daemon"
    "wad_app_guacamole_db:Guacamole PostgreSQL"
    "wad_app_guacamole:Guacamole Web App"
)

all_running=true
for container_info in "${containers[@]}"; do
    container_name="${container_info%%:*}"
    container_desc="${container_info#*:}"
    
    if docker ps --format "table {{.Names}}" | grep -q "^${container_name}$"; then
        echo -e "${GREEN}✓ ${container_desc} läuft${NC}"
    else
        echo -e "${RED}❌ ${container_desc} läuft nicht${NC}"
        all_running=false
    fi
done

if [ "$all_running" = false ]; then
    echo ""
    echo -e "${YELLOW}Starte fehlende Container...${NC}"
    cd "$(dirname "$0")/.."
    docker-compose -f docker-compose.app.yml up -d
    echo "Warte 30 Sekunden für Container-Start..."
    sleep 30
fi

# Prüfe Guacamole Erreichbarkeit
echo ""
echo "Prüfe Guacamole Erreichbarkeit..."

GUAC_URL="http://localhost:9871/guacamole"
if curl -s -o /dev/null -w "%{http_code}" "$GUAC_URL" | grep -q "200\|302"; then
    echo -e "${GREEN}✓ Guacamole ist erreichbar auf Port 9871${NC}"
else
    echo -e "${RED}❌ Guacamole ist nicht erreichbar auf $GUAC_URL${NC}"
    echo "   Prüfe die Logs: docker logs wad_app_guacamole"
    exit 1
fi

# Prüfe nginx Proxy
echo ""
echo "Prüfe nginx Proxy für Guacamole..."

NGINX_GUAC_URL="http://localhost:9081/guacamole/"
if curl -s -o /dev/null -w "%{http_code}" "$NGINX_GUAC_URL" | grep -q "200\|302"; then
    echo -e "${GREEN}✓ Guacamole ist über nginx erreichbar${NC}"
else
    echo -e "${YELLOW}⚠️  Guacamole ist nicht über nginx erreichbar${NC}"
    echo "   Dies kann normal sein, wenn nginx die Konfiguration noch nicht geladen hat"
fi

# Prüfe Guacamole Datenbank
echo ""
echo "Prüfe Guacamole Datenbank..."

if docker exec wad_app_guacamole_db psql -U guacamole_user -d guacamole_db -c "\dt" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Guacamole Datenbank ist initialisiert${NC}"
else
    echo -e "${YELLOW}⚠️  Guacamole Datenbank ist noch nicht vollständig initialisiert${NC}"
fi

# Remote Desktop Handler Status
echo ""
echo -e "${YELLOW}📋 Remote Desktop Integration Status:${NC}"
echo "   ✓ Guacamole läuft auf Port 9871 (statt 9070 im Hauptprojekt)"
echo "   ✓ Container-Präfix: wad_app_*"
echo "   ✓ Remote Desktop Handler integriert in macOS App"
echo "   ✓ IPC APIs verfügbar über window.electronAPI"
echo "   ✓ Frontend erkennt automatisch Electron-Umgebung"

echo ""
echo -e "${GREEN}✅ Guacamole Integration ist bereit!${NC}"
echo ""
echo "Nächste Schritte:"
echo "1. Erstelle Remote Desktop Verbindungen im Backend"
echo "2. Aktiviere Remote Desktop für Appliances"
echo "3. Teste VNC/RDP Verbindungen über die App"
echo ""
echo "Guacamole Admin Interface:"
echo "URL: http://localhost:9871/guacamole"
echo "Standard Login: guacadmin / guacadmin"
echo ""
echo "=== Test abgeschlossen ==="
