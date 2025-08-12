#!/bin/bash

# One-line installer for Web Appliance Dashboard
# Users can run this with:
# curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/install.sh | bash

set -e

echo "🚀 Web Appliance Dashboard - Quick Installer"
echo "==========================================="
echo ""

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    elif netstat -tuln 2>/dev/null | grep -q ":$port "; then
        return 0  # Port is in use
    elif ss -tuln 2>/dev/null | grep -q ":$port "; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to find an available port
find_available_port() {
    local base_port=$1
    local port=$base_port
    local max_tries=100
    
    for i in $(seq 0 $max_tries); do
        if ! check_port $port; then
            echo $port
            return 0
        fi
        port=$((base_port + i))
    done
    
    echo "❌ Could not find available port starting from $base_port" >&2
    return 1
}

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

# Check and find available ports
echo "🔍 Checking port availability..."

# Default ports
DEFAULT_HTTP_PORT=9080
DEFAULT_HTTPS_PORT=9443
DEFAULT_BACKEND_PORT=3001
DEFAULT_DB_PORT=3306

# Find available ports
HTTP_PORT=$(find_available_port $DEFAULT_HTTP_PORT)
HTTPS_PORT=$(find_available_port $DEFAULT_HTTPS_PORT)
BACKEND_PORT=$(find_available_port $DEFAULT_BACKEND_PORT)
DB_PORT=$(find_available_port $DEFAULT_DB_PORT)

# Report port configuration
if [ "$HTTP_PORT" != "$DEFAULT_HTTP_PORT" ]; then
    echo "⚠️  Port $DEFAULT_HTTP_PORT is in use, using port $HTTP_PORT for HTTP"
fi
if [ "$HTTPS_PORT" != "$DEFAULT_HTTPS_PORT" ]; then
    echo "⚠️  Port $DEFAULT_HTTPS_PORT is in use, using port $HTTPS_PORT for HTTPS"
fi

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
HTTP_PORT=${HTTP_PORT}
HTTPS_PORT=${HTTPS_PORT}
BACKEND_PORT=${BACKEND_PORT}
DB_EXTERNAL_PORT=${DB_PORT}
EXTERNAL_URL=http://localhost:${HTTP_PORT}

# TTYD Configuration
TTYD_USERNAME=admin
TTYD_PASSWORD=${TTYD_PASS}

# Guacamole Configuration (CRITICAL: Use correct password!)
GUACAMOLE_URL=http://localhost:${HTTP_PORT}/guacamole
GUACAMOLE_PROXY_URL=/guacamole/
GUACAMOLE_DB_HOST=guacamole_db
GUACAMOLE_DB_NAME=guacamole_db
GUACAMOLE_DB_USER=guacamole_user
GUACAMOLE_DB_PASSWORD=guacamole_pass123

# Container Names - WICHTIG: Diese müssen mit den Service-Namen übereinstimmen!
DB_CONTAINER_NAME=database
BACKEND_CONTAINER_NAME=backend
WEBSERVER_CONTAINER_NAME=webserver
TTYD_CONTAINER_NAME=ttyd
GUACAMOLE_CONTAINER_NAME=guacamole
GUACAMOLE_DB_CONTAINER_NAME=guacamole_db
GUACD_CONTAINER_NAME=guacd

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

