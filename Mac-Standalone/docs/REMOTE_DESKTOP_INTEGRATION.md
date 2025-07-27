# Remote Desktop Integration für macOS App

## Übersicht

Die Remote Desktop Integration wurde erfolgreich in die macOS Electron App implementiert. Die Integration ermöglicht es, VNC und RDP Verbindungen direkt aus der App heraus in nativen Electron-Fenstern zu öffnen.

## Implementierte Features

### 1. Remote Desktop Handler (`remoteDesktopHandler.js`)
- Verwaltet Remote Desktop Fenster für jede Appliance
- Verhindert doppelte Fenster für dieselbe Appliance
- Automatisches Cleanup beim Schließen der Fenster
- Support für VNC und RDP über Guacamole

### 2. IPC Integration
Neue IPC Handler in `main.js`:
- `remoteDesktop:open` - Öffnet ein Remote Desktop Fenster
- `remoteDesktop:close` - Schließt ein spezifisches Fenster
- `remoteDesktop:closeAll` - Schließt alle Remote Desktop Fenster
- `remoteDesktop:getOpenCount` - Gibt die Anzahl offener Fenster zurück

### 3. Preload Script (`preload.js`)
Exponiert sichere APIs für:
- Docker Management
- Remote Desktop Kontrolle
- App-spezifische Funktionen

### 4. Frontend Integration
Die `RemoteDesktopButton.jsx` Komponente erkennt automatisch:
- **Electron App**: Nutzt native Fenster über `window.electronAPI`
- **Web Browser**: Nutzt den Standard Window Manager

## Verwendung

### Remote Desktop öffnen
```javascript
// In React Komponenten
if (window.electronAPI && window.electronAPI.remoteDesktop) {
  const result = await window.electronAPI.remoteDesktop.open({
    applianceId: 'app-123',
    applianceName: 'Server 1',
    protocol: 'vnc',
    guacamoleUrl: 'http://localhost:8080/guacamole',
    token: 'auth-token'
  });
}
```

### Fenster schließen
```javascript
// Einzelnes Fenster schließen
await window.electronAPI.remoteDesktop.close('app-123');

// Alle Fenster schließen
await window.electronAPI.remoteDesktop.closeAll();
```

## Sicherheit

- Context Isolation aktiviert
- Keine direkte Node.js Integration im Renderer
- Alle APIs über sichere IPC Kommunikation
- Token-basierte Authentifizierung für Guacamole

## Deployment

1. Stelle sicher, dass Guacamole läuft und erreichbar ist
2. Konfiguriere die `GUACAMOLE_URL` in der Frontend-Config
3. Backend muss Guacamole Token generieren können

## Weitere Optimierungen

### Mögliche Erweiterungen:
1. **Window State Management**: Fensterposition und -größe speichern
2. **Multi-Monitor Support**: Fenster auf verschiedenen Monitoren öffnen
3. **Keyboard Shortcuts**: Globale Shortcuts für Remote Desktop
4. **Session Recording**: Aufzeichnung von Remote Sessions
5. **Performance Monitoring**: Überwachung der Verbindungsqualität

## Troubleshooting

### Fenster öffnet sich nicht
- Prüfe ob Guacamole erreichbar ist
- Verifiziere Token-Generierung im Backend
- Check Browser Console für Fehler

### Verbindung bricht ab
- Netzwerk-Timeouts prüfen
- Guacamole Logs überprüfen
- Token-Gültigkeit verifizieren
