#!/bin/bash

# Cleanup Script für Web Appliance Dashboard macOS App
# Entfernt alle Container und Volumes der App-Version

echo "🧹 Web Appliance Dashboard macOS App Cleanup"
echo "==========================================="
echo ""
echo "⚠️  WARNUNG: Dieses Script wird ALLE Container und Daten der macOS App löschen!"
echo ""

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Sicherheitsabfrage
read -p "Sind Sie sicher, dass Sie fortfahren möchten? (ja/nein): " answer
if [ "$answer" != "ja" ]; then
    echo "Abbruch."
    exit 0
fi

echo ""
echo "➡️  Stoppe alle laufenden Container..."

# Container stoppen
containers=$(docker ps -a --filter "name=wad_app_" --format "{{.Names}}")
if [ -n "$containers" ]; then
    echo "Folgende Container werden gestoppt:"
    echo "$containers"
    docker stop $containers 2>/dev/null || true
    echo -e "${GREEN}✓ Container gestoppt${NC}"
else
    echo -e "${YELLOW}Keine laufenden Container gefunden${NC}"
fi

echo ""
echo "➡️  Entferne alle Container..."

# Container entfernen
if [ -n "$containers" ]; then
    docker rm -f $containers 2>/dev/null || true
    echo -e "${GREEN}✓ Container entfernt${NC}"
else
    echo -e "${YELLOW}Keine Container zum Entfernen gefunden${NC}"
fi

echo ""
echo "➡️  Entferne alle Volumes..."

# Volumes auflisten und entfernen
volumes=$(docker volume ls --filter "name=wad_app_" --format "{{.Name}}")
if [ -n "$volumes" ]; then
    echo "Folgende Volumes werden entfernt:"
    echo "$volumes"
    
    # Bestätigung für Volume-Löschung
    echo ""
    echo -e "${RED}⚠️  ACHTUNG: Alle Daten in diesen Volumes gehen verloren!${NC}"
    read -p "Volumes wirklich löschen? (ja/nein): " volume_answer
    
    if [ "$volume_answer" = "ja" ]; then
        docker volume rm $volumes 2>/dev/null || true
        echo -e "${GREEN}✓ Volumes entfernt${NC}"
    else
        echo -e "${YELLOW}Volume-Löschung übersprungen${NC}"
    fi
else
    echo -e "${YELLOW}Keine Volumes zum Entfernen gefunden${NC}"
fi

echo ""
echo "➡️  Entferne Netzwerk..."

# Netzwerk entfernen
if docker network ls | grep -q "wad_app_network"; then
    docker network rm wad_app_network 2>/dev/null || true
    echo -e "${GREEN}✓ Netzwerk entfernt${NC}"
else
    echo -e "${YELLOW}Kein Netzwerk zum Entfernen gefunden${NC}"
fi

echo ""
echo "➡️  Prüfe verbleibende Docker-Ressourcen..."

# Status-Check
remaining_containers=$(docker ps -a --filter "name=wad_app_" --format "{{.Names}}" | wc -l)
remaining_volumes=$(docker volume ls --filter "name=wad_app_" --format "{{.Name}}" | wc -l)

if [ "$remaining_containers" -eq 0 ] && [ "$remaining_volumes" -eq 0 ]; then
    echo -e "${GREEN}✓ Alle App-Ressourcen wurden erfolgreich entfernt${NC}"
else
    echo -e "${YELLOW}⚠️  Es sind noch Ressourcen vorhanden:${NC}"
    if [ "$remaining_containers" -gt 0 ]; then
        echo "   - $remaining_containers Container"
        docker ps -a --filter "name=wad_app_"
    fi
    if [ "$remaining_volumes" -gt 0 ]; then
        echo "   - $remaining_volumes Volumes"
        docker volume ls --filter "name=wad_app_"
    fi
fi

echo ""
echo "==========================================="
echo "✅ Cleanup abgeschlossen!"
echo ""
echo "Nächste Schritte:"
echo "- Für Neuinstallation: ./scripts/build.sh"
echo "- Für einzelne Container: docker-compose -f docker-compose.app.yml up -d"
echo ""

# Optional: Docker System Prune
echo "Möchten Sie auch ungenutzte Docker-Ressourcen aufräumen?"
echo "(Dies entfernt ALLE ungenutzten Images, Container, Volumes und Netzwerke)"
read -p "Docker System Prune ausführen? (ja/nein): " prune_answer

if [ "$prune_answer" = "ja" ]; then
    echo ""
    echo "➡️  Führe Docker System Prune aus..."
    docker system prune -a --volumes -f
    echo -e "${GREEN}✓ Docker System bereinigt${NC}"
fi

echo ""
echo "🧹 Cleanup vollständig abgeschlossen!"
