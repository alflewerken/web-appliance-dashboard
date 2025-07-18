# Audit Log Restore - Fehlerbehebung

## Problem
Nach dem Klick auf "Original wiederherstellen" passiert nichts nach der Warnmeldung.

## Ursache
Die Restore-Endpunkte erforderten Admin-Rechte (`requireAdmin`), was normale Benutzer blockierte.

## Lösung

### 1. Berechtigungen angepasst
Die Endpunkte in `backend/routes/auditRestore.js` wurden geändert:
- Von: `router.post('/restore/appliances/:logId', requireAdmin, ...)`
- Zu: `router.post('/restore/appliances/:logId', async (req, res) => { ... })`

Neue Logik:
- Admins können alles wiederherstellen
- Normale Benutzer können nur ihre eigenen Änderungen rückgängig machen

### 2. Debug-Logging hinzugefügt
In `frontend/src/components/AuditLog/AuditLogTableMUI.js`:
```javascript
console.log('Starting restore for log:', log);
console.log('Restore info:', restoreInfo);
console.log('Calling endpoint:', endpoint);
console.log('Response:', response);
```

### 3. Bestätigungsdialog
Ein Confirm-Dialog wurde hinzugefügt, der den Ressourcennamen anzeigt.

## Geänderte Dateien
1. `backend/routes/auditRestore.js` - Berechtigungen gelockert
2. `frontend/src/components/AuditLog/AuditLogTableMUI.js` - Debug-Logging und Confirm-Dialog
3. `debug-restore.html` - Debug-Tool zum Testen der API

## Test-Anleitung

### Browser-Konsole nutzen:
1. Öffnen Sie die Entwicklerkonsole (F12)
2. Navigieren Sie zum Audit Log
3. Klicken Sie auf "Original wiederherstellen"
4. Prüfen Sie die Konsolen-Ausgaben

### Debug-Tool nutzen:
1. Öffnen Sie: http://localhost:9080/debug-restore.html
2. Geben Sie Ihr Auth-Token ein
3. Laden Sie die Audit Logs
4. Testen Sie die Restore-Funktion direkt

## Nächste Schritte
Falls es weiterhin Probleme gibt:
1. Prüfen Sie die Backend-Logs: `docker logs appliance_backend -f`
2. Stellen Sie sicher, dass der Benutzer die nötigen Rechte hat
3. Überprüfen Sie, ob die Ressource bereits existiert (gleicher Name)
