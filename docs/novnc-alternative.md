# Alternative: noVNC Integration

## Was ist noVNC?
noVNC ist ein HTML5 VNC Client, der direkt im Browser läuft ohne Plugins.

## Vorteile gegenüber Guacamole:
- Einfachere Integration
- Keine separate Authentifizierung nötig
- Direkter Zugriff vom Dashboard
- Leichtgewichtiger

## Installation:

1. **noVNC Container hinzufügen** (in docker-compose.yml):

```yaml
  novnc:
    image: theasp/novnc:latest
    container_name: appliance_novnc
    restart: always
    ports:
      - "6080:80"
    environment:
      # VNC connection parameters can be passed via URL
      RUN_XTERM: "no"
      RUN_FLUXBOX: "no"
    networks:
      - appliance_network
```

2. **Frontend Integration**:

Die RemoteDesktopButton Komponente kann dann direkt noVNC URLs generieren:

```javascript
const novncUrl = `http://localhost:6080/vnc.html?host=${appliance.remote_host}&port=${appliance.remote_port}&encrypt=0&true_color=1&password=${encodeURIComponent(password)}`;
```

## Verwendung:

1. noVNC Container starten
2. VNC Button im Dashboard klickt
3. Direkter Zugriff ohne zusätzliche Authentifizierung

Dies wäre eine simplere Alternative zu Guacamole.
