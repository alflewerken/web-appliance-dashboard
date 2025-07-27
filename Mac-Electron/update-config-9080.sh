#!/bin/bash

echo "🔧 Aktualisiere Konfiguration für Port 9080..."

# Erstelle das Konfigurationsverzeichnis
CONFIG_DIR="$HOME/Library/Application Support/web-appliance-dashboard-electron"
mkdir -p "$CONFIG_DIR"

# Erstelle die korrekte Konfiguration für nginx auf Port 9080
cat > "$CONFIG_DIR/config.json" << EOF
{
  "apiHost": "localhost",
  "apiPort": "9080",
  "apiProtocol": "http"
}
EOF

echo "✅ Konfiguration aktualisiert!"
echo ""
cat "$CONFIG_DIR/config.json"
echo ""
echo "Starte die App neu, um die Änderungen zu übernehmen."
