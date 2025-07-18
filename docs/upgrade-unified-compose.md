# Upgrade Guide: Unified Docker Compose

## Overview
In Version 1.1.0 wurden die separaten Docker Compose Dateien zu einer einzigen `docker-compose.yml` zusammengeführt. Dies vereinfacht die Verwaltung und Installation.

## Was hat sich geändert?

### Vorher:
- `docker-compose.yml` - Hauptanwendung
- `docker-compose.guacamole.yml` - Remote Desktop Services

### Jetzt:
- `docker-compose.yml` - Alles in einer Datei

## Upgrade-Schritte für bestehende Installationen

### 1. Backup erstellen (Optional aber empfohlen)
```bash
docker compose exec backend npm run backup
```

### 2. Alte Services stoppen
```bash
docker compose down
docker compose -f docker-compose.guacamole.yml down 2>/dev/null || true
```

### 3. Neue docker-compose.yml verwenden
Die neue Datei ist bereits im Repository. Falls Sie lokale Änderungen haben, sichern Sie diese zuerst.

### 4. Services neu starten
```bash
# Mit Remote Desktop (Standard)
docker compose up -d

# Oder ohne Remote Desktop
docker compose up -d database backend ttyd webserver
```

### 5. Verifizieren
```bash
./scripts/status.sh
```

## Container Namen

Die Container haben jetzt konsistente Namen mit dem Präfix `appliance_`:
- `appliance_db` - Datenbank
- `appliance_backend` - Backend API
- `appliance_webserver` - Nginx
- `appliance_ttyd` - Terminal
- `appliance_guacd` - Guacamole Daemon
- `appliance_guacamole` - Guacamole Web
- `appliance_guacamole_db` - Guacamole Datenbank

## Vorteile der Vereinheitlichung

1. **Einfachere Verwaltung** - Nur eine Datei
2. **Bessere Integration** - Services im gleichen Netzwerk
3. **Konsistente Konfiguration** - Einheitliche Health Checks und Labels
4. **Flexibilität** - Remote Desktop kann einzeln gestartet/gestoppt werden

## Befehle

### Alle Services starten
```bash
docker compose up -d
```

### Nur Hauptanwendung (ohne Remote Desktop)
```bash
docker compose up -d database backend ttyd webserver
```

### Nur Remote Desktop hinzufügen
```bash
docker compose up -d guacamole-postgres guacd guacamole
```

### Remote Desktop stoppen
```bash
docker compose stop guacamole-postgres guacd guacamole
```

## Troubleshooting

Falls Probleme auftreten:

1. **Container Name Konflikte**
   ```bash
   docker compose down -v
   docker container prune
   ```

2. **Port Konflikte**
   Prüfen Sie ob Port 8080 bereits belegt ist

3. **Datenbank Migration**
   ```bash
   ./scripts/verify-database.sh
   ```

## Rollback (Falls nötig)

Die alte `docker-compose.guacamole.yml` wurde entfernt. Falls Sie zurück zur alten Struktur möchten, finden Sie diese im Git History.