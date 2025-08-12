# Backend-Funktionen für Host-Karten

## 1. HOST-VERWALTUNG (`/backend/routes/hosts.js`)

### Basis-Operationen

#### GET `/api/hosts`
- **Funktion**: Alle Hosts abrufen
- **Berechtigung**: Angemeldeter Benutzer
- **Rückgabe**: Liste aller Hosts mit Details
- **Felder**: id, name, description, hostname, port, username, ssh_key_name, icon, color, transparency, blur, remote_desktop_enabled, remote_desktop_type, remote_protocol, remote_port, remote_username, guacamole_performance_mode, rustdesk_id

#### GET `/api/hosts/:id`
- **Funktion**: Einzelnen Host abrufen
- **Berechtigung**: Angemeldeter Benutzer
- **Rückgabe**: Host-Details

#### POST `/api/hosts`
- **Funktion**: Neuen Host erstellen
- **Berechtigung**: Admin erforderlich
- **Parameter**:
  - Pflicht: name, hostname, username
  - Optional: description, port (default: 22), password, privateKey, sshKeyName, icon, color, transparency, blur
  - Remote Desktop: remoteDesktopEnabled, remoteDesktopType, remoteProtocol, remotePort, remoteUsername, remotePassword, guacamole_performance_mode, rustdesk_id, rustdesk_password
- **Features**:
  - Passwort-Verschlüsselung
  - Automatische Guacamole-Connection-Erstellung
  - SSE-Event: `host_created`
  - Audit-Log-Eintrag

#### PUT `/api/hosts/:id`
- **Funktion**: Host aktualisieren
- **Berechtigung**: Admin erforderlich
- **Dynamische Updates**: Nur übergebene Felder werden aktualisiert
- **Features**:
  - Passwort-Verschlüsselung
  - Automatisches Update der Guacamole-Connection
  - SSE-Event: `host_updated`
  - Audit-Log mit Änderungsprotokoll

#### DELETE `/api/hosts/:id`
- **Funktion**: Host löschen
- **Berechtigung**: Admin erforderlich
- **Features**:
  - Vollständige Datensicherung für Restore
  - Guacamole-Connection wird gelöscht
  - SSE-Event: `host_deleted`
  - Audit-Log für mögliche Wiederherstellung

### Remote Desktop Funktionen

#### POST `/api/hosts/:id/remote-desktop-token`
- **Funktion**: Guacamole-Token für Remote Desktop generieren
- **Berechtigung**: Angemeldeter Benutzer
- **Integration**: GuacamoleService
- **Audit-Log**: `remote_desktop_access`

#### POST `/api/hosts/:id/rustdesk-access`
- **Funktion**: RustDesk-Zugriff protokollieren
- **Berechtigung**: Angemeldeter Benutzer
- **Audit-Log**: `rustdesk_access`

#### POST `/api/hosts/:id/update-guacamole-connection`
- **Funktion**: Guacamole-Verbindung manuell aktualisieren
- **Berechtigung**: Admin erforderlich

## 2. SSH-SCHLÜSSEL-VERWALTUNG (`/backend/routes/ssh-keys.js`)

#### GET `/api/ssh/keys`
- **Funktion**: Alle SSH-Schlüssel auflisten
- **Berechtigung**: Angemeldeter Benutzer
- **Rückgabe**: id, key_name, key_type, key_size, comment, fingerprint, created_at

#### GET `/api/ssh/keys/:keyName/public`
- **Funktion**: Öffentlichen Schlüssel abrufen
- **Berechtigung**: Angemeldeter Benutzer
- **Rückgabe**: public_key Inhalt

#### POST `/api/ssh/keys/generate`
- **Funktion**: Neuen SSH-Schlüssel generieren
- **Berechtigung**: Admin erforderlich
- **Parameter**:
  - keyName (default: 'dashboard')
  - keyType (default: 'rsa')
  - keySize (default: 2048)
  - comment (optional)
- **Features**:
  - Schlüssel-Generierung mit ssh-keygen
  - Speicherung in Datenbank und Dateisystem
  - Fingerprint-Berechnung

#### DELETE `/api/ssh/keys/:keyId`
- **Funktion**: SSH-Schlüssel löschen
- **Berechtigung**: Admin erforderlich
- **Schutz**: Prüfung ob Schlüssel von Hosts verwendet wird
- **Cleanup**: Dateien werden vom Dateisystem entfernt

#### POST `/api/ssh/keys/setup`
- **Funktion**: SSH-Schlüssel auf Remote-Host registrieren
- **Berechtigung**: Admin erforderlich
- **Parameter**: hostname, host, username, password, port, keyName
- **Prozess**: 
  - Verwendet sshpass für einmalige Authentifizierung
  - Fügt public key zu authorized_keys hinzu
  - Fehlerbehandlung für verschiedene Verbindungsprobleme

