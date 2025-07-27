#!/bin/bash

echo "🚀 Erstelle Test-Konfiguration für Electron App..."

# Erstelle das Konfigurationsverzeichnis
CONFIG_DIR="$HOME/Library/Application Support/web-appliance-dashboard-electron"
mkdir -p "$CONFIG_DIR"

# Erstelle eine Standard-Konfiguration
cat > "$CONFIG_DIR/config.json" << EOF
{
  "apiHost": "localhost",
  "apiPort": "3001",
  "apiProtocol": "http"
}
EOF

echo "✅ Konfiguration erstellt in: $CONFIG_DIR/config.json"
echo ""
echo "Starte App..."

cd "$(dirname "$0")"
npm start
