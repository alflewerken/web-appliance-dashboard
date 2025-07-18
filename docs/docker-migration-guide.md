# Docker Compose Migration Guide

## 🔄 Migration von hardcoded Werten zu .env

Diese Anleitung beschreibt die Migration von der alten `docker-compose.yml` mit hardcoded Werten zur neuen Version mit `.env` Unterstützung.

### Was wurde geändert?

1. **Environment-Variablen** - Alle sensiblen Daten und Konfigurationswerte sind jetzt in `.env`
2. **Flexible Konfiguration** - Ports, Container-Namen und Volumes können über `.env` angepasst werden
3. **Sicherheit** - Secrets sind nicht mehr im Repository sichtbar

### Migration durchführen

#### 1. Backup erstellen (optional)
```bash
# Backup der Datenbank
docker compose exec database mysqldump -u root -p appliance_dashboard > backup.sql

# SSH Keys sichern
docker compose cp backend:/root/.ssh ./ssh-backup
```

#### 2. Alte Container stoppen
```bash
docker compose down
```

#### 3. Environment Setup
```bash
# Automatisch (empfohlen)
./setup-env.sh

# Oder manuell
cp .env.example .env
# .env anpassen mit Ihren Werten
```

#### 4. Neue Container starten
```bash
docker compose up -d
```

### Wichtige Änderungen

#### Volumes
Die Volumes verwenden jetzt Standard-Namen statt dynamischer Namen:
- `db_data` (vorher: `appliance_db_data`)
- `ssh_keys` (vorher: `appliance_ssh_keys`)

Die Daten bleiben erhalten, wenn Sie die gleichen Volume-Namen verwenden.

#### Container Namen
Können jetzt über `.env` konfiguriert werden:
```env
DB_CONTAINER_NAME=my_custom_db
BACKEND_CONTAINER_NAME=my_custom_backend
```

#### Ports
Alle Ports sind konfigurierbar:
```env
BACKEND_PORT=3001
NGINX_HTTP_PORT=9080
NGINX_HTTPS_PORT=9443
TTYD_PORT=7681
DB_EXTERNAL_PORT=3306
```

### Troubleshooting

#### "Volume not found" Fehler
Wenn Sie Fehler wie `refers to undefined volume` sehen:
1. Prüfen Sie, ob `.env` existiert
2. Führen Sie `docker compose config` aus, um die Konfiguration zu validieren
3. Stellen Sie sicher, dass Sie Docker Compose v2 verwenden

#### Permission Denied bei clean.sh
```bash
# Mit sudo ausführen
sudo ./scripts/clean.sh

# Oder Berechtigungen ändern
sudo chown -R $(whoami) backend/node_modules frontend/node_modules
```

#### Services starten nicht
```bash
# Logs prüfen
docker compose logs -f

# Einzelnen Service debuggen
docker compose logs -f backend

# Health Status prüfen
docker compose ps
```

### Best Practices

1. **Niemals .env committen** - Ist bereits in `.gitignore`
2. **Sichere Secrets verwenden** - Der `setup-env.sh` generiert diese automatisch
3. **Regelmäßige Backups** - Besonders vor Updates
4. **Development Override** - Nutzen Sie `docker-compose.override.yml` für Dev-Umgebungen

### Rollback (falls nötig)

Wenn Sie zur alten Version zurückkehren müssen:
1. Alte `docker-compose.yml` aus Git History wiederherstellen
2. `.env` temporär umbenennen
3. Container mit alter Config starten

Die Daten in den Volumes bleiben in beiden Versionen kompatibel.