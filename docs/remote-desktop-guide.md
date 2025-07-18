# Remote Desktop Integration Guide

## 🖥️ Übersicht

Das Web Appliance Dashboard unterstützt jetzt Remote Desktop Verbindungen über VNC und RDP Protokolle. Diese Integration nutzt Apache Guacamole als Backend für clientless Remote Desktop Access.

## 🚀 Installation

### 1. Hauptanwendung starten
```bash
docker-compose up -d
```

### 2. Datenbank-Migration ausführen
```bash
./run-migration.sh
```

### 3. Guacamole Services starten
```bash
docker-compose -f docker-compose.guacamole.yml up -d
```

Oder nutzen Sie das All-in-One Script:
```bash
./start-with-guacamole.sh
```

## 🔧 Konfiguration

### Remote Desktop für eine Appliance aktivieren

1. Öffnen Sie die Appliance-Einstellungen
2. Gehen Sie zum Tab "Service & SSH"
3. Scrollen Sie zum Abschnitt "Remote Desktop"
4. Aktivieren Sie "Remote Desktop aktivieren"
5. Wählen Sie das Protokoll:
   - **VNC** - Für Linux/Unix Systeme
   - **RDP** - Für Windows Systeme
6. Konfigurieren Sie die Verbindungsdetails:
   - **Port**: Standard 5900 für VNC, 3389 für RDP
   - **Benutzername**: Nur für RDP erforderlich
   - **Passwort**: Wird verschlüsselt gespeichert

### Guacamole Konfiguration

Die Standard-Konfiguration sollte für die meisten Anwendungsfälle ausreichen. Bei Bedarf können Sie folgende Umgebungsvariablen anpassen:

```env
# In .env
GUACAMOLE_DB_PASSWORD=your_secure_password
GUACAMOLE_URL=http://localhost:8080/guacamole
```

## 🎯 Verwendung

### Remote Desktop öffnen

Nach der Konfiguration erscheinen in der Appliance-Karte neue Buttons:
- 🖥️ **Monitor Icon** - Für VNC Verbindungen
- 💻 **Desktop Icon** - Für RDP Verbindungen

Ein Klick öffnet die Remote Desktop Verbindung in einem neuen Fenster.

### Features

- **PWA Support**: Öffnet als separates Fenster im PWA-Modus
- **Token-basierte Authentifizierung**: Sichere, temporäre Tokens
- **Multi-Protokoll**: VNC und RDP Support
- **Verschlüsselte Passwörter**: Sichere Speicherung von Credentials

## 🔒 Sicherheit

### Token-Mechanismus

- Temporäre Tokens (5 Minuten Gültigkeit)
- Single-Use Tokens
- Automatisches Cleanup

### Verschlüsselung

- Passwörter werden mit AES-256 verschlüsselt
- Gleicher Mechanismus wie SSH-Keys

### Netzwerk

- Verbindungen laufen über Guacamole Proxy
- HTTPS wird empfohlen für Production
- CORS Headers für iFrame Integration

## 🐛 Troubleshooting

### Guacamole startet nicht

```bash
# Logs prüfen
docker-compose -f docker-compose.guacamole.yml logs guacamole

# Neustart versuchen
docker-compose -f docker-compose.guacamole.yml restart
```

### Verbindung schlägt fehl

1. Prüfen Sie die Netzwerkverbindung zum Zielhost
2. Verifizieren Sie Port und Protokoll
3. Testen Sie die Credentials direkt

### Token-Fehler

- Stellen Sie sicher, dass die Backend-Route korrekt registriert ist
- Prüfen Sie die Guacamole-Erreichbarkeit

## 📊 Architektur

```
Browser
   ↓ (PWA Window)
Nginx
   ↓ (Proxy)
Guacamole Web App
   ↓ (WebSocket)
guacd
   ↓ (Native Protocol)
Remote Server (VNC/RDP)
```

## 🎨 Anpassungen

### Custom Guacamole Theme

Erstellen Sie eine Custom Extension für Guacamole:
```java
// Siehe guacamole/DashboardAuthProvider.java
```

### Alternative Ports

In `docker-compose.guacamole.yml`:
```yaml
ports:
  - "8888:8080"  # Ändert Guacamole Port
```

## 📝 API Endpoints

### Token erstellen
```
POST /api/remote/guacamole/token/:applianceId
Authorization: Bearer <jwt-token>

Response:
{
  "token": "...",
  "connectionId": "...",
  "expiresIn": 300
}
```

### Token validieren (intern)
```
GET /api/remote/guacamole/validate/:token

Response:
{
  "valid": true,
  "connectionId": "...",
  "config": {...}
}
```