# Web Appliance Dashboard 🚀

[🇬🇧 English](README.en.md) | 🇩🇪 Deutsch

[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.1.1-brightgreen.svg)](package.json)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](SECURITY.md)

Ein modernes, containerisiertes Dashboard zur zentralen Verwaltung und Überwachung von Web-Appliances, Services und Servern mit integrierter SSH-Funktionalität, Web-Terminal und Remote Desktop Support.

![Web Appliance Dashboard](docs/user-manual/images/Desktop%20Ansicht.png)

## 🌟 Features

### Core Features
- **📊 Zentrales Dashboard** - Übersichtliche Verwaltung aller Appliances mit Kategorisierung
- **🔐 Authentifizierung** - JWT-basierte Benutzerverwaltung mit Rollen (Admin/User)
- **🖥️ Web Terminal** - Integriertes Terminal über ttyd mit SSH-Key Support
- **🔑 SSH Integration** - Vollständiges SSH-Key Management mit automatischer Authentifizierung
- **🖥️ Remote Desktop** - VNC & RDP Support über Apache Guacamole
- **📦 Service Control** - Start/Stop/Status von Services über SSH
- **🎨 Anpassbares Design** - Dark/Light Mode, Custom Backgrounds, Glassmorphism
- **📱 Responsive** - Optimiert für Desktop, Tablet und Mobile (PWA-ready)

### Erweiterte Features
- **💾 Backup & Restore** - Komplette Systemsicherung mit Verschlüsselung und Key-Dialog
- **📝 Audit Logging** - Nachvollziehbare Aktionsprotokolle mit Export
- **⚡ Echtzeit-Updates** - Server-Sent Events (SSE) für Live-Status
- **🛡️ Sicherheit** - Rate Limiting, CORS, Helmet.js, CSP, keine Debug-Endpoints
- **🌐 Multi-User** - Benutzerverwaltung mit granularem Rechtesystem
- **🚨 Health Monitoring** - Automatische Gesundheitsprüfungen mit Alerting
- **📊 Performance Metrics** - CPU, Memory, Disk Usage Monitoring
- **🔍 Volltextsuche** - Schnelle Suche über alle Appliances
- **💡 Smart UI** - Tooltips, Toggle-Panels, Resize-fähige Sidebars

## 🆕 Neueste Updates (v1.1.1)

### Sicherheitsverbesserungen
- ✅ Alle Debug-Dateien und -Ordner entfernt
- ✅ Keine öffentlich zugänglichen Debug-Endpoints mehr
- ✅ Saubere Browser-Konsole ohne Debug-Ausgaben
- ✅ Reduzierte Angriffsfläche für Production

### UI/UX Verbesserungen
- ✅ Interaktive Tooltips für kollabierte Sidebar
- ✅ Toggle-Funktionalität für Sidepanels
- ✅ Verbesserte Resize-Funktionalität für Panels
- ✅ Kein horizontales Scrolling in der Sidebar

### Neue Features
- ✅ Verschlüsselungsschlüssel-Dialog nach Backup
- ✅ Guacamole Cache-Clear API Endpoint
- ✅ Verbesserte SSH-Host Update-Funktionalität
- ✅ Terminal Error Suppressor für saubere Konsole

### Bug Fixes
- ✅ Health Check Probleme behoben (ttyd, webserver)
- ✅ SSH File Upload bei 10% hängen behoben
- ✅ Hostname-Duplikat Check beim Update korrigiert
- ✅ Remote Desktop nach Logout funktioniert wieder

### Code-Qualität
- ✅ 109 console.log Statements entfernt
- ✅ 31 Debug-Dateien gelöscht
- ✅ 3 temporäre Backup-Verzeichnisse entfernt
- ✅ Verbesserte Code-Organisation

## 🆕 Frühere Updates (v1.1.0)

