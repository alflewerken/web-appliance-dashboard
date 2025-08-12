# RustDesk Integration für Web Appliance Dashboard

## Übersicht

Diese Integration ermöglicht schnellen, performanten Remote Desktop Zugriff ohne komplexe Konfiguration. RustDesk bietet deutlich bessere Performance als Guacamole + VNC, besonders auf macOS.

## Features

- ✅ **Automatische Installation**: RustDesk wird automatisch auf Hosts installiert
- ✅ **Keine PIN/Passwort**: Zugriff erfolgt über Dashboard-Authentifizierung
- ✅ **Hohe Performance**: Bis zu 60 FPS möglich (statt 2 FPS bei Guacamole+VNC)
- ✅ **Nahtlose Integration**: Embedded in Dashboard UI
- ✅ **Cross-Platform**: Windows, Linux, macOS Support

## Setup

### 1. RustDesk Services starten

```bash
# Einzeln starten
docker-compose -f docker-compose.rustdesk.yml up -d

# Oder mit Haupt-Services
./start-with-rustdesk.sh
```

### 2. Services prüfen

```bash
docker-compose -f docker-compose.rustdesk.yml ps
```

### 3. Integration aktivieren

Die Integration ist automatisch verfügbar. Beim ersten Remote Desktop Zugriff auf einen Host wird RustDesk automatisch installiert.

## Architektur

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Web Browser    │────▶│  Dashboard UI    │────▶│  Backend API    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                          │
                                ▼                          ▼
                        ┌──────────────────┐      ┌─────────────────┐
                        │ RustDesk Web     │      │ RustDesk Server │
                        │   Client          │◀────▶│  (ID + Relay)   │
                        └──────────────────┘      └─────────────────┘
                                                           │
                                                           ▼
                                                  ┌─────────────────┐
                                                  │   Host mit      │
                                                  │ RustDesk Agent  │
                                                  └─────────────────┘
```

## Komponenten

### Backend
- `backend/modules/streaming/rustdesk-manager.js` - Hauptverwaltung
- `backend/routes/rustdesk.js` - API Endpoints
- Platform-spezifische Installer für Linux/Windows/macOS

### Frontend
- `frontend/src/components/SeamlessRemoteDesktop.jsx` - Hauptkomponente
- `frontend/src/components/RustDeskButton.jsx` - Button für ApplianceCard
- Automatische Installation mit Progress-Anzeige

### Docker
- `docker-compose.rustdesk.yml` - Container-Definitionen
- `nginx/conf.d/rustdesk.conf` - Proxy-Konfiguration

## API Endpoints

- `GET /api/rustdesk/status` - Service Status
- `POST /api/rustdesk/install/:hostId` - Installation starten
- `GET /api/rustdesk/install/:hostId/status` - Installation Status
- `POST /api/rustdesk/session` - Session erstellen
- `DELETE /api/rustdesk/session/:sessionId` - Session beenden

## Ports

- `21116` - ID Server (TCP/UDP)
- `21117` - Relay Server
- `21118` - Web Client HTTP
- `21119` - API Server
- `21120` - WebSocket
- `21121` - Web Interface

## Sicherheit

- Eigener RustDesk Server (kein Cloud-Service)
- Authentifizierung über Dashboard
- Session-basierte Tokens
- Verschlüsselte Verbindungen

## Troubleshooting

### Services starten nicht
```bash
# Logs prüfen
docker-compose -f docker-compose.rustdesk.yml logs

# Ports prüfen
netstat -an | grep 2111
```

### Installation schlägt fehl
- SSH-Verbindung zum Host prüfen
- Platform-Detection in Host-Einstellungen prüfen
- Logs in Backend prüfen

### Performance-Probleme
- Quality-Setting anpassen (fast/balanced/best)
- Netzwerk-Verbindung prüfen
- Hardware-Encoding auf Host prüfen

## Weiterentwicklung

### Geplante Features
- [ ] Persistente Installation-Status in DB
- [ ] Multi-Session Support
- [ ] Custom Branding
- [ ] Recording-Funktion
- [ ] File Transfer UI

### Offene Fragen
1. Soll Guacamole parallel bleiben als Fallback?
2. Wie soll die Rechteverwaltung integriert werden?
3. Sollen Sessions zeitlich begrenzt werden?
4. Brauchen wir Session-Recording für Compliance?
