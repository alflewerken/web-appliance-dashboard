#!/bin/bash
# Set VNC password on macOS

echo "=== macOS VNC-Passwort setzen ==="
echo ""
echo "WICHTIG: VNC-Passwörter auf macOS sind auf 8 Zeichen begrenzt!"
echo ""

# Prüfe ob Script als root läuft
if [ "$EUID" -ne 0 ]; then 
    echo "Bitte mit sudo ausführen:"
    echo "sudo $0"
    exit 1
fi

# Standard-Passwort oder als Parameter
VNC_PASSWORD="${1:-indigo12}"

# Kürze auf 8 Zeichen
VNC_PASSWORD_SHORT="${VNC_PASSWORD:0:8}"

if [ ${#VNC_PASSWORD} -gt 8 ]; then
    echo "⚠️  Passwort wurde auf 8 Zeichen gekürzt: '$VNC_PASSWORD_SHORT'"
fi

echo "Setze VNC-Passwort auf: '$VNC_PASSWORD_SHORT'"

# Setze VNC-Passwort
/System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart \
    -configure -clientopts -setvnclegacy -vnclegacy yes \
    -setvncpw -vncpw "$VNC_PASSWORD_SHORT" \
    -restart -agent

if [ $? -eq 0 ]; then
    echo "✅ VNC-Passwort wurde erfolgreich gesetzt"
    echo ""
    echo "Verbindungsdetails:"
    echo "  Protokoll: VNC"
    echo "  Host: $(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')"
    echo "  Port: 5900"
    echo "  Passwort: $VNC_PASSWORD_SHORT"
else
    echo "❌ Fehler beim Setzen des VNC-Passworts"
fi

echo ""
echo "Teste die Verbindung mit:"
echo "  vnc://$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}'):5900"
