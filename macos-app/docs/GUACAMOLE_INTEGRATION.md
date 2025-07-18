# Guacamole Integration für macOS App

## Übersicht

Die macOS App Version des Web Appliance Dashboards beinhaltet jetzt eine vollständige Guacamole Integration für Remote Desktop Zugriff (VNC & RDP).

## Konfiguration

### Ports
- **Guacamole Web**: Port 9871 (statt 9070 im Hauptprojekt)
- **Frontend**: Port 9081
- **Backend API**: Port 3002
- **Terminal**: Port 7682
- **Database**: Port 3307

### Container Namen
Alle Container verwenden das Präfix `wad_app_*`:
- `wad_app_guacamole` - Guacamole Web Application
- `wad_app_guacd` - Guacamole Proxy Daemon
- `wad_app_guacamole_db` - PostgreSQL für Guacamole

## Build Prozess

Der Build-Prozess wurde erweitert:

1. **Docker Images**: Baut alle notwendigen Images inklusive Guacamole
2. **Nginx Konfiguration**: Proxy-Regeln für Guacamole auf `/guacamole/`
3. **Frontend Config**: Automatische Erkennung der macOS App Umgebung

```bash
cd macos-app
./scripts/build.sh
```

## Remote Desktop Features

### Electron Integration
- Native Electron-Fenster für jede Remote Desktop Verbindung
- Window Management verhindert doppelte Fenster
- Automatisches Cleanup beim Schließen

### Frontend Anpassungen
- Automatische Umgebung-Erkennung (Web vs. Electron)
- Korrekte Guacamole URL basierend auf der Umgebung
- Nahtlose Integration mit bestehenden Komponenten

## Testing

### Container Status prüfen
```bash
./test-guacamole.sh
```

### Manuelle Tests
1. Öffne die macOS App
2. Gehe zu einer Appliance mit aktiviertem Remote Desktop
3. Klicke auf den VNC/RDP Button
4. Ein natives Fenster sollte sich mit der Remote Desktop Verbindung öffnen

## Troubleshooting

### Guacamole nicht erreichbar
```bash
# Logs prüfen
docker logs wad_app_guacamole
docker logs wad_app_guacd

# Container neu starten
docker-compose -f docker-compose.app.yml restart guacamole guacd
```

### Port Konflikte
Falls Port 9871 bereits belegt ist, kann er in `docker-compose.app.yml` geändert werden.

### Verbindungsprobleme
1. Prüfe ob die Guacamole Verbindung konfiguriert ist
2. Verifiziere die Token-Generierung im Backend
3. Stelle sicher, dass die Remote-Systeme erreichbar sind

## Sicherheit

- Token-basierte Authentifizierung
- Zeitlich begrenzte Tokens
- Sichere IPC-Kommunikation
- Context Isolation in Electron

## Nächste Schritte

1. Konfiguriere Guacamole Verbindungen für deine Appliances
2. Teste VNC und RDP Verbindungen
3. Optimiere Window-Größen für verschiedene Auflösungen
