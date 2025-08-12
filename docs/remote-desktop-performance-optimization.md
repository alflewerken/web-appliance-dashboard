# Remote Desktop Performance Optimierung für Web Appliance Dashboard

## Problem
Guacamole ist für gelegentliche Administration ausreichend, aber zu langsam für produktives Arbeiten.

## Ursachen der schlechten Performance

### 1. Guacamole Architektur
- **HTML5 Canvas Rendering**: Alles wird als Bitmap übertragen
- **HTTP/WebSocket Overhead**: Zusätzliche Latenz durch Protokoll
- **Keine Hardware-Beschleunigung**: Reine Software-Lösung
- **Kompression-Limitierungen**: Balance zwischen CPU-Last und Bandbreite

### 2. Aktuelle Konfiguration
```yaml
guacd:
  environment:
    GUACD_LOG_LEVEL: ${GUACD_LOG_LEVEL:-info}
```
- Keine Performance-Optimierungen konfiguriert
- Standard-Einstellungen für Encoding/Kompression

## Lösungsansätze

### A. Guacamole Optimierung (Kurzfristig)

#### 1. Connection Parameter optimieren
```javascript
// In RemoteDesktopButton.jsx oder Backend
const connectionParams = {
  // Video Encoding
  'enable-wallpaper': 'false',
  'enable-theming': 'false',
  'enable-font-smoothing': 'false',
  'enable-full-window-drag': 'false',
  'enable-desktop-composition': 'false',
  'enable-menu-animations': 'false',
  
  // Performance
  'color-depth': '16',  // Reduzierte Farbtiefe
  'jpeg-quality': '50', // Niedrigere JPEG-Qualität
  'enable-audio': 'false', // Audio deaktivieren wenn nicht benötigt
  
  // Für VNC
  'encodings': 'zrle ultra copyrect hextile zlib corre rre raw',
  
  // Für RDP
  'enable-printing': 'false',
  'enable-drive': 'false',
  'performance-flags': '0x80', // Alle Optimierungen aktivieren
  'glyph-cache-size': '65536',
};
```

#### 2. Guacd Performance Tuning
```yaml
# docker-compose.yml
guacd:
  environment:
    GUACD_LOG_LEVEL: ${GUACD_LOG_LEVEL:-warning}
    # Performance Tuning
    GUACD_MAX_THREADS: 8
    GUACD_BIND_HOST: 0.0.0.0
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 2G
```

#### 3. Nginx Optimierung
```nginx
# nginx/conf.d/remote-desktop.conf
location /guacamole/websocket-tunnel {
    proxy_pass http://guacamole:8080/guacamole/websocket-tunnel;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_buffering off;
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
    
    # Performance
    tcp_nodelay on;
    tcp_nopush off;
}
```

### B. Alternative Lösungen (Mittelfristig)

#### 1. Moonlight Integration
**Vorteile:**
- Hardware-beschleunigte H.264/H.265 Codierung
- Extrem niedrige Latenz (Gaming-tauglich)
- Unterstützt bis zu 4K@120fps

**Implementation:**
```yaml
# docker-compose.yml Addition
moonlight-server:
  image: games-on-whales/sunshine:latest
  container_name: appliance_sunshine
  restart: unless-stopped
  devices:
    - /dev/dri:/dev/dri  # GPU Access
  environment:
    - PUID=1000
    - PGID=1000
    - TZ=Europe/Berlin
    - SUNSHINE_USER=admin
    - SUNSHINE_PASS=admin
  ports:
    - "47984:47984/tcp"
    - "47989:47989/tcp"
    - "48010:48010/tcp"
    - "47998:47998/udp"
    - "47999:47999/udp"
    - "48000:48000/udp"
  volumes:
    - sunshine_config:/config
```

