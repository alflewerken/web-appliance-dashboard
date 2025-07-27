# Remote Desktop Setup Guide

## Version 1.1.0

Dieses Dokument beschreibt die Einrichtung und Konfiguration der Remote Desktop Funktionalität über Apache Guacamole im Web Appliance Dashboard.

## 📋 Inhaltsverzeichnis

- [Übersicht](#übersicht)
- [Architektur](#architektur)
- [Installation](#installation)
- [Konfiguration](#konfiguration)
- [Protokolle](#protokolle)
- [Sicherheit](#sicherheit)
- [Troubleshooting](#troubleshooting)
- [Performance Optimierung](#performance-optimierung)

## 🎯 Übersicht

Apache Guacamole ist ein clientless Remote Desktop Gateway, das VNC, RDP und SSH Verbindungen über einen Webbrowser ermöglicht. In Version 1.1.0 wurde Guacamole vollständig in das Web Appliance Dashboard integriert.

### Hauptfeatures

- **Protokoll-Support**: VNC, RDP, SSH
- **Browser-basiert**: Keine Client-Software erforderlich
- **Token-Authentifizierung**: Sichere, temporäre Zugriffe
- **Multi-User**: Gleichzeitige Verbindungen möglich
- **Verschlüsselung**: Ende-zu-Ende verschlüsselte Verbindungen

## 🏗️ Architektur

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Browser   │────▶│    Guacamole    │────▶│     guacd       │
│                 │     │   (Web Client)  │     │  (Proxy Daemon) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
                        ┌─────────────────────────────────┼─────────────┐
                        │                                 │             │
                  ┌─────▼─────┐                   ┌──────▼────┐ ┌──────▼────┐
                  │    VNC     │                   │    RDP    │ │    SSH    │
                  │  Servers   │                   │   Hosts   │ │   Hosts   │
                  └───────────┘                   └───────────┘ └───────────┘
```

### Container-Struktur

- **guacamole**: Web-Frontend (Tomcat-basiert)
- **guacd**: Proxy-Daemon für Protokoll-Übersetzung
- **guacamole-postgres**: Konfigurations-Datenbank

## 📦 Installation

### 1. Standard-Installation (mit Build-Script)

```bash
# Vollständige Installation mit Remote Desktop
./scripts/build.sh --nocache
```

### 2. Nachträgliche Installation

```bash
# Remote Desktop zu bestehender Installation hinzufügen
./scripts/update-remote-desktop.sh
```

### 3. Manuelle Installation

```bash
# Docker Services starten
docker compose up -d guacamole-postgres guacd guacamole

# Datenbank initialisieren
docker exec -i guacamole-postgres psql -U guacamole_user guacamole_db < guacamole/initdb.sql

# Nginx Konfiguration neu laden
docker exec appliance_nginx nginx -s reload
```

## ⚙️ Konfiguration

### Umgebungsvariablen

#### Backend (.env)

```env
# Guacamole Database
GUACAMOLE_DB_NAME=guacamole_db
GUACAMOLE_DB_USER=guacamole_user
GUACAMOLE_DB_PASSWORD=your_secure_password
GUACAMOLE_DB_HOST=guacamole-postgres
GUACAMOLE_DB_PORT=5432

# Guacamole Settings
GUACAMOLE_HOME=/etc/guacamole
POSTGRES_INITDB_ARGS=--auth=scram-sha-256
```

#### Docker Compose Konfiguration

```yaml
guacamole:
  image: guacamole/guacamole:1.5.5
  environment:
    GUACD_HOSTNAME: guacd
    POSTGRES_DATABASE: ${GUACAMOLE_DB_NAME}
    POSTGRES_USER: ${GUACAMOLE_DB_USER}
    POSTGRES_PASSWORD: ${GUACAMOLE_DB_PASSWORD}
    POSTGRES_HOSTNAME: guacamole-postgres
  depends_on:
    - guacd
    - guacamole-postgres
  networks:
    - appliance_network

guacd:
  image: guacamole/guacd:1.5.5
  networks:
    - appliance_network

guacamole-postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: ${GUACAMOLE_DB_NAME}
    POSTGRES_USER: ${GUACAMOLE_DB_USER}
    POSTGRES_PASSWORD: ${GUACAMOLE_DB_PASSWORD}
  volumes:
    - postgres_data:/var/lib/postgresql/data
  networks:
    - appliance_network
```

### Nginx Proxy Konfiguration

```nginx
# Guacamole Proxy
location /guacamole/ {
    proxy_pass http://guacamole:8080/guacamole/;
    proxy_buffering off;
    proxy_http_version 1.1;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $http_connection;
    proxy_cookie_path /guacamole/ /guacamole/;
    access_log off;
    
    # WebSocket Support
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400;
}
```

## 🔌 Protokolle

### VNC (Virtual Network Computing)

#### Konfiguration in der Appliance

```javascript
{
  "remoteDesktopEnabled": true,
  "remoteProtocol": "vnc",
  "remoteHost": "192.168.1.100",
  "remotePort": 5900,
  "remotePassword": "vnc_password" // wird verschlüsselt gespeichert
}
```

#### VNC Server Setup (Linux)

```bash
# TigerVNC Installation
sudo apt-get install tigervnc-standalone-server

# VNC Server starten
vncserver :1 -geometry 1920x1080 -depth 24

# Passwort setzen
vncpasswd
```

#### Empfohlene VNC Server

- **Linux**: TigerVNC, TightVNC, x11vnc
- **Windows**: RealVNC, TightVNC, UltraVNC
- **macOS**: Integrierte Bildschirmfreigabe

### RDP (Remote Desktop Protocol)

#### Konfiguration in der Appliance

```javascript
{
  "remoteDesktopEnabled": true,
  "remoteProtocol": "rdp",
  "remoteHost": "192.168.1.200",
  "remotePort": 3389,
  "remoteUsername": "Administrator",
  "remotePassword": "windows_password", // wird verschlüsselt gespeichert
  "remoteDomain": "WORKGROUP" // optional
}
```

#### Windows RDP Aktivierung

```powershell
# RDP aktivieren
Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -name "fDenyTSConnections" -value 0

# Firewall-Regel hinzufügen
Enable-NetFirewallRule -DisplayGroup "Remote Desktop"

# NLA (Network Level Authentication) optional deaktivieren
Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -name "UserAuthentication" -value 0
```

### SSH (Secure Shell)

SSH-Verbindungen werden primär über das integrierte Web-Terminal (ttyd) gehandhabt, können aber auch über Guacamole erfolgen.

## 🔒 Sicherheit

### Token-basierte Authentifizierung

1. **Token-Generierung**: Bei jeder Remote Desktop Anfrage wird ein temporärer Token erstellt
2. **Gültigkeit**: Tokens sind 5 Minuten gültig
3. **Single-Use**: Jeder Token kann nur einmal verwendet werden
4. **Verschlüsselung**: Tokens werden mit JWT signiert

```javascript
// Token-Generierung im Backend
const token = jwt.sign({
  username: `user_${userId}`,
  connectionId: connectionId,
  exp: Math.floor(Date.now() / 1000) + 300 // 5 Minuten
}, process.env.JWT_SECRET);
```

### Passwort-Verschlüsselung

Alle Remote Desktop Passwörter werden mit AES-256 verschlüsselt:

```javascript
// Verschlüsselung
const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
const encrypted = cipher.update(password, 'utf8', 'hex') + cipher.final('hex');

// Entschlüsselung
const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
const decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
```

### Best Practices

1. **Verwenden Sie starke Passwörter** für alle Remote-Verbindungen
2. **Aktivieren Sie Verschlüsselung** auf VNC/RDP Servern
3. **Begrenzen Sie Netzwerkzugriff** mit Firewalls
4. **Überwachen Sie Zugriffe** über Audit Logs
5. **Rotieren Sie Credentials** regelmäßig

## 🔧 Troubleshooting

### Häufige Probleme

#### 1. Verbindung schlägt fehl

```bash
# Guacamole Logs prüfen
docker logs appliance_guacamole

# Guacd Logs prüfen
docker logs appliance_guacd

# Netzwerk-Konnektivität testen
docker exec appliance_backend nc -zv <remote_host> <remote_port>
```

#### 2. "Invalid Token" Fehler

- Token ist abgelaufen (>5 Minuten)
- Token wurde bereits verwendet
- JWT_SECRET stimmt nicht überein

```bash
# Token-Generierung testen
docker exec appliance_backend node utils/guacamole/test-token.js
```

#### 3. Schwarzer Bildschirm bei VNC

- VNC Server läuft nicht
- Falscher Port konfiguriert
- Firewall blockiert Verbindung
- Desktop-Umgebung nicht gestartet

```bash
# VNC Server Status prüfen
systemctl status vncserver@:1

# X11 Display prüfen
export DISPLAY=:1
xhost +
```

#### 4. RDP Authentication Fehler

- Network Level Authentication (NLA) aktiviert
- Falscher Benutzername/Domäne
- Passwort enthält Sonderzeichen

```powershell
# NLA deaktivieren (Windows)
Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -name "UserAuthentication" -value 0
```

### Debug-Modus

```bash
# Guacd im Debug-Modus starten
docker run --rm -it --network appliance_network guacamole/guacd:1.5.5 /usr/local/sbin/guacd -L debug -f

# Verbose Logging aktivieren
docker exec appliance_guacamole sed -i 's/INFO/DEBUG/g' /usr/local/tomcat/conf/logging.properties
docker restart appliance_guacamole
```

## ⚡ Performance Optimierung

### 1. Verbindungsparameter

```javascript
// Optimale VNC Einstellungen
{
  "color-depth": 16,          // Reduzierte Farbtiefe
  "compression": 9,           // Maximale Kompression
  "quality": 6,              // Mittlere Qualität
  "disable-audio": true,      // Audio deaktivieren
  "enable-wallpaper": false   // Desktop-Hintergrund deaktivieren
}

// Optimale RDP Einstellungen
{
  "color-depth": 16,
  "disable-audio": true,
  "disable-wallpaper": true,
  "disable-theming": true,
  "disable-font-smoothing": true,
  "performance-flags": "0x00000001 | 0x00000002 | 0x00000004"
}
```

### 2. Netzwerk-Optimierung

```bash
# TCP Tuning
echo "net.core.rmem_max = 134217728" >> /etc/sysctl.conf
echo "net.core.wmem_max = 134217728" >> /etc/sysctl.conf
echo "net.ipv4.tcp_rmem = 4096 87380 134217728" >> /etc/sysctl.conf
echo "net.ipv4.tcp_wmem = 4096 65536 134217728" >> /etc/sysctl.conf
sysctl -p
```

### 3. Container Resources

```yaml
# docker-compose.override.yml
services:
  guacd:
    mem_limit: 2g
    cpus: '2.0'
    
  guacamole:
    mem_limit: 1g
    cpus: '1.0'
    environment:
      JAVA_OPTS: '-Xmx768m -Xms256m'
```

### 4. Caching

```nginx
# Nginx Cache für statische Guacamole Assets
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## 📊 Monitoring

### Metriken sammeln

```bash
# Aktive Verbindungen
docker exec guacamole-postgres psql -U guacamole_user -d guacamole_db -c "SELECT COUNT(*) FROM guacamole_connection WHERE connection_id IN (SELECT connection_id FROM guacamole_connection_history WHERE end_date IS NULL);"

# Verbindungshistorie
docker exec guacamole-postgres psql -U guacamole_user -d guacamole_db -c "SELECT username, start_date, end_date, remote_host FROM guacamole_connection_history ORDER BY start_date DESC LIMIT 10;"

# Resource Usage
docker stats guacd guacamole guacamole-postgres
```

### Health Checks

```yaml
# docker-compose.yml
guacamole:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8080/guacamole/"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 60s

guacd:
  healthcheck:
    test: ["CMD", "nc", "-z", "localhost", "4822"]
    interval: 30s
    timeout: 5s
    retries: 3
```

## 🔄 Backup & Restore

### Guacamole Konfiguration sichern

```bash
# Backup erstellen
docker exec guacamole-postgres pg_dump -U guacamole_user guacamole_db > guacamole_backup_$(date +%Y%m%d).sql

# Backup wiederherstellen
docker exec -i guacamole-postgres psql -U guacamole_user guacamole_db < guacamole_backup.sql
```

### Connection Settings exportieren

```bash
# Export als JSON
docker exec appliance_backend node utils/backup/export-remote-connections.js > remote_connections.json

# Import
docker exec appliance_backend node utils/backup/import-remote-connections.js < remote_connections.json
```

## 📚 Weiterführende Ressourcen

- [Apache Guacamole Dokumentation](https://guacamole.apache.org/doc/gug/)
- [VNC Security Best Practices](https://www.realvnc.com/en/connect/docs/security.html)
- [RDP Security Guide](https://docs.microsoft.com/en-us/windows-server/remote/remote-desktop-services/rds-security)
- [Web Appliance Dashboard Wiki](https://github.com/alflewerken/web-appliance-dashboard/wiki)

---

**Version:** 1.1.0 | **Letzte Aktualisierung:** 24. Juli 2025