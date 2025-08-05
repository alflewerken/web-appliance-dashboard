# Alternative Guacamole-Konfiguration für macOS

## Problem
Standard VNC-Verbindungen zu macOS funktionieren oft nicht mit Guacamole wegen:
- Apple's proprietärer VNC-Implementierung
- Authentifizierungsproblemen
- Verschlüsselungsanforderungen

## Lösungsansätze

### 1. RustDesk verwenden (empfohlen)
RustDesk funktioniert bereits zuverlässig mit macOS. In der Appliance-Konfiguration:
- Remote Desktop Type: RustDesk
- RustDesk ID: [ID des Macs]
- RustDesk Password: [Passwort]

### 2. SSH-Tunnel für VNC
Erstelle einen SSH-Tunnel zu deinem Mac und verbinde Guacamole über localhost:

```bash
# Auf dem Guacamole-Server:
ssh -L 5901:localhost:5900 user@192.168.178.70
```

Dann in Guacamole:
- Host: localhost
- Port: 5901
- Passwort: [VNC-Passwort]

### 3. Alternative VNC-Server
Installiere einen alternativen VNC-Server wie TigerVNC oder RealVNC:

```bash
# Mit Homebrew:
brew install tigervnc-server

# Starte VNC-Server
vncserver :1 -geometry 1920x1080 -depth 24
```

### 4. Direkte VNC-Verbindung testen
Teste zuerst mit einem VNC-Client ob die Verbindung funktioniert:

```bash
# Von einem anderen Mac:
open vnc://192.168.178.70:5900

# Von Linux:
vncviewer 192.168.178.70:5900
```

## Empfehlung
Für macOS empfehle ich RustDesk oder TeamViewer statt VNC über Guacamole, da diese Tools speziell für Cross-Platform Remote Desktop entwickelt wurden und die macOS-spezifischen Eigenheiten besser handhaben.
