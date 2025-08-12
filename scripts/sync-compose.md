# Docker-Compose Synchronisation Guide

## Übersicht

Das Web Appliance Dashboard verwendet unterschiedliche Docker-Compose Konfigurationen für Entwicklung und Production. Um diese synchron zu halten, gibt es ein automatisiertes Synchronisations-System.

## Datei-Struktur

```
web-appliance-dashboard/
├── docker-compose.yml              # Entwicklungs-Konfiguration (Primary Source)
├── docker-compose.production.yml   # Production-Template (Auto-generiert)
├── install.sh                      # Lädt docker-compose.production.yml herunter
└── scripts/
    ├── sync-compose.sh             # Synchronisations-Tool
    └── sync-compose.md             # Diese Dokumentation
```

## Das Problem

Früher wurde die docker-compose Konfiguration an zwei Stellen gepflegt:
1. **docker-compose.yml** für die lokale Entwicklung
2. **Inline im install.sh** für Production-Installationen

Dies führte zu:
- 🔴 Inkonsistenzen zwischen Umgebungen
- 🔴 Doppelte Arbeit bei Änderungen
- 🔴 Fehleranfällige manuelle Synchronisation
- 🔴 Unterschiedliche Container-Namen

## Die Lösung

### Template-basierter Ansatz

1. **docker-compose.yml** ist die "Single Source of Truth"
2. **docker-compose.production.yml** wird automatisch daraus generiert
3. **install.sh** lädt die Production-Version vom Repository

### Automatische Konvertierung

Das `sync-compose.sh` Script konvertiert automatisch von Development zu Production:

| Development | Production |
|------------|------------|
| `build: ./backend` | `image: ghcr.io/alflewerken/web-appliance-dashboard-backend:latest` |
| `build: ./nginx` | `image: ghcr.io/alflewerken/web-appliance-dashboard-nginx:latest` |
| `- ./backend:/app` | (entfernt - kein Code-Mount) |
| `- /app/node_modules` | (entfernt - nicht benötigt) |
| Lokale Ports | Konfigurierbare Ports via ENV |

## Verwendung

### 1. Änderungen prüfen

```bash
./scripts/sync-compose.sh check
```

Zeigt:
- Welche Services in Development existieren
- Welche Services in Production existieren
- Unterschiede zwischen beiden

Beispiel-Output:
```
📊 Comparing docker-compose files...

Services in Development:
  - backend
  - database
  - guacamole
  - guacamole-postgres
  - guacd
  - rustdesk-relay
  - rustdesk-server
  - ttyd
  - webserver

Services in Production:
  - backend
  - database
  - guacamole
  - guacamole-postgres
  - guacd
  - rustdesk-relay
  - rustdesk-server
  - ttyd
  - webserver

✅ Service names are synchronized!
```

### 2. Production-Template aktualisieren

```bash
./scripts/sync-compose.sh update
```

Dies:
1. Erstellt ein Backup: `docker-compose.production.yml.bak`
2. Kopiert `docker-compose.yml` nach `docker-compose.production.yml`
3. Wendet automatische Konvertierungen an:
   - Ersetzt Build-Kontexte mit Docker Hub/ghcr.io Images
   - Entfernt development-spezifische Volume-Mounts
   - Bereinigt leere Sections

### 3. Detaillierte Unterschiede anzeigen

```bash
./scripts/sync-compose.sh diff
```

Zeigt einen vollständigen `diff` zwischen Development und Production.

### 4. Hilfe anzeigen

```bash
./scripts/sync-compose.sh help
```

## Workflow für Entwickler

### Bei Änderungen an docker-compose.yml:

1. **Änderungen in docker-compose.yml vornehmen**
   ```bash
   vim docker-compose.yml
   ```

2. **Lokal testen**
   ```bash
   ./scripts/build.sh --refresh
   docker compose ps
   ```

3. **Synchronisation prüfen**
   ```bash
   ./scripts/sync-compose.sh check
   ```

4. **Production-Template aktualisieren**
   ```bash
   ./scripts/sync-compose.sh update
   ```

5. **Änderungen überprüfen**
   ```bash
   # Manuell das generierte Template prüfen
   diff docker-compose.production.yml.bak docker-compose.production.yml
   
   # Bei Bedarf manuelle Anpassungen
   vim docker-compose.production.yml
   ```

6. **Änderungen committen**
   ```bash
   git add docker-compose.yml docker-compose.production.yml
   git commit -m "Update docker configurations"
   git push
   ```

## Container-Namen Konvention

### Vereinheitlichte Namen (seit 2025-12-28):

