#!/bin/bash
# Test Build Script - Testet den kompletten Build-Prozess

echo "🧪 Testing Web Appliance Dashboard Mac App Build"
echo "=============================================="
echo ""

# Führe den Build aus
cd "$(dirname "$0")/.."
./scripts/build.sh

# Prüfe ob die App erstellt wurde
if [ -d "dist/mac" ] || [ -d "dist/mac-arm64" ]; then
    echo ""
    echo "✅ App wurde erfolgreich erstellt!"
    
    # Zeige App-Informationen
    echo ""
    echo "📱 App Details:"
    if [ -d "dist/mac-arm64" ]; then
        ls -la "dist/mac-arm64/"*.app 2>/dev/null || true
    fi
    if [ -d "dist/mac" ]; then
        ls -la "dist/mac/"*.app 2>/dev/null || true
    fi
    
    echo ""
    echo "🚀 Nächste Schritte:"
    echo "1. Öffnen Sie die App aus dem dist/ Verzeichnis"
    echo "2. Stellen Sie sicher, dass Docker Desktop läuft"
    echo "3. Die App wird automatisch alle Container starten"
else
    echo ""
    echo "❌ Fehler: App wurde nicht erstellt!"
    echo "Überprüfen Sie die Build-Logs oben für Details."
fi
