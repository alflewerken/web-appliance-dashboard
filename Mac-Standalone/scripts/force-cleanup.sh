#!/bin/bash

# Force Cleanup Script für Web Appliance Dashboard macOS App
# Entfernt ALLE Container und Volumes ohne Nachfrage

echo "🧹 Force Cleanup - Web Appliance Dashboard macOS App"
echo "=================================================="
echo ""

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${RED}⚠️  WARNUNG: Alle Daten werden gelöscht!${NC}"
echo ""

# Container stoppen und entfernen
echo "➡️  Stoppe und entferne alle Container..."
docker ps -a --filter "name=wad_app_" --format "{{.Names}}" | xargs -r docker rm -f 2>/dev/null || true
echo -e "${GREEN}✓ Container entfernt${NC}"

# Volumes entfernen
echo ""
echo "➡️  Entferne alle Volumes..."
docker volume ls --filter "name=wad_app_" --format "{{.Name}}" | xargs -r docker volume rm -f 2>/dev/null || true
echo -e "${GREEN}✓ Volumes entfernt${NC}"

# Netzwerk entfernen
echo ""
echo "➡️  Entferne Netzwerk..."
docker network rm wad_app_network 2>/dev/null || true
echo -e "${GREEN}✓ Netzwerk entfernt${NC}"

echo ""
echo "✅ Force Cleanup abgeschlossen!"
echo ""
echo "Alle Container und Daten wurden entfernt."
