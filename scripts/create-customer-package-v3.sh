#!/bin/bash

# Web Appliance Dashboard Customer Package Creator v3.0
# Open Source Edition (MIT License)
# Creates a deployment package without authentication requirements

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PACKAGE_DIR="${PROJECT_ROOT}/customer-package"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="web-appliance-dashboard-${TIMESTAMP}"
PACKAGE_PATH="${PACKAGE_DIR}/${PACKAGE_NAME}"

# Print header
echo -e "${GREEN}=== Web Appliance Dashboard Customer Package Creator v3.0 ===${NC}"
echo -e "${GREEN}=== Open Source Edition (MIT License) ===${NC}"
echo ""

# Validate project structure
echo "🔍 Validating project structure..."
if [ ! -f "${PROJECT_ROOT}/docker-compose.yml" ]; then
    echo -e "${RED}❌ Error: docker-compose.yml not found in project root${NC}"
    exit 1
fi

if [ ! -d "${PROJECT_ROOT}/init-db" ]; then
    echo -e "${RED}❌ Error: init-db directory not found${NC}"
    exit 1
fi

# Create package directory
echo "📦 Creating package: ${PACKAGE_NAME}"
rm -rf "${PACKAGE_PATH}"
mkdir -p "${PACKAGE_PATH}"

# Copy database initialization
echo "📄 Copying database schema..."
cp -r "${PROJECT_ROOT}/init-db" "${PACKAGE_PATH}/"

# Create SSL directory and generate self-signed certificate
echo "🔐 Generating self-signed SSL certificate..."
mkdir -p "${PACKAGE_PATH}/ssl"
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "${PACKAGE_PATH}/ssl/key.pem" \
    -out "${PACKAGE_PATH}/ssl/cert.pem" \
    -subj "/C=DE/ST=State/L=City/O=Organization/CN=localhost" \
    2>/dev/null

# Create nginx configuration directory
mkdir -p "${PACKAGE_PATH}/nginx"

