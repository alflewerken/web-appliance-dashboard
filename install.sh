#!/bin/bash

# One-line installer for Web Appliance Dashboard
# Users can run this with:
# curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/install.sh | bash

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

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

# Check for existing installation
EXISTING_INSTALL=false
EXISTING_DB=false
ENV_EXISTS=false
CREDENTIALS_MISMATCH=false
USER_PROVIDED_PASSWORD=""

# Check for existing database
if [ -d "data/database" ] && [ "$(ls -A data/database 2>/dev/null)" ]; then
    echo "⚠️  Existing database data detected!"
    EXISTING_DB=true
    EXISTING_INSTALL=true
fi

# Check for existing .env
if [ -f ".env" ]; then
    ENV_EXISTS=true
    if ! grep -q "YOUR_.*_HERE\|CHANGE_ME" .env 2>/dev/null; then
        echo "✅ Valid configuration file found"
        
        # Extract existing passwords to reuse them
        EXISTING_DB_PASS=$(grep "^DB_PASSWORD=" .env | cut -d= -f2- || echo "")
        EXISTING_ROOT_PASS=$(grep "^MYSQL_ROOT_PASSWORD=" .env | cut -d= -f2- || echo "")
        EXISTING_SSH_KEY=$(grep "^SSH_KEY_ENCRYPTION_SECRET=" .env | cut -d= -f2- || echo "")
        
        if [ -n "$EXISTING_DB_PASS" ]; then
            echo "✅ Found existing database credentials"
        fi
    fi
fi

# Critical: Check for credential mismatch scenario
if [ "$EXISTING_DB" = true ] && [ "$ENV_EXISTS" = false ]; then
    echo ""
    echo "🚨 CRITICAL: Database exists but configuration file is missing!"
    echo "============================================================"
    echo ""
    echo "The database contains encrypted passwords and SSH keys that"
    echo "REQUIRE the original encryption keys to decrypt."
    echo ""
    echo "You need BOTH keys from your old .env file:"
    echo "  1. DB_PASSWORD - to connect to the database"
    echo "  2. SSH_KEY_ENCRYPTION_SECRET (or ENCRYPTION_KEY) - to decrypt stored data"
    echo ""
    echo "WITHOUT BOTH KEYS, YOUR ENCRYPTED DATA WILL BE INACCESSIBLE!"
    echo ""
    echo "OPTIONS:"
    echo ""
    echo "1) If you have BOTH keys from your old .env file:"
    echo "   → Enter them when prompted below"
    echo ""
    echo "2) If you have a backup of the .env file:"
    echo "   → Press Ctrl+C now, restore the .env file, and re-run install.sh"
    echo ""
    echo "3) If you've lost the encryption key:"
    echo "   → Your encrypted passwords and SSH keys CANNOT be recovered"
    echo "   → Press Ctrl+C, delete data/, and re-run for fresh install"
    echo "   ⚠️  WARNING: This will DELETE ALL DATA!"
    echo ""
    echo "============================================================"
    echo ""
    
    if [ -t 0 ] || [ -t 1 ]; then
        # Interactive mode - ask for BOTH passwords
        echo "To recover your existing installation, enter BOTH keys:"
        echo ""
        
        # DB Password
        read -p "1. Original DB_PASSWORD: " USER_PROVIDED_PASSWORD
        
        if [ -z "$USER_PROVIDED_PASSWORD" ]; then
            echo ""
            echo "❌ No DB_PASSWORD provided - cannot access database"
            echo "   Installation cancelled. Delete data/ for fresh install or restore .env"
            exit 1
        fi
        
        # Encryption Key
        echo ""
        echo "2. Original SSH_KEY_ENCRYPTION_SECRET or ENCRYPTION_KEY"
        echo "   (This is required to decrypt passwords and SSH keys in the database)"
        read -p "   Encryption key: " USER_SSH_KEY
        
        if [ -z "$USER_SSH_KEY" ]; then
            echo ""
            echo "❌ No encryption key provided - encrypted data will be INACCESSIBLE!"
            echo ""
            echo "Without this key:"
            echo "  - All host passwords will be unreadable"
            echo "  - All SSH private keys will be unreadable"
            echo "  - All service credentials will be unreadable"
            echo ""
            read -p "Continue anyway? You'll need to reset ALL passwords [y/N]: " -n 1 -r REPLY
            echo ""
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "Installation cancelled. Restore your .env or delete data/ for fresh start."
                exit 1
            fi
            echo "⚠️  Proceeding without encryption key - prepare to reset all credentials"
            USER_SSH_KEY=$(openssl rand -hex 32 2>/dev/null)
            CREDENTIALS_MISMATCH=true
        else
            echo "✅ Will use provided encryption key for existing encrypted data"
        fi
        
        EXISTING_DB_PASS="$USER_PROVIDED_PASSWORD"
        EXISTING_SSH_KEY="$USER_SSH_KEY"
        
    else
        echo "Non-interactive mode: Cannot continue without .env file when database exists"
        exit 1
    fi