### Remote Desktop Integration
- ✅ Apache Guacamole für VNC/RDP Zugriff
- ✅ Automatische Token-Authentifizierung
- ✅ Verschlüsselte Passwort-Speicherung
- ✅ Connection-Management über API

### SSH Terminal Verbesserungen
- ✅ Automatische SSH-Key Verwendung
- ✅ Keine Passwort-Eingabe bei konfigurierten Keys
- ✅ Verbesserte Terminal-Ausgabe mit Farben
- ✅ SSH-Config Integration

### UI/UX Verbesserungen
- ✅ Neues Glassmorphism Design
- ✅ Verbesserte Mobile Navigation
- ✅ Optimierte Service Cards
- ✅ Dark/Light Mode Toggle

## 📸 Screenshots

### Login Screen
![Login Screen](docs/images/login-screen.jpeg)

### Dashboard Übersicht
![Dashboard Desktop](docs/user-manual/images/Desktop%20Ansicht.png)

### Mobile Ansicht
<p align="center">
  <img src="docs/images/mobile-view.jpeg" alt="Mobile View" width="300">
  <img src="docs/user-manual/images/Mobile.jpeg" alt="Mobile Dashboard" width="300">
</p>

### Service Cards
![Service Card Running](docs/user-manual/images/Service-Card%20Detailansicht%20(grüner%20Statusbar%20für%20Service%20läuft).png)
*Service Card mit grünem Status - Service läuft*

![Service Card Stopped](docs/user-manual/images/Service-Card%20ohne%20Details%20(roter%20Statusbar%20für%20Service%20läuft%20nicht).png)
*Service Card mit rotem Status - Service gestoppt*

### Terminal Integration
![Terminal View](docs/images/terminal-view.png)
*Integriertes Web-Terminal mit SSH-Key Authentifizierung*

### Remote Desktop
*VNC/RDP Zugriff über integriertes Guacamole*

### Widget Ansicht
![Widget View](docs/images/Miniaur-Widget-Ansicht.png)
*Kompakte Widget-Ansicht für schnellen Zugriff*

### Verwaltung
![User Management](docs/user-manual/images/Benutzerverwaltung.png)
*Benutzerverwaltung mit Rollenzuweisung*

![Audit Log](docs/user-manual/images/Audit%20Log.png)
*Vollständiges Audit-Log aller Aktionen*

## 📋 Voraussetzungen

- Docker & Docker Compose (v2.0+)
- Node.js 18+ (für lokale Entwicklung)
- macOS (Apple Silicon/Intel), Linux oder Windows mit WSL2
- 2GB RAM minimum (4GB empfohlen)
- 10GB freier Speicherplatz

## 🚀 Quick Start

### 1. Repository klonen

#### Mit SSH (Empfohlen):
```bash
git clone git@github.com:alflewerken/web-appliance-dashboard.git
cd web-appliance-dashboard
```

#### Mit Personal Access Token:
```bash
# Ersetzen Sie YOUR_TOKEN mit Ihrem GitHub Personal Access Token
git clone https://YOUR_TOKEN@github.com/alflewerken/web-appliance-dashboard.git
cd web-appliance-dashboard
```

> **Hinweis**: Dieses Repository ist privat. Sie benötigen Zugriffsrechte und müssen sich authentifizieren.

### 2. Schnellinstallation

```bash
# Automatische Konfiguration und Installation
./scripts/build.sh --nocache
```
Beim ersten Start wird das Skript nach einem Domain-Namen und einem External-Host-Namen fragen. Geben Sie bei Domain-Name den Rechner-Namen oder die IP des Docker-Hosts ein, auf dem das Web Appliance Dashboard läuft. Wenn das Web-Appliance-Dashboard hinter einem Reverse-Proxy wie nginx läuft, geben Sie hier die externe Domain des Docker-Hosts ein, wie z.B. dashboard.example.com
Das System ist nach wenigen Minuten unter http://localhost:9080 erreichbar. Der Reverse Proxy sollte so konfiguriert werden, daß er von der Internen IP des Docker-Hosts mit Port 9080 nach Port 443 (https) mappt.

