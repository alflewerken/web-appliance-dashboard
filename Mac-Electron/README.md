# Web Appliance Dashboard - Electron App für macOS

Diese Electron-App lädt das Web Appliance Dashboard Frontend als native macOS-Anwendung.

## Voraussetzungen

- Node.js (v16 oder höher)
- npm oder yarn
- Xcode (für Mac App Store Build)
- Apple Developer Account (für App Store Veröffentlichung)

## Installation

1. Installiere die Abhängigkeiten:
```bash
cd Mac-Electron
npm install
```

2. Baue das Frontend:
```bash
npm run build-frontend
```

## Entwicklung

Starte die App im Entwicklungsmodus:
```bash
npm start
```

## Build für Distribution

### Normaler macOS Build:
```bash
npm run dist
```

### Mac App Store Build:
```bash
npm run dist-mas
```

### Mac App Store Development Build:
```bash
npm run dist-mas-dev
```

## Konfiguration für App Store

Bevor Sie die App im Mac App Store veröffentlichen können, müssen Sie folgende Schritte durchführen:

1. **Team ID einrichten**: Ersetzen Sie `TEAM_ID` in `assets/entitlements.mas.plist` mit Ihrer Apple Developer Team ID.

2. **App Icon erstellen**: 
   - Erstellen Sie ein Icon Set mit allen erforderlichen Größen
   - Speichern Sie es als `assets/icon.icns`
   - Verwenden Sie dafür z.B. [Icon Set Creator](https://apps.apple.com/app/icon-set-creator/id939343785)

3. **Provisioning Profile**:
   - Erstellen Sie ein Provisioning Profile in Apple Developer Portal
   - Speichern Sie es als `embedded.provisionprofile` im Hauptverzeichnis

4. **Code Signing**:
   - Installieren Sie Ihre Developer Zertifikate
   - electron-builder wird diese automatisch verwenden

## API-Konfiguration

Die App verbindet sich standardmäßig mit dem lokal laufenden Backend.
Für eine Cloud-basierte Lösung müssen Sie die API-URL im Frontend konfigurieren.

## Troubleshooting

### Build-Fehler
- Stelle sicher, dass alle Zertifikate korrekt installiert sind
- Überprüfe die Xcode-Installation mit `xcode-select --install`

### App Store Ablehnung
- Stelle sicher, dass alle Entitlements korrekt sind
- Prüfe, ob die App Sandbox-kompatibel ist
- Entferne alle privaten APIs oder nicht erlaubte Funktionen

## Weitere Schritte

1. Icon-Design erstellen
2. App Store Screenshots vorbereiten
3. App Store Beschreibung verfassen
4. Preisgestaltung festlegen
5. App zur Überprüfung einreichen
