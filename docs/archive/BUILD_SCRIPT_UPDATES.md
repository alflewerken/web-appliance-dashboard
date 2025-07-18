# Build Script Updates für getrennte nginx Deployments

## Datum: 13. Juli 2025

## Zusammenfassung
Die Build-Skripte wurden aktualisiert, um mit den getrennten nginx-Konfigurationen für das Hauptprojekt und die Mac App korrekt zu funktionieren.

## Änderungen

### 1. Hauptprojekt Build Script (`scripts/build.sh`)
- **Port-Korrektur**: Dashboard-URL zeigt jetzt korrekt auf Port 9080 statt Port 80
- **Konfigurationshinweis**: Zeigt verwendete nginx-Konfiguration an
- **Container-Info**: Erwähnt den Container-Namen und die Ports

### 2. Mac App Build Script (`macos-app/scripts/build.sh`)
- **Container-Präfix**: Korrigiert zu `wad_app_*`
- **Konfigurationshinweis**: Erwähnt die spezifische nginx-Konfiguration

### 3. Neue Hilfsskripte

#### `scripts/verify-nginx.sh`
Überprüft die nginx-Konfiguration:
- Existenz der Konfigurationsdateien
- Korrekte Referenzen in docker-compose Dateien
- Container-Status
- Port-Erreichbarkeit
- API-Health-Checks

#### `scripts/update-nginx-configs.sh`
Aktualisiert bestehende Konfigurationen:
- Ersetzt alte nginx-Konfigurationsreferenzen
- Erstellt Backups der alten Dateien
- Zeigt aktuellen Status

## nginx Konfigurationen

### Hauptprojekt
- **Datei**: `nginx/nginx-main-docker-http.conf`
- **Container**: `appliance_webserver`
- **Port**: 9080 (HTTP), 9443 (HTTPS)
- **Backend**: Port 3001

### Mac App
- **Datei**: `nginx/nginx-macapp-docker.conf`
- **Container**: `wad_app_webserver`
- **Port**: 9081 (HTTP), 9444 (HTTPS)
- **Backend**: Port 3002

## Verwendung

### Build ausführen
```bash
# Hauptprojekt
./scripts/build.sh

# Mac App
cd macos-app && ./scripts/build.sh
```

### Konfiguration verifizieren
```bash
./scripts/verify-nginx.sh
```

### Konfigurationen aktualisieren
```bash
./scripts/update-nginx-configs.sh
```

## Port-Übersicht

| Komponente | Hauptprojekt | Mac App |
|------------|--------------|---------|
| nginx (HTTP) | 9080 | 9081 |
| nginx (HTTPS) | 9443 | 9444 |
| Backend API | 3001 | 3002 |
| Datenbank | 3306 | 3307 |
| Terminal (ttyd) | 7681 | 7682 |

## Wichtige Hinweise

1. **Frontend Build**: Beide Versionen nutzen das gleiche Frontend-Build aus `/frontend/build`
2. **Container-Namen**: Müssen eindeutig sein (appliance_* vs wad_app_*)
3. **SSL-Zertifikate**: Hauptprojekt nutzt HTTP-only Konfiguration, Mac App kann HTTPS nutzen
4. **Unabhängigkeit**: Beide Versionen können parallel laufen ohne Konflikte

## Fehlerbehebung

### Container startet nicht
1. Logs prüfen: `docker logs <container-name>`
2. Verifikationsskript ausführen: `./scripts/verify-nginx.sh`
3. Container neu erstellen: `docker-compose down && docker-compose up -d`

### Port-Konflikte
1. Ports prüfen: `lsof -i :9080` oder `lsof -i :9081`
2. Andere Prozesse beenden oder Ports in `.env` anpassen

### Build-Fehler
1. Frontend-Build prüfen: `cd frontend && npm run build`
2. Docker-Images neu bauen: `docker-compose build --no-cache`
