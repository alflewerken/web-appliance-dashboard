#!/bin/bash

# Restart Web Appliance Dashboard Mac App containers
echo "🔄 Restarting Web Appliance Dashboard Mac App containers..."

cd /Users/alflewerken/Desktop/web-appliance-dashboard/macos-app

# Stop containers
echo "⏹️  Stopping containers..."
docker-compose -f docker-compose.app.yml down

# Start containers
echo "▶️  Starting containers..."
docker-compose -f docker-compose.app.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check container status
echo "📊 Container status:"
docker ps --filter "name=wad_app_" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Test terminal endpoint
echo -e "\n🔍 Testing terminal endpoint..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:9081/terminal/ | grep -q "200\|302"; then
    echo "✅ Terminal endpoint is accessible"
else
    echo "❌ Terminal endpoint is not accessible"
    echo "   Checking nginx logs..."
    docker logs wad_app_webserver --tail 20
fi

echo -e "\n✅ Restart complete!"
echo "🌐 Open http://localhost:9081 in your browser"
echo "🖥️  Terminal should now be accessible"
