#!/bin/bash

# One-line installer for Web Appliance Dashboard
# Users can run this with:
# curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/install.sh | bash

set -e

echo "🚀 Web Appliance Dashboard - Quick Installer"
echo "==========================================="
echo ""

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check for Docker Compose
if ! docker compose version &> /dev/null 2>&1 && ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed!"
    exit 1
fi

# Create installation directory
INSTALL_DIR="${HOME}/web-appliance-dashboard"
echo "📁 Installing to: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Download docker-compose.yml directly from GitHub
echo "📥 Downloading configuration..."
curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/docker-compose.yml \
    -o docker-compose.yml

# Create necessary directories
mkdir -p init-db ssl uploads logs terminal_sessions

# Download database initialization script
echo "📥 Downloading database schema..."
curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/init-db/01-init.sql \
    -o init-db/01-init.sql

# Create .env file with secure defaults
echo "🔐 Generating secure configuration..."

# Generate passwords once to ensure consistency
DB_PASS=$(openssl rand -base64 24)
ROOT_PASS=$(openssl rand -base64 32)
JWT=$(openssl rand -base64 48)
SESSION=$(openssl rand -base64 48)
SSH_KEY=$(openssl rand -base64 32)
TTYD_PASS=$(openssl rand -base64 16)
GUAC_DB_PASS=$(openssl rand -base64 24)

cat > .env << EOF
# Auto-generated secure configuration
# Database Configuration
DB_HOST=appliance_db
DB_PORT=3306
DB_NAME=appliance_db
DB_USER=appliance_user
DB_PASSWORD=${DB_PASS}
MYSQL_ROOT_PASSWORD=${ROOT_PASS}
MYSQL_DATABASE=appliance_db
MYSQL_USER=appliance_user
MYSQL_PASSWORD=${DB_PASS}

# Security
JWT_SECRET=${JWT}
SESSION_SECRET=${SESSION}
SSH_KEY_ENCRYPTION_SECRET=${SSH_KEY}

# CORS Settings
ALLOWED_ORIGINS=http://localhost,https://localhost

# Network Configuration  
HTTP_PORT=80
HTTPS_PORT=443
EXTERNAL_URL=http://localhost

# TTYD Configuration
TTYD_USERNAME=admin
TTYD_PASSWORD=${TTYD_PASS}

# Guacamole Configuration
GUACAMOLE_URL=http://guacamole:8080/guacamole
GUACAMOLE_PROXY_URL=/guacamole/
GUACAMOLE_DB_HOST=appliance_guacamole_db
GUACAMOLE_DB_NAME=guacamole_db
GUACAMOLE_DB_USER=guacamole_user
GUACAMOLE_DB_PASSWORD=${GUAC_DB_PASS}
EOF

# Generate SSL certificates
echo "🔒 Generating SSL certificates..."
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" \
    2>/dev/null

# Pull and start services
echo "🐳 Starting services..."
docker compose pull
docker compose up -d

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 15

# Check status
echo ""
echo "📊 Service Status:"
docker compose ps

echo ""
echo "✅ Installation complete!"
echo ""
echo "📱 Access your dashboard at:"
echo "   http://localhost"
echo "   https://localhost (self-signed certificate)"
echo ""
echo "📁 Installation directory: $INSTALL_DIR"
echo "📝 Configuration file: $INSTALL_DIR/.env"
echo ""
echo "🛑 To stop services: cd $INSTALL_DIR && docker compose down"
echo "🔄 To update: cd $INSTALL_DIR && docker compose pull && docker compose up -d"
echo ""
echo "🎉 Enjoy your Web Appliance Dashboard!"