elif [ "$EXISTING_DB" = true ] && [ -n "$EXISTING_DB_PASS" ]; then
    # Database exists and we have credentials from .env
    echo "✅ Will reuse existing credentials from .env"
    
    # But check if we have the encryption key
    if [ -z "$EXISTING_SSH_KEY" ]; then
        echo ""
        echo "⚠️  WARNING: SSH_KEY_ENCRYPTION_SECRET not found in .env!"
        echo "   Encrypted passwords and SSH keys may not be accessible."
    fi
fi

if [ "$EXISTING_INSTALL" = true ] && [ "$CREDENTIALS_MISMATCH" = false ]; then
    echo ""
    echo "📌 Existing installation detected. The installer will:"
    echo "   • Preserve your database data"
    echo "   • Reuse existing credentials"
    echo "   • Update scripts and configurations"
    echo ""
    
    # Create backup
    if [ -d "data" ] && [ "$(ls -A data 2>/dev/null)" ]; then
        BACKUP_DIR="backups/before_install_$(date +%Y%m%d_%H%M%S)"
        echo "📥 Creating safety backup at $BACKUP_DIR..."
        mkdir -p "$BACKUP_DIR"
        cp -r data "$BACKUP_DIR/" 2>/dev/null || true
        [ -f ".env" ] && cp .env "$BACKUP_DIR/.env.backup" 2>/dev/null || true
        echo "✅ Backup created"
    fi
fi

# Create necessary directories
mkdir -p init-db ssl guacamole scripts
# Only create data directories if they don't exist (preserve existing data)
for dir in database ssh_keys uploads terminal_sessions guacamole_db guacamole_drive guacamole_record guacamole_home rustdesk; do
    mkdir -p "data/$dir"
done
log_info "Data directories ready (existing data preserved)"

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
    log_info "Using default: localhost" "Using default: localhost"
