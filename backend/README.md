# Web Appliance Dashboard - Backend API

## 🚀 Übersicht

Das Backend des Web Appliance Dashboard ist eine RESTful API basierend auf Node.js und Express, die alle Funktionen für die Verwaltung von Web-Applikationen, Services und Remote-Verbindungen bereitstellt.

## 📋 Version

**Aktuelle Version:** 1.1.0

## 🛠️ Technologie-Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Datenbank:** MariaDB (MySQL kompatibel)
- **Authentifizierung:** JWT (JSON Web Tokens)
- **WebSocket:** ws / express-ws für Terminal-Verbindungen
- **SSH:** node-pty für Terminal-Emulation
- **Remote Desktop:** Apache Guacamole Integration
- **Dokumentation:** Swagger/OpenAPI 3.0

## 📚 API Dokumentation

### Interaktive Dokumentation

Die API verfügt über eine interaktive Swagger-Dokumentation:

```
http://localhost:3001/api-docs
```

### Entwickler-Dokumentation

Eine umfassende Entwickler-Dokumentation mit Beispielen finden Sie unter:

```
/docs/developer.html
```

## 🔑 Hauptfunktionen

### 1. Authentifizierung & Autorisierung
- JWT-basierte Authentifizierung
- Rollen-basierte Zugriffskontrolle (RBAC)
- Session-Management
- Passwort-Hashing mit bcrypt

### 2. Appliance Management
- CRUD-Operationen für Web-Appliances
- Kategorisierung und Tagging
- Favoriten-Verwaltung
- Status-Überwachung
- Remote Desktop Integration (VNC/RDP)

### 3. SSH & Terminal
- WebSocket-basierte Terminal-Verbindungen
- SSH-Key-Management
- Multi-Host-Unterstützung
- Sichere Credential-Speicherung

### 4. Service Control
- Start/Stop/Restart von Services
- Custom Commands
- Status-Monitoring
- Audit-Logging

### 5. Backup & Restore
- Vollständige System-Backups
- Selektive Wiederherstellung
- Verschlüsselte Speicherung
- Automatische Backup-Rotation

### 6. Real-Time Updates
- Server-Sent Events (SSE)
- WebSocket für Terminal
- Status-Updates
- System-Benachrichtigungen

## 🚦 API Endpoints

### Authentifizierung
- `POST /api/auth/login` - Benutzer-Login
- `POST /api/auth/logout` - Benutzer-Logout
- `GET /api/auth/me` - Aktuelle Benutzer-Info
- `POST /api/auth/change-password` - Passwort ändern

### Appliances
- `GET /api/appliances` - Alle Appliances abrufen
- `GET /api/appliances/:id` - Einzelne Appliance
- `POST /api/appliances` - Neue Appliance erstellen
- `PUT /api/appliances/:id` - Appliance aktualisieren
- `DELETE /api/appliances/:id` - Appliance löschen
- `PATCH /api/appliances/:id/favorite` - Favoriten-Status

### SSH & Terminal
- `GET /api/ssh/hosts` - SSH-Hosts verwalten
- `POST /api/ssh/keys/generate` - SSH-Keys generieren
- `WS /api/terminal/connect` - Terminal-WebSocket

### Remote Desktop
- `POST /api/guacamole/token` - Temporärer Zugangstoken
- `GET /api/guacamole/validate/:token` - Token-Validierung

### Weitere Endpoints
Siehe die vollständige API-Dokumentation für alle verfügbaren Endpoints.

## 🔒 Sicherheit

### Implementierte Sicherheitsmaßnahmen

1. **Authentifizierung**
   - JWT mit kurzer Lebensdauer
   - Refresh-Token-Mechanismus
   - Rate-Limiting für Login-Versuche

2. **Verschlüsselung**
   - AES-256 für Remote Desktop Credentials
   - bcrypt für Passwort-Hashing
   - HTTPS-Unterstützung

3. **Middleware**
   - CORS-Konfiguration
   - Helmet.js für Security Headers
   - Input-Validierung
   - SQL-Injection-Schutz

4. **Audit-Logging**
   - Alle kritischen Aktionen werden protokolliert
   - IP-Tracking
   - Benutzer-Aktivitäten

## 🐳 Docker-Unterstützung

Das Backend läuft in einem Docker-Container mit folgenden Features:

- Multi-Stage Build für optimale Größe
- Non-Root User für Sicherheit
- Health-Checks
- Volume-Mounts für Persistenz

## 📝 Umgebungsvariablen

```env
# Datenbank
DB_HOST=database
DB_PORT=3306
DB_USER=dashboard_user
DB_PASSWORD=dashboard_pass123
DB_NAME=appliance_dashboard

# Sicherheit
JWT_SECRET=your-secret-key
SSH_KEY_ENCRYPTION_SECRET=your-encryption-key

# Server
NODE_ENV=production
BACKEND_PORT=3001

# Features
FEATURE_AUDIT_LOG=true
FEATURE_BACKUP_RESTORE=true
FEATURE_SSH_TERMINAL=true
FEATURE_REMOTE_DESKTOP=true
```

## 🧪 Testing

```bash
# Unit Tests
npm test

# Integration Tests
npm run test:integration

# Test Coverage
npm run test:coverage
```

## 📊 Monitoring

Das Backend bietet mehrere Monitoring-Endpoints:

- `/health` - Health-Check
- `/api/status-check/info` - Status-Checker Info
- `/metrics` - Prometheus-Metriken (optional)

## 🔧 Entwicklung

### Lokale Entwicklung

```bash
# Dependencies installieren
npm install

# Entwicklungsserver starten
npm run dev

# Linting
npm run lint

# Code-Formatierung
npm run format
```

### Datenbank-Migrationen

Beim Start werden automatisch notwendige Datenbank-Migrationen durchgeführt.

## 📦 Deployment

### Production Build

```bash
# Docker Image bauen
docker build -t web-appliance-backend .

# Mit Docker Compose
docker-compose up -d backend
```

### Skalierung

Das Backend ist stateless designed und kann horizontal skaliert werden:

- Session-Daten in Redis (optional)
- Datei-Uploads in Object Storage
- Load Balancing über Nginx

## 🤝 Contributing

Beiträge sind willkommen! Bitte beachten Sie:

1. Fork des Repositories
2. Feature-Branch erstellen
3. Tests schreiben
4. Pull Request erstellen

## 📄 Lizenz

MIT License - siehe LICENSE Datei

## 🔗 Links

- [Hauptprojekt](https://github.com/alflewerken/web-appliance-dashboard)
- [API-Dokumentation](/api-docs)
- [Entwickler-Handbuch](/docs/developer.html)
- [Changelog](/CHANGELOG.md)
