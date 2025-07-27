#!/bin/bash

# Stelle sicher, dass wir im richtigen Verzeichnis sind
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "🚀 Starte Electron App aus: $SCRIPT_DIR"
echo ""

# Prüfe ob node_modules existiert
if [ ! -d "node_modules" ]; then
    echo "📦 Installiere Dependencies..."
    npm install
fi

# Starte die App
npm start
