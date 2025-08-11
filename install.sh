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

# Download docker-compose.yml
echo "📥 Downloading configuration..."
curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/docker-compose.yml \
    -o docker-compose.yml || {
    echo "❌ Failed to download docker-compose.yml"
    exit 1
}

# Modify docker-compose.yml to use pre-built images instead of building locally
echo "📝 Configuring to use pre-built images..."
sed -i.bak 's|build: ./frontend|image: ghcr.io/alflewerken/web-appliance-dashboard-frontend:latest|g' docker-compose.yml
sed -i.bak 's|build: ./backend|image: ghcr.io/alflewerken/web-appliance-dashboard-backend:latest|g' docker-compose.yml
sed -i.bak 's|build: ./nginx|image: ghcr.io/alflewerken/web-appliance-dashboard-nginx:latest|g' docker-compose.yml
sed -i.bak 's|build:|#build:|g' docker-compose.yml
rm -f docker-compose.yml.bak

# Create necessary directories
mkdir -p init-db ssl guacamole scripts nginx/conf.d frontend backend

# Download database initialization script
echo "📥 Downloading database schema..."
curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/init-db/01-init.sql \
    -o init-db/01-init.sql 2>/dev/null || echo "⚠️  DB init script not found, will use defaults"

# Download nginx configuration files
echo "📥 Downloading nginx configuration..."
curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/nginx/Dockerfile \
    -o nginx/Dockerfile 2>/dev/null || {
    # Create minimal nginx Dockerfile if download fails
    cat > nginx/Dockerfile << 'DOCKERFILE'
FROM nginx:alpine
COPY conf.d /etc/nginx/conf.d
RUN rm -f /etc/nginx/conf.d/default.conf
DOCKERFILE
}

curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/nginx/conf.d/default.conf \
    -o nginx/conf.d/default.conf 2>/dev/null || {
    # Create minimal nginx config if download fails
    cat > nginx/conf.d/default.conf << 'NGINX'
server {
    listen 80;
    server_name localhost;
    
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://backend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINX
}

curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/nginx/conf.d/guacamole-websocket.inc \
    -o nginx/conf.d/guacamole-websocket.inc 2>/dev/null || true

# Create minimal frontend and backend Dockerfiles
echo "📥 Setting up application structure..."
cat > frontend/Dockerfile << 'DOCKERFILE'
FROM node:18-alpine as builder
WORKDIR /app
RUN echo '<!DOCTYPE html><html><body><h1>Web Appliance Dashboard</h1><p>Frontend will be built here</p></body></html>' > index.html

FROM nginx:alpine
COPY --from=builder /app/index.html /usr/share/nginx/html/
DOCKERFILE

cat > backend/Dockerfile << 'DOCKERFILE'
FROM node:18-alpine
WORKDIR /app
RUN echo '{"name":"backend","version":"1.0.0"}' > package.json
CMD ["node", "-e", "console.log('Backend placeholder running')"]
DOCKERFILE

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
DEFAULT_RUSTDESK_ID_PORT=21116
DEFAULT_RUSTDESK_RELAY_PORT=21117
DEFAULT_RUSTDESK_WEB_PORT=21118
DEFAULT_RUSTDESK_API_PORT=21119
DEFAULT_RUSTDESK_WS_PORT=21120

# Find available ports
HTTP_PORT=$(find_available_port $DEFAULT_HTTP_PORT)
HTTPS_PORT=$(find_available_port $DEFAULT_HTTPS_PORT)
BACKEND_PORT=$(find_available_port $DEFAULT_BACKEND_PORT)
DB_PORT=$(find_available_port $DEFAULT_DB_PORT)

# RustDesk ports - if any is in use, shift all RustDesk ports together
if check_port $DEFAULT_RUSTDESK_ID_PORT || check_port $DEFAULT_RUSTDESK_RELAY_PORT || \
   check_port $DEFAULT_RUSTDESK_WEB_PORT || check_port $DEFAULT_RUSTDESK_API_PORT || \
   check_port $DEFAULT_RUSTDESK_WS_PORT; then
    echo "⚠️  RustDesk ports conflict detected, finding alternative port range..."
    
    # Find a base port where 5 consecutive ports are free
    BASE_PORT=22116
    for attempt in $(seq 0 20); do
        TEST_BASE=$((BASE_PORT + (attempt * 10)))
        if ! check_port $TEST_BASE && ! check_port $((TEST_BASE + 1)) && \
           ! check_port $((TEST_BASE + 2)) && ! check_port $((TEST_BASE + 3)) && \
           ! check_port $((TEST_BASE + 4)); then
            RUSTDESK_ID_PORT=$TEST_BASE
            RUSTDESK_RELAY_PORT=$((TEST_BASE + 1))
            RUSTDESK_WEB_PORT=$((TEST_BASE + 2))
            RUSTDESK_API_PORT=$((TEST_BASE + 3))
            RUSTDESK_WS_PORT=$((TEST_BASE + 4))
            echo "✅ Found alternative RustDesk ports: $RUSTDESK_ID_PORT-$RUSTDESK_WS_PORT"
            break
        fi
    done
    
    # If still not found, disable RustDesk
    if [ -z "$RUSTDESK_ID_PORT" ]; then
        echo "⚠️  Could not find 5 consecutive free ports for RustDesk"
        echo "   RustDesk will be disabled. You can enable it later by editing docker-compose.yml"
        RUSTDESK_ID_PORT=""
        RUSTDESK_RELAY_PORT=""
        RUSTDESK_WEB_PORT=""
        RUSTDESK_API_PORT=""
        RUSTDESK_WS_PORT=""
    fi
else
    RUSTDESK_ID_PORT=$DEFAULT_RUSTDESK_ID_PORT
    RUSTDESK_RELAY_PORT=$DEFAULT_RUSTDESK_RELAY_PORT
    RUSTDESK_WEB_PORT=$DEFAULT_RUSTDESK_WEB_PORT
    RUSTDESK_API_PORT=$DEFAULT_RUSTDESK_API_PORT
    RUSTDESK_WS_PORT=$DEFAULT_RUSTDESK_WS_PORT
fi

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

# RustDesk Ports (if available)
${RUSTDESK_ID_PORT:+RUSTDESK_ID_PORT=${RUSTDESK_ID_PORT}}
${RUSTDESK_RELAY_PORT:+RUSTDESK_RELAY_PORT=${RUSTDESK_RELAY_PORT}}
${RUSTDESK_WEB_PORT:+RUSTDESK_WEB_PORT=${RUSTDESK_WEB_PORT}}
${RUSTDESK_API_PORT:+RUSTDESK_API_PORT=${RUSTDESK_API_PORT}}
${RUSTDESK_WEBSOCKET_PORT:+RUSTDESK_WEBSOCKET_PORT=${RUSTDESK_WS_PORT}}

# TTYD Configuration
TTYD_USERNAME=admin
TTYD_PASSWORD=${TTYD_PASS}

# Guacamole Configuration (CRITICAL: Use correct password!)
GUACAMOLE_URL=http://localhost:${HTTP_PORT}/guacamole
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

# If RustDesk ports are not available, remove RustDesk services from docker-compose
if [ -z "$RUSTDESK_ID_PORT" ]; then
    echo "📝 Disabling RustDesk services in docker-compose.yml..."
    # Comment out RustDesk services
    sed -i.bak '/rustdesk-server:/,/^[[:space:]]*$/{s/^/#/}' docker-compose.yml
    sed -i.bak '/rustdesk-relay:/,/^[[:space:]]*$/{s/^/#/}' docker-compose.yml
fi

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
echo "   🌐 http://localhost:${HTTP_PORT}"
if [ -f "ssl/cert.pem" ]; then
    echo "   🔒 https://localhost:${HTTPS_PORT} (self-signed certificate)"
fi
echo ""
echo "📝 Default Credentials:"
echo "   Dashboard: admin / admin123"
echo "   Guacamole: guacadmin / guacadmin"
echo ""
if [ -n "$RUSTDESK_ID_PORT" ]; then
    echo "🖥️  RustDesk Ports:"
    echo "   ID Server: ${RUSTDESK_ID_PORT}"
    echo "   Relay: ${RUSTDESK_RELAY_PORT}"
    echo "   Web: ${RUSTDESK_WEB_PORT}"
    echo ""
fi
echo "📁 Installation: $INSTALL_DIR"
echo "🛠️  Maintenance: cd $INSTALL_DIR && ./scripts/build.sh --help"
echo ""
echo "🛑 Stop: cd $INSTALL_DIR && docker compose down"
echo "🔄 Update: cd $INSTALL_DIR && docker compose pull && docker compose up -d"
echo ""
echo "🎉 Enjoy your Web Appliance Dashboard!"
