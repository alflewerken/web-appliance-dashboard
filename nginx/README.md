# Nginx Konfiguration für Web Appliance Dashboard

## Übersicht

Dieses Verzeichnis enthält verschiedene nginx Konfigurationen für das Web Appliance Dashboard:

- **Hauptversion**: Läuft auf Port 9080
- **Mac App Version**: Läuft auf Port 9081

## Konfigurationsdateien

### 1. nginx-main.conf
- Für die Hauptversion des Dashboards
- Port 9080 → Frontend (localhost:3000)
- API-Calls werden an Backend Port 3001 weitergeleitet

### 2. nginx-macapp.conf
- Für die Mac App Version
- Port 9081 → Frontend (localhost:3000)
- API-Calls werden an Backend Port 3002 weitergeleitet

### 3. nginx-combined.conf
- Kombinierte Konfiguration für beide Versionen gleichzeitig
- Beide Ports (9080 und 9081) sind aktiv

### 4. nginx-docker.conf
- Für Docker-Container Deployment
- Standard HTTPS Ports (80/443)

### 5. nginx-app.conf
- Für die Mac App mit statischen Frontend-Dateien
- Verwendet in der gepackten Mac App

## Start-Skripte

### Hauptversion starten:
```bash
./start-nginx-main.sh
```
Zugriff über: http://localhost:9080

### Mac App Version starten:
```bash
./start-nginx-macapp.sh
```
Zugriff über: http://localhost:9081

### Beide Versionen gleichzeitig:
```bash
./start-nginx-combined.sh
```
- Hauptversion: http://localhost:9080
- Mac App: http://localhost:9081

## Nginx Befehle

### Nginx stoppen:
```bash
sudo nginx -s stop
```

### Nginx neu laden:
```bash
sudo nginx -s reload
```

### Nginx Status prüfen:
```bash
ps aux | grep nginx
```

### Nginx Fehler debuggen:
```bash
sudo nginx -t -c /pfad/zur/config.conf
```

## Port-Übersicht

| Version | nginx Port | Frontend Port | Backend Port |
|---------|------------|---------------|--------------|
| Hauptversion | 9080 | 3000 | 3001 |
| Mac App | 9081 | 3000 | 3002 |

## Logs

Nginx Logs befinden sich unter:
- Access Log: `/usr/local/var/log/nginx/access.log`
- Error Log: `/usr/local/var/log/nginx/error.log`

## Fehlerbehebung

1. **Port bereits belegt**: 
   ```bash
   sudo lsof -i :9080
   sudo lsof -i :9081
   ```

2. **Nginx läuft bereits**:
   ```bash
   sudo nginx -s stop
   ```

3. **Konfiguration testen**:
   ```bash
   sudo nginx -t -c /Users/alflewerken/Desktop/web-appliance-dashboard/nginx/nginx-main.conf
   ```
