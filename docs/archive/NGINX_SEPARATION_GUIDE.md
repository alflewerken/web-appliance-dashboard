# Nginx Konfiguration für getrennte Deployments

## Übersicht

Das Web Appliance Dashboard läuft in zwei separaten Docker-Umgebungen:

1. **Hauptprojekt**: Port 9080 (nginx) → Backend Port 3001
2. **Mac App Version**: Port 9081 (nginx) → Backend Port 3002

## Docker Container

### Hauptprojekt
- **Container**: `appliance_webserver`
- **Port**: 9080 (HTTP), 9443 (HTTPS)
- **Config**: `nginx/nginx-main-docker-http.conf`
- **Backend**: `appliance_backend` (Port 3001)
- **Datenbank**: `appliance_db` (Port 3306)

### Mac App Version
- **Container**: `wad_app_webserver`
- **Port**: 9081 (HTTP), 9444 (HTTPS)
- **Config**: `nginx/nginx-macapp-docker.conf`
- **Backend**: `wad_app_backend` (Port 3002)
- **Datenbank**: `wad_app_db` (Port 3307)

## Nginx Konfigurationsdateien

### Für Docker Container:
- `nginx-main-docker-http.conf` - Hauptprojekt (HTTP only)
- `nginx-main-docker.conf` - Hauptprojekt (mit HTTPS)
- `nginx-macapp-docker.conf` - Mac App Version
- `nginx-docker.conf` - Original (veraltet)

### Für lokale Entwicklung (ohne Docker):
- `nginx-main.conf` - Hauptprojekt lokal
- `nginx-macapp.conf` - Mac App lokal
- `nginx-combined.conf` - Beide gleichzeitig lokal

## Container Management

### Hauptprojekt starten:
```bash
cd /Users/alflewerken/Desktop/web-appliance-dashboard
docker-compose up -d
```

### Mac App starten:
```bash
cd /Users/alflewerken/Desktop/web-appliance-dashboard/macos-app
docker-compose -f docker-compose.app.yml up -d
```

### Container Status prüfen:
```bash
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
```

### Container Logs anzeigen:
```bash
# Hauptprojekt
docker logs appliance_webserver -f
docker logs appliance_backend -f

# Mac App
docker logs wad_app_webserver -f
docker logs wad_app_backend -f
```

### Container neu starten:
```bash
# Hauptprojekt
docker-compose restart webserver

# Mac App
cd macos-app && docker-compose -f docker-compose.app.yml restart webserver
```

## Zugriff

- **Hauptprojekt**: http://localhost:9080
- **Mac App**: http://localhost:9081

## Fehlerbehebung

### Container startet nicht:
1. Logs prüfen: `docker logs <container-name>`
2. Konfiguration validieren: `docker exec <container-name> nginx -t`
3. Port-Konflikte prüfen: `lsof -i :9080` oder `lsof -i :9081`

### Änderungen werden nicht übernommen:
1. Container komplett neu erstellen:
   ```bash
   docker-compose down webserver
   docker-compose up -d webserver
   ```

### SSL-Zertifikat Fehler:
- Verwenden Sie die HTTP-only Konfiguration (`nginx-main-docker-http.conf`)
- Oder erstellen Sie SSL-Zertifikate im `nginx/ssl/` Verzeichnis

## Entwicklungshinweise

1. Frontend Build muss vor Container-Start erfolgen:
   ```bash
   cd frontend && npm run build
   ```

2. Änderungen an nginx-Konfiguration erfordern Container-Neustart

3. Beide Versionen verwenden das gleiche Frontend-Build aus `/frontend/build`

4. Die Container-Namen müssen eindeutig sein, daher das Präfix:
   - Hauptprojekt: `appliance_*`
   - Mac App: `wad_app_*`
