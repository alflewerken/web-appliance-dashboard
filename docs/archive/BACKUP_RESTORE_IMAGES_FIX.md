# Backup/Restore Hintergrundbilder - Lösung

## Problem
Bei der Backup-Wiederherstellung im Einstellungen-Panel wurden die Hintergrundbilder nicht wiederhergestellt.

## Ursachen

1. **Volume-Konfiguration**: Das uploads-Verzeichnis war nicht als Docker Volume konfiguriert
2. **Verzeichnis-Erstellung**: Das backgrounds-Verzeichnis wurde nicht automatisch erstellt
3. **Dateipfade**: Inkonsistenz zwischen Host-System und Container-Pfaden

## Implementierte Lösung

### 1. Docker-Compose angepasst (`docker-compose.yml`)
```yaml
backend:
  volumes:
    - ./backend:/app
    - /app/node_modules
    - ssh_keys:/root/.ssh
    - uploads:/app/uploads  # NEU: Persistentes Volume für Uploads

volumes:
  uploads:
    driver: local
    labels:
      - "backup=${BACKUP_ENABLED:-true}"
      - "purpose=uploads"
      - "project=web-appliance-dashboard"
```

### 2. Backup-Restore Code verbessert (`backend/routes/backup.js`)
```javascript
// Verzeichnis erstellen falls nicht vorhanden
await fs.mkdir(backgroundsDir, { recursive: true });

// Beim Wiederherstellen einzelner Dateien
const dir = path.dirname(filepath);
await fs.mkdir(dir, { recursive: true });
```

## Was passiert jetzt

### Beim Backup erstellen:
1. Hintergrundbilder-Metadaten werden aus der Datenbank gelesen
2. Bilddateien werden aus `/app/uploads/backgrounds/` gelesen
3. Dateien werden base64-kodiert und im Backup JSON gespeichert

### Beim Backup wiederherstellen:
1. Alte Bilder werden gelöscht (optional)
2. Verzeichnis wird erstellt falls nicht vorhanden
3. Base64-Daten werden dekodiert und als Dateien gespeichert
4. Metadaten werden in der Datenbank wiederhergestellt

## Wichtige Hinweise

1. **Persistenz**: Das uploads-Volume ist jetzt persistent und überlebt Container-Neustarts
2. **Migration**: Bestehende Dateien müssen einmalig ins Volume kopiert werden:
   ```bash
   docker cp ./backend/uploads/backgrounds/. appliance_backend:/app/uploads/backgrounds/
   ```
3. **Backup-Größe**: Backups mit vielen/großen Bildern können sehr groß werden

## Testing

### Backup erstellen und prüfen:
```bash
# Backup erstellen
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/backup/create > backup.json

# Prüfen ob Bilder enthalten sind
cat backup.json | jq '.background_images[0] | {filename, has_data: (.file_data != null)}'
```

### Wiederherstellung testen:
1. Einstellungen → Backup Tab öffnen
2. Backup-Datei auswählen
3. "Wiederherstellen" klicken
4. Prüfen ob Hintergrundbilder wieder da sind

## Container-Befehle

```bash
# Bilder im Container prüfen
docker exec appliance_backend ls -la /app/uploads/backgrounds/

# Volume inspizieren
docker volume inspect web-appliance-dashboard_uploads

# Logs während Restore
docker logs -f appliance_backend
```

## Nächste Schritte

1. **Automatische Migration**: Script für bestehende Installationen
2. **Kompression**: Bilder vor dem Speichern im Backup komprimieren
3. **Selektives Backup**: Option nur Metadaten ohne Bilder zu sichern
