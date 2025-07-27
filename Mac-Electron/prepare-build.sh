#!/bin/bash

echo "🚀 Web Appliance Dashboard - Mac Electron App Build"
echo "=================================================="

# Farben für Output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Prüfe ob wir im richtigen Verzeichnis sind
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Fehler: package.json nicht gefunden. Bitte im Mac-Electron Verzeichnis ausführen.${NC}"
    exit 1
fi

# Schritt 1: Dependencies installieren
echo -e "\n${YELLOW}📦 Installiere Dependencies...${NC}"
npm install

# Schritt 2: Frontend bauen
echo -e "\n${YELLOW}🔨 Baue Frontend...${NC}"
cd ../frontend

# Prüfe ob Frontend Dependencies installiert sind
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installiere Frontend Dependencies...${NC}"
    npm install
fi

# Baue Frontend
npm run build

# Kopiere Build in Electron App
echo -e "\n${YELLOW}📁 Kopiere Frontend Build...${NC}"
cd ../Mac-Electron
rm -rf frontend-build
cp -r ../frontend/build frontend-build

# Schritt 3: Icon prüfen
if [ ! -f "assets/icon.icns" ]; then
    echo -e "\n${YELLOW}⚠️  Warnung: Icon fehlt (assets/icon.icns)${NC}"
    echo "Verwende Platzhalter Icon..."
    
    # Erstelle einen einfachen Platzhalter PNG
    if [ ! -f "assets/icon.png" ]; then
        # Erstelle ein einfaches Icon mit ImageMagick (falls installiert)
        if command -v convert &> /dev/null; then
            convert -size 512x512 xc:blue -fill white -gravity center -pointsize 200 -annotate +0+0 'WA' assets/icon.png
            echo -e "${GREEN}✅ Platzhalter Icon erstellt${NC}"
        else
            echo -e "${RED}❌ ImageMagick nicht installiert. Bitte Icon manuell erstellen.${NC}"
        fi
    fi
fi

echo -e "\n${GREEN}✅ Build-Vorbereitung abgeschlossen!${NC}"
echo -e "\nNächste Schritte:"
echo "1. Für lokalen Test: npm start"
echo "2. Für Distribution Build: npm run dist"
echo "3. Für App Store Build: npm run dist-mas"

# Checkliste für App Store
echo -e "\n${YELLOW}📋 App Store Checkliste:${NC}"
echo "[ ] Team ID in assets/entitlements.mas.plist eingetragen"
echo "[ ] Icon Set (assets/icon.icns) erstellt"
echo "[ ] Provisioning Profile vorhanden"
echo "[ ] Developer Zertifikate installiert"
echo "[ ] App Store Screenshots vorbereitet"
echo "[ ] App Beschreibung verfasst"