# Create nginx.conf without Lua
cat > "${PACKAGE_PATH}/nginx/nginx.conf" << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    
    sendfile on;
    keepalive_timeout 65;
    
    # Include additional configurations
    include /etc/nginx/conf.d/*.conf;
}
EOF

# Create default.conf without Lua variables
cat > "${PACKAGE_PATH}/nginx/default.conf" << 'EOF'
server {
    listen 80 default_server;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Increase body size limit for large background images and backup files
    client_max_body_size 50G;

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # WebSocket proxy for terminal connections
    location ~ ^/api/terminal/(.*)$ {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 10s;
    }

    # WebSocket proxy for terminal-session
    location = /api/terminal-session {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 10s;
    }

    # Server-Sent Events (SSE) proxy
    location /api/sse/stream {
        proxy_pass http://backend:3001/api/sse/stream$is_args$args;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_set_header Connection '';
        
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        chunked_transfer_encoding on;
        proxy_set_header X-Accel-Buffering no;
        keepalive_timeout 86400s;
    }

    # API routes
    location /api/ {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_set_header Connection "";
        
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # ttyd proxy (Terminal)
    location /ttyd/ {
        proxy_pass http://ttyd:7681/;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_buffering off;
    }

    # Guacamole proxy (Remote Desktop)
    location /guacamole/ {
        proxy_pass http://guacamole:8080/guacamole/;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $http_connection;
        
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_cookie_path /guacamole/ /guacamole/;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}

# HTTPS server configuration
server {
    listen 443 ssl default_server;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SSL configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 50G;

    # Same locations as HTTP server
    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~ ^/api/terminal/(.*)$ {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 10s;
    }

    location = /api/terminal-session {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 10s;
    }

    location /api/sse/stream {
        proxy_pass http://backend:3001/api/sse/stream$is_args$args;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_set_header Connection '';
        
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        chunked_transfer_encoding on;
        proxy_set_header X-Accel-Buffering no;
        keepalive_timeout 86400s;
    }

    location /api/ {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_set_header Connection "";
        
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        
        proxy_buffering off;
        proxy_request_buffering off;
    }

    location /ttyd/ {
        proxy_pass http://ttyd:7681/;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_buffering off;
    }

    location /guacamole/ {
        proxy_pass http://guacamole:8080/guacamole/;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $http_connection;
        
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_cookie_path /guacamole/ /guacamole/;
    }

    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Create docker-compose.yml with corrected health check
cat > "${PACKAGE_PATH}/docker-compose.yml" << 'EOF'
version: '3.8'

services:
  database:
    image: mariadb:latest
    container_name: appliance_db
    hostname: database
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - db_data:/var/lib/mysql
      - ./init-db:/docker-entrypoint-initdb.d:ro
    networks:
      - appliance_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 10s

  backend:
    image: ghcr.io/alflewerken/web-appliance-dashboard-backend:latest
    container_name: appliance_backend
    hostname: backend
    depends_on:
      database:
        condition: service_healthy
    environment:
      # Database
      DB_HOST: database
      DB_PORT: 3306
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: ${DB_NAME}
      # App Configuration
      NODE_ENV: production
      PORT: 3001
      JWT_SECRET: ${JWT_SECRET}
      SESSION_SECRET: ${SESSION_SECRET}
      # Feature Flags
      ENABLE_CORS: "true"
      CORS_ORIGIN: ${CORS_ORIGIN}
      REQUIRE_AUTH: "false"
      # Guacamole Integration
      GUACAMOLE_URL: http://guacamole:8080/guacamole
      GUACAMOLE_DB_HOST: guacamole-postgres
      GUACAMOLE_DB_PORT: 5432
      GUACAMOLE_DB_NAME: guacamole_db
      GUACAMOLE_DB_USER: guacamole_user
      GUACAMOLE_DB_PASSWORD: ${GUACAMOLE_DB_PASSWORD}
    volumes:
      - backend_uploads:/app/uploads
      - backend_logs:/app/logs
      - ssh_keys:/app/ssh-keys
    networks:
      - appliance_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s

  webserver:
    image: nginx:alpine
    container_name: appliance_webserver
    hostname: webserver
    ports:
      - "${HTTP_PORT}:80"
      - "${HTTPS_PORT}:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - frontend_data:/usr/share/nginx/html:ro
    depends_on:
      - backend
    networks:
      - appliance_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  ttyd:
    image: ghcr.io/alflewerken/web-appliance-dashboard-ttyd:latest
    container_name: appliance_ttyd
    hostname: ttyd
    environment:
      TTYD_USERNAME: ${TTYD_USERNAME}
      TTYD_PASSWORD: ${TTYD_PASSWORD}
      TTYD_PORT: 7681
    volumes:
      - terminal_sessions:/var/lib/ttyd
    networks:
      - appliance_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7681/"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  guacd:
    image: guacamole/guacd:latest
    container_name: appliance_guacd
    hostname: guacd
    networks:
      - appliance_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "nc", "-z", "localhost", "4822"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  guacamole-postgres:
    image: postgres:15-alpine
    container_name: appliance_guacamole_db
    hostname: guacamole-postgres
    environment:
      POSTGRES_DB: guacamole_db
      POSTGRES_USER: guacamole_user
      POSTGRES_PASSWORD: ${GUACAMOLE_DB_PASSWORD}
    volumes:
      - guacamole_postgres_data:/var/lib/postgresql/data
    networks:
      - appliance_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U guacamole_user -d guacamole_db"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  guacamole:
    image: ghcr.io/alflewerken/web-appliance-dashboard-guacamole:latest
    container_name: appliance_guacamole
    hostname: guacamole
    depends_on:
      - guacd
      - guacamole-postgres
    environment:
      GUACD_HOSTNAME: guacd
      GUACD_PORT: 4822
      POSTGRES_DATABASE: guacamole_db
      POSTGRES_HOSTNAME: guacamole-postgres
      POSTGRES_PASSWORD: ${GUACAMOLE_DB_PASSWORD}
      POSTGRES_USER: guacamole_user
      POSTGRES_PORT: 5432
    volumes:
      - guacamole_home:/opt/guacamole/home
    networks:
      - appliance_network
    restart: unless-stopped

networks:
  appliance_network:
    driver: bridge
    name: appliance_network

volumes:
  db_data:
  backend_uploads:
  backend_logs:
  ssh_keys:
  terminal_sessions:
  guacamole_home:
  guacamole_postgres_data:
  frontend_data:
EOF

# Create .env file
cat > "${PACKAGE_PATH}/.env" << EOF
# Database Configuration
DB_ROOT_PASSWORD=$(openssl rand -base64 32)
DB_NAME=appliance_db
DB_USER=appliance_user
DB_PASSWORD=$(openssl rand -base64 24)

# Application Secrets
JWT_SECRET=$(openssl rand -base64 48)
SESSION_SECRET=$(openssl rand -base64 48)

# CORS Configuration (will be updated by install script)
CORS_ORIGIN=http://localhost,https://localhost

# Port Configuration
HTTP_PORT=80
HTTPS_PORT=443

# Terminal (ttyd) Configuration
TTYD_USERNAME=admin
TTYD_PASSWORD=$(openssl rand -base64 16)

# Guacamole Database
GUACAMOLE_DB_PASSWORD=$(openssl rand -base64 24)

# Service URLs (internal Docker network)
BACKEND_URL=http://backend:3001
TTYD_URL=http://ttyd:7681
GUACAMOLE_URL=http://guacamole:8080/guacamole
EOF

# Create install script with nginx extraction
cat > "${PACKAGE_PATH}/install.sh" << 'INSTALL_SCRIPT'
#!/bin/bash

# Web Appliance Dashboard Installer
# Open Source Edition

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Web Appliance Dashboard Installer ===${NC}"
echo -e "${GREEN}=== Open Source Edition (MIT License) ===${NC}"
echo ""

# Check Docker
DOCKER_CMD=""
if command -v docker &> /dev/null; then
    DOCKER_CMD="docker"
elif [ -f "/usr/local/bin/docker" ]; then
    DOCKER_CMD="/usr/local/bin/docker"
else
    echo -e "${RED}❌ Docker is not installed!${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check Docker Compose
COMPOSE_CMD=""
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif [ -f "/usr/local/bin/docker-compose" ]; then
    COMPOSE_CMD="/usr/local/bin/docker-compose"
elif [ -f "/usr/local/bin/docker" ] && /usr/local/bin/docker compose version &> /dev/null; then
    COMPOSE_CMD="/usr/local/bin/docker compose"
else
    echo -e "${RED}❌ Docker Compose is not installed!${NC}"
    exit 1
fi

# Add PATH for commands
export PATH="/usr/local/bin:$PATH"

echo "✅ Using Docker command: $DOCKER_CMD"
echo "✅ Using Docker Compose command: $COMPOSE_CMD"

# Detect hostname and update CORS
HOSTNAME=$(hostname -f 2>/dev/null || hostname)
FQDN=$(hostname -A 2>/dev/null | awk '{print $1}' || echo $HOSTNAME)

echo "🌐 Detected hostname: $HOSTNAME"
echo "🌐 Detected FQDN: $FQDN"

# Get local IP addresses
LOCAL_IPS=$(hostname -I 2>/dev/null | tr ' ' ',' || echo "")

# Update CORS origins in .env
echo "📝 Updating CORS configuration..."
CORS_ORIGINS="http://localhost,https://localhost,http://127.0.0.1,https://127.0.0.1"
CORS_ORIGINS="${CORS_ORIGINS},http://${HOSTNAME},https://${HOSTNAME}"
if [ "$FQDN" != "$HOSTNAME" ]; then
    CORS_ORIGINS="${CORS_ORIGINS},http://${FQDN},https://${FQDN}"
fi
if [ ! -z "$LOCAL_IPS" ]; then
    for IP in $(echo $LOCAL_IPS | tr ',' ' '); do
        if [ ! -z "$IP" ]; then
            CORS_ORIGINS="${CORS_ORIGINS},http://${IP},https://${IP}"
        fi
    done
fi

# Update .env file
if grep -q "^CORS_ORIGIN=" .env; then
    sed -i.bak "s|^CORS_ORIGIN=.*|CORS_ORIGIN=${CORS_ORIGINS}|" .env
else
    echo "CORS_ORIGIN=${CORS_ORIGINS}" >> .env
fi

# Regenerate SSL certificate for the actual hostname
echo "🔐 Regenerating SSL certificate for ${FQDN}..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -subj "/C=DE/ST=State/L=City/O=Organization/CN=${FQDN}" \
    2>/dev/null

# Extract frontend from nginx image
echo ""
echo "📥 Extracting frontend files..."
# Try to pull the nginx image first
if $DOCKER_CMD pull ghcr.io/alflewerken/web-appliance-dashboard-nginx:latest; then
    echo "   Creating temporary container for frontend extraction..."
    $DOCKER_CMD create --name temp-nginx ghcr.io/alflewerken/web-appliance-dashboard-nginx:latest >/dev/null 2>&1
    mkdir -p frontend
    if $DOCKER_CMD cp temp-nginx:/usr/share/nginx/html/. frontend/ 2>/dev/null; then
        echo "   ✅ Frontend files extracted successfully"
    else
        echo -e "${YELLOW}   ⚠️  Could not extract frontend files${NC}"
    fi
    $DOCKER_CMD rm temp-nginx >/dev/null 2>&1
else
    echo -e "${YELLOW}   ⚠️  Could not pull nginx image for frontend extraction${NC}"
    echo "   Frontend will need to be added manually"
fi

# Create frontend volume and copy files
echo "📂 Setting up frontend volume..."
$DOCKER_CMD volume create web-appliance-dashboard-frontend >/dev/null 2>&1 || true
if [ -d "frontend" ] && [ "$(ls -A frontend)" ]; then
    # Create a temporary container to copy files
    $DOCKER_CMD run --rm -v web-appliance-dashboard-frontend:/data -v "$(pwd)/frontend:/source" alpine cp -r /source/. /data/ 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Could not copy frontend to volume${NC}"
    }
fi

# Pull images
echo ""
echo "📥 Pulling Docker images..."
echo "ℹ️  No authentication required - images are publicly available"

# Pull custom images
for IMAGE in backend nginx ttyd guacamole; do
    echo "   Pulling $IMAGE..."
    if $DOCKER_CMD pull ghcr.io/alflewerken/web-appliance-dashboard-${IMAGE}:latest; then
        echo "   ✅ $IMAGE pulled successfully"
    else
        echo -e "${YELLOW}   ⚠️  Could not pull $IMAGE image (may not exist or network issue)${NC}"
    fi
done

# Pull standard images
echo "   Pulling standard images..."
$DOCKER_CMD pull mariadb:latest || echo "   ⚠️ Could not pull mariadb"
$DOCKER_CMD pull guacamole/guacd:latest || echo "   ⚠️ Could not pull guacd"
$DOCKER_CMD pull postgres:15-alpine || echo "   ⚠️ Could not pull postgres"
$DOCKER_CMD pull nginx:alpine || echo "   ⚠️ Could not pull nginx:alpine"

echo ""
echo "✅ Image pull complete"

# Start services
echo ""
echo "🚀 Starting services..."

# Stop any existing containers
$COMPOSE_CMD down 2>/dev/null || true

# Start database first
echo "   Starting database..."
$COMPOSE_CMD up -d database

# Wait for database
echo "   Waiting for database to be ready..."
sleep 5
for i in {1..30}; do
    if $DOCKER_CMD exec appliance_db mysqladmin ping -h localhost --silent 2>/dev/null; then
        echo -e "${GREEN}   ✅ Database is ready${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

# Start all other services
echo "   Starting core services..."
$COMPOSE_CMD up -d

# Wait for services to be ready
echo "   Waiting for services to start..."
sleep 10

# Check service status
echo ""
echo "🔍 Checking service status..."
$DOCKER_CMD ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | grep -E "(NAMES|appliance_)" || true

# Show access information
echo ""
echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo "📱 Access the dashboard at:"
echo "   HTTP:  http://${FQDN}"
echo "   HTTPS: https://${FQDN}"
if [ ! -z "$LOCAL_IPS" ]; then
    for IP in $(echo $LOCAL_IPS | tr ',' ' '); do
        if [ ! -z "$IP" ]; then
            echo "   HTTP:  http://${IP}"
            echo "   HTTPS: https://${IP}"
        fi
    done
fi
echo ""
echo "🔐 Default credentials:"
echo "   No authentication required (Open Source Edition)"
echo ""
echo "📚 Documentation:"
echo "   https://github.com/alflewerken/web-appliance-dashboard"
echo ""
echo -e "${YELLOW}⚠️  Note: HTTPS uses a self-signed certificate.${NC}"
echo -e "${YELLOW}    Your browser will show a security warning.${NC}"
INSTALL_SCRIPT

chmod +x "${PACKAGE_PATH}/install.sh"

# Create uninstall script
cat > "${PACKAGE_PATH}/uninstall.sh" << 'UNINSTALL_SCRIPT'
#!/bin/bash

# Web Appliance Dashboard Uninstaller

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}=== Web Appliance Dashboard Uninstaller ===${NC}"
echo ""
echo -e "${RED}⚠️  Warning: This will remove all containers and data!${NC}"
echo -n "Are you sure you want to continue? (yes/no): "
read CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Uninstall cancelled."
    exit 0
fi

# Find docker-compose command
COMPOSE_CMD=""
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif [ -f "/usr/local/bin/docker-compose" ]; then
    COMPOSE_CMD="/usr/local/bin/docker-compose"
elif [ -f "/usr/local/bin/docker" ] && /usr/local/bin/docker compose version &> /dev/null; then
    COMPOSE_CMD="/usr/local/bin/docker compose"
fi

export PATH="/usr/local/bin:$PATH"

echo "🗑️  Stopping and removing containers..."
$COMPOSE_CMD down -v

echo "🗑️  Removing frontend volume..."
docker volume rm web-appliance-dashboard-frontend 2>/dev/null || true

echo ""
echo -e "${GREEN}✅ Uninstall complete!${NC}"
UNINSTALL_SCRIPT

chmod +x "${PACKAGE_PATH}/uninstall.sh"

# Create troubleshooting script
cat > "${PACKAGE_PATH}/troubleshoot.sh" << 'TROUBLESHOOT_SCRIPT'
#!/bin/bash

# Web Appliance Dashboard Troubleshooting Script

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}=== Web Appliance Dashboard Troubleshooting ===${NC}"
echo ""

# Add PATH
export PATH="/usr/local/bin:$PATH"

# Find docker command
DOCKER_CMD=""
if command -v docker &> /dev/null; then
    DOCKER_CMD="docker"
elif [ -f "/usr/local/bin/docker" ]; then
    DOCKER_CMD="/usr/local/bin/docker"
fi

echo "📊 Container Status:"
$DOCKER_CMD ps -a --format "table {{.Names}}\t{{.Status}}" | grep -E "(NAMES|appliance_)" || echo "No containers found"

echo ""
echo "📝 Recent logs from each service:"
for SERVICE in appliance_db appliance_backend appliance_webserver appliance_ttyd appliance_guacamole; do
    echo ""
    echo "--- $SERVICE ---"
    $DOCKER_CMD logs $SERVICE --tail 10 2>&1 || echo "Container $SERVICE not found"
done

echo ""
echo "🌐 Network Configuration:"
$DOCKER_CMD network inspect appliance_network 2>/dev/null | grep -A 3 "Containers" || echo "Network not found"

echo ""
echo "💾 Volumes:"
$DOCKER_CMD volume ls | grep appliance || echo "No volumes found"

echo ""
echo -e "${GREEN}Troubleshooting complete!${NC}"
TROUBLESHOOT_SCRIPT

chmod +x "${PACKAGE_PATH}/troubleshoot.sh"

# Create README
cat > "${PACKAGE_PATH}/README.md" << 'README'
# Web Appliance Dashboard - Customer Package

## Open Source Edition (MIT License)

This package contains everything needed to deploy the Web Appliance Dashboard.

## Prerequisites

- Docker and Docker Compose installed
- Ports 80 and 443 available
- Minimum 2GB RAM recommended

## Installation

1. Extract the package:
   ```bash
   tar -xzf web-appliance-dashboard-*.tar.gz
   cd web-appliance-dashboard-*
   ```

2. Run the installer:
   ```bash
   ./install.sh
   ```

3. Access the dashboard:
   - HTTP: http://your-server
   - HTTPS: https://your-server (self-signed certificate)

## Configuration

All configuration is stored in the `.env` file. Key settings:
- `HTTP_PORT`: HTTP port (default: 80)
- `HTTPS_PORT`: HTTPS port (default: 443)
- `CORS_ORIGIN`: Allowed origins (automatically configured)

## Services

The dashboard includes:
- **Backend API**: Node.js application server
- **Database**: MariaDB for data storage
- **Web Server**: Nginx for frontend and proxy
- **Terminal**: Web-based terminal access (ttyd)
- **Remote Desktop**: Guacamole for RDP/VNC connections

## Troubleshooting

Run the troubleshooting script:
```bash
./troubleshoot.sh
```

## Uninstall

To completely remove the installation:
```bash
./uninstall.sh
```

⚠️ **Warning**: This will delete all data!

## Support

- GitHub: https://github.com/alflewerken/web-appliance-dashboard
- Issues: https://github.com/alflewerken/web-appliance-dashboard/issues

## License

MIT License - See LICENSE file for details.
README

# Create LICENSE file
cat > "${PACKAGE_PATH}/LICENSE" << 'LICENSE'
MIT License

Copyright (c) 2024 Web Appliance Dashboard

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
LICENSE

# Create the package
echo ""
echo "📦 Creating tar.gz package..."
cd "${PACKAGE_DIR}"
tar -czf "${PACKAGE_NAME}.tar.gz" "${PACKAGE_NAME}"

# Clean up directory
rm -rf "${PACKAGE_PATH}"

# Show summary
echo ""
echo -e "${GREEN}✅ Package created successfully!${NC}"
echo ""
echo "📦 Package location: ${PACKAGE_DIR}/${PACKAGE_NAME}.tar.gz"
echo "📏 Package size: $(du -h "${PACKAGE_DIR}/${PACKAGE_NAME}.tar.gz" | cut -f1)"
echo ""
echo "📋 Installation instructions:"
echo "1. Copy the package to the target server"
echo "2. Extract: tar -xzf ${PACKAGE_NAME}.tar.gz"
echo "3. Install: cd ${PACKAGE_NAME} && ./install.sh"
echo ""
echo -e "${GREEN}🎉 Package includes:${NC}"
echo "- Nginx configuration without Lua dependencies"
echo "- Corrected health check endpoints"
echo "- Frontend extraction from original image"
echo "- Automatic SSL certificate generation"
echo "- Support for standard nginx:alpine image"
echo "- Full troubleshooting script"
echo ""
echo -e "${YELLOW}📖 Note:${NC}"
echo "This package uses standard nginx:alpine instead of custom image"
echo "to avoid Lua dependency issues."
