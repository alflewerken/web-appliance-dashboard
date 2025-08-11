#!/bin/bash

# Web Appliance Dashboard - Docker Installer Script
# This creates an installer container that sets up everything

cat << 'EOF' > Dockerfile.installer
FROM docker:latest

# Install required tools
RUN apk add --no-cache bash curl openssl git docker-compose

# Create working directory
WORKDIR /installer

# Create the installer script
RUN cat > /installer/install.sh << 'SCRIPT'
#!/bin/bash

set -e

echo "🚀 Web Appliance Dashboard Installer"
echo "===================================="
echo ""

# Check if running inside Docker
if [ ! -S /var/run/docker.sock ]; then
    echo "❌ Error: Docker socket not mounted"
    echo "Please run with: -v /var/run/docker.sock:/var/run/docker.sock"
    exit 1
fi

# Configuration
INSTALL_DIR="${INSTALL_DIR:-/opt/web-appliance-dashboard}"
HTTP_PORT="${HTTP_PORT:-80}"
HTTPS_PORT="${HTTPS_PORT:-443}"

echo "📦 Creating installation directory..."
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Generate docker-compose.yml
echo "📝 Generating docker-compose.yml..."
cat > docker-compose.yml << 'COMPOSE'
version: '3.8'

services:
  all-services:
    image: ghcr.io/alflewerken/web-appliance-dashboard:latest
    container_name: web-appliance-dashboard
    ports:
      - "${HTTP_PORT}:80"
      - "${HTTPS_PORT}:443"
    volumes:
      - data:/data
      - ./ssl:/etc/nginx/ssl
    restart: unless-stopped
    environment:
      - AUTO_SETUP=true

volumes:
  data:
COMPOSE

# Generate SSL certificates
echo "🔐 Generating SSL certificates..."
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" \
    2>/dev/null

# Start services
echo "🐳 Starting services..."
docker-compose up -d

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 10

# Get container IP
CONTAINER_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' web-appliance-dashboard)

echo ""
echo "✅ Installation complete!"
echo ""
echo "📱 Access your dashboard at:"
echo "   http://localhost:${HTTP_PORT}"
echo "   https://localhost:${HTTPS_PORT}"
echo ""
echo "🎉 Enjoy your Web Appliance Dashboard!"
SCRIPT

chmod +x /installer/install.sh

# Run the installer
ENTRYPOINT ["/installer/install.sh"]
EOF

# Build the installer image
docker build -f Dockerfile.installer -t ghcr.io/alflewerken/web-appliance-dashboard-installer:latest .

echo "Installer image created!"
echo ""
echo "To install Web Appliance Dashboard, run:"
echo "docker run --rm -v /var/run/docker.sock:/var/run/docker.sock ghcr.io/alflewerken/web-appliance-dashboard-installer:latest"
