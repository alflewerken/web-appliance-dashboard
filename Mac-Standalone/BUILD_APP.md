# macOS Electron App - Build Instructions

## Voraussetzungen
- Node.js und npm installiert
- Docker Desktop läuft
- Xcode Command Line Tools (für macOS builds)

## Installation der Abhängigkeiten
```bash
cd /Users/alflewerken/Desktop/web-appliance-dashboard/Mac-Standalone
npm install
```

## App im Entwicklungsmodus starten
```bash
npm run dev
# oder
npm start
```

## App für Distribution bauen

### 1. DMG-Datei erstellen (für Distribution):
```bash
npm run dist
```
Dies erstellt eine .dmg Datei im `dist/` Verzeichnis.

### 2. Nur App bauen (ohne DMG):
```bash
npm run build
```

## Docker Container für die App

Die App verwendet eigene Docker Container mit dem Präfix `wad_app_`.

### Container starten:
```bash
# Mit dem neuen Build-Script
../scripts/build-macos-app.sh

# Oder direkt:
docker compose -f docker-compose.app.yml -p web-appliance-app up -d
```

### Container Status prüfen:
```bash
docker compose -f docker-compose.app.yml -p web-appliance-app ps
```

## Ports der macOS App:
- Dashboard: http://localhost:9081
- Backend API: http://localhost:3002  
- Terminal: http://localhost:7682
- Guacamole: http://localhost:9782/guacamole/

## App Features:
1. **System Tray Integration** - App läuft im Hintergrund
2. **Automatischer Docker Start** - Startet Container beim App-Start
3. **Docker Management UI** - Verwalte Container über die App
4. **Native macOS Experience** - Optimiert für macOS

## Troubleshooting:

### App startet nicht:
```bash
# Logs prüfen
npm start

# Docker Desktop prüfen
docker info
```

### Container Probleme:
```bash
# Container neu starten
docker compose -f docker-compose.app.yml -p web-appliance-app restart

# Logs anzeigen
docker compose -f docker-compose.app.yml -p web-appliance-app logs -f
```

### App neu bauen:
```bash
# Alles aufräumen
npm run clean
rm -rf node_modules dist

# Neu installieren und bauen
npm install
npm run dist
```

## Entwicklung:

### Code-Struktur:
- `src/main.js` - Electron Hauptprozess
- `src/preload.js` - Bridge zwischen Main und Renderer
- `src/docker-manager.js` - Docker Container Verwaltung
- `src/remoteDesktopHandler.js` - Remote Desktop Integration

### Debug-Modus:
```bash
NODE_ENV=development npm start
```

Dies öffnet automatisch die DevTools.
