# Cleanup Scripts für macOS App

## Übersicht

Diese Scripts helfen beim Aufräumen der Docker-Container und Volumes der macOS App Version des Web Appliance Dashboards.

## Scripts

### 1. cleanup-app-containers.sh

Interaktives Cleanup-Script mit Sicherheitsabfragen:
- Fragt vor jeder Aktion nach Bestätigung
- Zeigt detaillierte Informationen über zu löschende Ressourcen
- Optional: Docker System Prune am Ende

```bash
./scripts/cleanup-app-containers.sh
```

### 2. force-cleanup.sh

Schnelles Cleanup ohne Nachfragen:
- Löscht alle Container mit Präfix `wad_app_*`
- Entfernt alle Volumes mit Präfix `wad_app_*`
- Entfernt das Netzwerk `wad_app_network`

```bash
./scripts/force-cleanup.sh
```

## Was wird gelöscht?

### Container
- `wad_app_webserver` - Nginx Webserver
- `wad_app_backend` - Node.js Backend
- `wad_app_db` - MariaDB Datenbank
- `wad_app_ttyd` - Web Terminal
- `wad_app_guacamole` - Remote Desktop Web App
- `wad_app_guacd` - Guacamole Proxy Daemon
- `wad_app_guacamole_db` - PostgreSQL für Guacamole

### Volumes
- `wad_app_db_data` - Datenbank-Daten
- `wad_app_ssh_keys` - SSH Schlüssel
- `wad_app_uploads` - Upload-Dateien
- `wad_app_guacamole_db` - Guacamole Datenbank
- `wad_app_guacamole_drive` - Guacamole Dateitransfer
- `wad_app_guacamole_record` - Guacamole Aufzeichnungen
- `wad_app_guacamole_home` - Guacamole Konfiguration

### Netzwerk
- `wad_app_network` - Docker Bridge Netzwerk

## Sicherheit

⚠️ **WARNUNG**: Diese Scripts löschen ALLE Daten unwiderruflich!

- Alle Benutzer-Accounts gehen verloren
- Alle Appliance-Konfigurationen werden gelöscht
- Alle SSH-Schlüssel werden entfernt
- Alle Remote Desktop Verbindungen werden gelöscht

## Nach dem Cleanup

### Neuinstallation
```bash
cd Mac-Standalone
./scripts/build.sh
```

### Nur Container neu starten
```bash
docker-compose -f docker-compose.app.yml up -d
```

## Troubleshooting

### Container lassen sich nicht löschen
```bash
# Force Remove
docker rm -f $(docker ps -a -q --filter "name=wad_app")
```

### Volumes lassen sich nicht löschen
```bash
# Prüfe ob Container noch Volumes nutzen
docker ps -a --filter "name=wad_app"

# Force Remove Volumes
docker volume rm -f $(docker volume ls -q --filter "name=wad_app")
```

### Netzwerk lässt sich nicht löschen
```bash
# Disconnect alle Container vom Netzwerk
docker network disconnect -f wad_app_network $(docker ps -q)

# Dann Netzwerk löschen
docker network rm wad_app_network
```