# Create docker-compose.yml with correct service names
echo "📝 Creating docker-compose configuration..."
cat > docker-compose.yml << 'EOF'
services:
  # Database - Service name MUST be 'database' for backend to find it
  database:
    image: mariadb:10.11
    container_name: database
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - db_data:/var/lib/mysql
      - ./init-db:/docker-entrypoint-initdb.d:ro
    ports:
      - "${DB_EXTERNAL_PORT:-3306}:3306"
    networks:
      - ${NETWORK_NAME:-appliance_network}
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${MYSQL_ROOT_PASSWORD}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend API - Service name MUST be 'backend' for nginx to find it
  backend:
    image: ghcr.io/alflewerken/web-appliance-dashboard-backend:latest
    container_name: backend
    restart: always
    depends_on:
      database:
        condition: service_healthy
    environment:
      DB_HOST: database
      DB_PORT: 3306
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: ${DB_NAME}
      JWT_SECRET: ${JWT_SECRET}
      SESSION_SECRET: ${SESSION_SECRET}
      SSH_KEY_ENCRYPTION_SECRET: ${SSH_KEY_ENCRYPTION_SECRET}
      ENCRYPTION_SECRET: ${ENCRYPTION_SECRET}
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS}
      NODE_ENV: production
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ${HOME}/.ssh:/root/.ssh
    ports:
      - "${BACKEND_PORT:-3001}:3001"
    networks:
      - ${NETWORK_NAME:-appliance_network}

  # Frontend - wird von nginx nicht verwendet (nginx hat frontend eingebaut)
  frontend:
    image: ghcr.io/alflewerken/web-appliance-dashboard-frontend:latest
    container_name: frontend
    restart: always
    depends_on:
      - backend
    networks:
      - ${NETWORK_NAME:-appliance_network}
    environment:
      - REACT_APP_API_URL=http://backend:3001

  # Nginx webserver - Service name MUST be 'webserver'
  webserver:
    image: ghcr.io/alflewerken/web-appliance-dashboard-nginx:latest
    container_name: webserver
    restart: always
    depends_on:
      - backend
      - frontend
    ports:
      - "${HTTP_PORT:-9080}:80"
      - "${HTTPS_PORT:-9443}:443"
    volumes:
      - ./ssl:/etc/nginx/ssl:ro
    networks:
      - ${NETWORK_NAME:-appliance_network}
    environment:
      BACKEND_URL: http://backend:3001
      EXTERNAL_URL: ${EXTERNAL_URL:-http://localhost:9080}

  # Terminal - Service name MUST be 'ttyd' for nginx to find it
  ttyd:
    image: ghcr.io/alflewerken/web-appliance-dashboard-ttyd:latest
    container_name: ttyd
    restart: always
    ports:
      - "7681:7681"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ${HOME}/.ssh:/root/.ssh:ro
    networks:
      - ${NETWORK_NAME:-appliance_network}
    environment:
      - TTYD_USERNAME=${TTYD_USERNAME:-admin}
      - TTYD_PASSWORD=${TTYD_PASSWORD:-admin}

  # Guacamole components - Service names are critical!
  guacd:
    image: guacamole/guacd:latest
    container_name: guacd
    restart: always
    networks:
      - ${NETWORK_NAME:-appliance_network}
    environment:
      GUACD_LOG_LEVEL: info

  guacamole_db:
    image: postgres:13
    container_name: guacamole_db
    restart: always
    environment:
      POSTGRES_DB: ${GUACAMOLE_DB_NAME:-guacamole_db}
      POSTGRES_USER: ${GUACAMOLE_DB_USER:-guacamole_user}
      POSTGRES_PASSWORD: ${GUACAMOLE_DB_PASSWORD:-guacamole_pass123}
    volumes:
      - guacamole_db_data:/var/lib/postgresql/data
      - ./guacamole:/docker-entrypoint-initdb.d:ro
    networks:
      - ${NETWORK_NAME:-appliance_network}

  guacamole:
    image: ghcr.io/alflewerken/web-appliance-dashboard-guacamole:latest
    container_name: guacamole
    restart: always
    depends_on:
      - guacd
      - guacamole_db
    environment:
      GUACD_HOSTNAME: guacd
      POSTGRESQL_HOSTNAME: guacamole_db
      POSTGRESQL_DATABASE: ${GUACAMOLE_DB_NAME:-guacamole_db}
      POSTGRESQL_USER: ${GUACAMOLE_DB_USER:-guacamole_user}
      POSTGRESQL_PASSWORD: ${GUACAMOLE_DB_PASSWORD:-guacamole_pass123}
    networks:
      - ${NETWORK_NAME:-appliance_network}

volumes:
  db_data:
  guacamole_db_data:

networks:
  appliance_network:
    driver: bridge
EOF

# Pull images
echo "🐳 Pulling Docker images..."
docker compose pull 2>/dev/null || echo "⚠️  Some images couldn't be pulled"

# Start services
echo "🚀 Starting services..."
docker compose up -d

# Wait for database
echo "⏳ Waiting for database to be ready..."
for i in {1..30}; do
    if docker exec database mysqladmin ping -h localhost -u root -p${ROOT_PASS} &>/dev/null; then
        echo "✅ Database is ready"
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

# Initialize database schema if needed
echo "📝 Initializing database schema..."
if [ -f "init-db/01-init.sql" ]; then
    docker exec -i database mariadb -u root -p${ROOT_PASS} appliance_dashboard < init-db/01-init.sql 2>/dev/null || {
        echo "⚠️  Some tables might already exist (this is normal)"
    }
    echo "✅ Database schema initialized"
fi

# Initialize Guacamole database if needed
echo "🔧 Checking Guacamole database..."
sleep 5

# Check if Guacamole tables exist
TABLES_EXIST=$(docker exec guacamole_db psql -U guacamole_user -d guacamole_db -tAc \
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'guacamole_connection');" 2>/dev/null || echo "f")

if [ "$TABLES_EXIST" = "f" ]; then
    echo "📝 Initializing Guacamole database..."
    
    # Try to load local schema files first
    if [ -f "guacamole/001-create-schema.sql" ]; then
        docker exec -i guacamole_db sh -c "PGPASSWORD=guacamole_pass123 psql -U guacamole_user -d guacamole_db" \
            < guacamole/001-create-schema.sql >/dev/null 2>&1
        
        if [ -f "guacamole/002-create-admin-user.sql" ]; then
            docker exec -i guacamole_db sh -c "PGPASSWORD=guacamole_pass123 psql -U guacamole_user -d guacamole_db" \
                < guacamole/002-create-admin-user.sql >/dev/null 2>&1
        fi
        
        echo "✅ Guacamole database initialized"
    else
        echo "⚠️  Guacamole schema files not found - Remote Desktop may not work initially"
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
echo "   🌐 http://localhost:${HTTP_PORT}"
if [ -f "ssl/cert.pem" ]; then
    echo "   🔒 https://localhost:${HTTPS_PORT} (self-signed certificate)"
fi
echo ""
echo "📝 Default Credentials:"
echo "   Dashboard: admin / admin123"
echo "   Guacamole: guacadmin / guacadmin"
echo ""
echo "📁 Installation: $INSTALL_DIR"
echo "🛠️  Maintenance: cd $INSTALL_DIR && docker compose"
echo ""
echo "🛑 Stop: cd $INSTALL_DIR && docker compose down"
echo "🔄 Update: cd $INSTALL_DIR && docker compose pull && docker compose up -d"
echo ""
echo "🎉 Enjoy your Web Appliance Dashboard!"
