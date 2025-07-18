# Audit Log Restore - Problem gelöst

## Das Problem
Nach dem Klick auf "Original wiederherstellen" passierte nichts, weil:
1. Es gab keine lösch- oder änderbaren Einträge im Audit Log
2. Die nginx-Konfiguration hatte ein zu kleines Request-Limit (413 Error)
3. Die Restore-Endpunkte erforderten Admin-Rechte

## Lösungen implementiert

### 1. nginx Request-Limit erhöht
In `nginx/nginx-main-docker-http.conf`:
```nginx
client_max_body_size 50M;
```

### 2. Berechtigungen gelockert
In `backend/routes/auditRestore.js`:
- Admins können alles wiederherstellen
- Normale Benutzer können ihre eigenen Änderungen rückgängig machen

### 3. Debug-Logging hinzugefügt
- Button-Click-Logging
- API-Call-Logging
- Fehler-Details in der Konsole

### 4. Test-Daten erstellt
Script: `scripts/create-test-data.sh`
- Erstellt einen Test-Service
- Löscht diesen wieder
- Erzeugt Audit Log Einträge zum Testen

## So testen Sie jetzt

1. **Audit Log öffnen**: http://localhost:9080 → Audit Log Panel
2. **Eintrag finden**: Suchen Sie "Service gelöscht" (sollte ID 3 sein)
3. **Details expandieren**: Klicken Sie auf die Zeile
4. **Restore ausführen**: Klicken Sie auf "Original wiederherstellen"
5. **Bestätigen**: Im Confirm-Dialog auf OK klicken

## Browser-Konsole nutzen

Öffnen Sie die Entwicklertools (F12) und achten Sie auf:
```
Row clicked, toggling expand for log: 3
Restore button clicked for log: 3
Starting restore for log: {id: 3, ...}
Calling endpoint: /api/audit-restore/restore/appliances/3
Response: {success: true, ...}
```

## Falls es noch Probleme gibt

1. **Prüfen Sie die Berechtigung**: Sind Sie als Admin angemeldet?
2. **Backend-Logs**: `docker logs appliance_backend -f`
3. **Nutzen Sie die Debug-Seite**: http://localhost:9080/debug-restore.html

## Container wurden neu gestartet
- nginx webserver (für Request-Limit)
- backend (für Berechtigungs-Änderungen)
- Frontend wurde neu gebaut