else
    # Parse user input - properly handle comma-separated values
    IFS=',' read -ra USER_HOST_ARRAY <<< "$USER_HOSTNAMES"
    HOSTNAMES=()
    
    # Process each hostname
    for host in "${USER_HOST_ARRAY[@]}"; do
        # Trim whitespace
        trimmed_host=$(echo "$host" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        if [ -n "$trimmed_host" ]; then
            HOSTNAMES+=("$trimmed_host")
            log_info "Added hostname: $trimmed_host" "Added hostname: $trimmed_host"
        fi
    done
    
    # Always include localhost for local access
    if [[ ! " ${HOSTNAMES[@]} " =~ " localhost " ]]; then
        HOSTNAMES+=("localhost")
        log_info "Added localhost for local access" "Added localhost for local access"
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

# Generate or reuse passwords - CRITICAL for data consistency
if [ "$EXISTING_DB" = true ] && [ -n "$EXISTING_DB_PASS" ]; then
    # Case 1: Database exists AND we have the password = perfect, reuse it
    DB_PASS="$EXISTING_DB_PASS"
    ROOT_PASS="${EXISTING_ROOT_PASS:-$(openssl rand -base64 32 2>/dev/null || echo "root_pass123")}"
    SSH_KEY="${EXISTING_SSH_KEY:-$(openssl rand -hex 32 2>/dev/null || echo "default-ssh-secret-change-in-production")}"
    echo "✅ Reusing existing database credentials (database will remain accessible)"
elif [ "$EXISTING_DB" = true ] && [ -z "$EXISTING_DB_PASS" ]; then
    # Case 2: Database exists BUT no password = problem!
    echo "⚠️  WARNING: Creating new credentials. Existing database will be INACCESSIBLE!"
    echo "   The database in data/database/ will remain but cannot be used."
    echo "   Consider backing up data/database/ and removing it for a fresh start."
    DB_PASS=$(openssl rand -base64 24 2>/dev/null || echo "dashboard_pass123")
    ROOT_PASS=$(openssl rand -base64 32 2>/dev/null || echo "root_pass123")
    SSH_KEY=$(openssl rand -hex 32 2>/dev/null || echo "default-ssh-secret-change-in-production")
else
    # Case 3: No database = fresh install, generate new passwords
    DB_PASS=$(openssl rand -base64 24 2>/dev/null || echo "dashboard_pass123")
    ROOT_PASS=$(openssl rand -base64 32 2>/dev/null || echo "root_pass123")
    SSH_KEY=$(openssl rand -hex 32 2>/dev/null || echo "default-ssh-secret-change-in-production")
    echo "✅ Generated new secure credentials for fresh installation"
fi

# Always generate new tokens for security
JWT=$(openssl rand -hex 32 2>/dev/null || echo "default-jwt-secret-change-in-production")
SESSION=$(openssl rand -hex 32 2>/dev/null || echo "default-session-secret-change-in-production")
TTYD_PASS=$(openssl rand -base64 16 2>/dev/null || echo "ttyd_pass123")
# CRITICAL: Use SSH_KEY as ENCRYPTION_KEY for consistency
ENCRYPTION_KEY="${SSH_KEY}"

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
# Encryption Key for Passwords (should match SSH_KEY_ENCRYPTION_SECRET)
ENCRYPTION_KEY=${SSH_KEY}

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

# Only add backend image if it's missing (don't modify anything else!)
echo "🔧 Checking configuration..."
if grep -q "^  backend:" docker-compose.yml && ! grep -A 2 "^  backend:" docker-compose.yml | grep -q "image:"; then
    echo "   ⚠️  Adding missing backend image..."
    
    # Platform-specific approach for adding backend image
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - use Python for reliable YAML manipulation
        if command -v python3 &> /dev/null; then
            python3 -c "
import sys
with open('docker-compose.yml', 'r') as f:
    lines = f.readlines()

found = False
for i, line in enumerate(lines):
    if line.strip() == 'backend:':
        # Check if next line already has image
        if i+1 < len(lines) and 'image:' not in lines[i+1]:
            lines.insert(i+1, '    image: ghcr.io/alflewerken/web-appliance-dashboard-backend:latest\n')
            found = True
            break

if found:
    with open('docker-compose.yml', 'w') as f:
        f.writelines(lines)
    print('✅ Backend image added successfully')
" || {
            echo "⚠️  Python fix failed, trying sed..."
            # Fallback to sed with macOS syntax
            sed -i '' '/^  backend:/a\
\    image: ghcr.io/alflewerken/web-appliance-dashboard-backend:latest' docker-compose.yml 2>/dev/null || {
                echo "❌ Could not add backend image automatically"
                echo "Please add manually after 'backend:' line:"
                echo "    image: ghcr.io/alflewerken/web-appliance-dashboard-backend:latest"
            }
        }
        else
            # No Python, use sed with macOS syntax
            sed -i '' '/^  backend:/a\
\    image: ghcr.io/alflewerken/web-appliance-dashboard-backend:latest' docker-compose.yml 2>/dev/null || {
                echo "❌ Could not add backend image automatically"
                echo "Please add manually after 'backend:' line:"
                echo "    image: ghcr.io/alflewerken/web-appliance-dashboard-backend:latest"
            }
        fi
    else
        # Linux - use standard sed
        sed -i '/^  backend:/a\    image: ghcr.io/alflewerken/web-appliance-dashboard-backend:latest' docker-compose.yml 2>/dev/null || {
            # Try with backup for older sed versions
            sed -i.bak '/^  backend:/a\    image: ghcr.io/alflewerken/web-appliance-dashboard-backend:latest' docker-compose.yml 2>/dev/null || {
                echo "❌ Could not add backend image automatically"
                echo "Please add manually after 'backend:' line:"
                echo "    image: ghcr.io/alflewerken/web-appliance-dashboard-backend:latest"
            }
        }
    fi
