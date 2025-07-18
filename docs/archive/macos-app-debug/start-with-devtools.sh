#!/bin/bash

echo "🔄 Starte Mac-App mit Developer Tools..."

# Beende laufende App
pkill -f "electron.*macos-app" || true
pkill -f "Electron.*macos-app" || true

# Warte kurz
sleep 2

# Starte mit Developer Tools aktiviert
cd /Users/alflewerken/Desktop/web-appliance-dashboard/macos-app
ENABLE_DEVTOOLS=true npm start &

echo "✅ Mac-App gestartet mit Developer Tools"
echo ""
echo "🔧 Developer Tools öffnen:"
echo "  - Menü: Fenster > Entwicklertools"
echo "  - Shortcut: Cmd+Option+I"
echo "  - Oder F12"
echo ""
echo "📝 Debug-Script ausführen:"
echo "  ./debug-ssh.sh"
