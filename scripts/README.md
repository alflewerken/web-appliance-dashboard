# Web Appliance Dashboard - Build Script

## 🚀 Quick Start

### Nach einem frischen Clone oder Neustart:
```bash
./scripts/build.sh
```

Das war's! Der Script kümmert sich um alles:
- ✅ Korrigiert automatisch falsche Passwörter
- ✅ Initialisiert Guacamole-Datenbank
- ✅ Startet alle Services in richtiger Reihenfolge
- ✅ Führt Health-Checks durch

### Für schnelle Code-Änderungen:
```bash
./scripts/build.sh --refresh
```

## 📝 build.sh - Der Universal-Script

### Standard-Start (nach Clone/Neustart)
```bash
./scripts/build.sh
```
**Was passiert:**
1. Prüft und korrigiert .env Konfiguration
2. Baut Frontend (wenn vorhanden)
3. Startet alle Services
4. Initialisiert Guacamole-DB bei Bedarf
5. Zeigt Status und Zugangsdaten

### Quick Refresh (Entwicklung)
```bash
./scripts/build.sh --refresh
```
**Was passiert:**
- Nur Backend und Frontend neu starten
- Keine vollständige Rebuild
- Perfekt für Code-Änderungen

### Weitere Optionen
```bash
./scripts/build.sh --nocache      # Löscht alle Caches, vollständiger Rebuild
./scripts/build.sh --no-remote-desktop  # Ohne Guacamole
./scripts/build.sh --help         # Zeigt alle Optionen
```

## 🔧 Typische Workflows

### Erstmalige Installation
```bash
git clone <repository>
cd web-appliance-dashboard
./scripts/build.sh
```

### Nach Docker-Neustart
```bash
./scripts/build.sh
```

### Während der Entwicklung
```bash
# Code ändern, dann:
./scripts/build.sh --refresh
```

### Bei Problemen
```bash
# Kompletter Neuaufbau:
./scripts/build.sh --nocache
```

## ⚙️ Was der Script automatisch macht

### Environment-Korrekturen
- `GUACAMOLE_DB_PASSWORD`: Korrigiert falsches Passwort
- `DB_PASSWORD`: Setzt Default wenn fehlt
- `JWT_SECRET`: Generiert wenn fehlt
- `SSH_KEY_ENCRYPTION_SECRET`: Generiert wenn fehlt

### Guacamole-Initialisierung
- Prüft ob Tabellen existieren
- Lädt Schema-Dateien wenn nötig
- Erstellt Admin-User (guacadmin/guacadmin)
- Aktiviert SFTP-Support

### Service-Start
1. Database → Backend → TTYD → Webserver
2. Guacamole-Postgres → Guacd → Guacamole (wenn aktiviert)
3. Health-Checks für jeden Service

## 🎯 Best Practices

1. **Immer `build.sh` nach Clone/Pull verwenden**
   - Keine weiteren Scripts nötig
   - Alles wird automatisch konfiguriert

2. **`--refresh` für schnelle Iterationen**
   - Spart Zeit während der Entwicklung
   - Kein vollständiger Rebuild

3. **`--nocache` nur wenn wirklich nötig**
   - Dauert länger
   - Löscht node_modules und Docker-Cache

## 📊 Status prüfen
```bash
docker compose ps
docker compose logs -f <service>
```

## ⚠️ Fehlerbehebung

### "Docker is not running"
→ Docker Desktop starten

### "Guacamole connection failed"
→ Script initialisiert DB automatisch, einfach warten

### "Wrong password errors"
→ Script korrigiert automatisch, Container werden neu gestartet

### "Port already in use"
→ Ports ändern in docker-compose.yml oder andere Services stoppen

## 🔒 Standard-Zugangsdaten

Nach erfolgreichem Start:

**Dashboard:**
- URL: http://localhost:9080
- User: admin
- Pass: admin123

**Guacamole (Remote Desktop):**
- URL: http://localhost:9080/guacamole
- User: guacadmin
- Pass: guacadmin

## 🛠️ Nur build.sh - Keine weiteren Scripts nötig!

Der `build.sh` ist jetzt der einzige Script, den du brauchst:
- Kaltstart ✅
- Entwicklung ✅
- Fehlerbehebung ✅
- Alle Checks ✅
