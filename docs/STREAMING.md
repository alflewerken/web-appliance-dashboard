# Streaming Integration für Web Appliance Dashboard

## Übersicht

Diese Integration ermöglicht es, Sunshine/Moonlight Game Streaming direkt in das Web Appliance Dashboard zu integrieren. Damit können Sie:

- **Low-Latency Streaming**: Spiele und Desktop mit minimaler Verzögerung streamen
- **Hardware-beschleunigtes Encoding**: Unterstützung für NVENC, QuickSync, VAAPI
- **WebRTC-basierter Client**: Direktes Streaming im Browser ohne zusätzliche Software
- **Zentrale Verwaltung**: Streaming-Sessions über das Dashboard steuern

## Architektur

### Komponenten

1. **Host (Sunshine)**
   - Läuft auf dem zu streamenden Rechner
   - Erfasst Video/Audio und encoded mit Hardware-Beschleunigung
   - Verwaltet Input (Maus, Tastatur, Gamepad)

2. **Client (Moonlight WebRTC)**
   - React-Komponente im Frontend
   - WebRTC für niedrige Latenz
   - WebAssembly für Video-Dekodierung

3. **Routing Layer**
   - WebSocket für Signaling
   - STUN/TURN für NAT-Traversal
   - Nginx als Reverse Proxy

## Installation

### Automatische Installation

```bash
cd scripts
./install-streaming.sh
```

Das Skript installiert:
- Sunshine auf dem Host-System
- WebRTC-Abhängigkeiten im Frontend
- Streaming-Routes im Backend
- Nginx-Konfiguration

### Manuelle Installation

#### 1. Sunshine installieren

**Linux:**
```bash
wget -qO - https://packagecloud.io/LizardByte/stable/gpgkey | sudo apt-key add -
echo "deb https://packagecloud.io/LizardByte/stable/ubuntu/ $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/sunshine.list
sudo apt update && sudo apt install sunshine
```

**macOS:**
```bash
brew install --cask sunshine
```

**Windows:**
Download von: https://github.com/LizardByte/Sunshine/releases/latest

#### 2. Frontend-Komponenten

Die Streaming-Komponenten befinden sich in:
- `frontend/src/components/Streaming/MoonlightPlayer.jsx`
- `frontend/src/components/Streaming/StreamingControls.jsx`

#### 3. Backend-Integration

Die API-Routes sind in:
- `backend/routes/streaming.js`
- `backend/modules/streaming/sunshine-controller.js`

## Verwendung

### 1. Streaming starten

1. Navigieren Sie zu einer Appliance im Dashboard
2. Klicken Sie auf den "Stream"-Button
3. Konfigurieren Sie die Streaming-Einstellungen:
   - Auflösung (720p bis 4K)
   - Framerate (30-144 FPS)
   - Bitrate (5-50 Mbps)
   - Codec (H.264, H.265, AV1)

### 2. Erste Verbindung

Beim ersten Mal müssen Sie das Gerät koppeln:
1. Sunshine zeigt einen 4-stelligen PIN
2. Geben Sie diesen im Dashboard ein
3. Die Geräte sind nun dauerhaft gekoppelt

### 3. Streaming-Kontrollen

- **Vollbild**: F11 oder Vollbild-Button
- **Statistiken**: Latenz, FPS, Bitrate in Echtzeit
- **Input**: Maus, Tastatur und Gamepad werden durchgereicht

## Konfiguration

### Sunshine-Konfiguration

Die Konfiguration befindet sich in:
```
~/.config/sunshine/sunshine.conf
```

Wichtige Einstellungen:
```conf
# Video
encoder = auto          # auto, nvenc, quicksync, vaapi, software
bitrate = 20000        # Bitrate in kbps
fps = 60               # Framerate

# Netzwerk
port = 47989           # RTSP Port
https_port = 47990     # Web UI Port

# Sicherheit
origin_pin = 0000      # Standard-PIN (ändern!)
```

### Performance-Optimierung

#### GPU-Encoding aktivieren

**NVIDIA (NVENC):**
```bash
# Prüfen ob NVENC verfügbar
nvidia-smi encodersessions
```

