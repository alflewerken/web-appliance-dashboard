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

## 📸 Screenshots

<details>
<summary><b>Alle Screenshots anzeigen</b></summary>

### Dashboard & Navigation
![Dashboard Desktop](docs/user-manual/images/Desktop%20View.png)
*Desktop Dashboard Übersicht*

![Mobile Dashboard](docs/user-manual/images/Mobile.jpeg)
*Mobile Ansicht*

![iPad View](docs/user-manual/images/iPad%20View.png)
*Tablet/iPad Ansicht*

### Service Management
![Service Card Running](docs/user-manual/images/Service%20Card%20Detail%20View%20(green%20statusbar%20service%20running).png)
*Service Card - Service läuft (grün)*

![Service Card Stopped](docs/user-manual/images/Service%20Card%20without%20Details%20(red%20statusbar%20service%20not%20running).png)
*Service Card - Service gestoppt (rot)*

![Create Service](docs/user-manual/images/Create%20Service.png)
*Neuen Service anlegen*

### Terminal & Remote Access
![Terminal View](docs/images/terminal-view.png)
*Integriertes Web-Terminal*

![Custom Commands](docs/user-manual/images/Custom%20Commands.jpeg)
*Custom SSH Commands*

### Administration
![User Management](docs/user-manual/images/User%20Management.png)
*Benutzerverwaltung*

![Audit Log](docs/user-manual/images/Audit%20Log.png)
*Audit Log Übersicht*

### Einstellungen
![Settings Categories](docs/user-manual/images/Settings%20Categories.png)
*Kategorien verwalten*

![Settings Background](docs/user-manual/images/Settings%20Background.png)
*Hintergrundbild anpassen*

![Backup Restore](docs/user-manual/images/Settings%20Backup%20Restore.png)
*Backup & Restore*

</details>

## 📋 Voraussetzungen

- Docker & Docker Compose (v2.0+)
- Linux/macOS/Windows mit WSL2
- 2GB RAM (4GB empfohlen)
- 10GB freier Speicherplatz

## 🚀 Quick Start

### 1. Repository klonen
```bash
git clone https://github.com/alflewerken/web-appliance-dashboard.git
cd web-appliance-dashboard
```

### 2. Environment Setup
```bash
./scripts/setup-env.sh
```
Das Script:
- Erstellt sichere Passwörter
- Konfiguriert die .env Datei
- Fragt nach Verschlüsselungsschlüssel
- Bereitet die Docker-Umgebung vor

### 3. Container starten
```bash
docker compose up -d
```

### 4. Dashboard öffnen
```
http://localhost:9080
```

Standard-Login:
- **Benutzer**: admin
- **Passwort**: admin123

⚠️ **Wichtig**: Ändern Sie das Standard-Passwort sofort nach dem ersten Login!

## 📚 Dokumentation

### Benutzer-Dokumentation
- [Benutzerhandbuch](docs/user-manual/index.html) - Web-basierte Anleitung

### Entwickler-Dokumentation
- [Entwicklerleitfaden](docs/developer.html) - Architektur mit Diagrammen
- [API-Referenz](docs/api-reference-ger.md) - API-Dokumentation
- [API Client SDKs](docs/api-client-sdks-ger.md) - Client-Beispiele
- [Integrationsleitfaden](docs/integration-guide-ger.md) - Integration in bestehende Systeme
- [Entwicklungsumgebung](docs/DEVELOPMENT_SETUP-ger.md) - Entwicklungsumgebung einrichten

### Setup & Konfiguration
- [Remote-Desktop-Einrichtung](docs/remote-desktop-setup-guide-ger.md) - Guacamole einrichten
- [Sicherheitsleitfaden](docs/security-best-practices-guide-ger.md) - Sicherheitsrichtlinien
- [Leistungsoptimierung](docs/performance-tuning-guide-ger.md) - Optimierung
- [Docker-Umgebung](docs/docker-env-setup-ger.md) - Docker Konfiguration

### Technische Dokumentation
- [Backend-Proxy-Implementierung](docs/BACKEND_PROXY_IMPLEMENTATION-ger.md) - Proxy-Architektur
- [OpenAPI-Spezifikation](docs/openapi.yaml) - API Spezifikation

## 🔒 Sicherheit

### Integrierte Sicherheitsfunktionen
- **JWT-Authentifizierung** - Sichere Token-basierte Authentifizierung
- **Verschlüsselte Passwörter** - AES-256 für Remote-Host-Passwörter
- **Rate-Limiting** - Schutz vor Brute-Force-Angriffen
- **CORS-Schutz** - Konfigurierbare Richtlinien
- **SQL-Injection-Schutz** - Prepared Statements
- **XSS-Prävention** - Eingabebereinigung

