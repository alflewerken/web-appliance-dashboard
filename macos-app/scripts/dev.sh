#!/bin/bash

# Entwicklungs-Script für Web Appliance Dashboard macOS App

echo "🔧 Starte Web Appliance Dashboard im Entwicklungsmodus"
echo "====================================================="

# Prüfe ob wir im richtigen Verzeichnis sind
if [ ! -f "package.json" ]; then
    echo "❌ Fehler: package.json nicht gefunden!"
    echo "Bitte führen Sie dieses Script im macos-app Verzeichnis aus."
    exit 1
fi

# Prüfe ob Docker läuft
if ! docker info > /dev/null 2>&1; then
    echo "⚠️  Docker scheint nicht zu laufen!"
    echo "Bitte starten Sie Docker Desktop und versuchen Sie es erneut."
    exit 1
fi

# Prüfe Docker Compose Version
echo "📋 Docker Compose Version:"
if docker compose version > /dev/null 2>&1; then
    docker compose version
    echo "✅ Verwende docker compose (v2)"
else
    docker-compose --version
    echo "✅ Verwende docker-compose (v1)"
fi

# Zeige Docker-Projekt Pfad
echo ""
echo "📁 Docker-Projekt Pfad: $(pwd)/.."
echo ""

# Installiere Dependencies falls nötig
if [ ! -d "node_modules" ]; then
    echo "📦 Installiere Dependencies..."
    npm install
fi

# Starte die App
echo "🚀 Starte Electron App..."
NODE_ENV=development npm start
