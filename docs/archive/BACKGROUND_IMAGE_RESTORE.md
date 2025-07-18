# Background Image Restore Implementation

## Problem
Hintergrundbilder wurden beim Restore nicht wiederhergestellt, da sie als Dateien im Filesystem gespeichert sind und nur der Dateiname in der Datenbank steht.

## Lösung

### 1. Neuer Helper erstellt
`backend/utils/backgroundImageHelper.js`:
- `saveBackgroundImageToAuditLog()`: Liest Bilddatei und speichert sie base64-kodiert
- `restoreBackgroundImageFromAuditLog()`: Erstellt Bilddatei aus base64-Daten

### 2. Delete-Funktion erweitert
In `backend/routes/appliances.js`:
- Beim Löschen wird das Hintergrundbild ausgelesen
- Die Bilddaten werden base64-kodiert im Audit Log gespeichert
- Format: `{ filename, data, mimeType }`

### 3. Restore-Funktion erweitert
In `backend/routes/auditRestore.js`:
- Prüft ob `backgroundImageData` im Audit Log vorhanden ist
- Erstellt neue Bilddatei mit Prefix `restored_`
- Aktualisiert den Dateinamen in der Datenbank

### 4. Datenbank-Queries angepasst
- INSERT und UPDATE Statements enthalten jetzt `background_image` Feld
- Stellt sicher, dass der Dateiname korrekt gespeichert wird

## Implementierte Dateien

### Neue Datei:
- `/backend/utils/backgroundImageHelper.js`

### Geänderte Dateien:
- `/backend/routes/appliances.js` - Speichert Bild beim Löschen
- `/backend/routes/auditRestore.js` - Stellt Bild beim Restore wieder her

## Funktionsweise

1. **Beim Löschen**:
   ```javascript
   // Bild-Daten sichern
   backgroundImageData = await saveBackgroundImageToAuditLog(deletedService.backgroundImage);
   
   // In Audit Log speichern
   {
     service: deletedService,
     backgroundImageData: {
       filename: "background_123.jpg",
       data: "base64...",
       mimeType: "image/jpeg"
     }
   }
   ```

2. **Beim Restore**:
   ```javascript
   // Bild wiederherstellen
   const newFilename = await restoreBackgroundImageFromAuditLog(details.backgroundImageData);
   // Neuer Dateiname: "restored_1234567890.jpg"
   ```

## Test-Skript
`scripts/test-bg-restore.sh`:
- Erstellt Service mit Hintergrundbild
- Löscht Service
- Prüft Audit Log
- Stellt Service wieder her
- Verifiziert Hintergrundbild

## Wichtige Hinweise

1. **Speicherplatz**: Base64-kodierte Bilder im Audit Log benötigen ~33% mehr Speicherplatz
2. **Performance**: Große Bilder können die Audit Log Tabelle verlangsamen
3. **Dateinamen**: Wiederhergestellte Bilder erhalten Prefix `restored_` um Konflikte zu vermeiden

## Nächste Schritte

1. **Upload-Integration**: Die tatsächliche Upload-Funktionalität muss noch getestet werden
2. **Cleanup**: Alte Bilddateien sollten regelmäßig bereinigt werden
3. **Kompression**: Bilder könnten vor dem Speichern komprimiert werden

## Verwendung

Nach einem Service-Delete mit Hintergrundbild:
1. Öffnen Sie das Audit Log
2. Finden Sie den "Service gelöscht" Eintrag
3. Klicken Sie auf "Original wiederherstellen"
4. Das Hintergrundbild wird automatisch wiederhergestellt