**Frontend Integration:**
```jsx
// components/MoonlightButton.jsx
import React from 'react';
import { Monitor } from 'lucide-react';

const MoonlightButton = ({ appliance }) => {
  const openMoonlight = () => {
    // Moonlight Web Client URL
    const moonlightUrl = `https://moonlight-stream.org/app/?host=${appliance.host}`;
    window.open(moonlightUrl, '_blank');
  };

  return (
    <button onClick={openMoonlight} className="moonlight-btn">
      <Monitor size={20} />
      <span>Moonlight (Gaming)</span>
    </button>
  );
};
```

#### 2. Apache Guacamole + xrdp Optimierung
```bash
# Auf Target-System installieren
sudo apt-get install xrdp xorgxrdp
sudo systemctl enable xrdp

# xrdp.ini optimieren
sudo nano /etc/xrdp/xrdp.ini
# max_bpp=16
# xserverbpp=16
# crypt_level=low
```

#### 3. noVNC als Alternative
```yaml
# docker-compose.yml Addition
novnc:
  image: theasp/novnc:latest
  container_name: appliance_novnc
  environment:
    - DISPLAY_WIDTH=1920
    - DISPLAY_HEIGHT=1080
    - RUN_XTERM=no
  ports:
    - "6080:80"
  networks:
    - ${NETWORK_NAME:-appliance_network}
```

### C. Hybrid-Lösung (Empfohlen)

#### 1. Multi-Protocol Support
```javascript
// services/remoteDesktopService.js
class RemoteDesktopService {
  static getOptimalProtocol(requirements) {
    if (requirements.gaming || requirements.highPerformance) {
      return 'moonlight';
    } else if (requirements.webOnly) {
      return 'guacamole';
    } else if (requirements.linux) {
      return 'novnc';
    }
    return 'guacamole'; // Default
  }

  static async createConnection(appliance, protocol) {
    switch(protocol) {
      case 'moonlight':
        return this.createMoonlightConnection(appliance);
      case 'novnc':
        return this.createNoVNCConnection(appliance);
      default:
        return this.createGuacamoleConnection(appliance);
    }
  }
}
```

#### 2. UI mit Protokoll-Auswahl
```jsx
// components/RemoteDesktopSelector.jsx
const RemoteDesktopSelector = ({ appliance }) => {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <div className="remote-desktop-selector">
      <button onClick={() => setShowOptions(!showOptions)}>
        Remote Desktop ▼
      </button>
      
      {showOptions && (
        <div className="protocol-options">
          <button onClick={() => connectWith('guacamole')}>
            <FileText /> Standard (Guacamole)
          </button>
          <button onClick={() => connectWith('moonlight')}>
            <Zap /> High Performance (Moonlight)
          </button>
          <button onClick={() => connectWith('novnc')}>
            <Monitor /> Linux Desktop (noVNC)
          </button>
        </div>
      )}
    </div>
  );
};
```

### D. Performance Monitoring

```javascript
// utils/performanceMonitor.js
class RemoteDesktopPerformanceMonitor {
  static measureLatency(protocol) {
    const metrics = {
      roundTripTime: 0,
      frameRate: 0,
      bandwidth: 0,
      packetLoss: 0
    };

    // WebRTC Stats API für Moonlight
    if (protocol === 'moonlight') {
      // RTCPeerConnection.getStats()
    }

    return metrics;
  }

  static suggestOptimalSettings(metrics) {
    if (metrics.roundTripTime > 50) {
      return {
        colorDepth: 16,
        jpegQuality: 40,
        enableEffects: false
      };
    }
    // ...
  }
}
```

## Empfehlung

### Phase 1 (Sofort)
1. Guacamole Performance-Parameter optimieren
2. Nginx WebSocket-Konfiguration verbessern
3. Connection-Parameter für reduzierte Qualität

### Phase 2 (1-2 Wochen)
1. Moonlight/Sunshine für High-Performance Nutzer
2. noVNC als lightweight Alternative
3. Protokoll-Auswahl im UI

### Phase 3 (Langfristig)
1. WebRTC-basierte Lösung evaluieren
2. Eigene optimierte Lösung entwickeln
3. GPU-Beschleunigung wo möglich

## Erwartete Verbesserungen
- **Guacamole-Optimierung**: 30-50% bessere Responsivität
- **Moonlight**: 80-90% Native-Performance
- **Hybrid-Lösung**: Beste User Experience für alle Anwendungsfälle
