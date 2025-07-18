#!/bin/bash

echo "🛠️  Komplette Neuinstallation der macOS App Container"
echo "=================================================="
echo ""

# 1. Stoppe alle Container
echo "1️⃣  Stoppe alle Container..."
docker stop wad_app_webserver wad_app_backend wad_app_ttyd wad_app_db 2>/dev/null
echo ""

# 2. Entferne alle Container
echo "2️⃣  Entferne alle Container..."
docker rm -f wad_app_webserver wad_app_backend wad_app_ttyd wad_app_db 2>/dev/null
echo ""

# 3. Prüfe den Application Support Ordner
APP_SUPPORT="$HOME/Library/Application Support/web-appliance-dashboard"
echo "3️⃣  Prüfe Application Support Ordner..."
if [ -d "$APP_SUPPORT" ]; then
    echo "   ✓ Gefunden: $APP_SUPPORT"
    
    # Entferne die docker-compose.yml
    if [ -f "$APP_SUPPORT/docker-compose.yml" ]; then
        echo "   ⚠️  Entferne alte docker-compose.yml..."
        rm "$APP_SUPPORT/docker-compose.yml"
    fi
else
    echo "   ✗ Nicht gefunden"
fi
echo ""

# 4. Info
echo "4️⃣  Nächste Schritte:"
echo "   1. Beenden Sie die macOS App komplett (Cmd+Q)"
echo "   2. Starten Sie die App neu"
echo "   3. Die App wird neue Container mit der korrekten nginx Config erstellen"
echo "   4. Das Terminal sollte dann funktionieren"
echo ""
echo "   Die neue docker-compose.yml wird automatisch erstellt mit:"
echo "   - nginx-macapp-docker.conf (mit Terminal support)"
echo "   - Korrekten Container-Namen und Ports"
echo ""
echo "✅ Bereinigung abgeschlossen!"
