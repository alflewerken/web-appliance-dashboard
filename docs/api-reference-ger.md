# Web Appliance Dashboard API-Referenz

Version: 1.1.1

## Inhaltsverzeichnis

1. [Einführung](#einführung)
2. [Authentifizierung](#authentifizierung)
3. [API-Endpunkte](#api-endpunkte)
   - [Auth-Endpunkte](#auth-endpunkte)
   - [Appliance-Endpunkte](#appliance-endpunkte)
   - [SSH-Endpunkte](#ssh-endpunkte)
   - [Remote-Desktop-Endpunkte](#remote-desktop-endpunkte)
   - [Backup-Endpunkte](#backup-endpunkte)
   - [Benutzerverwaltung](#benutzerverwaltung)
   - [Audit-Log](#audit-log)
4. [Fehlerbehandlung](#fehlerbehandlung)
5. [Rate-Limiting](#rate-limiting)
6. [WebSocket-Events](#websocket-events)

## Einführung

Die Web Appliance Dashboard API bietet eine RESTful-Schnittstelle zur Verwaltung von Web-Appliances, SSH-Verbindungen, Remote-Desktop-Sitzungen und Systemverwaltungsaufgaben.

**Basis-URL**: `http://localhost:3000/api`

**API-Version**: 1.1.1

**Content-Type**: `application/json`

## Authentifizierung

Die API verwendet JWT (JSON Web Token) Authentifizierung. Alle Anfragen (außer Login und Health-Endpunkte) erfordern ein gültiges JWT-Token.

### Anmeldung

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "ihr-passwort"
}
```

**Antwort:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

### Token verwenden

Fügen Sie das Token im Authorization-Header für alle nachfolgenden Anfragen ein:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## API-Endpunkte

### Auth-Endpunkte

#### Anmeldung
```http
POST /api/auth/login
```
Benutzer authentifizieren und JWT-Token erhalten.

#### Token verifizieren
```http
GET /api/auth/verify
Authorization: Bearer <token>
```
Überprüfen, ob das aktuelle Token gültig ist.

#### Abmeldung
```http
POST /api/auth/logout
Authorization: Bearer <token>
```
Aktuelle Sitzung ungültig machen.

### Appliance-Endpunkte

#### Alle Appliances auflisten
```http
GET /api/appliances
Authorization: Bearer <token>
```

**Query-Parameter:**
- `category` (optional): Nach Kategorie filtern
- `search` (optional): Suchbegriff

**Antwort:**
```json
{
  "success": true,
  "appliances": [
    {
      "id": 1,
      "name": "Produktionsserver",
      "category": "server",
      "url": "https://server.beispiel.de",
      "icon": "server",
      "color": "#007AFF",
      "order": 1,
      "is_active": true,
      "show_in_sidebar": true
    }
  ]
}
```
#### Einzelne Appliance abrufen
```http
GET /api/appliances/:id
Authorization: Bearer <token>
```

#### Appliance erstellen
```http
POST /api/appliances
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Neuer Server",
  "category": "server",
  "url": "https://neuer-server.beispiel.de",
  "icon": "server",
  "color": "#007AFF"
}
```

#### Appliance aktualisieren
```http
PUT /api/appliances/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Aktualisierter Servername",
  "url": "https://aktualisierter-server.beispiel.de"
}
```
#### Appliance löschen
```http
DELETE /api/appliances/:id
Authorization: Bearer <token>
```

#### Appliance-Status prüfen
```http
GET /api/appliances/:id/status
Authorization: Bearer <token>
```

#### Proxy-Anfragen
```http
ALL /api/appliances/:id/proxy/*
Authorization: Bearer <token>
```
Proxy-Anfragen an die Appliance weiterleiten.

### SSH-Endpunkte

#### SSH-Hosts auflisten
```http
GET /api/ssh/hosts
Authorization: Bearer <token>
```

#### SSH-Host erstellen
```http
POST /api/ssh/hosts
Authorization: Bearer <token>
Content-Type: application/json

{
  "hostname": "produktions-server",
  "host": "192.168.1.100",
  "port": 22,
  "username": "admin",
  "password": "passwort"
}
```
#### SSH-Schlüssel einrichten
```http
POST /api/ssh/setup
Authorization: Bearer <token>
Content-Type: application/json

{
  "hostname": "produktions-server",
  "host": "192.168.1.100",
  "username": "admin",
  "password": "passwort"
}
```

#### SSH-Host aktualisieren
```http
PUT /api/ssh/hosts/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "hostname": "aktualisierter-server",
  "password": "neues-passwort"
}
```

#### SSH-Host löschen
```http
DELETE /api/ssh/hosts/:id
Authorization: Bearer <token>
```
#### SSH-Befehl ausführen
```http
POST /api/ssh/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "hostId": 1,
  "command": "ls -la"
}
```

#### SSH-Datei-Upload
```http
POST /api/ssh/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binär>
hostId: 1
remotePath: /home/user/
```

### Remote-Desktop-Endpunkte

#### Remote-Desktop-Verbindungen auflisten
```http
GET /api/remote-desktop/connections
Authorization: Bearer <token>
```

#### Verbindung erstellen
```http
POST /api/remote-desktop/connections
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "VNC Server",
  "protocol": "vnc",
  "parameters": {
    "hostname": "192.168.1.100",
    "port": 5900,
    "password": "vnc-passwort"
  }
}
```
#### Verbindungstoken abrufen
```http
GET /api/remote-desktop/token/:connectionId
Authorization: Bearer <token>
```

**Antwort:**
```json
{
  "token": "ABC123DEF456",
  "url": "http://localhost:9070/guacamole/#/client/ABC123DEF456"
}
```

#### Guacamole-Cache leeren
```http
POST /api/remote-desktop/clear-cache
Authorization: Bearer <token>
```

### Backup-Endpunkte

#### Backup erstellen
```http
GET /api/backup
Authorization: Bearer <token>
```

**Antwort:**
```json
{
  "metadata": {
    "version": "1.1.1",
    "created_at": "2025-01-27T12:00:00Z",
    "appliances_count": 10,
    "users_count": 5
  },
  "appliances": [...],
  "users": [...],
  "ssh_hosts": [...],
  "encryption_key": "ihr-verschlüsselungsschlüssel"
}
```
#### Backup wiederherstellen
```http
POST /api/backup/restore
Authorization: Bearer <token>
Content-Type: application/json

{
  "metadata": {...},
  "appliances": [...],
  "users": [...],
  "ssh_hosts": [...]
}
```

### Benutzerverwaltung

#### Benutzer auflisten
```http
GET /api/users
Authorization: Bearer <token>
```

#### Benutzer erstellen
```http
POST /api/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "neuerbenutzer",
  "password": "passwort123",
  "email": "benutzer@beispiel.de",
  "role": "user"
}
```

#### Benutzer aktualisieren
```http
PUT /api/users/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "neueemail@beispiel.de",
  "role": "admin"
}
```
#### Benutzer löschen
```http
DELETE /api/users/:id
Authorization: Bearer <token>
```

#### Passwort ändern
```http
PUT /api/users/:id/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "altespasswort",
  "newPassword": "neuespasswort123"
}
```

### Audit-Log

#### Audit-Logs abrufen
```http
GET /api/audit
Authorization: Bearer <token>
```

**Query-Parameter:**
- `startDate` (optional): ISO-Datumsstring
- `endDate` (optional): ISO-Datumsstring
- `action` (optional): Nach Aktionstyp filtern
- `user` (optional): Nach Benutzername filtern

#### Audit-Logs exportieren
```http
GET /api/audit/export
Authorization: Bearer <token>
```
## Fehlerbehandlung

Die API gibt konsistente Fehlerantworten zurück:

```json
{
  "success": false,
  "error": "Fehlerbeschreibung",
  "code": "FEHLERCODE"
}
```

### Häufige Fehlercodes

- `401` - Nicht autorisiert (ungültiges oder fehlendes Token)
- `403` - Verboten (unzureichende Berechtigungen)
- `404` - Ressource nicht gefunden
- `409` - Konflikt (z.B. doppelter Eintrag)
- `422` - Validierungsfehler
- `429` - Zu viele Anfragen (Rate-Limit überschritten)
- `500` - Interner Serverfehler

## Rate-Limiting

Die API implementiert Rate-Limiting zur Missbrauchsprävention:

- **Standard-Limit**: 100 Anfragen pro 15 Minuten pro IP
- **Proxy-Endpunkte**: 60 Anfragen pro 15 Minuten pro Benutzer
- **SSH-Operationen**: 30 Anfragen pro 15 Minuten pro Benutzer

Rate-Limit-Header werden in Antworten eingeschlossen:
- `X-RateLimit-Limit`: Maximal erlaubte Anfragen
- `X-RateLimit-Remaining`: Verbleibende Anfragen
- `X-RateLimit-Reset`: UTC-Zeitstempel für Limit-Reset
## WebSocket-Events

Die API unterstützt Server-Sent Events (SSE) für Echtzeit-Updates:

```http
GET /api/events
Authorization: Bearer <token>
Accept: text/event-stream
```

### Event-Typen

#### Status-Update
```json
{
  "type": "status_update",
  "data": {
    "applianceId": 1,
    "status": "online",
    "responseTime": 125
  }
}
```

#### SSH-Sitzungs-Update
```json
{
  "type": "ssh_session",
  "data": {
    "hostId": 1,
    "status": "connected",
    "sessionId": "abc123"
  }
}
```

#### System-Benachrichtigung
```json
{
  "type": "notification",
  "data": {
    "level": "info",
    "message": "Backup erfolgreich abgeschlossen"
  }
}
```

## SDK-Beispiele

Für sprachspezifische Beispiele siehe [API Client SDKs](./api-client-sdks-ger.md).

## OpenAPI-Spezifikation

Die vollständige OpenAPI 3.0-Spezifikation ist verfügbar unter [openapi.yaml](./openapi.yaml).

---

Zuletzt aktualisiert: Januar 2025 | Version: 1.1.1