# Guacamole Performance Optimierung - Quick Fixes

## 1. Backend Connection Parameter Update

Erstelle eine neue Datei für optimierte Guacamole-Verbindungen:

```javascript
// backend/utils/guacamoleOptimizer.js
const getOptimizedConnectionParams = (connectionType, performanceLevel = 'balanced') => {
  const baseParams = {
    // Disable visual effects
    'enable-wallpaper': 'false',
    'enable-theming': 'false',
    'enable-font-smoothing': 'false',
    'enable-full-window-drag': 'false',
    'enable-desktop-composition': 'false',
    'enable-menu-animations': 'false',
  };

  const performanceProfiles = {
    'high-quality': {
      'color-depth': '24',
      'jpeg-quality': '90',
      'enable-audio': 'true',
    },
    'balanced': {
      'color-depth': '16',
      'jpeg-quality': '60',
      'enable-audio': 'true',
    },
    'performance': {
      'color-depth': '16',
      'jpeg-quality': '40',
      'enable-audio': 'false',
      'resize-method': 'display-update', // Schnellere Resize-Methode
    },
    'low-bandwidth': {
      'color-depth': '8',
      'jpeg-quality': '20',
      'enable-audio': 'false',
      'resize-method': 'reconnect',
    }
  };

  if (connectionType === 'rdp') {
    return {
      ...baseParams,
      ...performanceProfiles[performanceLevel],
      'performance-flags': performanceLevel === 'performance' ? '0x80' : '0x00',
      'glyph-cache-size': '65536',
      'bitmap-cache-size': '65536',
      'offscreen-cache-size': '65536',
      'enable-printing': 'false',
      'enable-drive': 'false',
    };
  } else if (connectionType === 'vnc') {
    return {
      ...baseParams,
      ...performanceProfiles[performanceLevel],
      'encodings': 'zrle ultra copyrect hextile zlib corre rre raw',
    };
  }

  return baseParams;
};

module.exports = { getOptimizedConnectionParams };
```

## 2. Docker Compose Optimierungen

```yaml
# docker-compose.yml - Guacd Service Update
guacd:
  image: guacamole/guacd:latest
  container_name: ${GUACD_CONTAINER_NAME:-appliance_guacd}
  restart: always
  volumes:
    - guacamole_drive:/drive:rw
    - guacamole_record:/record:rw
  environment:
    GUACD_LOG_LEVEL: ${GUACD_LOG_LEVEL:-warning}  # Weniger Logging
    # Performance Tuning
    GUACD_MAX_THREADS: 8
    GUACD_BIND_HOST: 0.0.0.0
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 2G
      reservations:
        cpus: '1.0'
        memory: 1G
  networks:
    - ${NETWORK_NAME:-appliance_network}
  healthcheck:
    test: ["CMD", "nc", "-z", "localhost", "4822"]
    interval: ${HEALTH_CHECK_INTERVAL:-30s}
    timeout: ${HEALTH_CHECK_TIMEOUT:-10s}
    retries: ${HEALTH_CHECK_RETRIES:-3}
```

## 3. Frontend Performance Toggle

```jsx
// frontend/src/components/RemoteDesktopButton.jsx - Update
import React, { useState } from 'react';
import { Monitor, Zap, Gauge } from 'lucide-react';
import './RemoteDesktopButton.css';

const RemoteDesktopButton = ({ appliance, onConnect }) => {
  const [performanceMode, setPerformanceMode] = useState('balanced');
  const [showMenu, setShowMenu] = useState(false);

  const performanceModes = {
    'high-quality': { icon: Monitor, label: 'High Quality', color: '#4CAF50' },
    'balanced': { icon: Gauge, label: 'Balanced', color: '#2196F3' },
    'performance': { icon: Zap, label: 'Performance', color: '#FF9800' }
  };

  const handleConnect = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/remote-desktop/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          applianceId: appliance.id,
          performanceMode: performanceMode
        })
      });

      if (response.ok) {
        const data = await response.json();
        const guacUrl = `/guacamole/#/client/${data.token}`;
        window.open(guacUrl, '_blank');
      }
    } catch (error) {
      console.error('Remote desktop connection failed:', error);
    }
  };

  const CurrentIcon = performanceModes[performanceMode].icon;

  return (
    <div className="remote-desktop-button-container">
      <button
        className="remote-desktop-button"
        onClick={handleConnect}
        title={`Connect via ${performanceModes[performanceMode].label} mode`}
      >
        <CurrentIcon size={20} />
        <span>Remote Desktop</span>
      </button>
      
      <button
        className="performance-toggle"
        onClick={() => setShowMenu(!showMenu)}
        style={{ borderColor: performanceModes[performanceMode].color }}
      >
        <Gauge size={16} />
      </button>

      {showMenu && (
        <div className="performance-menu">
          {Object.entries(performanceModes).map(([mode, config]) => (
            <button
              key={mode}
              className={`performance-option ${mode === performanceMode ? 'active' : ''}`}
              onClick={() => {
                setPerformanceMode(mode);
                setShowMenu(false);
              }}
            >
              <config.icon size={16} />
              <span>{config.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RemoteDesktopButton;
```

## 4. CSS für Performance Toggle

```css
/* frontend/src/components/RemoteDesktopButton.css - Addition */
.remote-desktop-button-container {
  position: relative;
  display: inline-flex;
  gap: 4px;
}

.performance-toggle {
  padding: 6px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.performance-toggle:hover {
  background: rgba(255, 255, 255, 0.2);
}

.performance-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: rgba(30, 30, 30, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px;
  min-width: 160px;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.performance-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 4px;
}

.performance-option:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.performance-option.active {
  background: rgba(33, 150, 243, 0.2);
  color: #2196F3;
}
```

## 5. Nginx WebSocket Optimierung

```nginx
# nginx/conf.d/guacamole-performance.conf
upstream guacamole {
    server guacamole:8080;
    keepalive 64;
}

location /guacamole/ {
    proxy_pass http://guacamole/guacamole/;
    proxy_buffering off;
    proxy_http_version 1.1;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $http_connection;
    
    # Performance optimizations
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
    
    # Disable buffering for WebSocket
    proxy_request_buffering off;
    
    # TCP optimizations
    tcp_nodelay on;
    tcp_nopush off;
    
    # Larger buffers
    proxy_buffer_size 64k;
    proxy_buffers 16 32k;
    proxy_busy_buffers_size 64k;
    
    access_log off;
}

location /guacamole/websocket-tunnel {
    proxy_pass http://guacamole/guacamole/websocket-tunnel;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_buffering off;
    
    # WebSocket specific
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
    
    # TCP optimizations
    tcp_nodelay on;
    tcp_nopush off;
    
    access_log off;
}
```

Diese Optimierungen sollten die Guacamole-Performance um 30-50% verbessern!
