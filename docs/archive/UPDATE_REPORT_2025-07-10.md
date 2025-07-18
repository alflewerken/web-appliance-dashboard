# Web Appliance Dashboard - Update Report 2025-07-10

## Version: 1.0.4

### Übersicht der Änderungen

Heute wurden mehrere wichtige Fehler behoben und neue Funktionen hinzugefügt, um die Benutzerfreundlichkeit und das Tracking von Service-Zugriffen zu verbessern.

### Behobene Probleme

#### 1. SSH-Host Bearbeitung - "deleted_at" Fehler
**Problem**: Beim Bearbeiten von SSH-Hosts erschien der Fehler "Unknown column 'deleted_at' in 'SELECT'"

**Lösung**: 
- Entfernte direkte Referenzen auf die nicht-existente `deleted_at` Spalte
- SQL-Abfragen wurden korrigiert, um die Spalte nur zu verwenden, wenn sie existiert
- Betroffene Datei: `/backend/routes/ssh.js`

#### 2. Audit-Log CSV Export - 404 Fehler
**Problem**: Der CSV-Export Button im Audit-Log führte zu einem 404 Fehler

**Lösung**:
- Neue Route `/api/audit-logs/export` wurde hinzugefügt
- `json2csv` Paket wurde installiert und zur package.json hinzugefügt
- Export unterstützt Filter nach Datum, Aktion, Ressourcentyp und Benutzer
- Betroffene Datei: `/backend/routes/auditLogs.js`

#### 3. Service-Zugriff Tracking fehlte
**Problem**: Beim Anklicken von Services wurde weder die "Zuletzt verwendet" Zeit aktualisiert noch ein Audit-Log Eintrag erstellt

**Lösung**:
- Frontend: `openService` Funktion wurde erweitert um API-Call zu `/api/services/${id}/access`
- Backend: Neue Route erstellt für Service-Zugriff-Tracking
- Korrigierte Spaltenname von `last_accessed` zu `lastUsed`
- SSE-Events werden nun korrekt gesendet
- Betroffene Dateien: 
  - `/frontend/src/components/ApplianceCard.js`
  - `/backend/routes/services.js`

#### 4. Audit-Log Live-Updates funktionierten nicht
**Problem**: Das Audit-Log aktualisierte sich nicht automatisch bei neuen Einträgen

**Lösung**:
- `createAuditLog` Funktion sendet nun SSE-Event `audit_log_created`
- Korrigierte fehlerhaften Event-Handler Code in AuditLog Komponente
- `service_accessed` Event wurde zur Event-Liste hinzugefügt
- Betroffene Dateien:
  - `/backend/utils/auth.js`
  - `/frontend/src/components/AuditLog/AuditLog.js`
  - `/frontend/src/services/sseService.js`

### Neue Features

1. **Service-Zugriff Tracking**
   - Automatisches Tracking wenn Services angeklickt/geöffnet werden
   - Aktualisierung der "Zuletzt verwendet" Zeit
   - Audit-Log Einträge für jeden Service-Zugriff
   - Echtzeit-Updates via SSE

2. **Audit-Log CSV Export**
   - Export aller Audit-Logs als CSV-Datei
   - Filteroptionen für gezielten Export
   - Formatierte Ausgabe mit allen relevanten Feldern

### Technische Details

#### Geänderte Dateien:
- `/backend/routes/ssh.js` - SQL-Abfragen korrigiert
- `/backend/routes/auditLogs.js` - Export-Route hinzugefügt
- `/backend/routes/services.js` - Access-Tracking Route hinzugefügt
- `/backend/utils/auth.js` - SSE-Event Broadcasting hinzugefügt
- `/backend/package.json` - json2csv Dependency
- `/frontend/src/components/ApplianceCard.js` - Service-Click Handler
- `/frontend/src/components/AuditLog/AuditLog.js` - Event-Handler korrigiert
- `/frontend/src/services/sseService.js` - Neue Events registriert

#### Neue Dependencies:
- `json2csv` (^6.0.0) - Für CSV-Export Funktionalität

### Test-Empfehlungen

1. **SSH-Host Bearbeitung**: Testen Sie das Bearbeiten bestehender SSH-Hosts
2. **CSV-Export**: Exportieren Sie Audit-Logs mit verschiedenen Filtern
3. **Service-Zugriff**: Klicken Sie auf Services und prüfen Sie:
   - Ob die "Zuletzt verwendet" Kategorie aktualisiert wird
   - Ob neue Einträge im Audit-Log erscheinen
   - Ob das Audit-Log sich live aktualisiert

### Migration

Keine Datenbank-Migration erforderlich. Alle Änderungen sind rückwärtskompatibel.

### Nächste Schritte

- Überwachung der neuen Features in Produktion
- Sammlung von Benutzer-Feedback
- Weitere Optimierung der Live-Update Performance

---

Erstellt am: 2025-07-10
Version: 1.0.4