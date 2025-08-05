#!/bin/bash
# macOS VNC Diagnose Script

echo "=== macOS VNC/Bildschirmfreigabe Diagnose ==="
echo ""

# 1. Prüfe ob Bildschirmfreigabe aktiv ist
echo "1. Bildschirmfreigabe Status:"
if launchctl list | grep -q "com.apple.screensharing"; then
    echo "✅ Bildschirmfreigabe-Dienst läuft"
else
    echo "❌ Bildschirmfreigabe-Dienst läuft NICHT"
fi

# 2. Prüfe VNC Port
echo ""
echo "2. VNC Port 5900 Status:"
if lsof -i :5900 > /dev/null 2>&1; then
    echo "✅ Port 5900 ist geöffnet"
    lsof -i :5900 | grep LISTEN
else
    echo "❌ Port 5900 ist NICHT geöffnet"
fi

# 3. Netzwerk-Interfaces
echo ""
echo "3. Netzwerk-Interfaces:"
ifconfig | grep "inet " | grep -v 127.0.0.1 | while read line; do
    echo "   IP: $(echo $line | awk '{print $2}')"
done

# 4. Firewall Status
echo ""
echo "4. Firewall Status:"
if /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate | grep -q "enabled"; then
    echo "⚠️  Firewall ist AKTIVIERT"
    echo "   Bildschirmfreigabe-Regel:"
    /usr/libexec/ApplicationFirewall/socketfilterfw --listapps | grep -i screen || echo "   Keine explizite Regel gefunden"
else
    echo "✅ Firewall ist deaktiviert"
fi

# 5. Remote Management Status
echo ""
echo "5. Remote Management (ARD) Status:"
if ps aux | grep -q "[A]RDAgent"; then
    echo "✅ ARD Agent läuft"
else
    echo "❌ ARD Agent läuft NICHT"
fi

echo ""
echo "=== Empfohlene Aktionen ==="
echo ""

if ! launchctl list | grep -q "com.apple.screensharing"; then
    echo "🔧 Bildschirmfreigabe aktivieren:"
    echo "   Systemeinstellungen → Freigaben → Bildschirmfreigabe aktivieren"
    echo ""
    echo "   Oder im Terminal:"
    echo "   sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.screensharing.plist"
fi

if ! lsof -i :5900 > /dev/null 2>&1; then
    echo "🔧 VNC-Port ist geschlossen. Mögliche Ursachen:"
    echo "   - Bildschirmfreigabe ist nicht aktiviert"
    echo "   - Firewall blockiert den Port"
    echo "   - Ein anderer Dienst nutzt den Port"
fi

echo ""
echo "=== VNC-Verbindungstest ==="
echo "Teste die Verbindung von einem anderen Computer mit:"
echo "  vnc://$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}'):5900"
