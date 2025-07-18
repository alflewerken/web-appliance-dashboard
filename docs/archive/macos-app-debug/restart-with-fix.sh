#!/bin/bash

echo "🔄 Neustart der Mac-App mit Terminal-Fix..."

# Gehe zum Mac-App Verzeichnis
cd /Users/alflewerken/Desktop/web-appliance-dashboard/macos-app

# Beende laufende Instanzen
echo "⏹️  Beende laufende App..."
pkill -f "Electron.*macos-app" || true
pkill -f "electron.*macos-app" || true

# Warte kurz
sleep 2

# Starte die App
echo "▶️  Starte Mac-App..."
npm start &

echo "✅ Mac-App wurde gestartet"
echo ""
echo "📝 Test-Anweisungen:"
echo "1. Öffne die Mac-App"
echo "2. Klicke auf einen Terminal-Button"
echo "3. Das Terminal sollte jetzt in einem separaten Fenster öffnen"
echo ""
echo "🧪 Alternativ: Öffne http://localhost:9081 in der Mac-App"
echo "   und navigiere zu /terminal-test.html für Debug-Tests"
