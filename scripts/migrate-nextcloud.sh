#!/bin/bash

# Script to run Nextcloud integration migration for MariaDB

echo "🔄 Running Nextcloud integration migration..."

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if database container is running
if ! docker ps | grep -q appliance_db; then
    echo "❌ Database container is not running!"
    echo "Please run: ./scripts/build.sh first"
    exit 1
fi

# Run the migration using mariadb client
echo "📝 Creating Nextcloud tables..."
docker exec -i appliance_db mariadb -uappliance_user -pappliance_password appliance_db < "$SCRIPT_DIR/../backend/migrations/007_add_nextcloud_integration.sql"

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
else
    echo "⚠️  Migration might have already been applied or there was an error"
    echo "Checking if tables exist..."
    
    # Check if tables exist
    TABLE_CHECK=$(docker exec appliance_db mariadb -uappliance_user -pappliance_password -e "SHOW TABLES LIKE 'nextcloud_connections';" appliance_db 2>/dev/null | grep -c "nextcloud_connections")
    
    if [ "$TABLE_CHECK" -gt 0 ]; then
        echo "✅ Nextcloud tables already exist!"
    else
        echo "❌ Failed to create tables"
        exit 1
    fi
fi

echo ""
echo "🔄 Restarting backend to apply changes..."
docker compose restart backend

echo "⏳ Waiting for backend to be ready..."
sleep 5

# Verify backend is responding
if curl -f -s http://localhost:3001/api/health >/dev/null 2>&1; then
    echo "✅ Backend is ready!"
    echo ""
    echo "🎉 Nextcloud integration is now available!"
    echo "   You can now add Nextcloud connections in the dashboard."
else
    echo "⚠️  Backend health check failed, but it might still be starting..."
fi