Dieser Befehl:
- Löscht alle Docker-Caches für eine saubere Installation
- Baut alle Container neu (Backend, Frontend, Database, Guacamole, ttyd)
- Installiert alle Services inklusive Remote Desktop
- Startet das komplette System

### Option 2: Manuelle Installation

#### 1. Umgebungsvariablen konfigurieren

##### Automatisches Setup (empfohlen)
```bash
# Führt Sie durch die Konfiguration und generiert sichere Secrets
./scripts/setup-env.sh
```
##### Manuelles Setup
```bash
# Environment-Datei erstellen
cp .env.example .env

# Backend Environment
cp backend/.env.example backend/.env

# Frontend Environment  
cp frontend/.env.example frontend/.env

# WICHTIG: Passen Sie alle Passwörter und Secret Keys in .env an!
```

Siehe [Docker Environment Setup Guide](docs/docker-env-setup.md) für Details.

#### 2. Docker Container starten

##### Build-Optionen:
```bash
# Standard Installation (mit Remote Desktop)
./scripts/build.sh

# Installation ohne Remote Desktop (kleinerer Footprint)
./scripts/build.sh --no-remote-desktop

# Neuaufbau mit Cache-Löschung (bei Problemen)
./scripts/build.sh --nocache
# Schneller Neustart (für Entwicklung)
./scripts/build.sh --refresh
```

### Nach der Installation

#### Dashboard aufrufen
- **Web Interface**: http://localhost:9080
- **API**: http://localhost:9080/api
- **API Docs**: http://localhost:9080/api-docs
- **Web Terminal**: http://localhost:9080/terminal/
- **Guacamole** (Remote Desktop): http://localhost:9080/guacamole/

#### Standard Login
- **Benutzer**: admin
- **Passwort**: admin123 (bitte sofort ändern!)

#### Guacamole Login (falls direkt aufgerufen)
- **Benutzer**: guacadmin
- **Passwort**: guacadmin

![Service anlegen](docs/user-manual/images/Service%20anlegen.png)
*Neuen Service hinzufügen - einfach und intuitiv*

## 🛠️ Management & Wartung

### Build-Kommandos
```bash# Standard Installation (mit Remote Desktop)
./scripts/build.sh

# Installation ohne Remote Desktop (kleinerer Footprint)
./scripts/build.sh --no-remote-desktop

# Neuaufbau mit Cache-Löschung (bei Docker-Problemen)
./scripts/build.sh --nocache

# Schneller Neustart für Code-Änderungen (Entwicklung)
./scripts/build.sh --refresh

# macOS App mitbauen
./scripts/build.sh --macos-app
```

### Container-Management
```bash
# Container starten
docker compose up -d

# Container stoppen
docker compose down

# Container-Status prüfen
./status.sh

# Logs anzeigen
docker compose logs -f
# Nur Backend-Logs
docker compose logs -f backend

# Nur Guacamole-Logs
docker compose logs -f guacamole
```

### Wartung & Updates
```bash
# Update auf Remote Desktop nachträglich
./scripts/update-remote-desktop.sh

# Kompletter Neuaufbau (LÖSCHT ALLE DATEN!)
./scripts/clean.sh --all

# Container löschen und neu bauen
./scripts/clean.sh && ./scripts/build.sh

# Datenbank-Migration ausführen
docker exec appliance_backend npm run migrate
```

### Remote Desktop Services
```bash
# Nur Remote Desktop starten
docker compose up -d guacamole-postgres guacd guacamole

# Nur Remote Desktop stoppen
docker compose stop guacamole-postgres guacd guacamole

# Guacamole-Verbindungen prüfendocker exec appliance_backend node utils/guacamole/test-connection.js
```

## 🛡️ Sicherheit

