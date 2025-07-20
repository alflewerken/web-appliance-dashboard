# Externe URL Konfiguration

## Übersicht

Die externe URL wird benötigt, damit Remote Desktop Verbindungen korrekt funktionieren, wenn das Dashboard über eine externe IP-Adresse oder Domain aufgerufen wird.

## Initial Setup

Die externe URL kann während des initialen Setups konfiguriert werden:

```bash
./scripts/setup-env.sh
```

Das Script fragt nach:
1. Domain (für CORS)
2. **Externe URL (für Remote Desktop)**
3. Environment (Production/Development/Staging)

## Nachträgliche Änderung

Um die externe URL nachträglich zu ändern oder zu entfernen:

```bash
./scripts/update-external-url.sh
```

Dieses Script:
- Erstellt ein Backup der .env Dateien
- Zeigt die aktuelle URL an
- Erlaubt das Setzen einer neuen URL oder das Entfernen
- Synchronisiert automatisch backend/.env
- Startet das Backend neu

## Beispiele

### Lokales Netzwerk
```
http://192.168.178.100:9080
```

### Öffentliche Domain
```
https://dashboard.example.com
```

### Docker Host
```
http://10.0.0.50:9080
```

## Wichtige Hinweise

- Die externe URL muss das Protokoll (http/https) enthalten
- Der Port muss angegeben werden (außer bei Standard-Ports 80/443)
- Die URL sollte von den Clients aus erreichbar sein
- Bei HTTPS muss ein gültiges Zertifikat vorhanden sein

## Fehlerbehebung

### Remote Desktop funktioniert nicht

1. Überprüfen Sie die externe URL:
   ```bash
   grep EXTERNAL_URL .env
   ```

2. Testen Sie die Erreichbarkeit:
   ```bash
   curl -I http://ihre-externe-url:9080
   ```

3. Prüfen Sie die Backend-Logs:
   ```bash
   docker-compose logs backend | grep EXTERNAL_URL
   ```

### URL wurde falsch gesetzt

Nutzen Sie das Update-Script:
```bash
./scripts/update-external-url.sh
```

Oder editieren Sie manuell:
1. `.env` und `backend/.env` bearbeiten
2. `docker-compose restart backend`