### Wichtige Sicherheitshinweise

⚠️ **Verschlüsselungsschlüssel**: 
- Wird beim Setup generiert oder manuell eingegeben
- Sicher aufbewahren (z.B. Passwort-Manager)
- Benötigt für Passwort-Entschlüsselung nach Restore

⚠️ **Best Practices**:
- Alle Standard-Passwörter ändern
- HTTPS mit gültigem Zertifikat verwenden
- Regelmäßige Backups erstellen
- Firewall-Regeln konfigurieren

## 🏗️ Architektur

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React SPA     │────▶│  Nginx Proxy    │────▶│  Node.js API    │
│   (Port 3001)   │     │   (Port 80)     │     │   (Port 3000)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
                        ┌─────────────────┐               │
                        │   Web Terminal  │◀──────────────┤
                        │     (ttyd)      │               │
                        └─────────────────┘               │
                                                          │
                        ┌─────────────────┐               │
                        │    Guacamole    │◀──────────────┤
                        │   (VNC/RDP)     │               │
                        └─────────────────┘               │
                                                          │
                        ┌─────────────────┐               │
                        │    MySQL DB     │◀──────────────┘
                        │   (Port 3306)   │
                        └─────────────────┘
```

## 🛠️ Konfiguration

### Environment Variablen

Die wichtigsten Einstellungen in der `.env` Datei:

```env
# Ports
PUBLIC_PORT=9080
BACKEND_PORT=3000
FRONTEND_PORT=3001

# Security
JWT_SECRET=<auto-generated>
SSH_KEY_ENCRYPTION_SECRET=<your-encryption-key>

# Database
MYSQL_ROOT_PASSWORD=<auto-generated>
MYSQL_PASSWORD=<auto-generated>

# Features
ENABLE_REMOTE_DESKTOP=true
ENABLE_AUDIT_LOG=true
```

### Docker Compose Override

Für spezifische Anpassungen erstellen Sie eine `docker-compose.override.yml`:

```yaml
version: '3.8'
services:
  webserver:
    ports:
      - "443:443"
    volumes:
      - ./ssl:/etc/nginx/ssl:ro
```

## 🔧 Wartung

### Backup erstellen
```bash
# Über die UI: Einstellungen → Backup → Backup erstellen
# Oder via Script:
docker exec appliance_backend npm run backup
```

### Logs anzeigen
```bash
# Alle Services
docker compose logs -f

# Spezifischer Service
docker compose logs -f backend
```

### Container neu starten
```bash
# Alle Services
docker compose restart

# Einzelner Service
docker compose restart backend
```

### Updates
```bash
git pull
docker compose down
docker compose build
docker compose up -d
```

## 📊 Leistung

### System-Anforderungen
- **CPU**: 2 Cores (4 empfohlen)
- **RAM**: 2GB minimum (4GB empfohlen)
- **Festplatte**: 10GB (20GB empfohlen)

### Optimierungen
- Redis-Cache (optional)
- CDN für statische Ressourcen
- Datenbankabfrage-Optimierung
- Verbindungspooling

## 🐛 Fehlerbehebung

### Häufige Probleme

**Container startet nicht:**
```bash
docker compose down -v
docker compose up -d
```

**Passwort vergessen:**
```bash
docker exec appliance_backend npm run reset-admin-password
```

**SSL-Zertifikat-Fehler:**
- Prüfen Sie die Nginx-Konfiguration
- Stellen Sie sicher, dass Port 443 verfügbar ist

### Debug-Modus

Für detaillierte Logs:
```bash
# .env anpassen
NODE_ENV=development
LOG_LEVEL=debug

# Container neu starten
docker compose restart backend
```

## 🤝 Contributing

Wir freuen uns über Beiträge! Siehe [CONTRIBUTING.md](CONTRIBUTING.md) für Details.

### Development Setup
```bash
# Frontend Development
cd frontend
npm install
npm run dev

# Backend Development
cd backend
npm install
npm run dev
```

## 📄 Lizenz

Dieses Projekt ist unter der MIT License lizenziert - siehe [LICENSE](LICENSE) für Details.

## 🙏 Danksagungen

- [React](https://reactjs.org/) - UI Framework
- [Express.js](https://expressjs.com/) - Backend Framework
- [Apache Guacamole](https://guacamole.apache.org/) - Remote Desktop
- [ttyd](https://github.com/tsl0922/ttyd) - Web Terminal
- Alle weiteren [Open Source Projekte](package.json) die dieses Projekt ermöglichen

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/alflewerken">Alf Lewerken</a>
</p>