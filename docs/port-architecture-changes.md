# Port- und Architektur-Anpassungen für Guacamole

## Zusammenfassung der Änderungen

### 1. Port-Änderung: 8080 → 9070
- **Grund**: Port 8080 wird bereits von Nextcloud verwendet
- **Geänderte Dateien**:
  - `docker-compose.yml`: GUACAMOLE_PORT Default auf 9070
  - `.env.example`: GUACAMOLE_PORT=9070 und GUACAMOLE_URL angepasst
  - `frontend/src/config.js`: Default Guacamole URL auf Port 9070

### 2. ARM64 Support für Apple Silicon (M1/M2)
- **Platform-Direktive hinzugefügt** für alle Guacamole Services:
  - `guacd`: `platform: linux/arm64`
  - `guacamole-postgres`: `platform: linux/arm64`
  - `guacamole`: `platform: linux/arm64`
- Dies stellt sicher, dass die korrekten Images für ARM64 geladen werden

### 3. Vereinheitlichte Docker Compose
- Alle Services sind jetzt in einer `docker-compose.yml`
- Alte `docker-compose.guacamole.yml` wurde entfernt
- Konsistente Container-Namen mit `appliance_` Präfix

## Verwendung

### Starten mit neuem Port:
```bash
# Standard-Installation
./scripts/build.sh

# Oder manuell
docker compose up -d
```

### Zugriff:
- Dashboard: http://localhost:9080
- Guacamole: http://localhost:9070/guacamole
- Backend API: http://localhost:3001

### Umgebungsvariablen:
Falls ein anderer Port gewünscht ist, in `.env` setzen:
```bash
GUACAMOLE_PORT=9070
```

## Troubleshooting

### Port bereits belegt:
```bash
# Check welcher Service Port 9070 nutzt
lsof -i :9070
# oder
sudo netstat -tlnp | grep 9070
```

### ARM64 Hinweise:
Guacamole hat keine nativen ARM64 Images, aber Docker wird diese automatisch unter Rosetta 2 emulieren.
Die Warnung "platform (linux/amd64) does not match the detected host platform (linux/arm64/v8)" kann ignoriert werden.

Falls Performance-Probleme auftreten, können Sie alternative Images verwenden:
```bash
# PostgreSQL hat native ARM64 Unterstützung
docker pull postgres:15-alpine
```

### Container neu bauen:
```bash
# Alte Container entfernen
docker compose down -v

# Neu bauen mit explizitem Platform-Flag
docker compose build --no-cache

# Starten
docker compose up -d
```

## Verifizierung

Nach dem Start prüfen:
```bash
# Container Status
docker compose ps

# Architektur der laufenden Container
docker inspect appliance_guacamole | grep -i architecture

# Logs prüfen
docker compose logs guacamole
```