fi

# Validate docker-compose configuration before starting
echo "🔍 Testing configuration..."
if ! $DOCKER_COMPOSE_CMD config > /dev/null 2>&1; then
    echo "⚠️  Configuration has issues, attempting to fix..."
    
    # Check for common issues and fix them
    # 1. Remove empty volumes sections (common issue from production template)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - use Python for reliable fix
        if command -v python3 &> /dev/null; then
            python3 -c "
import re

with open('docker-compose.yml', 'r') as f:
    content = f.read()

# Remove empty volumes sections (with proper indentation)
# This regex matches volumes: followed by nothing or just whitespace until next service/key
content = re.sub(r'^(\s+)volumes:\s*\n(?=\s*[a-z])', '', content, flags=re.MULTILINE)

with open('docker-compose.yml', 'w') as f:
    f.write(content)
print('✅ Cleaned up empty volumes sections')
" 2>/dev/null || echo "⚠️  Could not clean volumes sections with Python"
        else
            # macOS sed fallback
            sed -i '' '/^[[:space:]]*volumes:[[:space:]]*$/d' docker-compose.yml 2>/dev/null || \
            echo "⚠️  Could not clean volumes sections with sed"
        fi
    else
        # Linux - use sed
        sed -i '/^\s*volumes:\s*$/d' docker-compose.yml 2>/dev/null || \
        sed -i.bak '/^[[:space:]]*volumes:[[:space:]]*$/d' docker-compose.yml 2>/dev/null || \
        echo "⚠️  Could not clean volumes sections"
    fi
    
    # Re-validate after fixes
    if ! $DOCKER_COMPOSE_CMD config > /dev/null 2>&1; then
        echo "❌ Docker Compose configuration is still invalid!"
        echo "📋 Error details:"
        $DOCKER_COMPOSE_CMD config 2>&1 | grep -E "yaml:|line" | head -5
        echo ""
        echo "🔧 Please check docker-compose.yml manually or re-run the installer"
        echo "💡 Tip: You can download a fresh copy with:"
        echo "   curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/docker-compose.production.yml -o docker-compose.yml"
        exit 1
    else
        echo "✅ Configuration fixed and validated"
    fi
else
    echo "✅ Configuration is valid"
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
echo "🚀 Building and starting services..."
# First build any local images (like guacamole)
$DOCKER_COMPOSE_CMD build --no-cache guacamole 2>/dev/null || {
    echo "⚠️  Build step completed (some services use pre-built images)"
}
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

# ALWAYS ensure password is correctly set (fix for SCRAM-SHA-256 authentication)
# This must be done every time because PostgreSQL resets it on container recreation
echo "🔐 Setting Guacamole database password..."
if $DOCKER_CMD exec ${GUACAMOLE_DB_CONTAINER_NAME:-appliance_guacamole_db} psql -U guacamole_user -d guacamole_db -c \
    "ALTER USER guacamole_user PASSWORD 'guacamole_pass123';" 2>&1; then
    log_success "Guacamole database password set successfully"
    
    # Restart Guacamole to ensure it uses the new password
    log_info "Restarting Guacamole to apply password change..."
    $DOCKER_CMD restart ${GUACAMOLE_CONTAINER_NAME:-appliance_guacamole} >/dev/null 2>&1
    sleep 5
    log_success "Guacamole restarted"
