#!/bin/bash

echo "🚀 Baue Frontend mit Port 9080 Konfiguration..."

# Zum Frontend-Verzeichnis wechseln
cd /Users/alflewerken/Desktop/web-appliance-dashboard/frontend

# Erstelle .env Datei mit der richtigen Konfiguration
cat > .env << EOF
# API Configuration
REACT_APP_API_URL=http://localhost:9080
REACT_APP_API_TIMEOUT=30000

# WebSocket Configuration  
REACT_APP_WS_URL=ws://localhost:9080
REACT_APP_SSE_RECONNECT_INTERVAL=5000

# Terminal Configuration
REACT_APP_TERMINAL_URL=http://localhost:9080/terminal
REACT_APP_TERMINAL_ENABLED=true

# Application Settings
REACT_APP_NAME=Web Appliance Dashboard
REACT_APP_VERSION=1.0.4
REACT_APP_ENVIRONMENT=production

# Feature Flags
REACT_APP_FEATURE_SSH=true
REACT_APP_FEATURE_TERMINAL=true
REACT_APP_FEATURE_REMOTE_DESKTOP=true
REACT_APP_FEATURE_DOCKER=true
REACT_APP_FEATURE_SYSTEM_INFO=true
EOF

echo "📝 .env Datei erstellt mit Port 9080"

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

# Korrigiere Pfade für Electron
cd frontend-build
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' 's|href="/|href="./|g' index.html
    sed -i '' 's|src="/|src="./|g' index.html
    sed -i '' 's|src="./electron-env.js"|src="./electron-env.js"|g' index.html
else
    # Linux
    sed -i 's|href="/|href="./|g' index.html
    sed -i 's|src="/|src="./|g' index.html
fi

echo "✅ Frontend erfolgreich für Port 9080 gebaut!"
echo ""
echo "Starte die App mit: npm start"
