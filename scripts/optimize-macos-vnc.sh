#!/bin/bash

# macOS Native Screen Sharing Optimizer
# Nutzt macOS eingebaute Screen Sharing für beste Performance

echo "🖥️  macOS Screen Sharing Optimizer"
echo "================================="

# 1. Aktiviere Screen Sharing wenn nicht aktiv
if ! sudo launchctl list | grep -q "com.apple.screensharing"; then
    echo "Aktiviere Screen Sharing..."
    sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.screensharing.plist
fi

# 2. Optimiere VNC Einstellungen
echo "Optimiere VNC Performance..."

# Setze VNC auf maximale Performance
defaults write com.apple.ScreenSharing controlMode 1
defaults write com.apple.ScreenSharing quality 3
defaults write com.apple.ScreenSharing compressionLevel 0

# 3. Port-Forwarding für Docker
echo "Erstelle Port-Forwarding..."

# Erstelle socat Bridge für bessere Performance
if ! command -v socat &> /dev/null; then
    echo "Installiere socat..."
    brew install socat
fi

# Forward VNC traffic mit minimal overhead
echo "Starte optimierten VNC Bridge..."
socat TCP-LISTEN:5901,reuseaddr,fork TCP:host.docker.internal:5900 &
SOCAT_PID=$!

echo "✅ VNC Bridge läuft auf Port 5901 (PID: $SOCAT_PID)"

# 4. Update Guacamole Verbindung
echo ""
echo "Update Guacamole Verbindung mit diesen Einstellungen:"
echo "  Hostname: host.docker.internal"
echo "  Port: 5901"
echo "  Encoding: tight"
echo "  Color Depth: 16"
echo ""
echo "Oder nutzen Sie direkt: vnc://localhost:5901"

# Keep running
echo "Drücken Sie Ctrl+C zum Beenden..."
wait $SOCAT_PID