### Production-Ready Security
- **Keine Debug-Endpoints** - Alle Debug-Dateien und -Ordner wurden entfernt
- **JWT-Authentifizierung** - Sichere Token-basierte Authentifizierung
- **Verschlüsselte Passwörter** - AES-256 Verschlüsselung für Remote-Host Passwörter
- **Rate Limiting** - Schutz vor Brute-Force Angriffen
- **CORS Protection** - Konfigurierbare Cross-Origin Policies
- **CSP Headers** - Content Security Policy aktiviert
- **SQL Injection Schutz** - Prepared Statements für alle Queries
- **XSS Prevention** - Input Sanitization und Output Encoding

### Wichtige Sicherheitshinweise

⚠️ **Verschlüsselungsschlüssel**: 
- Der Verschlüsselungsschlüssel wird beim Setup generiert
- Bewahren Sie ihn sicher auf (z.B. in einem Passwort-Manager)
- Ohne diesen Schlüssel können Remote-Passwörter nach einem Restore nicht entschlüsselt werden

⚠️ **Standard-Passwörter**:
- Ändern Sie ALLE Standard-Passwörter in der .env Datei
- Verwenden Sie starke, einzigartige Passwörter
- Nutzen Sie das setup-env.sh Script für sichere Zufallspasswörter

⚠️ **Netzwerk-Sicherheit**:
- Betreiben Sie das Dashboard hinter einem Reverse-Proxy mit HTTPS
- Beschränken Sie den Zugriff über Firewall-Regeln
- Verwenden Sie VPN für Remote-Zugriff

## 🏗️ Architektur

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   React SPA     │────▶│  Nginx Proxy    │────▶│  Node.js API    │
│   (Frontend)    │     │   (Port 9080)   │     │   (Port 3001)   │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
                        ┌─────────────────┐               │
                        │                 │               │
                        │   Web Terminal  │◀──────────────┤
                        │     (ttyd)      │               │
                        │                 │               │
                        └─────────────────┘               │
                                                          │
                        ┌─────────────────┐               │
                        │                 │               │
                        │    Guacamole    │◀──────────────┤
                        │   (VNC/RDP)     │               │
                        │                 │               │
                        └─────────────────┘               │
                                                          │
                        ┌─────────────────┐               │                        │                 │               │
                        │    MariaDB      │◀──────────────┘
                        │   (Database)    │
                        │                 │
                        └─────────────────┘
```

### Container Details

| Container | Port | Beschreibung |
|-----------|------|--------------|
| nginx | 9080, 9443 | Reverse Proxy & Static Files |
| backend | 3001 | Node.js API Server |
| database | 3306 | MariaDB Datenbank |
| ttyd | 7681 | Web Terminal |
| guacamole | 8080 | Remote Desktop Web Client |
| guacd | 4822 | Remote Desktop Proxy Daemon |
| guacamole-postgres | 5432 | Guacamole Datenbank |

## 🎨 Benutzeroberfläche

Das Dashboard bietet eine moderne, intuitive Benutzeroberfläche mit verschiedenen Ansichten:

### Desktop & Tablet
![iPad View](docs/user-manual/images/iPad%20Ansicht.png)
*Responsive Design für alle Bildschirmgrößen*

### Service Management![Service Management](docs/user-manual/images/Custom%20Commands.jpeg)
*Custom Commands für schnelle Aktionen*

### Einstellungen
<p align="center">
  <img src="docs/user-manual/images/Einstellungen%20Kategorien.png" alt="Kategorien" width="45%">
  <img src="docs/user-manual/images/Einstellungen%20Hintergrundbild.png" alt="Hintergrundbild" width="45%">
</p>

### SSH & Backup
<p align="center">
  <img src="docs/user-manual/images/Einstellungen%20SSH%20Remote%20Control.png" alt="SSH Remote Control" width="45%">
  <img src="docs/user-manual/images/Einstellungen%20Backup%20Restore.png" alt="Backup & Restore" width="45%">
</p>

## 📁 Projektstruktur

```
web-appliance-dashboard/
├── backend/                 # Node.js Express API
│   ├── routes/             # API Endpoints
│   ├── utils/              # Helper Functions
│   │   ├── guacamole/      # Guacamole Integration
│   │   ├── terminal/       # Terminal Management
│   │   └── backup/         # Backup/Restore Logic
│   ├── uploads/            # File Uploads
│   └── server.js           # Main Server File├── frontend/               
├── frontend/
│   ├── src/
│   │   ├── components/     # React Components
│   │   ├── contexts/       # React Contexts
│   │   ├── hooks/          # Custom Hooks
│   │   ├── services/       # API Services
│   │   └── utils/          # Utilities
│   └── build/              # Production Build
├── nginx/                  # Nginx Configuration
├── guacamole/             # Guacamole Dockerfile
├── ttyd/                  # ttyd Configuration
├── Mac-Standalone/        # Electron macOS App
├── scripts/               # Management Scripts
├── docs/                  # Documentation
├── docker-compose.yml     # Docker Orchestration
└── init.sql              # Database Schema
```

## 🛠️ Entwicklung

### Backend Development
```bash
cd backend
npm install
npm run dev
```

### Frontend Development
```bash
cd frontend
npm install
npm start
```

### Docker Development
```bash
# Mit Volume-Mounts für Hot-Reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## 🔧 Konfiguration