## 3. TERMINAL-FUNKTIONEN (`/backend/routes/terminal.js`)

#### POST `/api/terminal/token`
- **Funktion**: Terminal-Token für Host generieren
- **Parameter**: hostId
- **Rückgabe**: JWT-Token für Terminal-Zugriff

#### WebSocket `/ws/terminal`
- **Funktion**: Terminal-Verbindung über WebSocket
- **Protokoll**: SSH über WebSocket
- **Features**: Resize-Support, Session-Management

## 4. UNTERSTÜTZENDE SERVICES

### GuacamoleService (`/backend/services/guacamoleService.js`)
- **updateHostConnection(hostId)**: Erstellt/Aktualisiert Guacamole-Verbindung
- **deleteHostConnection(hostId)**: Löscht Guacamole-Verbindung
- **generateRemoteDesktopToken(user, hostId)**: Erzeugt Zugriffs-Token

### SSHManager (`/backend/utils/sshManager.js`)
- **regenerateSSHConfig()**: Generiert SSH-Config aus Datenbank
- **verifyKeyPair(keyName)**: Überprüft SSH-Schlüsselpaar
- **syncKeysToFilesystem()**: Synchronisiert Schlüssel DB → Dateisystem
- **testConnection(host)**: Testet SSH-Verbindung

### SSE-Events (`/backend/utils/sseManager.js`)
- **host_created**: Neuer Host erstellt
- **host_updated**: Host aktualisiert
- **host_deleted**: Host gelöscht
- **host_restored**: Host wiederhergestellt (aus Audit-Log)
- **host_reverted**: Host auf vorherige Version zurückgesetzt

## 5. DATENBANK-SCHEMA

### Tabelle: `hosts`
```sql
- id (INT, PRIMARY KEY)
- name (VARCHAR)
- description (TEXT)
- hostname (VARCHAR)
- port (INT)
- username (VARCHAR)
- password (VARCHAR, verschlüsselt)
- private_key (TEXT)
- ssh_key_name (VARCHAR)
- icon (VARCHAR)
- color (VARCHAR)
- transparency (FLOAT)
- blur (INT)
- remote_desktop_enabled (BOOLEAN)
- remote_desktop_type (VARCHAR)
- remote_protocol (VARCHAR)
- remote_port (INT)
- remote_username (VARCHAR)
- remote_password (VARCHAR, verschlüsselt)
- guacamole_performance_mode (VARCHAR)
- rustdesk_id (VARCHAR)
- rustdesk_password (VARCHAR, verschlüsselt)
- created_by (INT)
- updated_by (INT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Tabelle: `ssh_keys`
```sql
- id (INT, PRIMARY KEY)
- key_name (VARCHAR, UNIQUE)
- key_type (VARCHAR)
- key_size (INT)
- comment (TEXT)
- public_key (TEXT)
- private_key (TEXT)
- fingerprint (VARCHAR)
- created_at (TIMESTAMP)
```

## 6. SICHERHEITSFEATURES

### Authentifizierung
- JWT-Token-basierte Authentifizierung
- Admin-Berechtigung für kritische Operationen

### Verschlüsselung
- Passwörter: bcrypt (irreversibel)
- Remote-Passwörter: AES-256 (reversibel für Verbindungsaufbau)
- SSH-Private-Keys: Im Dateisystem mit 0600 Rechten

### Audit-Trail
- Alle Änderungen werden protokolliert
- Wiederherstellung gelöschter Hosts möglich
- IP-Adressen-Tracking
- Detaillierte Änderungsprotokolle

## 7. INTEGRATION MIT FRONTEND

### Host-Panel Aktionen
1. **Host hinzufügen**: POST `/api/hosts`
2. **Host bearbeiten**: PUT `/api/hosts/:id`
3. **Host löschen**: DELETE `/api/hosts/:id`
4. **SSH-Schlüssel verwalten**: Alle `/api/ssh/keys/*` Endpunkte
5. **Terminal öffnen**: POST `/api/terminal/token`
6. **Remote Desktop**: POST `/api/hosts/:id/remote-desktop-token`

### Real-Time Updates
- SSE-Verbindung für Live-Updates
- Automatische UI-Aktualisierung bei Änderungen
- Multi-Client-Synchronisation

Diese Backend-Struktur bietet eine vollständige API für die Verwaltung von Host-Karten mit SSH-Zugriff, Remote Desktop Integration und umfassenden Sicherheitsfeatures.
