# Web Appliance Dashboard macOS App

Eine native macOS App für das Web Appliance Dashboard, die sich automatisch installiert und Docker Container verwaltet.

## 🚀 Features

- **Automatische Installation** - Kein Terminal, keine Konfiguration erforderlich
- **Docker Container Management** - Start/Stop/Restart mit einem Klick
- **Live Logs** - Container-Logs direkt in der App anzeigen
- **System Tray Integration** - App läuft im Hintergrund
- **Isolierte Container** - Eigene Container mit `wad_app_*` Präfix

## 📦 Installation

1. **App herunterladen** oder mit `npm run build` erstellen
2. **App öffnen** - Doppelklick auf "Web Appliance Dashboard.app"
3. **Fertig!** - Die App installiert sich selbst beim ersten Start

## 🎯 Verwendung

### Hauptfenster
- Zeigt das Web Appliance Dashboard (localhost:9081)
- Schnellzugriff auf alle Dienste

### Management-Fenster (CMD+M)
- Container-Status überwachen
- Container starten/stoppen/neustarten
- Logs in Echtzeit anzeigen

### System Tray
- Quick-Access zu allen Funktionen
- App läuft im Hintergrund weiter

## 🛠️ Entwicklung

```bash
# Abhängigkeiten installieren
npm install

# Entwicklungsmodus
npm run dev

# macOS App erstellen
npm run build
```

## 📁 Projekt-Struktur

```
macos-app/
├── main.js              # Electron Hauptprozess
├── renderer.js          # UI-Logik
├── preload.js          # Sichere API-Bridge
├── docker-manager.js    # Docker-Integration
├── index.html          # Management UI
├── styles.css          # Styling
├── docker-compose.app.yml # Container-Konfiguration
└── package.json        # Projekt-Konfiguration
```

## 🔧 Technische Details

### Automatisches Setup
- Findet das Hauptprojekt automatisch
- Erstellt Arbeitsverzeichnis in `~/Library/Application Support/`
- Generiert Docker-Konfiguration mit absoluten Pfaden

### Container-Isolation
- **Ports**: 9081 (Frontend), 3002 (API), 7682 (Terminal), 3307 (DB)
- **Container**: wad_app_db, wad_app_backend, wad_app_webserver, wad_app_ttyd
- **Netzwerk**: wad_app_network

### Reset bei Problemen
```bash
# App-Daten zurücksetzen
rm -rf ~/Library/Application\ Support/web-appliance-dashboard

# Container bereinigen
./cleanup-app-containers.sh
```

## 📋 Voraussetzungen

- macOS 10.15 oder neuer
- Docker Desktop installiert und laufend
- Web Appliance Dashboard Projekt

## 🤝 Beitragen

Pull Requests sind willkommen! Für größere Änderungen bitte erst ein Issue erstellen.

## 📄 Lizenz

Siehe Hauptprojekt-Lizenz.