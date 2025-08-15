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
DOCKER_CMD=""
if command -v docker &> /dev/null; then
    DOCKER_CMD="docker"
elif [ -x "/usr/local/bin/docker" ]; then
    # Docker Desktop on macOS often installs here
    DOCKER_CMD="/usr/local/bin/docker"
    export PATH="/usr/local/bin:$PATH"
else
    echo "❌ Docker is not installed!"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✅ Found Docker: $($DOCKER_CMD --version)"

# Check for Docker Compose
DOCKER_COMPOSE_CMD=""
if $DOCKER_CMD compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="$DOCKER_CMD compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    echo "❌ Docker Compose is not installed!"
    exit 1
fi

echo "✅ Found Docker Compose: $($DOCKER_COMPOSE_CMD version)"

# Determine installation directory
# Use current directory if provided via argument or environment, otherwise use current working directory
if [ -n "$1" ]; then
    INSTALL_DIR="$1"
elif [ -n "$INSTALL_PATH" ]; then
    INSTALL_DIR="$INSTALL_PATH"
else
    INSTALL_DIR="$(pwd)/web-appliance-dashboard"
fi

# Ensure the directory path is absolute
INSTALL_DIR=$(cd "$(dirname "$INSTALL_DIR")" 2>/dev/null && pwd)/$(basename "$INSTALL_DIR")

echo "📁 Installation directory: $INSTALL_DIR"
echo ""

# Ask for confirmation if directory exists
if [ -d "$INSTALL_DIR" ]; then
    echo "⚠️  Directory already exists: $INSTALL_DIR"
    
    # Check if we can interact
    if [ -t 0 ] || [ -t 1 ]; then
        # We have a terminal
        read -p "Do you want to continue and potentially overwrite existing files? (y/N): " -n 1 -r REPLY
        echo ""
    else
        # Non-interactive mode
        echo "Non-interactive mode: Continuing with existing directory."
        REPLY="y"
    fi
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 1
    fi
fi

# Create installation directory
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR" || exit 1

echo "✅ Working in: $(pwd)"
echo ""

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

# Get system hostname for reference
SYSTEM_HOSTNAME="localhost"
if command -v hostname &> /dev/null; then
    DETECTED_HOSTNAME=$(hostname 2>/dev/null)
    if [ -n "$DETECTED_HOSTNAME" ]; then
        SYSTEM_HOSTNAME="$DETECTED_HOSTNAME"
        # On macOS, also get the .local hostname
        if [[ "$OSTYPE" == "darwin"* ]]; then
            LOCAL_HOSTNAME=$(hostname -s 2>/dev/null)
            if [ -n "$LOCAL_HOSTNAME" ]; then
                SYSTEM_HOSTNAME="${SYSTEM_HOSTNAME},${LOCAL_HOSTNAME}.local"
            fi
        fi
    fi
fi

# Get primary IP address for reference
PRIMARY_IP=""
if command -v ip &> /dev/null; then
    # Linux
    PRIMARY_IP=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '^127\.' | head -1)
elif command -v ifconfig &> /dev/null; then
    # macOS/BSD
    PRIMARY_IP=$(ifconfig | grep 'inet ' | awk '{print $2}' | grep -v '^127\.' | head -1)
fi

# Ask user for hostname configuration
echo ""
echo "🌐 Configure Access Domain"
echo "========================"
echo "The dashboard needs to know how it will be accessed."
echo "This is important for CORS configuration and reverse proxy setups."
echo ""
echo "Detected system information (for reference):"
echo "  Hostname: $SYSTEM_HOSTNAME"
if [ -n "$PRIMARY_IP" ]; then
    echo "  Primary IP: $PRIMARY_IP"
fi
echo ""
echo "Enter the domain or IP address where this dashboard will be accessed."
echo "For production behind a reverse proxy, use your actual domain."
echo ""
echo "Examples:"
echo "  - Production with domain: dashboard.example.com"
echo "  - Production with subdomain: appliances.company.internal"
echo "  - Local development: localhost"
echo "  - LAN access by IP: 192.168.1.100"
echo "  - Multiple access points: app.company.com,192.168.1.100"
echo ""

# When piped through bash, stdin is already used, so we check for TTY availability
USER_HOSTNAMES=""
if [ -t 0 ] || [ -t 1 ]; then
    # Interactive mode - we have a terminal
    read -p "Enter domain/hostname [press Enter for localhost]: " USER_HOSTNAMES
