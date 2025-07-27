#!/bin/bash

echo "🔄 Restarting macOS App containers with correct nginx config..."
echo ""

# Stop all containers
echo "1. Stopping containers..."
docker stop wad_app_webserver wad_app_backend wad_app_ttyd wad_app_db 2>/dev/null || true

# Remove containers to force recreation
echo "2. Removing containers..."
docker rm wad_app_webserver wad_app_backend wad_app_ttyd wad_app_db 2>/dev/null || true

echo ""
echo "3. Containers removed. Please restart the macOS App to create new containers with the correct configuration."
echo ""
echo "After restarting the app:"
echo "- The terminal should work correctly"
echo "- nginx will use nginx-macapp-docker.conf"
echo "- Terminal will be accessible at /terminal/"
