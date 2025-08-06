#!/bin/bash

echo "========================================="
echo "Web Appliance Dashboard Installation"
echo "========================================="

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check Docker Compose
COMPOSE_COMMAND=""
if docker compose version &> /dev/null; then
    COMPOSE_COMMAND="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_COMMAND="docker-compose"
else
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Using Docker Compose command: $COMPOSE_COMMAND"

# Create .env from example
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created with secure defaults"
fi

# Generate SSL certificate
if [ ! -d ssl ]; then
    echo "🔒 Generating self-signed SSL certificate..."
    mkdir -p ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/key.pem \
        -out ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" \
        2>/dev/null
    echo "✅ SSL certificate generated"
fi

# Setup Docker authentication (works around macOS keychain issues)
echo ""
echo "🔑 Setting up GitHub Container Registry access..."

# Create docker config directory
mkdir -p ~/.docker

# Check if we're on macOS
if [[ "$(uname)" == "Darwin" ]]; then
    echo "📱 Detected macOS - using manual authentication method"
    
    # Backup existing config
    if [ -f ~/.docker/config.json ]; then
        cp ~/.docker/config.json ~/.docker/config.json.backup
    fi
    
    # Create config with auth directly (bypasses keychain)
    cat > ~/.docker/config.json << 'DOCKEREOF'
{
  "auths": {
    "ghcr.io": {
      "auth": "YWxmbGV3ZXJrZW46Z2hwX1hwczFCdGtQZDdFV1FKbzlZQjVZTkNBWXRxRkZvYTJTaVkxSw=="
    }
  }
}
DOCKEREOF
    
    echo "✅ Docker authentication configured"
else
    # For Linux, try normal login first
    echo "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" | docker login ghcr.io -u "alflewerken" --password-stdin 2>/dev/null || {
        echo "⚠️  Standard login failed, using manual method..."
        cat > ~/.docker/config.json << 'DOCKEREOF'
{
  "auths": {
    "ghcr.io": {
      "auth": "YWxmbGV3ZXJrZW46Z2hwX1hwczFCdGtQZDdFV1FKbzlZQjVZTkNBWXRxRkZvYTJTaVkxSw=="
    }
  }
}
DOCKEREOF
    }
fi

# Test authentication by trying to pull one image
echo "🔍 Testing registry access..."
if docker pull ghcr.io/alflewerken/web-appliance-dashboard-backend:latest &> /dev/null; then
    echo "✅ Successfully authenticated with GitHub Container Registry"
else
    echo "❌ Authentication test failed."
    echo ""
    echo "Troubleshooting steps:"
    echo "1. Try manual login:"
    echo "   docker login ghcr.io -u alflewerken"
    echo "   Password: [use your access token]"
    echo ""
    echo "2. If on macOS, disable keychain in Docker Desktop:"
    echo "   Docker Desktop → Settings → General"
    echo "   Uncheck 'Securely store Docker logins in macOS keychain'"
    echo ""
    echo "3. Contact support with this error"
    exit 1
fi

# Pull all images
echo ""
echo "📥 Pulling Docker images..."
echo "This may take a few minutes depending on your internet speed..."

$COMPOSE_COMMAND pull || {
    echo "❌ Failed to pull images."
    echo "Please check your internet connection and try again."
    exit 1
}

# Start services
echo ""
echo "🚀 Starting services..."
$COMPOSE_COMMAND up -d

# Wait for services with progress indicator
echo ""
echo "⏳ Waiting for services to start..."
for i in {1..30}; do
    echo -n "."
    sleep 1
done
echo ""

# Check health
echo ""
echo "🏥 Checking service health..."
$COMPOSE_COMMAND ps

# Check if services are actually running
BACKEND_RUNNING=$($COMPOSE_COMMAND ps backend | grep -c "Up")
WEBSERVER_RUNNING=$($COMPOSE_COMMAND ps webserver | grep -c "Up")

if [ "$BACKEND_RUNNING" -eq 0 ] || [ "$WEBSERVER_RUNNING" -eq 0 ]; then
    echo ""
    echo "⚠️  Some services didn't start properly."
    echo "Check logs with: $COMPOSE_COMMAND logs"
else
    echo ""
    echo "========================================="
    echo "✅ Installation Complete!"
    echo "========================================="
    echo ""
    echo "Access the dashboard at:"
    echo "  📌 http://localhost"
    echo "  🔒 https://localhost (self-signed cert warning is normal)"
    echo ""
    echo "Login credentials:"
    echo "  👤 Username: admin"
    echo "  🔑 Password: admin123"
    echo ""
    echo "Available services:"
    echo "  📊 Dashboard: https://localhost"
    echo "  🔌 API: https://localhost/api"
    echo "  💻 Terminal: https://localhost/terminal/"
    echo "  🖥️  Remote Desktop: https://localhost/guacamole/"
    echo ""
    echo "Useful commands:"
    echo "  View logs: $COMPOSE_COMMAND logs -f"
    echo "  Stop services: $COMPOSE_COMMAND stop"
    echo "  Start services: $COMPOSE_COMMAND start"
    echo "  Restart services: $COMPOSE_COMMAND restart"
    echo "  Remove everything: ./uninstall.sh"
    echo ""
fi
