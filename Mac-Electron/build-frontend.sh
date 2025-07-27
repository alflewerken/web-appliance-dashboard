#!/bin/bash

echo "🔨 Baue Frontend für Electron App..."

# Zum Frontend-Verzeichnis wechseln
cd ../frontend

# Prüfe ob node_modules existiert
if [ ! -d "node_modules" ]; then
    echo "📦 Installiere Frontend Dependencies..."
    npm install
fi

# Baue das Frontend
echo "🏗️  Erstelle Production Build..."
npm run build

# Zurück zum Electron-Verzeichnis
cd ../Mac-Electron

# Lösche alten Build
rm -rf frontend-build

# Kopiere neuen Build
echo "📁 Kopiere Frontend Build..."
cp -r ../frontend/build frontend-build

echo "✅ Frontend erfolgreich gebaut!"
echo ""
echo "Starte die App mit: npm start"
