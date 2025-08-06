#!/bin/bash

echo "========================================="
echo "Web Appliance Dashboard Uninstaller"
echo "========================================="
echo ""
echo "⚠️  WARNING: This will remove:"
echo "   - All containers"
echo "   - All volumes (INCLUDING YOUR DATA)"
echo "   - Docker images"
echo ""
read -p "Are you SURE you want to continue? Type 'yes' to confirm: " -r CONFIRM

if [[ "$CONFIRM" != "yes" ]]; then
    echo "❌ Uninstall cancelled"
    exit 0
fi

# Detect compose command
if docker compose version &> /dev/null; then
    COMPOSE_COMMAND="docker compose"
else
    COMPOSE_COMMAND="docker-compose"
fi

echo ""
echo "🛑 Stopping services..."
$COMPOSE_COMMAND down -v

echo "🗑️  Removing images..."
$COMPOSE_COMMAND down --rmi all

echo "🧹 Cleaning up SSL certificates..."
rm -rf ssl/

echo ""
echo "✅ Uninstall complete!"
echo ""
echo "Note: The .env file was preserved in case you need it."
echo "To remove it: rm .env"
