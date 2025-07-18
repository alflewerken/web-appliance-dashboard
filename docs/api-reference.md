# Web Appliance Dashboard API Reference

## 📚 Übersicht

Die Web Appliance Dashboard API ist eine RESTful API, die auf Node.js/Express basiert und JWT-Authentifizierung verwendet. Alle Endpoints (außer Auth) erfordern einen gültigen Bearer Token.

**Base URL:** `http://localhost:3001/api`  
**Version:** 1.0.4  
**Authentifizierung:** JWT Bearer Token

## 🔐 Authentifizierung

Die API verwendet JWT (JSON Web Tokens) für die Authentifizierung. Nach erfolgreicher Anmeldung erhalten Sie einen Token, der bei allen weiteren Anfragen im Authorization-Header mitgesendet werden muss.

### Authorization Header
```
Authorization: Bearer <your-jwt-token>
```

## 📋 Inhaltsverzeichnis

- [Auth Endpoints](#auth-endpoints)
- [User Management](#user-management)
- [Appliances](#appliances)
- [Categories](#categories)
- [SSH Management](#ssh-management)
- [SSH Hosts](#ssh-hosts)
- [Terminal](#terminal)
- [Service Control](#service-control)
- [Backup & Restore](#backup--restore)
- [Audit Logs](#audit-logs)
- [Audit Log Restore](#audit-log-restore)
- [System & Settings](#system--settings)
- [Real-time Events (SSE)](#real-time-events-sse)
- [Error Responses](#error-responses)

---

## Auth Endpoints

### Login
Authentifiziert einen Benutzer und gibt einen JWT-Token zurück.

**Endpoint:** `POST /api/auth/login`  
**Auth Required:** No

#### Request Body
```json
{
  "username": "admin",
  "password": "admin123"
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "email": "admin@example.com"
  }
}
```

#### Error Response (401 Unauthorized)
```json
{
  "success": false,
  "message": "Ungültige Anmeldedaten"
}
```

### Logout
Invalidiert den aktuellen Token (serverseitig).

**Endpoint:** `POST /api/auth/logout`  
**Auth Required:** Yes

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Erfolgreich abgemeldet"
}
```

### Refresh Token
Erneuert einen ablaufenden Token.

**Endpoint:** `POST /api/auth/refresh`  
**Auth Required:** Yes

#### Success Response (200 OK)
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## User Management

### Get Current User
Gibt Informationen über den aktuell angemeldeten Benutzer zurück.

**Endpoint:** `GET /api/users/me`  
**Auth Required:** Yes

#### Success Response (200 OK)
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "created_at": "2025-01-01T00:00:00.000Z",
    "last_login": "2025-07-07T10:30:00.000Z"
  }
}
```

### List All Users
Listet alle Benutzer auf (nur Admin).

**Endpoint:** `GET /api/users`  
**Auth Required:** Yes (Admin only)

#### Query Parameters
- `page` (optional): Seitennummer (default: 1)
- `limit` (optional): Einträge pro Seite (default: 20)
- `search` (optional): Suchbegriff für Username/Email

#### Success Response (200 OK)
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "role": "admin",
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 10,
    "page": 1,
    "pages": 1,
    "limit": 20
  }
}
```

### Create User
Erstellt einen neuen Benutzer (nur Admin).

**Endpoint:** `POST /api/users`  
**Auth Required:** Yes (Admin only)

#### Request Body
```json
{
  "username": "newuser",
  "password": "securePassword123!",
  "email": "newuser@example.com",
  "role": "user"
}
```

#### Success Response (201 Created)
```json
{
  "success": true,
  "message": "Benutzer erfolgreich erstellt",
  "user": {
    "id": 2,
    "username": "newuser",
    "email": "newuser@example.com",
    "role": "user"
  }
}
```

### Update User
Aktualisiert Benutzerdaten.

**Endpoint:** `PUT /api/users/:id`  
**Auth Required:** Yes (Admin oder eigener Account)

#### Request Body
```json
{
  "email": "updated@example.com",
  "password": "newPassword123!",
  "role": "admin"
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Benutzer erfolgreich aktualisiert",
  "user": {
    "id": 2,
    "username": "newuser",
    "email": "updated@example.com",
    "role": "admin"
  }
}
```

### Delete User
Löscht einen Benutzer (nur Admin).

**Endpoint:** `DELETE /api/users/:id`  
**Auth Required:** Yes (Admin only)

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Benutzer erfolgreich gelöscht"
}
```

---

## Appliances

### List Appliances
Listet alle Appliances mit optionaler Filterung.

**Endpoint:** `GET /api/appliances`  
**Auth Required:** Yes

#### Query Parameters
- `category` (optional): Filtert nach Kategorie
- `status` (optional): Filtert nach Status (online/offline)
- `search` (optional): Sucht in Name/URL
- `sort` (optional): Sortierung (name, created, updated)
- `order` (optional): asc/desc (default: asc)
- `favorite` (optional): true/false - Nur Favoriten anzeigen

#### Success Response (200 OK)
```json
{
  "success": true,
  "appliances": [
    {
      "id": 1,
      "name": "Production Server",
      "url": "https://prod.example.com",
      "icon": "Server",
      "category": "infrastructure",
      "status": "online",
      "description": "Main production server",
      "tags": ["production", "critical"],
      "isFavorite": true,
      "ssh_connection": {
        "host": "192.168.1.100",
        "port": 22,
        "username": "root",
        "ssh_key_id": 1
      },
      "start_command": "systemctl start myapp",
      "stop_command": "systemctl stop myapp",
      "status_command": "systemctl status myapp",
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-07-07T00:00:00.000Z"
    }
  ]
}
```

### Get Single Appliance
Gibt Details einer spezifischen Appliance zurück.

**Endpoint:** `GET /api/appliances/:id`  
**Auth Required:** Yes

#### Success Response (200 OK)
```json
{
  "success": true,
  "appliance": {
    "id": 1,
    "name": "Production Server",
    "url": "https://prod.example.com",
    "icon": "Server",
    "category": "infrastructure",
    "status": "online",
    "description": "Main production server",
    "tags": ["production", "critical"],
    "isFavorite": true,
    "ssh_connection": {
      "host": "192.168.1.100",
      "port": 22,
      "username": "root",
      "ssh_key_id": 1,
      "use_password": false
    },
    "start_command": "systemctl start myapp",
    "stop_command": "systemctl stop myapp",
    "status_command": "systemctl status myapp",
    "monitoring": {
      "enabled": true,
      "interval": 300,
      "last_check": "2025-07-07T10:00:00.000Z"
    },
    "created_at": "2025-01-01T00:00:00.000Z",
    "updated_at": "2025-07-07T00:00:00.000Z"
  }
}
```

### Create Appliance
Erstellt eine neue Appliance.

**Endpoint:** `POST /api/appliances`  
**Auth Required:** Yes

#### Request Body
```json
{
  "name": "Development Server",
  "url": "https://dev.example.com",
  "icon": "Server",
  "category": "development",
  "description": "Development environment",
  "tags": ["development", "testing"],
  "isFavorite": false,
  "ssh_connection": {
    "host": "192.168.1.101",
    "port": 22,
    "username": "developer",
    "ssh_key_id": 2
  },
  "start_command": "docker-compose up -d",
  "stop_command": "docker-compose down",
  "status_command": "docker-compose ps"
}
```

#### Success Response (201 Created)
```json
{
  "success": true,
  "message": "Appliance erfolgreich erstellt",
  "appliance": {
    "id": 2,
    "name": "Development Server",
    "url": "https://dev.example.com",
    "status": "pending"
  }
}
```

### Update Appliance
Aktualisiert eine bestehende Appliance.

**Endpoint:** `PUT /api/appliances/:id`  
**Auth Required:** Yes

#### Request Body
```json
{
  "name": "Updated Server Name",
  "category": "production",
  "tags": ["production", "critical", "updated"],
  "isFavorite": true,
  "start_command": "systemctl start myapp-v2"
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Appliance erfolgreich aktualisiert",
  "appliance": {
    "id": 1,
    "name": "Updated Server Name",
    "category": "production"
  }
}
```

### Delete Appliance
Löscht eine Appliance.

**Endpoint:** `DELETE /api/appliances/:id`  
**Auth Required:** Yes

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Appliance erfolgreich gelöscht"
}
```

### Check Appliance Status
Prüft den Status einer Appliance.

**Endpoint:** `POST /api/appliances/:id/status`  
**Auth Required:** Yes

#### Success Response (200 OK)
```json
{
  "success": true,
  "status": {
    "online": true,
    "response_time": 145,
    "http_status": 200,
    "ssl_valid": true,
    "ssl_expiry": "2025-12-31T23:59:59.000Z",
    "checked_at": "2025-07-07T10:30:00.000Z"
  }
}
```

### Toggle Favorite
Markiert/Entmarkiert eine Appliance als Favorit.

**Endpoint:** `POST /api/appliances/:id/favorite`  
**Auth Required:** Yes

#### Request Body
```json
{
  "isFavorite": true
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Favorit-Status aktualisiert",
  "isFavorite": true
}
```

---

## Categories

### List Categories
Listet alle Kategorien auf.

**Endpoint:** `GET /api/categories`  
**Auth Required:** Yes

#### Success Response (200 OK)
```json
{
  "success": true,
  "categories": [
    {
      "id": 1,
      "name": "infrastructure",
      "icon": "Server",
      "color": "#FF6B6B",
      "order": 1,
      "created_at": "2025-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "name": "development",
      "icon": "Code",
      "color": "#4ECDC4",
      "order": 2,
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

### Create Category
Erstellt eine neue Kategorie.

**Endpoint:** `POST /api/categories`  
**Auth Required:** Yes (Admin only)

#### Request Body
```json
{
  "name": "monitoring",
  "icon": "Activity",
  "color": "#95E1D3",
  "order": 3
}
```

#### Success Response (201 Created)
```json
{
  "success": true,
  "message": "Kategorie erfolgreich erstellt",
  "category": {
    "id": 3,
    "name": "monitoring",
    "icon": "Activity",
    "color": "#95E1D3",
    "order": 3
  }
}
```

### Update Category
Aktualisiert eine Kategorie.

**Endpoint:** `PUT /api/categories/:id`  
**Auth Required:** Yes (Admin only)

#### Request Body
```json
{
  "name": "monitoring-updated",
  "icon": "BarChart",
  "color": "#A8E6CF",
  "order": 4
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Kategorie erfolgreich aktualisiert"
}
```

### Delete Category
Löscht eine Kategorie.

**Endpoint:** `DELETE /api/categories/:id`  
**Auth Required:** Yes (Admin only)

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Kategorie erfolgreich gelöscht"
}
```

### Reorder Categories
Ändert die Reihenfolge der Kategorien.

**Endpoint:** `POST /api/categories/reorder`  
**Auth Required:** Yes (Admin only)

#### Request Body
```json
{
  "categories": [
    { "id": 2, "order": 1 },
    { "id": 1, "order": 2 },
    { "id": 3, "order": 3 }
  ]
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Kategorien erfolgreich neu sortiert"
}
```

---

## SSH Management

### List SSH Keys
Listet alle SSH-Schlüssel auf.

**Endpoint:** `GET /api/ssh/keys`  
**Auth Required:** Yes

#### Success Response (200 OK)
```json
{
  "success": true,
  "keys": [
    {
      "id": 1,
      "name": "production-key",
      "type": "rsa",
      "bits": 4096,
      "fingerprint": "SHA256:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "created_at": "2025-01-01T00:00:00.000Z",
      "last_used": "2025-07-07T10:00:00.000Z"
    }
  ]
}
```

### Generate SSH Key
Generiert ein neues SSH-Schlüsselpaar.

**Endpoint:** `POST /api/ssh/keys/generate`  
**Auth Required:** Yes

#### Request Body
```json
{
  "name": "new-production-key",
  "type": "rsa",
  "bits": 4096,
  "passphrase": "optional-passphrase"
}
```

#### Success Response (201 Created)
```json
{
  "success": true,
  "message": "SSH-Schlüssel erfolgreich generiert",
  "key": {
    "id": 2,
    "name": "new-production-key",
    "type": "rsa",
    "bits": 4096,
    "fingerprint": "SHA256:yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
    "public_key": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQC..."
  }
}
```

### Upload SSH Key
Lädt einen bestehenden SSH-Schlüssel hoch.

**Endpoint:** `POST /api/ssh/keys/upload`  
**Auth Required:** Yes  
**Content-Type:** multipart/form-data

#### Form Data
- `name`: Schlüsselname
- `private_key`: Private Key Datei
- `public_key`: Public Key Datei (optional)
- `passphrase`: Passphrase (optional)

#### Success Response (201 Created)
```json
{
  "success": true,
  "message": "SSH-Schlüssel erfolgreich hochgeladen",
  "key": {
    "id": 3,
    "name": "uploaded-key",
    "fingerprint": "SHA256:zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"
  }
}
```

### Delete SSH Key
Löscht einen SSH-Schlüssel.

**Endpoint:** `DELETE /api/ssh/keys/:id`  
**Auth Required:** Yes

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "SSH-Schlüssel erfolgreich gelöscht"
}
```

### Test SSH Connection
Testet eine SSH-Verbindung.

**Endpoint:** `POST /api/ssh/test`  
**Auth Required:** Yes

#### Request Body
```json
{
  "host": "192.168.1.100",
  "port": 22,
  "username": "root",
  "key_id": 1
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "SSH-Verbindung erfolgreich",
  "details": {
    "connected": true,
    "server_version": "OpenSSH_8.2p1",
    "auth_methods": ["publickey"],
    "response_time": 52
  }
}
```

### Execute SSH Command
Führt einen Befehl über SSH aus.

**Endpoint:** `POST /api/ssh/execute`  
**Auth Required:** Yes

#### Request Body
```json
{
  "appliance_id": 1,
  "command": "df -h",
  "timeout": 30000
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "output": {
    "stdout": "Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1        20G  5.5G   14G  30% /",
    "stderr": "",
    "exit_code": 0,
    "duration": 125
  }
}
```

---

## SSH Hosts

### List SSH Hosts
Listet alle SSH-Hosts auf.

**Endpoint:** `GET /api/ssh/hosts`  
**Auth Required:** Yes

#### Query Parameters
- `includeDeleted` (optional): Zeigt auch gelöschte Hosts an (true/false)

#### Success Response (200 OK)
```json
{
  "success": true,
  "hosts": [
    {
      "id": 1,
      "hostname": "prod-server",
      "host": "192.168.1.100",
      "username": "root",
      "port": 22,
      "key_name": "production-key",
      "is_active": true,
      "last_tested": "2025-01-09T10:00:00.000Z",
      "test_status": "success",
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-09T10:00:00.000Z"
    }
  ]
}
```

### Create SSH Host
Erstellt einen neuen SSH-Host.

**Endpoint:** `POST /api/ssh/hosts`  
**Auth Required:** Yes

#### Request Body
```json
{
  "hostname": "dev-server",
  "host": "192.168.1.101",
  "username": "developer",
  "port": 22,
  "key_name": "development-key"
}
```

#### Success Response (201 Created)
```json
{
  "success": true,
  "message": "SSH-Host erfolgreich erstellt",
  "host": {
    "id": 2,
    "hostname": "dev-server",
    "host": "192.168.1.101",
    "username": "developer",
    "port": 22,
    "key_name": "development-key"
  }
}
```

### Update SSH Host
Aktualisiert einen SSH-Host.

**Endpoint:** `PUT /api/ssh/hosts/:id`  
**Auth Required:** Yes

#### Request Body
```json
{
  "hostname": "dev-server-updated",
  "port": 2222,
  "key_name": "new-development-key"
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "SSH-Host erfolgreich aktualisiert"
}
```

### Delete SSH Host
Löscht einen SSH-Host (Soft-Delete).

**Endpoint:** `DELETE /api/ssh/hosts/:id`  
**Auth Required:** Yes

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "SSH-Host erfolgreich gelöscht"
}
```

### Test SSH Host Connection
Testet die Verbindung zu einem SSH-Host.

**Endpoint:** `POST /api/ssh/hosts/:id/test`  
**Auth Required:** Yes

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "SSH-Verbindung erfolgreich",
  "details": {
    "connected": true,
    "response_time": 52,
    "server_version": "OpenSSH_8.2p1"
  }
}
```

### Get SSH Host History
Ruft die Änderungshistorie eines SSH-Hosts ab.

**Endpoint:** `GET /api/ssh/hosts/:id/history`  
**Auth Required:** Yes

#### Success Response (200 OK)
```json
{
  "success": true,
  "history": [
    {
      "id": 1,
      "host_id": 1,
      "hostname": "prod-server",
      "host": "192.168.1.100",
      "username": "root",
      "port": 22,
      "key_name": "production-key",
      "changed_at": "2025-01-09T10:00:00.000Z",
      "changed_by": 1,
      "changed_by_username": "admin",
      "change_type": "update",
      "change_details": {
        "old": { "port": 22 },
        "new": { "port": 2222 }
      }
    }
  ]
}
```

---

## Terminal

### Create Terminal Session
Erstellt eine neue Terminal-Sitzung.

**Endpoint:** `POST /api/terminal/sessions`  
**Auth Required:** Yes

#### Request Body
```json
{
  "appliance_id": 1,
  "cols": 80,
  "rows": 24
}
```

#### Success Response (201 Created)
```json
{
  "success": true,
  "session": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "websocket_url": "ws://localhost:3001/terminal/550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2025-07-07T10:30:00.000Z"
  }
}
```

### List Terminal Sessions
Listet alle aktiven Terminal-Sitzungen auf.

**Endpoint:** `GET /api/terminal/sessions`  
**Auth Required:** Yes

#### Success Response (200 OK)
```json
{
  "success": true,
  "sessions": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "appliance_id": 1,
      "appliance_name": "Production Server",
      "created_at": "2025-07-07T10:30:00.000Z",
      "last_activity": "2025-07-07T10:35:00.000Z"
    }
  ]
}
```

### Close Terminal Session
Beendet eine Terminal-Sitzung.

**Endpoint:** `DELETE /api/terminal/sessions/:id`  
**Auth Required:** Yes

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Terminal-Sitzung beendet"
}
```

---

## Service Control

### Get Service Status
Ruft den Status eines Services ab.

**Endpoint:** `GET /api/services/:appliance_id/status`  
**Auth Required:** Yes

#### Query Parameters
- `service` (optional): Spezifischer Service-Name

#### Success Response (200 OK)
```json
{
  "success": true,
  "services": [
    {
      "name": "nginx",
      "status": "active",
      "running": true,
      "enabled": true,
      "uptime": "2d 5h 30m",
      "memory": "125MB",
      "cpu": "0.5%"
    },
    {
      "name": "mysql",
      "status": "active",
      "running": true,
      "enabled": true,
      "uptime": "2d 5h 30m",
      "memory": "512MB",
      "cpu": "2.1%"
    }
  ]
}
```

### Start Service
Startet einen Service.

**Endpoint:** `POST /api/services/:appliance_id/start`  
**Auth Required:** Yes

#### Request Body
```json
{
  "service": "nginx"
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Service erfolgreich gestartet",
  "service": {
    "name": "nginx",
    "status": "active",
    "running": true
  }
}
```

### Stop Service
Stoppt einen Service.

**Endpoint:** `POST /api/services/:appliance_id/stop`  
**Auth Required:** Yes

#### Request Body
```json
{
  "service": "nginx"
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Service erfolgreich gestoppt",
  "service": {
    "name": "nginx",
    "status": "inactive",
    "running": false
  }
}
```

### Restart Service
Startet einen Service neu.

**Endpoint:** `POST /api/services/:appliance_id/restart`  
**Auth Required:** Yes

#### Request Body
```json
{
  "service": "nginx"
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Service erfolgreich neu gestartet",
  "service": {
    "name": "nginx",
    "status": "active",
    "running": true
  }
}
```

### Execute Custom Command
Führt einen benutzerdefinierten Befehl aus (start/stop/status).

**Endpoint:** `POST /api/services/:appliance_id/execute`  
**Auth Required:** Yes

#### Request Body
```json
{
  "command_type": "start",
  "custom_command": "docker-compose up -d myservice"
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "output": {
    "stdout": "Starting myservice... done",
    "stderr": "",
    "exit_code": 0
  }
}
```

---

## Backup & Restore

### Create Backup
Erstellt ein System-Backup.

**Endpoint:** `POST /api/backup/create`  
**Auth Required:** Yes (Admin only)

#### Request Body
```json
{
  "include_ssh_keys": true,
  "include_logs": false,
  "include_uploads": true,
  "description": "Weekly backup"
}
```

#### Success Response (202 Accepted)
```json
{
  "success": true,
  "message": "Backup wird erstellt",
  "backup_id": "backup-2025-07-07-103000",
  "status_url": "/api/backup/status/backup-2025-07-07-103000"
}
```

### List Backups
Listet alle verfügbaren Backups auf.

**Endpoint:** `GET /api/backup/list`  
**Auth Required:** Yes (Admin only)

#### Success Response (200 OK)
```json
{
  "success": true,
  "backups": [
    {
      "id": "backup-2025-07-07-103000",
      "created_at": "2025-07-07T10:30:00.000Z",
      "size": "125MB",
      "description": "Weekly backup",
      "includes": {
        "database": true,
        "ssh_keys": true,
        "logs": false,
        "uploads": true
      }
    }
  ]
}
```

### Download Backup
Lädt ein Backup herunter.

**Endpoint:** `GET /api/backup/download/:id`  
**Auth Required:** Yes (Admin only)

#### Success Response (200 OK)
- Content-Type: application/zip
- Content-Disposition: attachment; filename="backup-2025-07-07-103000.zip"

### Restore Backup
Stellt ein System aus einem Backup wieder her.

**Endpoint:** `POST /api/backup/restore`  
**Auth Required:** Yes (Admin only)  
**Content-Type:** multipart/form-data

#### Form Data
- `backup`: Backup ZIP-Datei
- `restore_database`: true/false
- `restore_ssh_keys`: true/false
- `restore_settings`: true/false

#### Success Response (202 Accepted)
```json
{
  "success": true,
  "message": "Wiederherstellung gestartet",
  "job_id": "restore-2025-07-07-104500",
  "status_url": "/api/backup/restore/status/restore-2025-07-07-104500"
}
```

### Restore Single Appliance
Stellt eine einzelne Appliance aus einem Backup wieder her.

**Endpoint:** `POST /api/restore/appliance/:id`  
**Auth Required:** Yes (Admin only)

#### Request Body
```json
{
  "backup_data": {
    "name": "Restored Server",
    "url": "https://restored.example.com",
    "icon": "Server",
    "category": "production",
    "ssh_connection": {
      "host": "192.168.1.100",
      "port": 22,
      "username": "root",
      "ssh_key_id": 1
    },
    "start_command": "systemctl start app",
    "stop_command": "systemctl stop app",
    "status_command": "systemctl status app",
    "isFavorite": true
  }
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Appliance erfolgreich wiederhergestellt",
  "appliance": {
    "id": 1,
    "name": "Restored Server"
  }
}
```

---

## System & Settings

### Get System Info
Ruft Systeminformationen ab.

**Endpoint:** `GET /api/system/info`  
**Auth Required:** Yes

#### Success Response (200 OK)
```json
{
  "success": true,
  "system": {
    "version": "1.0.1",
    "uptime": "2d 5h 30m",
    "hostname": "dashboard-server",
    "platform": "linux",
    "node_version": "18.17.0",
    "memory": {
      "total": "8GB",
      "used": "2.5GB",
      "free": "5.5GB"
    },
    "disk": {
      "total": "50GB",
      "used": "15GB",
      "free": "35GB"
    }
  }
}
```

### Get Settings
Ruft Systemeinstellungen ab.

**Endpoint:** `GET /api/settings`  
**Auth Required:** Yes

#### Success Response (200 OK)
```json
{
  "success": true,
  "settings": {
    "general": {
      "site_name": "Web Appliance Dashboard",
      "timezone": "Europe/Berlin",
      "language": "de"
    },
    "security": {
      "session_timeout": 3600,
      "max_login_attempts": 5,
      "password_min_length": 8,
      "require_2fa": false
    },
    "monitoring": {
      "check_interval": 300,
      "retention_days": 30
    },
    "ui": {
      "theme": "dark",
      "background_image": "/uploads/backgrounds/custom-bg.jpg",
      "show_favorites_first": true
    }
  }
}
```

### Update Settings
Aktualisiert Systemeinstellungen.

**Endpoint:** `PUT /api/settings`  
**Auth Required:** Yes (Admin only)

#### Request Body
```json
{
  "general": {
    "site_name": "My Dashboard",
    "timezone": "Europe/Berlin"
  },
  "security": {
    "session_timeout": 7200,
    "require_2fa": true
  },
  "ui": {
    "theme": "light",
    "show_favorites_first": false
  }
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Einstellungen erfolgreich aktualisiert",
  "settings": {
    "general": {
      "site_name": "My Dashboard",
      "timezone": "Europe/Berlin"
    }
  }
}
```

### Upload Background Image
Lädt ein Hintergrundbild hoch.

**Endpoint:** `POST /api/settings/background`  
**Auth Required:** Yes (Admin only)  
**Content-Type:** multipart/form-data

#### Form Data
- `background`: Bilddatei (JPEG, PNG, WebP)

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Hintergrundbild erfolgreich hochgeladen",
  "path": "/uploads/backgrounds/bg-2025-07-07-103000.jpg"
}
```

### Get Audit Logs
Ruft Audit-Logs ab.

**Endpoint:** `GET /api/audit`  
**Auth Required:** Yes (Admin only)

#### Query Parameters
- `page` (optional): Seitennummer (default: 1)
- `limit` (optional): Einträge pro Seite (default: 50)
- `user_id` (optional): Nach Benutzer filtern
- `action` (optional): Nach Aktion filtern
- `from` (optional): Startdatum (ISO 8601)
- `to` (optional): Enddatum (ISO 8601)

#### Success Response (200 OK)
```json
{
  "success": true,
  "logs": [
    {
      "id": 1234,
      "user_id": 1,
      "username": "admin",
      "action": "appliance.create",
      "resource_type": "appliance",
      "resource_id": 5,
      "details": {
        "name": "New Server",
        "category": "production"
      },
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2025-07-07T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 500,
    "page": 1,
    "pages": 10,
    "limit": 50
  }
}
```

---

## Audit Logs

### Get Audit Logs
Ruft Audit-Logs ab.

**Endpoint:** `GET /api/audit-logs`  
**Auth Required:** Yes (Admin only)

#### Query Parameters
- `page` (optional): Seitennummer (default: 1)
- `limit` (optional): Einträge pro Seite (default: 50)
- `user_id` (optional): Nach Benutzer filtern
- `action` (optional): Nach Aktion filtern
- `resource_type` (optional): Nach Ressourcentyp filtern
- `from` (optional): Startdatum (ISO 8601)
- `to` (optional): Enddatum (ISO 8601)

#### Success Response (200 OK)
```json
{
  "success": true,
  "logs": [
    {
      "id": 1234,
      "user_id": 1,
      "username": "admin",
      "action": "appliance_created",
      "resource_type": "appliances",
      "resource_id": 5,
      "details": {
        "name": "New Server",
        "category": "production"
      },
      "ip_address": "192.168.1.100",
      "created_at": "2025-01-09T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 500,
    "page": 1,
    "pages": 10,
    "limit": 50
  }
}
```

### Delete Audit Logs
Löscht alte Audit-Logs.

**Endpoint:** `DELETE /api/audit-logs`  
**Auth Required:** Yes (Admin only)

#### Request Body
```json
{
  "before": "2025-01-01T00:00:00.000Z",
  "confirm": true
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Audit-Logs erfolgreich gelöscht",
  "deleted_count": 250
}
```

---

## Audit Log Restore

### Get Restorable Audit Log
Ruft Details eines Audit-Log-Eintrags mit Wiederherstellungsoptionen ab.

**Endpoint:** `GET /api/audit-restore/:id`  
**Auth Required:** Yes (Admin only)

#### Success Response (200 OK)
```json
{
  "id": 1234,
  "action": "ssh_host_updated",
  "resource_type": "ssh_host",
  "resource_id": 1,
  "details": {
    "old_data": {
      "hostname": "prod-server",
      "port": 22
    },
    "new_data": {
      "hostname": "production-server",
      "port": 2222
    }
  },
  "canRestore": true,
  "restoreInfo": {
    "type": "ssh_host",
    "original_data": { ... },
    "canRevertToOriginal": true
  }
}
```

### Restore Deleted Resource
Stellt eine gelöschte Ressource wieder her.

**Endpoint:** `POST /api/audit-restore/restore/:resource_type/:logId`  
**Auth Required:** Yes (Admin only)

#### Supported Resource Types
- `appliances`
- `users`
- `categories`
- `ssh_hosts`

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "SSH host successfully restored",
  "resource_id": 1
}
```

### Revert Resource to Previous State
Setzt eine Ressource auf einen vorherigen Zustand zurück.

**Endpoint:** `POST /api/audit-restore/revert/:resource_type/:logId`  
**Auth Required:** Yes (Admin only)

#### Supported Resource Types
- `appliances`
- `users`
- `categories`
- `ssh_hosts`

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "SSH host successfully reverted to previous state"
}
```

---

## Real-time Events (SSE)

Für Echtzeit-Updates verwendet die API Server-Sent Events (SSE).

### SSE Endpoint
**URL:** `GET /api/events`  
**Auth Required:** Yes

### Event Types

#### Appliance Status Update
```javascript
event: appliance.status
data: {
  "id": 1,
  "status": "online",
  "timestamp": "2025-07-07T10:30:00.000Z"
}
```

#### Appliance Created
```javascript
event: appliance.created
data: {
  "id": 5,
  "name": "New Server",
  "category": "production",
  "timestamp": "2025-07-07T10:30:00.000Z"
}
```

#### Appliance Updated
```javascript
event: appliance.updated
data: {
  "id": 1,
  "changes": {
    "name": "Updated Name",
    "isFavorite": true
  },
  "timestamp": "2025-07-07T10:30:00.000Z"
}
```

#### Appliance Deleted
```javascript
event: appliance.deleted
data: {
  "id": 3,
  "timestamp": "2025-07-07T10:30:00.000Z"
}
```

#### Service Status Update
```javascript
event: service.status
data: {
  "appliance_id": 1,
  "service": "nginx",
  "status": "stopped",
  "timestamp": "2025-07-07T10:30:00.000Z"
}
```

#### Category Update
```javascript
event: category.updated
data: {
  "categories": [
    { "id": 1, "name": "infrastructure", "order": 1 },
    { "id": 2, "name": "development", "order": 2 }
  ],
  "timestamp": "2025-07-07T10:30:00.000Z"
}
```

#### System Alert
```javascript
event: system.alert
data: {
  "level": "warning",
  "message": "Hohe CPU-Auslastung erkannt",
  "appliance_id": 1,
  "timestamp": "2025-07-07T10:30:00.000Z"
}
```

#### SSH Host Created
```javascript
event: ssh_host_created
data: {
  "id": 1,
  "hostname": "prod-server",
  "host": "192.168.1.100",
  "timestamp": "2025-01-09T10:30:00.000Z"
}
```

#### SSH Host Updated
```javascript
event: ssh_host_updated
data: {
  "id": 1,
  "hostname": "production-server",
  "changes": {
    "old": { "port": 22 },
    "new": { "port": 2222 }
  },
  "timestamp": "2025-01-09T10:30:00.000Z"
}
```

#### SSH Host Deleted
```javascript
event: ssh_host_deleted
data: {
  "id": 1,
  "hostname": "prod-server",
  "timestamp": "2025-01-09T10:30:00.000Z"
}
```

#### SSH Host Reverted
```javascript
event: ssh_host_reverted
data: {
  "id": 1,
  "hostname": "prod-server",
  "reverted_by": "admin",
  "timestamp": "2025-01-09T10:30:00.000Z"
}
```

#### Audit Log Created
```javascript
event: audit_log_created
data: {
  "action": "ssh_host_updated",
  "resource_type": "ssh_host",
  "resource_id": 1,
  "timestamp": "2025-01-09T10:30:00.000Z"
}
```

### JavaScript SSE Client Example
```javascript
const eventSource = new EventSource('/api/events', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

eventSource.addEventListener('appliance.status', (event) => {
  const data = JSON.parse(event.data);
  console.log(`Appliance ${data.id} is now ${data.status}`);
});

eventSource.addEventListener('error', (event) => {
  console.error('SSE Error:', event);
});
```

---

## Error Responses

Die API verwendet konsistente Fehlerantworten für alle Endpoints.

### Standard Error Format
```json
{
  "success": false,
  "message": "Fehlerbeschreibung",
  "error": {
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

### Common HTTP Status Codes

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Ungültige Anfrage",
  "error": {
    "code": "INVALID_REQUEST",
    "details": {
      "field": "email",
      "reason": "Ungültiges E-Mail-Format"
    }
  }
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Nicht autorisiert",
  "error": {
    "code": "UNAUTHORIZED",
    "details": {
      "reason": "Token abgelaufen"
    }
  }
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "message": "Zugriff verweigert",
  "error": {
    "code": "FORBIDDEN",
    "details": {
      "required_role": "admin",
      "current_role": "user"
    }
  }
}
```

#### 404 Not Found
```json
{
  "success": false,
  "message": "Ressource nicht gefunden",
  "error": {
    "code": "NOT_FOUND",
    "details": {
      "resource": "appliance",
      "id": 999
    }
  }
}
```

#### 409 Conflict
```json
{
  "success": false,
  "message": "Konflikt",
  "error": {
    "code": "CONFLICT",
    "details": {
      "reason": "Benutzername bereits vergeben"
    }
  }
}
```

#### 422 Unprocessable Entity
```json
{
  "success": false,
  "message": "Validierungsfehler",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {
      "errors": [
        {
          "field": "password",
          "message": "Passwort muss mindestens 8 Zeichen lang sein"
        },
        {
          "field": "email",
          "message": "E-Mail ist erforderlich"
        }
      ]
    }
  }
}
```

#### 429 Too Many Requests
```json
{
  "success": false,
  "message": "Zu viele Anfragen",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "details": {
      "limit": 100,
      "window": "1h",
      "retry_after": 3600
    }
  }
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Interner Serverfehler",
  "error": {
    "code": "INTERNAL_ERROR",
    "details": {
      "reference": "ERR-2025-07-07-001"
    }
  }
}
```

---

## Rate Limiting

Die API implementiert Rate Limiting zum Schutz vor Überlastung:

- **Standard Endpoints:** 100 Anfragen pro Stunde
- **Auth Endpoints:** 5 Anfragen pro Minute
- **File Upload:** 10 Anfragen pro Stunde
- **SSH Execute:** 30 Anfragen pro Stunde

Rate Limit Informationen werden in den Response Headers zurückgegeben:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1720351200
```

---

## API Client Beispiele

### JavaScript/Node.js

```javascript
// Installation: npm install axios
const axios = require('axios');

class ApplianceDashboardAPI {
  constructor(baseURL = 'http://localhost:3001/api') {
    this.baseURL = baseURL;
    this.token = null;
  }

  async login(username, password) {
    const response = await axios.post(`${this.baseURL}/auth/login`, {
      username,
      password
    });
    this.token = response.data.token;
    return response.data;
  }

  async getAppliances() {
    const response = await axios.get(`${this.baseURL}/appliances`, {
      headers: { Authorization: `Bearer ${this.token}` }
    });
    return response.data;
  }

  async createAppliance(appliance) {
    const response = await axios.post(
      `${this.baseURL}/appliances`,
      appliance,
      { headers: { Authorization: `Bearer ${this.token}` } }
    );
    return response.data;
  }

  // SSE für Echtzeit-Updates
  subscribeToEvents(onMessage) {
    const eventSource = new EventSource(`${this.baseURL}/events`, {
      headers: { Authorization: `Bearer ${this.token}` }
    });

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(event.type, data);
    };

    return eventSource;
  }
}

// Verwendung
const api = new ApplianceDashboardAPI();
await api.login('admin', 'admin123');
const appliances = await api.getAppliances();
console.log(appliances);

// SSE Events
const eventSource = api.subscribeToEvents((type, data) => {
  console.log(`Event ${type}:`, data);
});
```

### Python

```python
# Installation: pip install requests
import requests
import json
from typing import Dict, List, Optional

class ApplianceDashboardAPI:
    def __init__(self, base_url: str = "http://localhost:3001/api"):
        self.base_url = base_url
        self.token: Optional[str] = None
        self.session = requests.Session()
    
    def login(self, username: str, password: str) -> Dict:
        """Authentifiziert einen Benutzer und speichert den Token."""
        response = self.session.post(
            f"{self.base_url}/auth/login",
            json={"username": username, "password": password}
        )
        response.raise_for_status()
        data = response.json()
        self.token = data["token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        return data
    
    def get_appliances(self, **params) -> Dict:
        """Ruft alle Appliances ab mit optionalen Filtern."""
        response = self.session.get(f"{self.base_url}/appliances", params=params)
        response.raise_for_status()
        return response.json()
    
    def create_appliance(self, appliance: Dict) -> Dict:
        """Erstellt eine neue Appliance."""
        response = self.session.post(
            f"{self.base_url}/appliances",
            json=appliance
        )
        response.raise_for_status()
        return response.json()
    
    def toggle_favorite(self, appliance_id: int, is_favorite: bool) -> Dict:
        """Markiert/Entmarkiert eine Appliance als Favorit."""
        response = self.session.post(
            f"{self.base_url}/appliances/{appliance_id}/favorite",
            json={"isFavorite": is_favorite}
        )
        response.raise_for_status()
        return response.json()
    
    def execute_ssh_command(self, appliance_id: int, command: str, timeout: int = 30000) -> Dict:
        """Führt einen SSH-Befehl auf einer Appliance aus."""
        response = self.session.post(
            f"{self.base_url}/ssh/execute",
            json={
                "appliance_id": appliance_id,
                "command": command,
                "timeout": timeout
            }
        )
        response.raise_for_status()
        return response.json()

# Verwendung
api = ApplianceDashboardAPI()
api.login("admin", "admin123")

# Appliances abrufen
appliances = api.get_appliances(category="production")
print(f"Gefundene Appliances: {len(appliances['appliances'])}")

# Neue Appliance erstellen
new_appliance = api.create_appliance({
    "name": "Python Test Server",
    "url": "https://python-test.example.com",
    "icon": "Server",
    "category": "development",
    "tags": ["python", "test"],
    "isFavorite": True
})
print(f"Appliance erstellt: {new_appliance['appliance']['name']}")
```

### cURL Beispiele

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Mit Token (ersetzen Sie YOUR_TOKEN)
export TOKEN="YOUR_TOKEN"

# Appliances abrufen
curl -X GET http://localhost:3001/api/appliances \
  -H "Authorization: Bearer $TOKEN"

# Appliance erstellen
curl -X POST http://localhost:3001/api/appliances \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Server",
    "url": "https://test.example.com",
    "icon": "Server",
    "category": "development"
  }'

# SSH-Befehl ausführen
curl -X POST http://localhost:3001/api/ssh/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "appliance_id": 1,
    "command": "uptime"
  }'

# SSE Events empfangen
curl -N -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/events
```

---

## Changelog

### Version 1.0.3 (2025-01-09)
- **Added**: SSH-Host Audit Log restore/revert functionality
- **Added**: Live updates for SSH-Host changes via SSE
- **Added**: SSH-Host change visualization in Audit Log
- **Added**: Detailed before/after comparison for SSH-Host updates
- **Fixed**: SSH-Host Audit Log 404 errors during restore operations
- **Fixed**: Settings Panel live updates for SSH-Host changes
- **Improved**: SSE event system for SSH-Host operations
- **Improved**: Error handling in restore/revert operations

### Version 1.0.2 (2025-01-09)
- **Enhanced**: Backup/Restore functionality for complete data preservation
- **Added**: User password hashes in backups
- **Improved**: Data integrity for all backup types
- **Fixed**: SSH hosts and keys filesystem synchronization

### Version 1.0.1 (2025-07-07)
- **Added**: Categories API endpoints
- **Added**: Favorite functionality for appliances
- **Added**: Custom commands (start/stop/status) per appliance
- **Added**: SSE events for real-time updates
- **Added**: Background image upload endpoint
- **Fixed**: Backup/Restore field compatibility (snake_case vs camelCase)
- **Fixed**: Service deletion via panel
- **Fixed**: Various UI/UX improvements
- **Improved**: API documentation and examples
- **Improved**: Error handling and response consistency

### Version 1.0.0 (2025-01-15)
- Initial release
- Basic CRUD operations for appliances
- JWT authentication
- SSH key management
- Terminal integration
- Service control
- Backup/Restore functionality
- Audit logging

---

## Support

Bei Fragen oder Problemen:
- GitHub Issues: [https://github.com/alflewerken/web-appliance-dashboard/issues](https://github.com/alflewerken/web-appliance-dashboard/issues)
- Email: support@example.com

---

*Letzte Aktualisierung: Juli 2025*