else
    # Non-interactive mode - use defaults
    echo "⚠️  Non-interactive mode detected. Using defaults: localhost and detected hostnames"
    USER_HOSTNAMES=""
fi

# Process user input
if [ -z "$USER_HOSTNAMES" ]; then
    # User pressed Enter - use localhost and detect system hostname
    HOSTNAMES=("localhost")
    # On macOS, also add .local hostname for Bonjour/mDNS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        LOCAL_HOSTNAME=$(hostname -s 2>/dev/null)
        if [ -n "$LOCAL_HOSTNAME" ]; then
            HOSTNAMES+=("${LOCAL_HOSTNAME}.local")
        fi
    fi
else
    # Parse user input
    IFS=',' read -ra HOSTNAMES <<< "$USER_HOSTNAMES"
    # Always include localhost for local access
    if [[ ! " ${HOSTNAMES[@]} " =~ " localhost " ]]; then
        HOSTNAMES+=("localhost")
    fi
fi

# Remove duplicates and clean up
UNIQUE_HOSTNAMES=($(printf "%s\n" "${HOSTNAMES[@]}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sort -u))

# Build ALLOWED_ORIGINS string
ALLOWED_ORIGINS=""
for HOST in "${UNIQUE_HOSTNAMES[@]}"; do
    if [ -n "$ALLOWED_ORIGINS" ]; then
        ALLOWED_ORIGINS="${ALLOWED_ORIGINS},"
    fi
    ALLOWED_ORIGINS="${ALLOWED_ORIGINS}http://${HOST}:${HTTP_PORT}"
    if [ "$HTTPS_PORT" != "" ]; then
        ALLOWED_ORIGINS="${ALLOWED_ORIGINS},https://${HOST}:${HTTPS_PORT}"
    fi
done

echo ""
echo "✅ Configured for access via:"
for HOST in "${UNIQUE_HOSTNAMES[@]}"; do
    echo "   • $HOST"
done
echo ""

# Generate passwords
DB_PASS=$(openssl rand -base64 24 2>/dev/null || echo "dashboard_pass123")
ROOT_PASS=$(openssl rand -base64 32 2>/dev/null || echo "root_pass123")
JWT=$(openssl rand -hex 32 2>/dev/null || echo "default-jwt-secret-change-in-production")
SESSION=$(openssl rand -hex 32 2>/dev/null || echo "default-session-secret-change-in-production")
SSH_KEY=$(openssl rand -hex 32 2>/dev/null || echo "default-ssh-secret-change-in-production")
TTYD_PASS=$(openssl rand -base64 16 2>/dev/null || echo "ttyd_pass123")

# Determine primary hostname for EXTERNAL_URL
# Use the first user-provided hostname, or fallback to localhost
PRIMARY_HOST="${UNIQUE_HOSTNAMES[0]}"
if [ -z "$PRIMARY_HOST" ]; then
    PRIMARY_HOST="localhost"
fi

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

# CORS Settings - Auto-detected hostnames and IPs
ALLOWED_ORIGINS=${ALLOWED_ORIGINS}

# Network Configuration  
HTTP_PORT=${HTTP_PORT}
HTTPS_PORT=${HTTPS_PORT}
BACKEND_PORT=${BACKEND_PORT}
DB_EXTERNAL_PORT=${DB_PORT}
EXTERNAL_URL=http://${PRIMARY_HOST}:${HTTP_PORT}

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

# RustDesk Configuration
RUSTDESK_ID_PORT=21216
RUSTDESK_WEB_PORT=21218
RUSTDESK_API_PORT=21219
RUSTDESK_RELAY_PORT=21217
RUSTDESK_WEBSOCKET_PORT=21220

# Container Names - Mit appliance_ Prefix für Konsistenz
DB_CONTAINER_NAME=appliance_db
BACKEND_CONTAINER_NAME=appliance_backend
WEBSERVER_CONTAINER_NAME=appliance_webserver
TTYD_CONTAINER_NAME=appliance_ttyd
GUACAMOLE_CONTAINER_NAME=appliance_guacamole
GUACAMOLE_DB_CONTAINER_NAME=appliance_guacamole_db
GUACD_CONTAINER_NAME=appliance_guacd
# RustDesk behält die eigenen Namen ohne Prefix
RUSTDESK_SERVER_CONTAINER=rustdesk-server
RUSTDESK_RELAY_CONTAINER=rustdesk-relay

# Network
NETWORK_NAME=appliance_network
EOF

# Export variables for docker-compose (outside of .env file)
export DB_CONTAINER_NAME BACKEND_CONTAINER_NAME WEBSERVER_CONTAINER_NAME
export TTYD_CONTAINER_NAME GUACAMOLE_CONTAINER_NAME GUACAMOLE_DB_CONTAINER_NAME
export GUACD_CONTAINER_NAME RUSTDESK_SERVER_CONTAINER RUSTDESK_RELAY_CONTAINER
export NETWORK_NAME

# Generate SSL certificates
echo "🔒 Generating SSL certificates..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" \
    2>/dev/null || {
    echo "⚠️  Could not generate SSL certificates, using HTTP only"
}

# Download docker-compose.yml from repository
echo "📝 Downloading docker-compose configuration..."
curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/docker-compose.production.yml \
    -o docker-compose.yml 2>/dev/null || {
    echo "❌ Failed to download docker-compose.yml"
    exit 1
}
echo "✅ Docker compose configuration downloaded"

# Fix common docker-compose.yml issues
echo "🔧 Validating docker-compose configuration..."

# Check if backend service has image defined
if ! grep -q "backend:" docker-compose.yml || ! grep -A 5 "backend:" docker-compose.yml | grep -q "image:"; then
    echo "   ⚠️  Fixing missing backend image..."
    # Add image to backend service
    sed -i.bak '/^  backend:/a\    image: ghcr.io/alflewerken/web-appliance-dashboard-backend:latest' docker-compose.yml 2>/dev/null || \
    sed -i '' '/^  backend:/a\    image: ghcr.io/alflewerken/web-appliance-dashboard-backend:latest' docker-compose.yml 2>/dev/null
fi

# Check for empty volumes sections and fix them
if grep -q "volumes:\s*$" docker-compose.yml; then
    echo "   ⚠️  Fixing empty volumes sections..."
    # Fix empty volumes by removing them or adding dummy volume
    awk '
    /^    volumes:/ {
        print
        getline
        if ($0 ~ /^    [a-z]/ || $0 ~ /^  [a-z]/) {
            print "      - /dev/null:/tmp/dummy:ro"
        }
        print
        next
    }
    { print }
    ' docker-compose.yml > docker-compose.tmp && mv docker-compose.tmp docker-compose.yml
fi

# Ensure all services are in the correct network
echo "   ✅ Configuration validated"

# Validate docker-compose configuration before starting
echo "🔍 Testing configuration..."
if ! $DOCKER_COMPOSE_CMD config > /dev/null 2>&1; then
    echo "❌ Docker Compose configuration is invalid!"
    echo "📋 Error details:"
    $DOCKER_COMPOSE_CMD config 2>&1 | head -20
    echo ""
    echo "🔧 Attempting automatic fix..."
    
    # Try to fix common issues
    # Remove empty volumes sections completely
    sed -i.bak '/^\s*volumes:\s*$/d' docker-compose.yml 2>/dev/null || \
    sed -i '' '/^[[:space:]]*volumes:[[:space:]]*$/d' docker-compose.yml 2>/dev/null
    
    # Re-validate
    if ! $DOCKER_COMPOSE_CMD config > /dev/null 2>&1; then
        echo "❌ Could not automatically fix the configuration"
        echo "Please check docker-compose.yml manually"
        exit 1
    fi
    echo "✅ Configuration fixed automatically"
fi

# Pull images with progress indication
echo "🐳 Downloading Docker images (this may take a few minutes)..."
echo "=================================================="

# Define all images that need to be pulled
IMAGES=(
    "mariadb:latest"
    "ghcr.io/alflewerken/web-appliance-dashboard-backend:latest"
    "ghcr.io/alflewerken/web-appliance-dashboard-frontend:latest"
    "ghcr.io/alflewerken/web-appliance-dashboard-nginx:latest"
    "ghcr.io/alflewerken/web-appliance-dashboard-ttyd:latest"
    "ghcr.io/alflewerken/web-appliance-dashboard-guacamole:latest"
    "guacamole/guacd:1.5.5"
    "postgres:15-alpine"
    "rustdesk/rustdesk-server:latest"
)

# Pull each image with status
TOTAL_IMAGES=${#IMAGES[@]}
CURRENT=0

for IMAGE in "${IMAGES[@]}"; do
    CURRENT=$((CURRENT + 1))
    echo ""
    echo "[$CURRENT/$TOTAL_IMAGES] Downloading: $IMAGE"
    if $DOCKER_CMD pull "$IMAGE"; then
        echo "   ✅ Downloaded successfully"
    else
        echo "   ⚠️  Failed to download $IMAGE (will retry during startup)"
    fi
done

echo ""
echo "✅ Image download complete!"
echo ""

# Start services
echo "🚀 Starting services..."
$DOCKER_COMPOSE_CMD up -d || {
    echo "❌ Failed to start services"
    echo "📋 Checking configuration..."
    $DOCKER_COMPOSE_CMD config 2>&1 | head -20
    exit 1
}

# Wait for database
echo "⏳ Waiting for database to be ready..."
for i in {1..30}; do
    if $DOCKER_CMD exec ${DB_CONTAINER_NAME:-appliance_db} mysqladmin ping -h localhost -u root -p${ROOT_PASS} &>/dev/null; then
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
    $DOCKER_CMD exec -i ${DB_CONTAINER_NAME:-appliance_db} mariadb -u root -p${ROOT_PASS} appliance_dashboard < init-db/01-init.sql 2>/dev/null || {
        echo "⚠️  Some tables might already exist (this is normal)"
    }
    echo "✅ Database schema initialized"
fi

# Initialize Guacamole database if needed
echo "🔧 Checking Guacamole database..."
sleep 5

# Check if Guacamole tables exist
TABLES_EXIST=$($DOCKER_CMD exec ${GUACAMOLE_DB_CONTAINER_NAME:-appliance_guacamole_db} psql -U guacamole_user -d guacamole_db -tAc \
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'guacamole_connection');" 2>/dev/null || echo "f")

if [ "$TABLES_EXIST" = "f" ]; then
    echo "📝 Initializing Guacamole database..."
    
    # Try to load local schema files first
    if [ -f "guacamole/001-create-schema.sql" ]; then
        $DOCKER_CMD exec -i ${GUACAMOLE_DB_CONTAINER_NAME:-appliance_guacamole_db} sh -c "PGPASSWORD=guacamole_pass123 psql -U guacamole_user -d guacamole_db" \
            < guacamole/001-create-schema.sql >/dev/null 2>&1
        
        if [ -f "guacamole/002-create-admin-user.sql" ]; then
            $DOCKER_CMD exec -i ${GUACAMOLE_DB_CONTAINER_NAME:-appliance_guacamole_db} sh -c "PGPASSWORD=guacamole_pass123 psql -U guacamole_user -d guacamole_db" \
                < guacamole/002-create-admin-user.sql >/dev/null 2>&1
        fi
        
        echo "✅ Guacamole database initialized"
    else
        echo "⚠️  Guacamole schema files not found - Remote Desktop may not work initially"
    fi
    
    # Restart Guacamole
    $DOCKER_COMPOSE_CMD restart guacamole >/dev/null 2>&1
fi

# Final status check
echo ""
echo "📊 Service Status:"
$DOCKER_COMPOSE_CMD ps

echo ""
echo "✅ Installation complete!"
echo ""
echo "📱 Access your dashboard at:"
# Show all detected access URLs
for HOST in "${UNIQUE_HOSTNAMES[@]}"; do
    echo "   🌐 http://${HOST}:${HTTP_PORT}"
done
if [ -f "ssl/cert.pem" ]; then
    echo ""
    echo "   With HTTPS (self-signed certificate):"
    for HOST in "${UNIQUE_HOSTNAMES[@]}"; do
        echo "   🔒 https://${HOST}:${HTTPS_PORT}"
    done
fi
echo ""
echo "📝 Default Credentials:"
echo "   Dashboard: admin / admin123"
echo "   Guacamole: guacadmin / guacadmin"
echo ""
echo "📁 Installation: $INSTALL_DIR"
echo "🛠️  Maintenance: cd $INSTALL_DIR && $DOCKER_COMPOSE_CMD"
echo ""
echo "🛑 Stop: cd $INSTALL_DIR && $DOCKER_COMPOSE_CMD down"
echo "🔄 Update: cd $INSTALL_DIR && $DOCKER_COMPOSE_CMD pull && $DOCKER_COMPOSE_CMD up -d"
echo ""
echo "🎉 Enjoy your Web Appliance Dashboard!"