### Wichtige Umgebungsvariablen

#### Backend (.env)
```env
# Database
DB_HOST=database
DB_PORT=3306
DB_USER=dashboard_user
DB_PASSWORD=dashboard_pass123
DB_NAME=appliance_dashboard

# Security
JWT_SECRET=your-secret-key
SSH_KEY_ENCRYPTION_SECRET=your-encryption-key
# Server
PORT=3001
NODE_ENV=production

# Guacamole
GUACAMOLE_DB_NAME=guacamole_db
GUACAMOLE_DB_USER=guacamole_user
GUACAMOLE_DB_PASSWORD=guacamole_pass123
```

#### Frontend (.env)
```env
# API Configuration
REACT_APP_API_URL=/api
REACT_APP_WS_URL=ws://localhost:9080

# Features
REACT_APP_ENABLE_REMOTE_DESKTOP=true
REACT_APP_ENABLE_TERMINAL=true
```

#### Docker Compose Override
Für lokale Entwicklung kann eine `docker-compose.override.yml` erstellt werden:
```yaml
version: '3.8'
services:
  backend:
    volumes:
      - ./backend:/app
      - /app/node_modules    environment:
      NODE_ENV: development
  
  frontend:
    volumes:
      - ./frontend/src:/app/src
    environment:
      CHOKIDAR_USEPOLLING: true
```

## 🔒 Sicherheit

### Best Practices
- ✅ JWT Token Authentication
- ✅ Passwort-Hashing mit bcrypt
- ✅ Rate Limiting für API
- ✅ CORS Protection
- ✅ SQL Injection Protection
- ✅ XSS Protection via Helmet.js
- ✅ SSH Key Encryption
- ✅ Verschlüsselte Passwort-Speicherung für Remote Desktop
- ✅ Content Security Policy (CSP)
- ✅ HTTPS Support (Nginx)

### Empfehlungen
1. **Ändern Sie alle Standard-Passwörter** sofort nach der Installation
2. **Verwenden Sie starke JWT Secrets** (mindestens 32 Zeichen)
3. **Aktivieren Sie HTTPS** in Production-Umgebungen
4. **Regelmäßige Security Updates** der Container5. **Backup-Strategie** implementieren und testen
6. **Firewall-Regeln** für Docker Ports konfigurieren
7. **SSH-Keys** regelmäßig rotieren

## 📚 Dokumentation

Eine vollständige Dokumentation ist verfügbar:

- **[API Reference](docs/api-client-sdks)** - Detaillierte Endpoint-Dokumentation
- **[OpenAPI/Swagger](http://localhost:9080/api-docs)** - Interaktive API-Dokumentation
- **[Developer Documentation](docs/developer.html)** - Entwickler-Dokumentation
- **[Docker Environment Setup](docs/docker-env-setup.md)** - Docker-Umgebung einrichten
- **[Performance Tuning Guide](docs/performance-tuning-guide.md)** - Performance-Optimierung
- **[Remote Desktop Setup Guide](docs/remote-desktop-setup-guide.md)** - Remote Desktop Einrichtung
- **[Remote Desktop Password Restore](docs/REMOTE_DESKTOP_PASSWORD_RESTORE.md)** - Remote Desktop Passwort wiederherstellen
- **[Security Best Practices](docs/security-best-practices-guide.md)** - Sicherheits-Best-Practices
- **[Proxy Implementation Summary](docs/PROXY_IMPLEMENTATION_SUMMARY.md)** - Proxy-Implementierung Zusammenfassung
- **[User Manual](docs/user-manual/index.html)** - Benutzerhandbuch
- **[OpenAPI Specification](docs/openapi.yaml)** - OpenAPI/Swagger Spezifikation

### Backup & Restore
```bash
# Backup erstellen
curl -X POST http://localhost:9080/api/backup/create \
  -H "Authorization: Bearer <token>"
# Backup herunterladen
curl -X GET http://localhost:9080/api/backup/download/latest \
  -H "Authorization: Bearer <token>" \
  -o backup.zip

# Backup wiederherstellen
curl -X POST http://localhost:9080/api/restore \
  -H "Authorization: Bearer <token>" \
  -F "backup=@backup.zip"
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
npm run test:watch
npm run test:coverage
```

### Frontend Tests
```bash
cd frontend
npm test
npm run test:coverage
```

### E2E Tests (coming soon)
```bash
npm run test:e2e```

### API Tests
```bash
# Mit Postman/Newman
newman run docs/postman-collection.json
```

## 📖 Weitere Dokumentation

- **[API Reference](docs/api-reference.md)** - Vollständige API-Dokumentation mit Beispielen
- **[User Manual](docs/user-manual/)** - Benutzerhandbuch mit Screenshots
- **[Developer Guide](docs/developer-guide.md)** - Entwickler-Dokumentation
- **[Docker Guide](docs/docker-guide.md)** - Docker Setup und Konfiguration
- **[Security Guide](docs/security-guide.md)** - Sicherheitsrichtlinien
- **[Troubleshooting](docs/troubleshooting.md)** - Häufige Probleme und Lösungen

## 🤝 Contributing

Beiträge sind willkommen! Bitte beachten Sie:

1. Fork das Repository
2. Feature Branch erstellen (`git checkout -b feature/AmazingFeature`)
3. Änderungen committen (`git commit -m 'Add some AmazingFeature'`)
4. Branch pushen (`git push origin feature/AmazingFeature`)
5. Pull Request öffnen

### Code Style
- ESLint für JavaScript
- Prettier für Formatierung- Conventional Commits für Git Messages

### Development Guidelines
- Schreiben Sie Tests für neue Features
- Aktualisieren Sie die Dokumentation
- Befolgen Sie die bestehenden Code-Patterns
- Verwenden Sie aussagekräftige Commit-Messages

## 🐛 Known Issues & Limitations

### Bekannte Probleme
- [ ] Guacamole auf Apple Silicon benötigt Rosetta Emulation
- [ ] SSH Key Rotation noch nicht über UI verfügbar
- [ ] Multi-Factor Authentication (MFA) noch nicht implementiert
- [ ] LDAP/AD Integration fehlt
- [ ] Performance bei >1000 Appliances nicht optimiert

### Browser-Kompatibilität
- Chrome/Edge: ✅ Vollständig unterstützt
- Firefox: ✅ Vollständig unterstützt
- Safari: ✅ Vollständig unterstützt
- Mobile Browser: ✅ iOS Safari, Chrome Android

## 🗺️ Roadmap

### Version 1.1 (Q2 2025) ✅
- [x] Remote Desktop Integration (Guacamole)
- [x] Verbesserte Terminal-Integration
- [x] SSH-Key Auto-Authentication
- [x] UI/UX Improvements

### Version 1.2 (Q3 2025)
- [ ] TypeScript Migration
- [ ] GraphQL API Option
- [ ] Enhanced Test Coverage (>80%)
- [ ] GitHub Actions CI/CD
- [ ] Plugin System Architecture

### Version 1.3 (Q4 2025)
- [ ] Multi-Factor Authentication (2FA/MFA)
- [ ] LDAP/Active Directory Integration
- [ ] Prometheus/Grafana Monitoring
- [ ] Internationalization (i18n)
- [ ] Role-Based Access Control (RBAC) v2

### Version 2.0 (2026)
- [ ] Kubernetes Native Support
- [ ] Microservices Architecture
- [ ] Advanced Analytics Dashboard
- [ ] AI-Powered Anomaly Detection
- [ ] Multi-Tenancy Support

## 📊 Performance

### Systemanforderungen
- **CPU**: 2 Cores minimum (4 empfohlen)
- **RAM**: 2GB minimum (4GB empfohlen)
- **Disk**: 10GB minimum (20GB empfohlen)

### Performance Metriken- **Startup Zeit**: <10 Sekunden (alle Services)
- **API Response**: <100ms (average)
- **Memory Usage**: ~500MB (mit Guacamole)
- **Concurrent Users**: 100+ getestet
- **WebSocket Connections**: 1000+ möglich

### Optimierungen
- Redis Cache (optional)
- CDN für Static Assets
- Database Query Optimization
- Connection Pooling

## 🛟 Support

### Community
- **Issues**: [GitHub Issues](https://github.com/alflewerken/web-appliance-dashboard/issues)
- **Discussions**: [GitHub Discussions](https://github.com/alflewerken/web-appliance-dashboard/discussions)
- **Wiki**: [GitHub Wiki](https://github.com/alflewerken/web-appliance-dashboard/wiki)

## 📄 Lizenz

Dieses Projekt ist unter der MIT License lizenziert - siehe [LICENSE](LICENSE) für Details.

## 🙏 Danksagungen

### Core Technologies- [React](https://reactjs.org/) - UI Framework
- [Express.js](https://expressjs.com/) - Backend Framework
- [Docker](https://www.docker.com/) - Containerization
- [MariaDB](https://mariadb.org/) - Database
- [Nginx](https://nginx.org/) - Web Server

### Key Components
- [Apache Guacamole](https://guacamole.apache.org/) - Remote Desktop Gateway
- [ttyd](https://github.com/tsl0922/ttyd) - Web Terminal
- [xterm.js](https://xtermjs.org/) - Terminal Emulator
- [Socket.IO](https://socket.io/) - WebSocket Library
- [JWT](https://jwt.io/) - Authentication

### UI/UX
- [Lucide](https://lucide.dev/) - Beautiful Icons
- [Tailwind CSS](https://tailwindcss.com/) - Utility-First CSS
- [Framer Motion](https://www.framer.com/motion/) - Animations

### Development Tools
- [ESLint](https://eslint.org/) - Code Linting
- [Prettier](https://prettier.io/) - Code Formatting
- [Jest](https://jestjs.io/) - Testing Framework
- [Swagger](https://swagger.io/) - API Documentation

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/alflewerken">Alf Lewerken</a>
</p>
<p align="center">
  <a href="https://github.com/alflewerken/web-appliance-dashboard">GitHub</a> •
  <a href="https://alflewerken.de">Website</a> •
  <a href="#web-appliance-dashboard-">Back to top ↑</a>
</p>