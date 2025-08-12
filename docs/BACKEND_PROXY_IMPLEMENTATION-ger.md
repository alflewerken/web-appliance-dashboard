# Web Appliance Dashboard - Backend-Proxy-Implementierung

## 🎯 Übersicht

Die Backend-Proxy-Implementierung ermöglicht es, dass das Dashboard **IMMER** über den Backend-Proxy arbeitet - egal ob intern oder extern zugegriffen wird. Dies löst das Problem, dass Browser von extern keine internen Adressen auflösen können.

## 🏗️ Architektur

```
Client (Browser/App)
    ↓
Frontend (React)
    ↓
Backend API (/api/services/:id/proxy/*)
    ↓
ProxyEngine (intelligentes Routing)
    ↓
Interne Services (Proxmox, SSH, VNC, etc.)
```

## 📦 Neue Komponenten

### Backend

1. **ProxyEngine** (`backend/utils/proxyEngine.js`)
   - HTTP/HTTPS Proxy mit URL-Rewriting
   - WebSocket-Support für Terminal/VNC
   - Content-Rewriting für HTML/CSS/JS
   - Session-Management

2. **SessionCache** (`backend/utils/sessionCache.js`)
   - Connection-Pooling für SSH
   - VNC/RDP Session-Caching
   - Performance-Optimierung
   - Automatische Cleanup

3. **ProxyAuth Middleware** (`backend/middleware/proxyAuth.js`)
   - Service-basierte Zugriffskontrolle
   - Rate-Limiting pro User/Service
   - Vollständiges Audit-Logging
   - WebSocket-Authentifizierung

4. **Service Routes** (`backend/routes/services.js`)
   - `/api/services/:id/proxy/*` - Web-Interface Proxy
   - `/api/services/:id/terminal` - SSH Terminal WebSocket
   - `/api/services/:id/vnc` - VNC/RDP WebSocket
   - `/api/services/:id/files/*` - SFTP File Browser
   - `/api/services/:id/download/*` - File Download
   - `/api/services/:id/upload/*` - File Upload
   - `/api/services/:id/health` - Health Check

5. **AuditLog Model** (`backend/models/AuditLog.js`)
   - Protokollierung aller Proxy-Zugriffe
   - Performance-Metriken
   - Security-Audit-Trail

### Frontend

1. **ProxyService API** (`frontend/src/api/proxyService.js`)
   - Zentrale API für alle Service-Zugriffe
   - WebSocket-URL-Generation
   - File-Management
   - Health-Checks

2. **ServiceViewer Component** (`frontend/src/components/ServiceViewer.jsx`)
   - Beispiel-Komponente für Service-Anzeige
   - Tab-basierte Navigation
   - iframe-Integration für Web-Interfaces

## 🚀 Installation

### 1. Backend Dependencies installieren

```bash
cd backend
npm install http-proxy-middleware node-fetch@2 uuid
```

### 2. Datenbank-Migration ausführen

```bash
cd backend
npx sequelize-cli db:migrate
```

### 3. Environment-Variablen anpassen

In `backend/.env`:

```env
# Proxy-Einstellungen
PROXY_TIMEOUT=30000
PROXY_MAX_CONNECTIONS=100
SESSION_CACHE_TTL=1800000
```

### 4. Server neustarten

```bash
cd backend
npm run dev
```

## 🔧 Konfiguration

### Service-Konfiguration erweitern

Services benötigen jetzt zusätzliche Felder:

```javascript
{
    // Basis-Felder
    id: 1,
    name: "Proxmox VE",
    type: "https",
    
    // Proxy-spezifische Felder
    url: "https://192.168.1.100:8006",
    hostname: "192.168.1.100",
    port: 8006,
    username: "admin",
    password: "encrypted_password",
    
    // Für SSH
    privateKey: "ssh_private_key",
    passphrase: "key_passphrase",
    
    // Für VNC/RDP
    protocol: "vnc",
    targetHost: "192.168.1.101",
    targetPort: 5900,
    targetUsername: "vnc_user",
    targetPassword: "vnc_password"
}
```

## 🎨 Frontend-Integration

### Service im iframe anzeigen

```javascript
import proxyService from '../api/proxyService';

// In React-Komponente
<iframe 
    src={proxyService.getProxyUrl(serviceId, '/')}
    style={{ width: '100%', height: '600px', border: 'none' }}
/>
```

### Terminal-Session starten

```javascript
const terminalUrl = proxyService.getTerminalWebSocketUrl(serviceId);
// Mit xterm.js oder ähnlicher Library verbinden
```

### File-Browser nutzen

```javascript
// Dateien auflisten
const files = await proxyService.browseFiles(serviceId, '/home');

// Datei herunterladen
proxyService.downloadFile(serviceId, '/home/user/document.pdf');

// Dateien hochladen
await proxyService.uploadFiles(serviceId, '/home/user', fileList);
```

## 🔒 Sicherheit

1. **Authentifizierung**: Alle Proxy-Anfragen erfordern gültiges JWT-Token
2. **Autorisierung**: Service-basierte Zugriffskontrolle über Gruppen
3. **Rate-Limiting**: 100 Requests/Minute pro User/Service
4. **Audit-Logging**: Alle Zugriffe werden protokolliert
5. **Content-Security**: URL-Rewriting verhindert direkten Zugriff

## 📊 Monitoring

### Proxy-Metriken abrufen (Admin)

```javascript
const metrics = await proxyService.getMetrics();
// Zeigt Connection-Stats, Hit-Rates, etc.
```

### Health-Checks

```javascript
const health = await proxyService.checkHealth(serviceId);
// Status: healthy, unhealthy, unreachable
```

## 🐛 Debugging

### Backend-Logs prüfen

```bash
tail -f backend/logs/app.log
```

### Proxy-spezifische Debug-Logs

In `backend/.env`:

```env
LOG_LEVEL=debug
PROXY_DEBUG=true
```

## ⚡ Performance-Tipps

1. **Connection-Pooling**: SSH-Verbindungen werden wiederverwendet
2. **Session-Cache**: VNC/RDP-Sessions werden gecacht
3. **Content-Caching**: Statische Ressourcen können gecacht werden
4. **Compression**: Gzip für große Responses aktivieren

## 🔄 Nächste Schritte

1. **Testing**: Unit-Tests für ProxyEngine schreiben
2. **Monitoring**: Prometheus-Metriken hinzufügen
3. **Caching**: Redis für Session-Cache implementieren
4. **Load-Balancing**: Multiple Backend-Instanzen unterstützen

## 📝 Changelog

### Version 1.1.0
- Vollständige Backend-Proxy-Implementierung
- WebSocket-Support für Terminal/VNC
- SFTP File-Management
- Audit-Logging
- Performance-Optimierungen