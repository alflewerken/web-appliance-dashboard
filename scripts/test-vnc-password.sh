#!/bin/bash
# Test VNC Password on macOS

echo "=== VNC Passwort Test ==="
echo ""
echo "Dieser Test prüft, ob das VNC-Passwort korrekt gesetzt ist."
echo ""

# 1. Prüfe aktuelle Einstellungen
echo "1. Aktuelle Remote Management Einstellungen:"
defaults read /Library/Preferences/com.apple.RemoteManagement 2>/dev/null | grep -E "VNC|Legacy" || echo "Keine VNC-Einstellungen gefunden"

echo ""
echo "2. Teste VNC-Verbindung lokal:"
echo "   Öffne auf einem ANDEREN Mac:"
echo "   open vnc://192.168.178.70:5900"
echo "   Passwort: indigo"
echo ""

echo "3. Alternative: Setze das Passwort in der GUI:"
echo "   - Systemeinstellungen → Freigaben → Bildschirmfreigabe"
echo "   - Klicke auf 'Computereinstellungen...'"
echo "   - Aktiviere: 'VNC-Benutzer dürfen den Bildschirm mit dem Kennwort steuern'"
echo "   - Setze Passwort: indigo (6 Zeichen)"
echo ""

echo "4. Wenn das nicht hilft, teste mit einem anderen Passwort:"
echo "   sudo /System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart \\"
echo "     -configure -clientopts -setvnclegacy -vnclegacy yes \\"
echo "     -setvncpw -vncpw '12345678' \\"
echo "     -restart -agent"
echo ""
echo "   Dann in Guacamole das Passwort auf '12345678' ändern."
