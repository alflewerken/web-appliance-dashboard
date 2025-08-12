# macOS 15.x (Sonoma) Guacamole VNC Problembehebung

## Problem
macOS 15.x hat erweiterte Sicherheitsfunktionen, die Standard-VNC-Verbindungen blockieren können.

## Lösungsansätze

### 1. Sicherheitseinstellungen prüfen
In Systemeinstellungen → Datenschutz & Sicherheit:
- Stelle sicher, dass "Bildschirmaufnahme" für relevante Apps erlaubt ist
- Überprüfe "Bedienungshilfen" Berechtigungen

### 2. Alternative VNC-Server verwenden
Da die native macOS Bildschirmfreigabe Probleme macht, installiere einen alternativen VNC-Server:

```bash
# TigerVNC installieren
brew install tigervnc

# VNC-Server starten (Passwort: max 8 Zeichen)
vncserver :1 -geometry 1920x1080 -depth 24 -localhost no
```

Dann in Guacamole:
- Port: 5901 (statt 5900)
- Passwort: Das beim Start gesetzte Passwort

### 3. SSH-Tunnel für VNC (Workaround)
Erstelle einen SSH-Tunnel vom Guacamole-Server zum Mac:

```bash
# Auf dem Guacamole-Server
ssh -L 5901:localhost:5900 alflewerken@192.168.178.70 -N
```

Dann in Guacamole:
- Host: localhost
- Port: 5901

### 4. RustDesk als Alternative
Da RustDesk bereits funktioniert, ist es die zuverlässigste Option für macOS 15.x.

## Debugging

Teste die VNC-Verbindung lokal:
```bash
# Auf dem MacbookPro
sudo lsof -i :5900

# Sollte zeigen:
# launchd   ... TCP *:vnc (LISTEN)
```

Teste von einem anderen Mac:
```bash
open vnc://192.168.178.70:5900
# Passwort: indigo
```

Wenn es von Mac zu Mac funktioniert, aber nicht von Guacamole, liegt es an der VNC-Implementierung.
