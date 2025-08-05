# macOS Remote Desktop Setup für Guacamole

## Übersicht
Guacamole kann sich mit macOS über VNC (Virtual Network Computing) verbinden. Dafür muss die Bildschirmfreigabe auf dem Mac aktiviert werden.

## Voraussetzungen
- macOS 10.14 oder neuer
- Administrator-Zugriff auf den Mac
- Netzwerkverbindung zwischen Guacamole-Server und Mac

## Schritt 1: Bildschirmfreigabe aktivieren

### Option A: Über Systemeinstellungen (empfohlen)
1. Öffne **Systemeinstellungen** → **Freigaben**
2. Aktiviere **Bildschirmfreigabe**
3. Klicke auf **Computereinstellungen...**
4. Aktiviere folgende Optionen:
   - ✅ "Jeder darf nach Erlaubnis eine Freigabe für den Bildschirm beantragen"
   - ✅ "VNC-Benutzer dürfen den Bildschirm mit dem Kennwort steuern"
5. Setze ein sicheres VNC-Passwort (max. 8 Zeichen!)
6. Unter "Zugriff erlauben für:" wähle entweder:
   - "Alle Benutzer" (weniger sicher)
   - "Nur diese Benutzer:" und füge spezifische Benutzer hinzu

### Option B: Über Terminal (für Automatisierung)
```bash
# Bildschirmfreigabe aktivieren
sudo defaults write /var/db/launchd.db/com.apple.launchd/overrides.plist com.apple.screensharing -dict Disabled -bool false
sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.screensharing.plist

# VNC-Passwort setzen (max. 8 Zeichen!)
sudo /System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart \
  -configure -clientopts -setvnclegacy -vnclegacy yes \
  -setvncpw -vncpw "IhrVNCPW"

# Zugriff für alle Benutzer erlauben
sudo /System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart \
  -activate -configure -access -on \
  -configure -allowAccessFor -allUsers \
  -configure -restart -agent
```

## Schritt 2: Firewall konfigurieren

### macOS Firewall
1. **Systemeinstellungen** → **Sicherheit & Datenschutz** → **Firewall**
2. Klicke auf das Schloss und authentifiziere dich
3. Klicke auf **Firewall-Optionen...**
4. Stelle sicher, dass **Bildschirmfreigabe** erlaubt ist
5. Oder deaktiviere "Alle eingehenden Verbindungen blockieren"

### Port-Überprüfung
VNC verwendet standardmäßig Port 5900. Teste die Verbindung:
```bash
# Auf dem Mac
sudo lsof -i :5900

# Von einem anderen Computer
nc -zv <MAC_IP_ADRESSE> 5900
```

## Schritt 3: Guacamole-Verbindung konfigurieren

In der Web Appliance Dashboard Konfiguration:

1. **Remote Desktop aktivieren**: ✅
2. **Protokoll**: VNC
3. **Host**: IP-Adresse des Macs (z.B. 192.168.178.70)
4. **Port**: 5900 (oder leer lassen für Standard)
5. **Benutzername**: macOS-Benutzername
6. **Passwort**: VNC-Passwort (das in Schritt 1 gesetzte)

## Fehlerbehebung

### "Computer ist nicht erreichbar"
1. Überprüfe die IP-Adresse:
   ```bash
   # Auf dem Mac
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

2. Teste die Netzwerkverbindung:
   ```bash
   # Vom Guacamole-Server
   ping <MAC_IP_ADRESSE>
   ```

3. Überprüfe ob VNC läuft:
   ```bash
   # Auf dem Mac
   sudo launchctl list | grep vnc
   ```

### "Authentifizierung fehlgeschlagen"
1. VNC-Passwort ist auf max. 8 Zeichen begrenzt!
2. Groß-/Kleinschreibung beachten
3. Sonderzeichen vermeiden

### Performance-Probleme
1. Reduziere die Bildschirmauflösung auf dem Mac
2. In Guacamole-Einstellungen:
   - Farbtiefe reduzieren (16-bit statt 24-bit)
   - Kompression aktivieren

### Alternative: RustDesk
Wenn VNC Probleme macht, ist RustDesk eine gute Alternative:
- Bessere Performance
- Einfachere Firewall-Durchdringung
- Keine 8-Zeichen-Passwort-Beschränkung

## Sicherheitshinweise
- VNC-Passwörter sind auf 8 Zeichen begrenzt und nicht sehr sicher
- Verwende VPN oder SSH-Tunnel für Verbindungen über das Internet
- Aktiviere die Bildschirmfreigabe nur wenn nötig
- Beschränke den Zugriff auf spezifische Benutzer

## Automatisierung
Für die Verwaltung mehrerer Macs, erstelle ein Setup-Skript:

```bash
#!/bin/bash
# enable-vnc.sh

# Variablen
VNC_PASSWORD="IhrVNCPW"  # Max 8 Zeichen!

echo "Aktiviere Bildschirmfreigabe..."

# Bildschirmfreigabe aktivieren
sudo /System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart \
  -activate -configure -access -on \
  -configure -allowAccessFor -allUsers \
  -configure -restart -agent -privs -all

# VNC-Legacy-Modus und Passwort setzen
sudo /System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart \
  -configure -clientopts -setvnclegacy -vnclegacy yes \
  -setvncpw -vncpw "$VNC_PASSWORD"

echo "VNC wurde aktiviert. Port: 5900"
echo "IP-Adresse: $(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')"
```

## Weiterführende Links
- [Apple Support: Bildschirmfreigabe](https://support.apple.com/de-de/guide/mac-help/mh14066/mac)
- [Guacamole VNC Documentation](https://guacamole.apache.org/doc/gug/configuring-guacamole.html#vnc)
