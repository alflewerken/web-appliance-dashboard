#!/bin/bash
# Start Script mit Guacamole Integration

echo "🚀 Starting Web Appliance Dashboard mit Remote Desktop Support..."

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start main application
echo "📦 Starting main application..."
docker-compose up -d

# Wait for main services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if user wants Guacamole
read -p "🖥️  Möchten Sie Remote Desktop Support (Guacamole) aktivieren? (j/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Jj]$ ]]; then
    echo "🔧 Starting Guacamole services..."
    docker-compose -f docker-compose.guacamole.yml up -d
    
    echo "⏳ Waiting for Guacamole to initialize..."
    sleep 15
    
    # Initialize Guacamole database
    echo "📊 Initializing Guacamole database..."
    docker exec guacamole sh -c '/opt/guacamole/bin/initdb.sh --postgres' | \
        docker exec -i guacamole-postgres psql -U guacamole_user guacamole_db
    
    echo "✅ Guacamole ist bereit!"
    echo "   - Guacamole UI: http://localhost:8080/guacamole"
    echo "   - Default Login: guacadmin/guacadmin"
fi

echo ""
echo "✅ Web Appliance Dashboard ist bereit!"
echo "   - Dashboard: http://localhost:9080"
echo "   - API: http://localhost:3001"
echo "   - Terminal: http://localhost:7681"
echo ""
echo "📝 Standard Login:"
echo "   - Benutzer: admin"
echo "   - Passwort: admin123"
echo ""
echo "🛑 Zum Stoppen: docker-compose down"

# Show logs
echo ""
echo "📜 Logs werden angezeigt (Ctrl+C zum Beenden)..."
docker-compose logs -f