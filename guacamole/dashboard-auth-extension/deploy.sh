#!/bin/bash

# Deployment Script für Guacamole Dashboard Authentication Extension

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🚀 Deploying Guacamole Dashboard Authentication Extension..."

# 1. Build Extension
echo "📦 Building extension..."
cd "$SCRIPT_DIR"

if ! command -v mvn &> /dev/null; then
    echo "❌ Maven ist nicht installiert!"
    echo "Bitte installiere Maven:"
    echo "  macOS: brew install maven"
    echo "  Ubuntu: sudo apt-get install maven"
    exit 1
fi

mvn clean package

if [ ! -f "target/guacamole-auth-dashboard-1.0.0.jar" ]; then
    echo "❌ Build fehlgeschlagen! JAR wurde nicht erstellt."
    exit 1
fi

# 2. Copy to extensions directory
echo "📋 Copying extension to guacamole/extensions..."
mkdir -p "$PROJECT_ROOT/guacamole/extensions"
cp target/guacamole-auth-dashboard-1.0.0.jar "$PROJECT_ROOT/guacamole/extensions/"

# 3. Check if containers are running
echo "🔍 Checking Docker containers..."
cd "$PROJECT_ROOT"

if ! docker ps | grep -q "appliance_guacamole"; then
    echo "⚠️  Guacamole Container läuft nicht. Starte alle Container..."
    docker-compose up -d
    echo "⏳ Warte 30 Sekunden für Container-Start..."
    sleep 30
else
    echo "♻️  Restarting Guacamole container..."
    docker-compose restart guacamole
    echo "⏳ Warte 20 Sekunden für Neustart..."
    sleep 20
fi

# 4. Verify extension is loaded
echo "✅ Verifying extension loading..."
if docker logs appliance_guacamole 2>&1 | tail -50 | grep -q "Extension \"dashboard-auth\""; then
    echo "✅ Extension erfolgreich geladen!"
else
    echo "⚠️  Extension möglicherweise nicht geladen. Prüfe die Logs:"
    echo "   docker logs appliance_guacamole"
fi

# 5. Test JWT generation
echo ""
echo "🧪 Testing JWT token generation..."
echo "Führe folgenden Befehl aus um einen Test-Token zu generieren:"
echo ""
echo "curl -X POST http://localhost:3001/api/remote/guacamole/token/1 \\"
echo "  -H 'Authorization: Bearer YOUR_AUTH_TOKEN' \\"
echo "  -H 'Content-Type: application/json'"
echo ""

# 6. Summary
echo "📋 Deployment Summary:"
echo "===================="
echo "✅ Extension gebaut und deployed"
echo "✅ Guacamole neu gestartet"
echo ""
echo "🔗 Zugriff:"
echo "- Dashboard: http://localhost:9080"
echo "- Guacamole: http://localhost:9070/guacamole"
echo ""
echo "📖 Nächste Schritte:"
echo "1. Logge dich ins Dashboard ein"
echo "2. Aktiviere Remote Desktop für eine Appliance"
echo "3. Klicke auf den VNC/RDP Button"
echo "4. Genieße 1-Klick Remote Desktop! 🎉"
echo ""
echo "Bei Problemen:"
echo "- Logs prüfen: docker logs appliance_guacamole"
echo "- Extension prüfen: docker exec appliance_guacamole ls -la /etc/guacamole/extensions/"

echo ""
echo "✅ Deployment abgeschlossen!"
