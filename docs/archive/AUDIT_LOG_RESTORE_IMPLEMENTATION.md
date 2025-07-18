# Audit Log Restore Button Implementation

## Datum: 13. Juli 2025

## Zusammenfassung
Ein "Original wiederherstellen" Button wurde im Audit Log Panel hinzugefügt, der es ermöglicht, gelöschte oder geänderte Services, Benutzer, Kategorien und SSH-Hosts wiederherzustellen.

## Implementierte Funktionen

### 1. Wiederherstellungsfunktionalität
- **Gelöschte Elemente wiederherstellen**: Services, Benutzer, Kategorien und SSH-Hosts können nach dem Löschen wiederhergestellt werden
- **Änderungen rückgängig machen**: Bei Updates können die ursprünglichen Werte wiederhergestellt werden

### 2. Unterstützte Aktionen

#### Löschaktionen (Restore):
- `appliance_delete` / `appliance_deleted` → Service wiederherstellen
- `category_deleted` → Kategorie wiederherstellen  
- `user_delete` / `user_deleted` → Benutzer wiederherstellen
- `ssh_host_deleted` → SSH-Host wiederherstellen

#### Update-Aktionen (Revert):
- `appliance_update` / `appliance_updated` → Service auf Original zurücksetzen
- `category_updated` → Kategorie auf Original zurücksetzen
- `user_update` / `user_updated` → Benutzer auf Original zurücksetzen
- `ssh_host_updated` → SSH-Host auf Original zurücksetzen

### 3. UI-Komponenten
- Grüner "Original wiederherstellen" Button mit Rotate-Icon
- Ladeindikator während der Wiederherstellung
- Erfolgs-/Fehlermeldungen nach der Aktion
- Responsive Darstellung für Desktop und Mobile

### 4. API-Endpunkte

#### Appliances:
- Restore: `/api/audit-restore/restore/appliances/:logId`
- Revert: `/api/audit-restore/revert/appliances/:logId`

#### Categories:
- Restore: `/api/restore/category/:logId`
- Revert: `/api/restore/category/:logId/revert`

#### Users:
- Restore: `/api/restore/user/:logId`
- Revert: `/api/restore/user/:logId/revert`

#### SSH-Hosts:
- Restore: `/api/ssh/hosts/restore/:logId`
- Revert: `/api/ssh/hosts/:resourceId/revert/:logId`

## Geänderte Dateien

### Frontend
- `/frontend/src/components/AuditLog/AuditLogTableMUI.js`
  - Neue Imports: `RotateCcw` Icon, `Alert` Component, `axios`
  - Neue State-Variablen: `restoringLogs`, `restoreResults`
  - Neue Funktionen: `canRestore()`, `handleRestore()`
  - UI-Updates für Restore-Button in Details-Ansicht

## Styling
- Button verwendet Theme-aware Farben für Dark/Light Mode
- Grüne Farbgebung für positive Aktion (Wiederherstellung)
- Konsistent mit dem bestehenden Design-System

## Fehlerbehandlung
- Graceful Error Handling mit User-freundlichen Meldungen
- Fehler werden in der Konsole geloggt
- Loading States verhindern mehrfache Klicks

## Nächste Schritte
- Testing der Implementierung mit verschiedenen Ressourcentypen
- Monitoring der Performance bei vielen Audit Logs
- Ggf. Berechtigungsprüfung für Restore-Aktionen
