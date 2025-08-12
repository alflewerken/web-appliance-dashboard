# Web Appliance Dashboard - Backend Proxy Implementation

## 🎯 Overview

The backend proxy implementation allows the dashboard to **ALWAYS** work through the backend proxy - regardless of whether accessed internally or externally. This solves the problem where browsers cannot resolve internal addresses from external networks.

## 🏗️ Architecture

```
Client (Browser/App)
    ↓
Frontend (React)
    ↓
Backend API (/api/services/:id/proxy/*)
    ↓
ProxyEngine (intelligent routing)
    ↓
Internal Services (Proxmox, SSH, VNC, etc.)
```

## 📦 New Components

### Backend

1. **ProxyEngine** (`backend/utils/proxyEngine.js`)
   - HTTP/HTTPS proxy with URL rewriting
   - WebSocket support for Terminal/VNC
   - Content rewriting for HTML/CSS/JS
   - Session management

2. **SessionCache** (`backend/utils/sessionCache.js`)
   - Connection pooling for SSH
   - VNC/RDP session caching
   - Performance optimization
   - Automatic cleanup

3. **ProxyAuth Middleware** (`backend/middleware/proxyAuth.js`)
   - Service-based access control
   - Rate limiting per user/service
   - Complete audit logging
   - WebSocket authentication

4. **Service Routes** (`backend/routes/services.js`)
   - `/api/services/:id/proxy/*` - Web interface proxy
   - `/api/services/:id/terminal` - SSH terminal WebSocket
   - `/api/services/:id/vnc` - VNC/RDP WebSocket
   - `/api/services/:id/files/*` - SFTP file browser
   - `/api/services/:id/download/*` - File download
   - `/api/services/:id/upload/*` - File upload
   - `/api/services/:id/health` - Health check

5. **AuditLog Model** (`backend/models/AuditLog.js`)
   - Logging of all proxy accesses
   - Performance metrics
   - Security audit trail

### Frontend

1. **ProxyService API** (`frontend/src/api/proxyService.js`)
   - Central API for all service accesses
   - WebSocket URL generation
   - File management
   - Health checks

2. **ServiceViewer Component** (`frontend/src/components/ServiceViewer.jsx`)
   - Example component for service display
   - Tab-based navigation
   - iframe integration for web interfaces

## 🚀 Installation

### 1. Install Backend Dependencies

```bash
cd backend
npm install http-proxy-middleware node-fetch@2 uuid
```

### 2. Run Database Migration

```bash
cd backend
npx sequelize-cli db:migrate
```

### 3. Configure Environment Variables

In `backend/.env`:

```env
# Proxy settings
PROXY_TIMEOUT=30000
PROXY_MAX_CONNECTIONS=100
SESSION_CACHE_TTL=1800000
```

### 4. Restart Server

```bash
cd backend
npm run dev
```

## 🔧 Configuration

### Extended Service Configuration

Services now require additional fields:

```javascript
{
    // Basic fields
    id: 1,
    name: "Proxmox VE",
    type: "https",
    
    // Proxy-specific fields
    url: "https://192.168.1.100:8006",
    hostname: "192.168.1.100",
    port: 8006,
    username: "admin",
    password: "encrypted_password",
    
    // For SSH
    privateKey: "ssh_private_key",
    passphrase: "key_passphrase",
    
    // For VNC/RDP
    protocol: "vnc",
    targetHost: "192.168.1.101",
    targetPort: 5900,
    targetUsername: "vnc_user",
    targetPassword: "vnc_password"
}
```

## 🎨 Frontend Integration

### Display Service in iframe

```javascript
import proxyService from '../api/proxyService';

// In React component
<iframe 
    src={proxyService.getProxyUrl(serviceId, '/')}
    style={{ width: '100%', height: '600px', border: 'none' }}
/>
```

### Start Terminal Session

```javascript
const terminalUrl = proxyService.getTerminalWebSocketUrl(serviceId);
// Connect with xterm.js or similar library
```

### Use File Browser

```javascript
// List files
const files = await proxyService.browseFiles(serviceId, '/home');

// Download file
proxyService.downloadFile(serviceId, '/home/user/document.pdf');

// Upload files
await proxyService.uploadFiles(serviceId, '/home/user', fileList);
```

## 🔒 Security

1. **Authentication**: All proxy requests require valid JWT token
2. **Authorization**: Service-based access control via groups
3. **Rate Limiting**: 100 requests/minute per user/service
4. **Audit Logging**: All accesses are logged
5. **Content Security**: URL rewriting prevents direct access

## 📊 Monitoring

### Retrieve Proxy Metrics (Admin)

```javascript
const metrics = await proxyService.getMetrics();
// Shows connection stats, hit rates, etc.
```

### Health Checks

```javascript
const health = await proxyService.checkHealth(serviceId);
// Status: healthy, unhealthy, unreachable
```

## 🐛 Debugging

### Check Backend Logs

```bash
tail -f backend/logs/app.log
```

### Proxy-specific Debug Logs

In `backend/.env`:

```env
LOG_LEVEL=debug
PROXY_DEBUG=true
```

## ⚡ Performance Tips

1. **Connection Pooling**: SSH connections are reused
2. **Session Cache**: VNC/RDP sessions are cached
3. **Content Caching**: Static resources can be cached
4. **Compression**: Enable gzip for large responses

## 🔄 Next Steps

1. **Testing**: Write unit tests for ProxyEngine
2. **Monitoring**: Add Prometheus metrics
3. **Caching**: Implement Redis for session cache
4. **Load Balancing**: Support multiple backend instances

## 📝 Changelog

### Version 1.1.0
- Complete backend proxy implementation
- WebSocket support for Terminal/VNC
- SFTP file management
- Audit logging
- Performance optimizations