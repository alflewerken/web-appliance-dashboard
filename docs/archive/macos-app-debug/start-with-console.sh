#!/bin/bash
# Start mit ausführlichem Logging

cd "$(dirname "$0")"

echo "===================="
echo "Starting Web Appliance Dashboard App"
echo "===================="
echo ""

# Stoppe alte Instanzen
echo "Stopping old instances..."
pkill -f "Electron.*Web Appliance" 2>/dev/null || true
sleep 1

# Starte mit Console Output
echo "Starting Electron app with console output..."
echo ""
echo "Console Output:"
echo "---------------"

# Starte die App mit sichtbarem Output
npm start 2>&1 | while IFS= read -r line; do
    echo "[$(date '+%H:%M:%S')] $line"
done
