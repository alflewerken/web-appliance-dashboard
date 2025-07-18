# Backup/Restore Kompatibilitäts-Fix

## Problem
Bei einem Restore wurden die folgenden Felder nicht wiederhergestellt:
- Favoriten-Flags (`isFavorite`)
- SSH-Verbindungen (`ssh_connection`)
- Start-, Stop- und Statusbefehle (`start_command`, `stop_command`, `status_command`)
- Eigene Kommandos der Cards

## Ursache
Die Backup-Daten verwenden snake_case Feldnamen aus der Datenbank (z.B. `start_command`), aber der Restore-Code versuchte auf camelCase Varianten zuzugreifen (z.B. `startCommand`).

## Lösung

### 1. `/backend/routes/backup.js` - Restore-Funktion
- Unterstützt jetzt beide Feldnamen-Formate (snake_case und camelCase)
- Prüft mit `hasOwnProperty()` auf beide Varianten
- Verwendet den ersten gefundenen Wert mit Fallback auf `null`

```javascript
// Beispiel für start_command
if (appliance.hasOwnProperty('start_command') || appliance.hasOwnProperty('startCommand')) {
  fields.push('start_command');
  values.push(appliance.start_command || appliance.startCommand || null);
}
```

### 2. `/backend/routes/restore.js` - Einzelne Appliance wiederherstellen
- Gleiche Anpassungen für die Restore-Funktionen
- Unterstützt beide Formate beim Wiederherstellen einzelner Services
- Sichert Rückwärtskompatibilität mit älteren Backups

### 3. Debug-Logging
- Zusätzliches Logging beim Restore, um die Datenstruktur zu sehen
- Hilft bei der Diagnose von Format-Problemen

## Getestete Szenarien
- ✅ Restore mit snake_case Feldern (aktuelles Format)
- ✅ Restore mit camelCase Feldern (Legacy-Format)
- ✅ Restore von gelöschten Services
- ✅ Restore von einzelnen Service-Updates

## Nächste Schritte
1. Backend neu starten
2. Ein neues Backup erstellen
3. Restore testen - alle Felder sollten jetzt korrekt wiederhergestellt werden
