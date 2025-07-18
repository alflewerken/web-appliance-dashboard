#!/bin/bash

echo "🔄 Neustart der Mac-App..."

# Beende die laufende App
pkill -f "electron.*macos-app" || true

# Warte kurz
sleep 2

# Starte die App neu
cd /Users/alflewerken/Desktop/web-appliance-dashboard/macos-app
npm start &

echo "✅ Mac-App wurde neu gestartet"
echo "📝 Terminal sollte jetzt in einem neuen Fenster öffnen"
