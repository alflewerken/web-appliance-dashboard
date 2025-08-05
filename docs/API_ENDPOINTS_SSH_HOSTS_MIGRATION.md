# API Endpoints using deprecated ssh_hosts table

## Overview
Diese Datei listet alle API-Endpunkte auf, die noch die veraltete `ssh_hosts` Tabelle verwenden und angepasst werden müssen.

---

## 1. Commands Routes (`/api/commands`)

### GET `/api/commands/ssh-hosts/available`
- **Datei**: `backend/routes/commands.js` (Zeile 9)
- **Query**: `SELECT ... FROM ssh_hosts WHERE is_active = 1`
- **Anpassung**: Ändern zu `hosts` Tabelle
```sql
-- ALT:
FROM ssh_hosts WHERE is_active = 1

-- NEU:
FROM hosts WHERE is_active = 1
```

### GET `/api/commands/:id` 
- **Datei**: `backend/routes/commands.js` (Zeile 59)
- **Query**: `JOIN ssh_hosts sh ON ac.ssh_host_id = sh.id`
- **Anpassung**: Ändern zu `JOIN hosts h ON ac.host_id = h.id`

### POST `/api/commands/:id`
- **Datei**: `backend/routes/commands.js` (Zeile 88)
- **Query**: `JOIN ssh_hosts sh ON ac.ssh_host_id = sh.id`
- **Anpassung**: Ändern zu `JOIN hosts h ON ac.host_id = h.id`

### PUT `/api/commands/:applianceId/:commandId`
- **Datei**: `backend/routes/commands.js` (Zeile 128)
- **Query**: `JOIN ssh_hosts sh ON ac.ssh_host_id = sh.id`
- **Anpassung**: Ändern zu `JOIN hosts h ON ac.host_id = h.id`

### POST `/api/commands/:applianceId/:commandId/execute`
- **Datei**: `backend/routes/commands.js` (Zeile 190)
- **Query**: `JOIN ssh_hosts sh ON c.ssh_host_id = sh.id`
- **Anpassung**: Ändern zu `JOIN hosts h ON c.host_id = h.id`

---

## 2. Backup Routes (`/api/backup`)

### GET `/api/backup/stats`
- **Datei**: `backend/routes/backup.js` (Zeile 40)
- **Query**: `SELECT COUNT(*) as count FROM ssh_hosts WHERE is_active = 1`
- **Anpassung**: Entfernen oder durch hosts ersetzen

### GET `/api/backup/download`
- **Datei**: `backend/routes/backup.js` (Zeile 247)
- **Query**: `SELECT * FROM ssh_hosts ORDER BY hostname`
- **Anpassung**: Entfernen - ssh_hosts werden nicht mehr gebackupt

### POST `/api/backup/upload` (Restore)
- **Datei**: `backend/routes/backup.js` (Zeile 1641)
- **Funktion**: Restore von ssh_hosts Daten
- **Anpassung**: Komplett entfernen - Migration zu hosts wenn nötig

---

## 3. Audit Restore Routes (`/api/audit-logs`)

### GET `/api/audit-logs/ssh-host/:hostId/history`
- **Datei**: `backend/routes/auditLogs.js` (Zeile 186)
- **Anpassung**: Ändern zu `/api/audit-logs/host/:hostId/history`

### POST `/api/audit-logs/revert/ssh_hosts/:logId`
- **Datei**: `backend/routes/auditRestore.js` (Zeile 1065, 1279)
- **Query**: `UPDATE ssh_hosts SET ... WHERE id = ?`
- **Anpassung**: Entfernen - wird nicht mehr benötigt

### POST `/api/audit-logs/restore/ssh_hosts/:logId`
- **Datei**: `backend/routes/auditRestore.js` (Zeile 1148)
- **Query**: `INSERT INTO ssh_hosts ...`
- **Anpassung**: Entfernen - wird nicht mehr benötigt

---

## 4. RustDesk Install Routes (`/api/rustdesk-install`)

### POST `/api/rustdesk-install/:applianceId`
- **Datei**: `backend/routes/rustdesk-install.js` (Zeile 32)
- **Query**: `LEFT JOIN ssh_hosts s ON (...)`
- **Anpassung**: Entfernen - appliances sollten direkt host_id referenzieren

### DELETE `/api/rustdesk-install/:applianceId`
- **Datei**: `backend/routes/rustdesk-install.js` (Zeile 1194)
- **Query**: `LEFT JOIN ssh_hosts s ON (...)`
- **Anpassung**: Entfernen - appliances sollten direkt host_id referenzieren

---

## 5. Terminal WebSocket Routes

### WebSocket Connection Handler
- **Datei**: `backend/routes/terminal-websocket/ssh-terminal.js`
- **Queries**: 
  - Zeile 32: `SELECT * FROM ssh_hosts WHERE id = ?`
  - Zeile 79: `SELECT key_name FROM ssh_hosts WHERE host = ? AND username = ? AND port = ?`
  - Zeile 180: `SELECT * FROM ssh_hosts WHERE id = ?`
- **Anpassung**: Alle auf `hosts` Tabelle umstellen

---

## 6. Utils die angepasst werden müssen

### sshUploadHandler
- **Datei**: `backend/utils/sshUploadHandler.js`
- **Funktion**: Upload von Dateien via SSH
- **Anpassung**: Host lookup von ssh_hosts zu hosts

### guacamoleHelper
- **Datei**: `backend/utils/guacamoleHelper.js`
- **Funktion**: Guacamole Connection Management
- **Anpassung**: ssh_host_id zu host_id

### ssh.js
- **Datei**: `backend/utils/ssh.js`
- **Funktion**: SSH Command Execution
- **Anpassung**: Host lookup von ssh_hosts zu hosts

### terminal-session.js
- **Datei**: `backend/utils/terminal-session.js`
- **Funktion**: Terminal Session Management
- **Anpassung**: Host lookup von ssh_hosts zu hosts

---

## Migration Strategy

1. **Phase 1**: Update alle SELECT Queries
   - Ersetze `ssh_hosts` mit `hosts`
   - Passe Spaltennamen an (z.B. `host` → `hostname`)

2. **Phase 2**: Update Foreign Keys
   - `ssh_host_id` → `host_id` in allen Tabellen
   - Update JOIN Bedingungen

3. **Phase 3**: Entferne veraltete Endpunkte
   - Audit Restore für ssh_hosts
   - Backup/Restore für ssh_hosts

4. **Phase 4**: Frontend Updates
   - API Calls anpassen
   - Neue Endpunkt-URLs verwenden

---

## Betroffene Frontend-Komponenten (müssen geprüft werden)

1. Commands Management
2. Backup/Restore UI
3. Audit Log Viewer
4. Terminal Connection
5. RustDesk Installation

---

## Testing Checklist

- [ ] Commands können erstellt werden
- [ ] Commands können ausgeführt werden
- [ ] Terminal Verbindungen funktionieren
- [ ] Backup erstellt keine ssh_hosts mehr
- [ ] Restore funktioniert mit alten Backups (Migration)
- [ ] Audit Logs zeigen hosts statt ssh_hosts
- [ ] RustDesk Installation findet Hosts