**Intel (QuickSync):**
```bash
# VAAPI installieren
sudo apt install intel-media-va-driver
```

**AMD (VCE/VCN):**
```bash
# Mesa VAAPI
sudo apt install mesa-va-drivers
```

#### Netzwerk-Optimierung

1. **QoS aktivieren**: Priorisierung des Streaming-Traffics
2. **MTU optimieren**: Jumbo Frames für LAN
3. **Buffer tuning**: Kernel-Parameter anpassen

### Sicherheit

1. **HTTPS aktivieren**: Selbstsignierte Zertifikate werden automatisch erstellt
2. **PIN ändern**: Standard-PIN 0000 sollte geändert werden
3. **Firewall**: Nur benötigte Ports öffnen (47989, 47990)

## Erweiterte Features

### Multi-Monitor Support

```javascript
// In StreamingControls.jsx
const monitors = [
  { id: 0, name: 'Primary' },
  { id: 1, name: 'Secondary' }
];
```

### HDR Streaming

Für HDR-Support:
1. HDR auf dem Host aktivieren
2. HEVC/AV1 Codec verwenden
3. Client mit HDR-Display

### Touch-Kontrollen (Mobile)

Virtuelle Kontrollen für Touchscreens:
- Virtueller Joystick
- On-Screen Buttons
- Gesture-Support

## Troubleshooting

### Verbindungsprobleme

1. **Firewall prüfen**: Ports 47989-47990 müssen offen sein
2. **SSL-Zertifikat**: Browser-Warnung bei selbstsignierten Zertifikaten akzeptieren
3. **WebRTC**: STUN/TURN Server konfigurieren für NAT-Traversal

### Performance-Probleme

1. **Hardware-Encoding prüfen**: 
   ```bash
   # Linux
   vainfo
   
   # Windows
   dxdiag
   ```

2. **Bitrate anpassen**: Niedrigere Bitrate bei schlechter Verbindung
3. **Auflösung reduzieren**: 720p statt 1080p für bessere Performance

### Bekannte Einschränkungen

- **macOS**: Kein Gamepad-Support
- **Linux Wayland**: Eingeschränkte Capture-Optionen
- **Browser**: Chrome/Edge empfohlen für beste WebRTC-Performance

## API-Referenz

### Endpoints

```javascript
POST   /api/streaming/install/:applianceId    // Sunshine installieren
POST   /api/streaming/start/:applianceId      // Streaming starten
POST   /api/streaming/stop/:applianceId       // Streaming stoppen
GET    /api/streaming/status/:applianceId     // Status abrufen
POST   /api/streaming/pair/:applianceId       // Client koppeln
WS     /api/streaming/stream/:applianceId     // WebSocket für Stream
```

### WebSocket-Events

```javascript
// Client -> Server
{
  type: 'offer',        // WebRTC Offer
  type: 'answer',       // WebRTC Answer  
  type: 'ice-candidate',// ICE Candidate
  type: 'mouse-move',   // Maus-Bewegung
  type: 'mouse-click',  // Maus-Klick
  type: 'key-down',     // Taste gedrückt
  type: 'key-up'        // Taste losgelassen
}

// Server -> Client
{
  type: 'offer',        // WebRTC Offer
  type: 'ice-candidate',// ICE Candidate
  type: 'log',          // Log-Nachricht
  type: 'error',        // Fehler
  type: 'stats'         // Performance-Statistiken
}
```

## Weitere Entwicklung

### Geplante Features

- [ ] TURN Server Integration
- [ ] Aufnahme-Funktion
- [ ] Multi-User Streaming
- [ ] Cloud-Gaming Integration
- [ ] KI-basierte Upscaling

### Contributing

Pull Requests sind willkommen! Bitte beachten Sie:
1. Code-Style einhalten
2. Tests schreiben
3. Dokumentation aktualisieren

## Lizenz

Die Streaming-Integration nutzt:
- Sunshine: GPL-3.0
- Moonlight: GPL-3.0
- WebRTC: BSD-3-Clause

Das Web Appliance Dashboard selbst ist unter MIT lizenziert.