| Service | Container-Name | Hinweis |
|---------|---------------|---------|
| database | appliance_db | MariaDB |
| backend | appliance_backend | Node.js API |
| webserver | appliance_webserver | Nginx |
| ttyd | appliance_ttyd | Web Terminal |
| guacamole | appliance_guacamole | Remote Desktop Web |
| guacamole-postgres | appliance_guacamole_db | PostgreSQL für Guacamole |
| guacd | appliance_guacd | Guacamole Daemon |
| rustdesk-server | rustdesk-server | Kein Prefix (Standard) |
| rustdesk-relay | rustdesk-relay | Kein Prefix (Standard) |

**Wichtig**: RustDesk Container verwenden absichtlich KEINE `appliance_` Prefix, da sie eigenständige Services sind.

## Spezielle Anpassungen

### Manuelle Anpassungen nach sync

Manchmal sind manuelle Anpassungen in `docker-compose.production.yml` nötig:

1. **Environment-Variablen**
   - Production nutzt andere Defaults
   - Secrets sollten über ENV konfigurierbar sein

2. **Volumes**
   - Production braucht keine Source-Code Mounts
   - Aber: Config-Dateien und Daten-Volumes bleiben

3. **Ports**
   - Production-Ports sollten konfigurierbar sein
   - Default-Ports können sich unterscheiden

4. **Healthchecks**
   - Production kann andere Timings benötigen
   - Start-Period oft länger in Production

### Beispiel: Backend Service

**Development** (docker-compose.yml):
```yaml
backend:
  build:
    context: ./backend
    dockerfile: Dockerfile
  container_name: ${BACKEND_CONTAINER_NAME:-appliance_backend}
  volumes:
    - ./backend:/app
    - /app/node_modules
  environment:
    NODE_ENV: development
```

**Production** (docker-compose.production.yml):
```yaml
backend:
  image: ghcr.io/alflewerken/web-appliance-dashboard-backend:latest
  container_name: ${BACKEND_CONTAINER_NAME:-appliance_backend}
  # Keine Source-Volumes!
  environment:
    NODE_ENV: production
```

## Troubleshooting

### Problem: Services nur in Development

**Symptom:**
```
⚠️  Services only in Development:
  - new-service
```

**Lösung:**
```bash
./scripts/sync-compose.sh update
```

### Problem: Sync-Script schlägt fehl

**Symptom:**
```
sed: command not found
```

**Lösung:**
Das Script benötigt standard Unix-Tools (sed, grep, diff). Auf macOS sind diese vorinstalliert.

### Problem: Production-Template hat falsche Images

**Symptom:**
Build-Kontexte wurden nicht korrekt ersetzt.

**Lösung:**
1. Backup wiederherstellen:
   ```bash
   mv docker-compose.production.yml.bak docker-compose.production.yml
   ```

2. Manuell anpassen oder Issue melden

## Best Practices

### ✅ DO's

1. **Immer sync-compose.sh verwenden** nach Änderungen
2. **Beide Dateien committen** (docker-compose.yml UND docker-compose.production.yml)
3. **Backup prüfen** bevor größere Änderungen gemacht werden
4. **Changes.md aktualisieren** bei strukturellen Änderungen

### ❌ DON'Ts

1. **NICHT manuell in install.sh** die docker-compose Definition ändern
2. **NICHT nur eine Datei** committen (beide müssen synchron sein)
3. **NICHT Production-only Changes** in docker-compose.yml machen
4. **NICHT Container-Namen** ohne Absprache ändern

## Installation in Production

Das `install.sh` Script lädt automatisch die aktuelle `docker-compose.production.yml`:

```bash
# One-line installer
curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/install.sh | bash

# Was passiert intern:
# 1. Script lädt docker-compose.production.yml herunter
# 2. Speichert sie als docker-compose.yml
# 3. Startet Container mit dieser Konfiguration
```

## Versionierung

- **docker-compose.yml**: Entwicklungs-Version, ändert sich häufig
- **docker-compose.production.yml**: Production-Template, stabil
- **install.sh**: Referenziert immer main-Branch

Bei Breaking Changes:
1. Version-Tag erstellen
2. Release Notes schreiben
3. Migration Guide bereitstellen

## Support

Bei Problemen:
1. Check die [changes.md](../changes/changes.md) für aktuelle Änderungen
2. Führe `./scripts/sync-compose.sh check` aus
3. Erstelle ein Issue im Repository

---

*Letzte Aktualisierung: 2025-12-28*
*Autor: Web Appliance Dashboard Team*
