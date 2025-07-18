# Terminal-Funktionalität Update

## Übersicht
Das Web Appliance Dashboard Terminal wurde vollständig überarbeitet, um SSH-Verbindungen zu den konfigurierten Hosts zu ermöglichen.

## Änderungen

### 1. Frontend
- **TTYDTerminal-Komponente** wird jetzt überall verwendet (statt XTerminal)
- Terminal lädt über iframe von `/terminal/`
- Vereinfachte Implementierung ohne WebSocket-Komplexität

### 2. Backend
- **Terminal-WebSocket-Handler** in `server.js` eingebunden
- **Security Headers** angepasst:
  - `X-Frame-Options: SAMEORIGIN` (erlaubt iframes von gleicher Origin)
  - CSP frame-ancestors erlaubt localhost

### 3. ttyd Service
- **Custom Docker Image** mit SSH-Client (`ttyd-ssh:latest`)
- **SSH-Wrapper-Script** (`/scripts/ttyd-ssh-wrapper.sh`)
- **Automatische SSH-Verbindung** basierend auf SSH-Config
- **Base-path** von `/terminal` zu `/` geändert

### 4. Nginx
- **Location-Reihenfolge** korrigiert (spezifische Routen vor `/`)
- **Terminal-Proxy** zu `http://ttyd:7681/`

## Verwendung

### Standard-Verbindung
Das Terminal verbindet sich standardmäßig mit dem Host "mac" (konfiguriert in SSH-Config).

### Umgebungsvariablen
- `SSH_HOST`: Ziel-Host (Standard: mac)
- `SSH_USER`: Benutzername (Standard: alflewerken)
- `SSH_PORT`: Port (Standard: 22)

### SSH-Config
Die SSH-Konfiguration wird aus dem `ssh_keys` Volume geladen:
```
Host mac
    HostName 192.168.178.70
    User alflewerken
    Port 22
    IdentityFile /root/.ssh/id_rsa_dashboard
```

## Build-Anweisungen

### ttyd Image bauen
```bash
cd ttyd
docker build -t ttyd-ssh:latest .
```

### Hauptprojekt starten
```bash
docker-compose up -d
```

### Mac-App starten
```bash
cd macos-app
docker-compose -f docker-compose.app.yml up -d
```

## Fehlerbehebung

### Terminal lädt nicht
1. Browser-Cache leeren (Cmd+Shift+R)
2. Nginx-Container neu starten: `docker restart appliance_webserver`
3. Browser-Konsole auf Fehler prüfen

### SSH-Verbindung schlägt fehl
1. SSH-Keys prüfen: `docker exec appliance_ttyd ls -la /root/.ssh/`
2. SSH-Config prüfen: `docker exec appliance_ttyd cat /root/.ssh/config`
3. Logs prüfen: `docker logs appliance_ttyd`

## Zukünftige Erweiterungen
- Dynamische Host-Auswahl basierend auf Service
- Mehrere Terminal-Sessions
- Terminal-Größenanpassung
- Farbschema-Unterstützung