else
    log_error "Failed to set Guacamole database password"
    log_info "Trying alternative method..."
    $DOCKER_CMD exec ${GUACAMOLE_DB_CONTAINER_NAME:-appliance_guacamole_db} psql -U guacamole_user -d guacamole_db -c \
        "ALTER USER guacamole_user WITH PASSWORD 'guacamole_pass123';" 2>&1 || \
        log_error "Alternative method also failed"
fi

# Check if Guacamole tables exist
TABLES_EXIST=$($DOCKER_CMD exec ${GUACAMOLE_DB_CONTAINER_NAME:-appliance_guacamole_db} psql -U guacamole_user -d guacamole_db -tAc \
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'guacamole_connection');" 2>/dev/null || echo "f")

if [ "$TABLES_EXIST" = "f" ]; then
    echo "📝 Initializing Guacamole database..."
    
    # Generate schema from official Guacamole image if not exists
    if [ ! -f "guacamole/guacamole-schema.sql" ]; then
        echo "📥 Extracting Guacamole schema from official image..."
        $DOCKER_CMD run --rm guacamole/guacamole:1.5.5 /opt/guacamole/bin/initdb.sh --postgresql > guacamole/guacamole-schema.sql 2>/dev/null
    fi
    
    # Load schema
    if [ -f "guacamole/guacamole-schema.sql" ]; then
        echo "📋 Loading Guacamole schema..."
        $DOCKER_CMD exec -i ${GUACAMOLE_DB_CONTAINER_NAME:-appliance_guacamole_db} psql -U guacamole_user -d guacamole_db < guacamole/guacamole-schema.sql >/dev/null 2>&1
        
        # Create admin user
        echo "👤 Creating Guacamole admin user..."
        $DOCKER_CMD exec ${GUACAMOLE_DB_CONTAINER_NAME:-appliance_guacamole_db} psql -U guacamole_user -d guacamole_db -c "
            -- Create default admin user for Guacamole
            INSERT INTO guacamole_entity (name, type) VALUES ('guacadmin', 'USER')
            ON CONFLICT (name, type) DO NOTHING;
            
            INSERT INTO guacamole_user (entity_id, password_hash, password_salt, password_date)
            SELECT entity_id, 
                E'\\\\xCA458A7D494E3BE824F5E1E175A1556C0F8EEF2C2D7DF3633BEC4A29C4411960',
                E'\\\\xFE24ADC5E11E2B25288D1704ABE67A79E342ECC26064CE69C5B3177795A82264',
                CURRENT_TIMESTAMP
            FROM guacamole_entity
            WHERE name = 'guacadmin' AND type = 'USER'
            ON CONFLICT (entity_id) DO NOTHING;
            
            -- Give admin system permissions
            INSERT INTO guacamole_system_permission (entity_id, permission)
            SELECT entity_id, permission::guacamole_system_permission_type
            FROM guacamole_entity,
                (VALUES ('CREATE_CONNECTION'), ('CREATE_CONNECTION_GROUP'), 
                        ('CREATE_SHARING_PROFILE'), ('CREATE_USER'),
                        ('CREATE_USER_GROUP'), ('ADMINISTER')) AS perms(permission)
            WHERE name = 'guacadmin' AND type = 'USER'
            ON CONFLICT DO NOTHING;
        " >/dev/null 2>&1
        
        echo "✅ Guacamole database initialized"
    else
        echo "⚠️  Could not create schema file - Remote Desktop may not work initially"
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
echo ""
# Show all configured access URLs including user-provided domains
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
