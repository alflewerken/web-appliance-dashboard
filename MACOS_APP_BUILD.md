# macOS App Build Instructions

## 🚀 Quick Start

### Build Everything (Docker Containers + Electron App):
```bash
./scripts/build-macos-app.sh
```

Dies wird:
1. ✅ Die Docker Container für die macOS App bauen und starten
2. ✅ Die Electron App bauen 
3. ✅ Eine DMG-Datei für die Installation erstellen

### Build-Optionen:

#### Nur Electron App bauen (Container überspringen):
```bash
./scripts/build-macos-app.sh --skip-containers
```

#### Ohne DMG bauen (schneller):
```bash
./scripts/build-macos-app.sh --no-dmg
```

#### Clean Build (alles neu bauen):
```bash
./scripts/build-macos-app.sh --clean
```

#### Kombination:
```bash
./scripts/build-macos-app.sh --clean --skip-containers
```

## 📦 Ergebnis

Nach erfolgreichem Build finden Sie:

1. **DMG-Datei** (für Installation):
   ```
   macos-app/dist/Web Appliance Dashboard-1.0.1-arm64.dmg
   ```

2. **Docker Container** (wenn nicht übersprungen):
   - Dashboard: http://localhost:9081
   - Backend: http://localhost:3002
   - Terminal: http://localhost:7682
   - Guacamole: http://localhost:9782/guacamole/

## 🔧 Entwicklung

### App im Dev-Modus starten:
```bash
cd macos-app
npm start
```

### Nur Container verwalten:
```bash
cd macos-app
docker compose -f docker-compose.app.yml -p web-appliance-app up -d
docker compose -f docker-compose.app.yml -p web-appliance-app logs -f
docker compose -f docker-compose.app.yml -p web-appliance-app down
```

## 🎯 Features der macOS App

- **System Tray Integration**: Läuft im Hintergrund
- **Auto-Start Container**: Startet Docker Container automatisch
- **Guacamole auf Port 9782**: Remote Desktop integriert
- **Native macOS Experience**: Optimiert für macOS

## ⚠️ Voraussetzungen

- Node.js 16+ und npm
- Docker Desktop installiert und laufend
- macOS 10.12+
- Xcode Command Line Tools (für den Build)

## 🆘 Troubleshooting

### Build fehlgeschlagen?
```bash
# Clean build versuchen
./scripts/build-macos-app.sh --clean
```

### Container Probleme?
```bash
# Container Status prüfen
cd macos-app
docker compose -f docker-compose.app.yml -p web-appliance-app ps

# Container neu starten
docker compose -f docker-compose.app.yml -p web-appliance-app restart
```

### App startet nicht?
1. Prüfen Sie ob Docker Desktop läuft
2. Prüfen Sie die Logs: `cd macos-app && npm start`
3. Clean build: `./scripts/build-macos-app.sh --clean`
