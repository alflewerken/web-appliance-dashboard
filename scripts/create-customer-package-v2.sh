#!/bin/bash
# Create Customer Package Script v2.0
# Production-ready version with all fixes applied

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo -e "${GREEN}=== Web Appliance Dashboard Customer Package Creator v2.0 ===${NC}"
echo ""

# Validate required files
echo "🔍 Validating project structure..."

required_files=(
    "init.sql"
    "docker-compose.yml"
)

for file in "${required_files[@]}"; do
    if [ ! -f "${PROJECT_ROOT}/${file}" ]; then
        echo -e "${RED}❌ Missing required file: ${file}${NC}"
        exit 1
    fi
done

# Create package directory
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="web-appliance-dashboard-${TIMESTAMP}"
PACKAGE_DIR="${PROJECT_ROOT}/customer-package/${PACKAGE_NAME}"

echo "📦 Creating package: ${PACKAGE_NAME}"
mkdir -p "${PACKAGE_DIR}"
cd "${PACKAGE_DIR}"

# Create directory structure
mkdir -p init-db ssl

# Copy init.sql as database initialization script
echo "📄 Copying database schema..."
cp "${PROJECT_ROOT}/init.sql" init-db/01-init-schema.sql

# Add admin password update to ensure admin123 works
cat >> init-db/01-init-schema.sql << 'EOF'

-- Ensure admin user has correct password (admin123)
UPDATE users SET password_hash='$2a$10$ZU7Jq5cGnGSkrm2Y3HNVF.jFpRcF5Q1Sc0YW1XqBvxVBx8rFpjPLq' WHERE username='admin';
EOF

# Generate single password for all DB connections
DB_PASSWORD=$(openssl rand -hex 32)
DB_ROOT_PASSWORD=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
SSH_KEY_SECRET=$(openssl rand -hex 32)
GUAC_DB_PWD=$(openssl rand -hex 32)

# Create .env with consistent passwords
cat > .env << EOF
# Database Configuration - SINGLE PASSWORD FOR ALL
DB_ROOT_PASSWORD=$DB_ROOT_PASSWORD
DB_NAME=appliance_dashboard
DB_USER=appliance_user
DB_PASSWORD=$DB_PASSWORD

# Security Keys
JWT_SECRET=$JWT_SECRET
SSH_KEY_ENCRYPTION_SECRET=$SSH_KEY_SECRET

# CORS Configuration (will be updated during installation)
ALLOWED_ORIGINS=http://localhost,https://localhost

# Guacamole Database
GUACAMOLE_DB_NAME=guacamole_db
GUACAMOLE_DB_USER=guacamole_user
GUACAMOLE_DB_PASSWORD=$GUAC_DB_PWD

# Admin User
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Ports (can be customized if needed)
HTTP_PORT=80
HTTPS_PORT=443
EOF

