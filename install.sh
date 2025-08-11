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

# Download docker-compose.yml
echo "📥 Downloading configuration..."
curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/docker-compose.yml \
    -o docker-compose.yml || {
    echo "❌ Failed to download docker-compose.yml"
    exit 1
}

# Create necessary directories
mkdir -p init-db ssl guacamole scripts

# Download database initialization script
echo "📥 Downloading database schema..."
curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/init-db/01-init.sql \
    -o init-db/01-init.sql 2>/dev/null || echo "⚠️  DB init script not found, will use defaults"

# Download Guacamole schema files
echo "📥 Downloading Guacamole configuration..."
curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/guacamole/001-create-schema.sql \
    -o guacamole/001-create-schema.sql 2>/dev/null || echo "⚠️  Guacamole schema will be initialized later"

curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/guacamole/002-create-admin-user.sql \
    -o guacamole/002-create-admin-user.sql 2>/dev/null || true

curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/guacamole/custom-sftp.sql \
    -o guacamole/custom-sftp.sql 2>/dev/null || true

# Download build script for maintenance
echo "📥 Downloading maintenance scripts..."
curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/scripts/build.sh \
    -o scripts/build.sh 2>/dev/null && chmod +x scripts/build.sh

# Download setup-env script (used by build.sh for environment setup)
curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/scripts/setup-env.sh \
    -o scripts/setup-env.sh 2>/dev/null && chmod +x scripts/setup-env.sh

# Create .env file with secure defaults
echo "🔐 Generating secure configuration..."

# Generate passwords
DB_PASS=$(openssl rand -base64 24 2>/dev/null || echo "dashboard_pass123")
ROOT_PASS=$(openssl rand -base64 32 2>/dev/null || echo "root_pass123")
JWT=$(openssl rand -hex 32 2>/dev/null || echo "default-jwt-secret-change-in-production")
SESSION=$(openssl rand -hex 32 2>/dev/null || echo "default-session-secret-change-in-production")
SSH_KEY=$(openssl rand -hex 32 2>/dev/null || echo "default-ssh-secret-change-in-production")
TTYD_PASS=$(openssl rand -base64 16 2>/dev/null || echo "ttyd_pass123")

cat > .env << EOF
# Auto-generated secure configuration
# Database Configuration
DB_HOST=database
DB_PORT=3306
DB_NAME=appliance_dashboard
DB_USER=dashboard_user
DB_PASSWORD=${DB_PASS}
MYSQL_ROOT_PASSWORD=${ROOT_PASS}
MYSQL_DATABASE=appliance_dashboard
MYSQL_USER=dashboard_user
MYSQL_PASSWORD=${DB_PASS}

# Security
JWT_SECRET=${JWT}
SESSION_SECRET=${SESSION}
SSH_KEY_ENCRYPTION_SECRET=${SSH_KEY}
ENCRYPTION_SECRET=${SSH_KEY}

# CORS Settings
ALLOWED_ORIGINS=http://localhost,https://localhost

# Network Configuration  
HTTP_PORT=9080
HTTPS_PORT=9443
EXTERNAL_URL=http://localhost:9080

# TTYD Configuration
TTYD_USERNAME=admin
TTYD_PASSWORD=${TTYD_PASS}

# Guacamole Configuration (CRITICAL: Use correct password!)
GUACAMOLE_URL=http://localhost:9080/guacamole
GUACAMOLE_PROXY_URL=/guacamole/
GUACAMOLE_DB_HOST=appliance_guacamole_db
GUACAMOLE_DB_NAME=guacamole_db
GUACAMOLE_DB_USER=guacamole_user
GUACAMOLE_DB_PASSWORD=guacamole_pass123

# Container Names
DB_CONTAINER_NAME=appliance_db
BACKEND_CONTAINER_NAME=appliance_backend
WEBSERVER_CONTAINER_NAME=appliance_webserver
TTYD_CONTAINER_NAME=appliance_ttyd
GUACAMOLE_CONTAINER_NAME=appliance_guacamole
GUACAMOLE_DB_CONTAINER_NAME=appliance_guacamole_db
GUACD_CONTAINER_NAME=appliance_guacd

# Network
NETWORK_NAME=appliance_network
EOF

# Generate SSL certificates
echo "🔒 Generating SSL certificates..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" \
    2>/dev/null || {
    echo "⚠️  Could not generate SSL certificates, using HTTP only"
}

# Pull images
echo "🐳 Pulling Docker images..."
docker compose pull 2>/dev/null || echo "⚠️  Some images couldn't be pulled"

# Start services
echo "🚀 Starting services..."
docker compose up -d

# Wait for database
echo "⏳ Waiting for database to be ready..."
for i in {1..30}; do
    if docker exec appliance_db mysqladmin ping -h localhost -u root -p${ROOT_PASS} &>/dev/null; then
        echo "✅ Database is ready"
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

# Initialize Guacamole database if needed
echo "🔧 Checking Guacamole database..."
sleep 5

# Check if Guacamole tables exist
TABLES_EXIST=$(docker exec appliance_guacamole_db psql -U guacamole_user -d guacamole_db -tAc \
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'guacamole_connection');" 2>/dev/null || echo "f")

if [ "$TABLES_EXIST" = "f" ]; then
    echo "📝 Initializing Guacamole database..."
    
    # Try to load local schema files first
    if [ -f "guacamole/001-create-schema.sql" ]; then
        docker exec -i appliance_guacamole_db sh -c "PGPASSWORD=guacamole_pass123 psql -U guacamole_user -d guacamole_db" \
            < guacamole/001-create-schema.sql >/dev/null 2>&1
        
        if [ -f "guacamole/002-create-admin-user.sql" ]; then
            docker exec -i appliance_guacamole_db sh -c "PGPASSWORD=guacamole_pass123 psql -U guacamole_user -d guacamole_db" \
                < guacamole/002-create-admin-user.sql >/dev/null 2>&1
        fi
        
        echo "✅ Guacamole database initialized"
    else
        echo "⚠️  Guacamole schema files not found - Remote Desktop may not work initially"
        echo "   Run: cd $INSTALL_DIR && ./scripts/build.sh"
    fi
    
    # Restart Guacamole
    docker compose restart guacamole >/dev/null 2>&1
fi

# Final status check
echo ""
echo "📊 Service Status:"
docker compose ps

echo ""
echo "✅ Installation complete!"
echo ""
echo "📱 Access your dashboard at:"
echo "   🌐 http://localhost:9080"
echo "   🔒 https://localhost:9443 (self-signed certificate)"
echo ""
echo "📝 Default Credentials:"
echo "   Dashboard: admin / admin123"
echo "   Guacamole: guacadmin / guacadmin"
echo ""
echo "📁 Installation: $INSTALL_DIR"
echo "🛠️  Maintenance: cd $INSTALL_DIR && ./scripts/build.sh --help"
echo ""
echo "🛑 Stop: cd $INSTALL_DIR && docker compose down"
echo "🔄 Update: cd $INSTALL_DIR && docker compose pull && docker compose up -d"
echo ""
echo "🎉 Enjoy your Web Appliance Dashboard!"
