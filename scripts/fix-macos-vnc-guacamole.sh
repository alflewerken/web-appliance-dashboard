#!/bin/bash
# Fix macOS VNC for Guacamole
# This script configures macOS to work with Guacamole VNC

echo "=== macOS VNC Fix für Guacamole ==="
echo ""

if [ "$EUID" -ne 0 ]; then 
    echo "Bitte mit sudo ausführen:"
    echo "sudo $0"
    exit 1
fi

# 1. Stoppe Screen Sharing
echo "1. Stoppe Bildschirmfreigabe..."
launchctl unload /System/Library/LaunchDaemons/com.apple.screensharing.plist 2>/dev/null

# 2. Setze VNC Legacy Mode
echo "2. Aktiviere VNC Legacy Mode..."
defaults write /Library/Preferences/com.apple.RemoteManagement VNCLegacyConnectionsEnabled -bool true

# 3. Setze ein einfaches VNC Passwort (8 Zeichen)
echo "3. Setze VNC Passwort..."
/System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart \
    -configure -clientopts -setvnclegacy -vnclegacy yes \
    -setvncpw -vncpw "vnc12345"

# 4. Konfiguriere ARD für alle Benutzer
echo "4. Konfiguriere Zugriff..."
/System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart \
    -activate -configure -access -on \
    -configure -allowAccessFor -allUsers \
    -configure -restart -agent -privs -all

# 5. Starte Screen Sharing neu
echo "5. Starte Bildschirmfreigabe..."
launchctl load -w /System/Library/LaunchDaemons/com.apple.screensharing.plist

# 6. Öffne Port in Firewall (falls aktiviert)
echo "6. Konfiguriere Firewall..."
/usr/libexec/ApplicationFirewall/socketfilterfw --add /System/Library/CoreServices/RemoteManagement/screensharingd.bundle/Contents/MacOS/screensharingd 2>/dev/null
/usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /System/Library/CoreServices/RemoteManagement/screensharingd.bundle/Contents/MacOS/screensharingd 2>/dev/null

echo ""
echo "✅ Konfiguration abgeschlossen!"
echo ""
echo "VNC-Verbindungsdetails:"
echo "  Host: $(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')"
echo "  Port: 5900"
echo "  Passwort: vnc12345"
echo ""
echo "⚠️  WICHTIG: Verwende in Guacamole genau dieses Passwort!"