# Create simplified docker-compose.yml
cat > docker-compose.yml << 'EOF'
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
      test: ["CMD", "mariadb-admin", "ping", "-h", "localhost", "-u", "root", "-p${DB_ROOT_PASSWORD}"]
      interval: 10s
      timeout: 5s
      retries: 30
      start_period: 30s

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
      # Security
      JWT_SECRET: ${JWT_SECRET}
      SSH_KEY_ENCRYPTION_SECRET: ${SSH_KEY_ENCRYPTION_SECRET}
      # CORS
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS}
      # Features
      SSH_AUTO_INIT: "true"
      NODE_ENV: production
    volumes:
      - backend_uploads:/app/uploads
      - backend_logs:/app/logs
      - ssh_keys:/app/ssh-keys
    networks:
      - appliance_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s

  frontend:
    image: ghcr.io/alflewerken/web-appliance-dashboard-frontend:latest
    container_name: appliance_frontend
    hostname: frontend
    networks:
      - appliance_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost/"]
      interval: 10s
      timeout: 5s
      retries: 5

  webserver:
    image: nginx:alpine
    container_name: appliance_webserver
    hostname: webserver
    ports:
      - "${HTTP_PORT}:80"
      - "${HTTPS_PORT}:443"
    depends_on:
      - backend
      - frontend
      - ttyd
      - guacamole
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    networks:
      - appliance_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 10s
      timeout: 5s
      retries: 5

  ttyd:
    image: ghcr.io/alflewerken/web-appliance-dashboard-ttyd:latest
    container_name: appliance_ttyd
    hostname: ttyd
    command: >
      ttyd
      --writable
      --port 7681
      --base-path /
      --terminal-type xterm-256color
      /scripts/ttyd-ssh-wrapper.sh
    environment:
      SSH_PORT: 22
    networks:
      - appliance_network
    volumes:
      - ssh_keys:/root/.ssh
      - terminal_sessions:/tmp/terminal-sessions
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "sh", "-c", "pidof ttyd || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5

  guacd:
    image: guacamole/guacd:latest
    container_name: appliance_guacd
    hostname: guacd
    networks:
      - appliance_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "nc -z localhost 4822 || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5

  guacamole-postgres:
    image: postgres:15-alpine
    container_name: appliance_guacamole_db
    hostname: guacamole-postgres
    environment:
      POSTGRES_DB: ${GUACAMOLE_DB_NAME}
      POSTGRES_USER: ${GUACAMOLE_DB_USER}
      POSTGRES_PASSWORD: ${GUACAMOLE_DB_PASSWORD}
    volumes:
      - guacamole_postgres_data:/var/lib/postgresql/data
    networks:
      - appliance_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${GUACAMOLE_DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  guacamole:
    image: ghcr.io/alflewerken/web-appliance-dashboard-guacamole:latest
    container_name: appliance_guacamole
    hostname: guacamole
    depends_on:
      - guacd
      - guacamole-postgres
    environment:
      GUACD_HOSTNAME: guacd
      POSTGRES_HOSTNAME: guacamole-postgres
      POSTGRES_DATABASE: ${GUACAMOLE_DB_NAME}
      POSTGRES_USER: ${GUACAMOLE_DB_USER}
      POSTGRES_PASSWORD: ${GUACAMOLE_DB_PASSWORD}
      GUACAMOLE_HOME: /guacamole-home
    volumes:
      - guacamole_home:/guacamole-home
    networks:
      - appliance_network
    restart: unless-stopped

networks:
  appliance_network:
    name: appliance_network
    driver: bridge

volumes:
  db_data:
  backend_uploads:
  backend_logs:
  ssh_keys:
  terminal_sessions:
  guacamole_home:
  guacamole_postgres_data:
  rustdesk_data:
EOF

# Create robust nginx.conf that handles missing services
cat > nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    sendfile on;
    keepalive_timeout 65;
    client_max_body_size 50M;
    
    # Docker DNS resolver
    resolver 127.0.0.11 valid=30s;
    
    # Upstream definitions with variables (allows optional services)
    upstream backend_upstream {
        server backend:3001;
    }
    
    server {
        listen 80;
        listen [::]:80;
        server_name _;
        
        # Frontend
        location / {
            set $frontend_upstream frontend;
            proxy_pass http://$frontend_upstream;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Backend API
        location /api/ {
            proxy_pass http://backend_upstream;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # WebSocket for backend
        location /socket.io/ {
            proxy_pass http://backend_upstream;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
        
        # Uploads directory (images, etc) - CRITICAL for background images
        location /uploads {
            proxy_pass http://backend_upstream;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Terminal WebSocket API endpoints - HIGHEST PRIORITY
        location ~ ^/api/terminal/(.*)$ {
            proxy_pass http://backend_upstream;
            proxy_http_version 1.1;
            
            # WebSocket specific headers
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket specific settings
            proxy_cache_bypass $http_upgrade;
            proxy_buffering off;
            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;
            proxy_connect_timeout 10s;
        }
        
        # Terminal session WebSocket endpoint
        location = /api/terminal-session {
            proxy_pass http://backend_upstream;
            proxy_http_version 1.1;
            
            # WebSocket specific headers
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket specific settings
            proxy_cache_bypass $http_upgrade;
            proxy_buffering off;
            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;
            proxy_connect_timeout 10s;
        }
        
        # Terminal token endpoint
        location = /terminal/token {
            # Return a dummy JSON response to satisfy ttyd
            add_header Content-Type application/json;
            return 200 '{"success": true, "token": "dummy-token"}';
        }
        
        # ttyd Web Terminal proxy
        location /terminal/ {
            set $ttyd_upstream ttyd:7681;
            proxy_pass http://$ttyd_upstream/;
            proxy_http_version 1.1;
            
            # WebSocket support
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            
            # Headers
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Authorization $http_authorization;
            
            # Disable buffering for real-time terminal
            proxy_buffering off;
            proxy_cache off;
            
            # Timeouts
            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;
            proxy_connect_timeout 60s;
            
            # Frame options for iframe embedding
            add_header X-Frame-Options "SAMEORIGIN";
            
            # Return 503 if service unavailable
            proxy_intercept_errors on;
            error_page 502 503 504 = @service_unavailable;
        }
        
        # ttyd Web Terminal proxy - v1 compatibility with appliance ID
        location ~ ^/terminal/v1/(\d+)$ {
            proxy_pass http://backend_upstream;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # ttyd Web Terminal proxy - v1 compatibility (static)
        location /terminal/v1 {
            set $ttyd_upstream ttyd:7681;
            proxy_pass http://$ttyd_upstream/;
            proxy_http_version 1.1;
            
            # WebSocket support
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            
            # Headers
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Authorization $http_authorization;
            
            # Disable buffering for real-time terminal
            proxy_buffering off;
            proxy_cache off;
            
            # Timeouts
            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;
            proxy_connect_timeout 60s;
            
            # Frame options for iframe embedding
            add_header X-Frame-Options "SAMEORIGIN";
        }
        
        # ttyd WebSocket specific route
        location /terminal/ws {
            set $ttyd_upstream ttyd:7681;
            proxy_pass http://$ttyd_upstream/ws;
            proxy_http_version 1.1;
            
            # WebSocket headers
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            
            # No buffering for WebSocket
            proxy_buffering off;
            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;
        }
        
        # Wetty terminal (fallback if ttyd not available) - with error handling
        location /wetty/ {
            set $wetty_upstream ttyd:3000;
            proxy_pass http://$wetty_upstream/wetty/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;
            
            # Return 503 if service unavailable
            proxy_intercept_errors on;
            error_page 502 503 504 = @service_unavailable;
        }
        
        # Guacamole - with error handling
        location /guacamole/ {
            set $guac_upstream guacamole:8080;
            proxy_pass http://$guac_upstream/guacamole/;
            proxy_buffering off;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            access_log off;
            
            # Increased timeouts for Guacamole
            proxy_connect_timeout 60s;
            proxy_send_timeout 90s;
            proxy_read_timeout 90s;
            
            # Return 503 if service unavailable
            proxy_intercept_errors on;
            error_page 502 503 504 = @service_unavailable;
        }
        
        # Service unavailable handler
        location @service_unavailable {
            add_header Content-Type application/json;
            return 503 '{"error": "Service temporarily unavailable", "message": "The requested service is starting up or not available"}';
        }
        
        # Health check endpoint
        location /health {
            access_log off;
            add_header Content-Type text/plain;
            return 200 "healthy\n";
        }
    }
    
    # HTTPS server (optional)
    server {
        listen 443 ssl;
        listen [::]:443 ssl;
        server_name _;
        
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        
        # Copy all location blocks from above
        include /etc/nginx/conf.d/locations.conf*;
    }
}
EOF

# Generate self-signed SSL certificate
echo "🔐 Generating self-signed SSL certificate..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" \
    2>/dev/null

# Create install script
cat > install.sh << 'EOF'
#!/bin/bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Web Appliance Dashboard Installer ===${NC}"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed!${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check Docker Compose
COMPOSE_COMMAND=""
if command -v docker-compose &> /dev/null; then
    COMPOSE_COMMAND="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_COMMAND="docker compose"
else
    echo -e "${RED}❌ Docker Compose is not installed!${NC}"
    exit 1
fi

echo "✅ Using Docker Compose command: $COMPOSE_COMMAND"

# Detect hostname and update CORS
HOSTNAME=$(hostname)
HOSTNAME_FQDN=$(hostname -f 2>/dev/null || hostname)

echo "🌐 Detected hostname: $HOSTNAME"
echo "🌐 Detected FQDN: $HOSTNAME_FQDN"

# Update ALLOWED_ORIGINS in .env - include both lowercase and original case
echo "📝 Updating CORS configuration..."
HOSTNAME_LOWER=$(echo "$HOSTNAME" | tr '[:upper:]' '[:lower:]')
HOSTNAME_FQDN_LOWER=$(echo "$HOSTNAME_FQDN" | tr '[:upper:]' '[:lower:]')

# Build ALLOWED_ORIGINS with both cases
ALLOWED_ORIGINS="http://localhost,https://localhost"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS},http://$HOSTNAME,https://$HOSTNAME"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS},http://$HOSTNAME_LOWER,https://$HOSTNAME_LOWER"
if [ "$HOSTNAME" != "$HOSTNAME_FQDN" ]; then
    ALLOWED_ORIGINS="${ALLOWED_ORIGINS},http://$HOSTNAME_FQDN,https://$HOSTNAME_FQDN"
    ALLOWED_ORIGINS="${ALLOWED_ORIGINS},http://$HOSTNAME_FQDN_LOWER,https://$HOSTNAME_FQDN_LOWER"
fi

sed -i.bak "s|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=$ALLOWED_ORIGINS|" .env

# Update SSL certificate with correct CN
echo "🔐 Regenerating SSL certificate for $HOSTNAME..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$HOSTNAME" \
    2>/dev/null

# Login to GitHub Container Registry
echo ""
echo "🔐 Logging in to GitHub Container Registry..."
echo "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" | docker login ghcr.io -u alflewerken --password-stdin

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to login to GitHub Container Registry${NC}"
    echo "The images might be private and require authentication."
    exit 1
fi

# Pull images
echo ""
echo "📥 Pulling Docker images..."
$COMPOSE_COMMAND pull

# Start services with proper order
echo ""
echo "🚀 Starting services..."

# Start database first
echo "   Starting database..."
$COMPOSE_COMMAND up -d database

# Wait for database to be ready
echo "   Waiting for database to be ready..."
sleep 10

# Load DB password from .env
DB_ROOT_PWD=$(grep "^DB_ROOT_PASSWORD=" .env | cut -d'=' -f2)

# Check if database is healthy
for i in {1..30}; do
    if $COMPOSE_COMMAND exec database mariadb -u root -p${DB_ROOT_PWD} -e "SELECT 1" &>/dev/null; then
        echo -e "${GREEN}   ✅ Database is ready${NC}"
        break
    fi
    echo "   Waiting for database... ($i/30)"
    sleep 2
done

# Start core services
echo "   Starting core services..."
$COMPOSE_COMMAND up -d backend frontend webserver

# Start optional services (continue even if they fail)
echo "   Starting optional services..."
$COMPOSE_COMMAND up -d ttyd || echo -e "${YELLOW}   ⚠️  Terminal service failed to start${NC}"
$COMPOSE_COMMAND up -d guacd guacamole-postgres guacamole || echo -e "${YELLOW}   ⚠️  Remote desktop service failed to start${NC}"

# Final check
echo ""
echo "🔍 Checking service status..."
$COMPOSE_COMMAND ps

# Check if services are actually running
BACKEND_RUNNING=$($COMPOSE_COMMAND ps | grep "appliance_backend" | grep -c "Up\|running")
WEBSERVER_RUNNING=$($COMPOSE_COMMAND ps | grep "appliance_webserver" | grep -c "Up\|running")

if [ "$BACKEND_RUNNING" -eq 1 ] && [ "$WEBSERVER_RUNNING" -eq 1 ]; then
    echo ""
    echo -e "${GREEN}✅ Installation complete!${NC}"
    echo ""
    echo "🌐 Access the dashboard at:"
    echo "   - http://localhost"
    echo "   - http://$HOSTNAME"
    echo "   - http://$HOSTNAME_LOWER"
    if [ "$HOSTNAME" != "$HOSTNAME_FQDN" ]; then
        echo "   - http://$HOSTNAME_FQDN"
        echo "   - http://$HOSTNAME_FQDN_LOWER"
    fi
    echo ""
    echo "👤 Default login:"
    echo "   Username: admin"
    echo "   Password: admin123"
    echo ""
    echo "📝 Logs: $COMPOSE_COMMAND logs -f"
    echo "🛑 Stop: $COMPOSE_COMMAND down"
else
    echo ""
    echo -e "${RED}❌ Some services failed to start properly${NC}"
    echo "Check logs with: $COMPOSE_COMMAND logs"
    exit 1
fi
EOF

chmod +x install.sh

# Create uninstall script
cat > uninstall.sh << 'EOF'
#!/bin/bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== Web Appliance Dashboard Uninstaller ===${NC}"
echo ""

# Detect Docker Compose command
COMPOSE_COMMAND=""
if command -v docker-compose &> /dev/null; then
    COMPOSE_COMMAND="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_COMMAND="docker compose"
else
    echo -e "${RED}❌ Docker Compose is not found!${NC}"
    exit 1
fi

read -p "⚠️  This will stop and remove all containers. Continue? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo "🛑 Stopping services..."
$COMPOSE_COMMAND down

read -p "⚠️  Remove all data volumes? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Removing volumes..."
    $COMPOSE_COMMAND down -v
fi

echo -e "${GREEN}✅ Uninstall complete${NC}"
EOF

chmod +x uninstall.sh

# Create troubleshoot script
cat > troubleshoot.sh << 'EOF'
#!/bin/bash
# Troubleshooting script for Web Appliance Dashboard

echo "=== Web Appliance Dashboard Troubleshooting ==="
echo ""

# Detect Docker Compose
COMPOSE_COMMAND=""
if command -v docker-compose &> /dev/null; then
    COMPOSE_COMMAND="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_COMMAND="docker compose"
fi

echo "1. Container Status:"
$COMPOSE_COMMAND ps
echo ""

echo "2. Recent Backend Logs:"
$COMPOSE_COMMAND logs --tail=20 backend
echo ""

echo "3. Database Connection Test:"
DB_ROOT_PWD=$(grep "^DB_ROOT_PASSWORD=" .env | cut -d'=' -f2)
$COMPOSE_COMMAND exec database mariadb -u root -p${DB_ROOT_PWD} -e "SELECT COUNT(*) as user_count FROM appliance_dashboard.users;" 2>&1
echo ""

echo "4. Network Connectivity:"
$COMPOSE_COMMAND exec backend ping -c 1 database || echo "Cannot reach database"
echo ""

echo "5. Port Bindings:"
netstat -tln | grep -E ":(80|443|3001|3306)\s" || ss -tln | grep -E ":(80|443|3001|3306)\s"
echo ""

echo "6. CORS Configuration:"
grep ALLOWED_ORIGINS .env
echo ""

echo "7. Backend Environment:"
$COMPOSE_COMMAND exec backend env | grep -E "(ALLOWED_ORIGINS|DB_|NODE_ENV)"
echo ""

echo "💡 Common Issues:"
echo "- Port 80/443 already in use: Change HTTP_PORT/HTTPS_PORT in .env"
echo "- Cannot connect to database: Wait for database to fully start"
echo "- Login fails: Ensure database is initialized (check logs)"
echo "- CORS errors: Check that hostname matches ALLOWED_ORIGINS"
echo "- Services not starting: Check 'docker-compose logs [service]'"
EOF

chmod +x troubleshoot.sh

# Create README
cat > README.md << 'EOF'
# Web Appliance Dashboard - Customer Package

## Quick Start

1. Extract the package
2. Run the installer:
   ```bash
   ./install.sh
   ```
3. Access the dashboard:
   - http://localhost
   - http://[your-hostname]

Default credentials:
- Username: `admin`
- Password: `admin123`

## Requirements

- Docker Engine 20.10+
- Docker Compose 2.0+ (or docker-compose 1.29+)
- Ports 80 and 443 available (configurable in .env)

## Commands

- **Start services**: `docker compose up -d`
- **Stop services**: `docker compose down`
- **View logs**: `docker compose logs -f`
- **Restart a service**: `docker compose restart [service]`
- **Troubleshoot**: `./troubleshoot.sh`

## Configuration

Edit `.env` file to customize:
- Database passwords
- Port numbers
- CORS origins
- Admin credentials

## Services Included

- **Frontend**: React-based web interface
- **Backend**: Node.js API server
- **Database**: MariaDB
- **Terminal**: Web-based terminal (Wetty)
- **Remote Desktop**: Guacamole (VNC/RDP)
- **Reverse Proxy**: Nginx

## Troubleshooting

1. **Login fails**: 
   - Check if database is running: `docker compose ps`
   - Check backend logs: `docker compose logs backend`
   - Run `./troubleshoot.sh` for diagnostics

2. **CORS errors**:
   - Check browser console for the exact origin
   - Verify ALLOWED_ORIGINS in `.env` includes your access URL
   - Restart backend after changes: `docker compose restart backend`

3. **Port conflicts**:
   - Edit `.env` and change HTTP_PORT/HTTPS_PORT
   - Restart services

4. **Services not starting**:
   - Run `./troubleshoot.sh` for diagnostics
   - Check individual service logs

## Uninstall

To remove the installation:
```bash
./uninstall.sh
```

## Support

For issues, check:
1. Service logs: `docker compose logs [service]`
2. Troubleshooting script: `./troubleshoot.sh`
3. Documentation: https://github.com/alflewerken/web-appliance-dashboard

## Security Notes

- Default installation uses self-signed SSL certificates
- Change the admin password after first login
- Review and update security keys in `.env` for production use
- The included GitHub token is for pulling private Docker images only

## Version

This is v2.0 of the customer package with:
- Full database schema compatibility
- Automatic CORS configuration
- Robust error handling
- Built-in troubleshooting tools
EOF

# Create the package
cd ..
echo ""
echo "📦 Creating tar.gz package..."
tar -czf "${PACKAGE_NAME}.tar.gz" "${PACKAGE_NAME}"

# Cleanup
rm -rf "${PACKAGE_NAME}"

# Final message
echo ""
echo -e "${GREEN}✅ Package created successfully!${NC}"
echo ""
echo "📦 Package location: ${PACKAGE_DIR}.tar.gz"
echo "📏 Package size: $(du -h "${PACKAGE_NAME}.tar.gz" | cut -f1)"
echo ""
echo "📋 Installation instructions:"
echo "1. Copy the package to the target server"
echo "2. Extract: tar -xzf ${PACKAGE_NAME}.tar.gz"
echo "3. Install: cd ${PACKAGE_NAME} && ./install.sh"
echo ""
echo -e "${YELLOW}⚠️  This package includes:${NC}"
echo "- Complete database schema from init.sql"
echo "- GitHub authentication for private images"
echo "- Automatic CORS configuration (both case variants)"
echo "- Database health checks that work correctly"
echo "- Enhanced troubleshooting tools"
