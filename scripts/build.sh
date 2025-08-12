#!/bin/bash

# Web Appliance Dashboard - Universal Build & Start Script
# Version 2.0 - Consolidated with cold-start functionality

# Read version from VERSION file
VERSION=$(cat "$(dirname "$0")/../VERSION" 2>/dev/null || echo "2.0.0")

echo "🚀 Web Appliance Dashboard Build Script v$VERSION"
echo "======================================="

# Color codes for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    case $1 in
        "success") echo -e "${GREEN}✅ $2${NC}" ;;
        "error") echo -e "${RED}❌ $2${NC}" ;;
        "warning") echo -e "${YELLOW}⚠️  $2${NC}" ;;
        "info") echo -e "📌 $2" ;;
        "blue") echo -e "${BLUE}$2${NC}" ;;
    esac
}

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Function to fix environment variables
fix_env_file() {
    print_status "info" "Checking and fixing environment configuration..."
    
    # Check if setup-env.sh exists and should be run
    SETUP_ENV_SCRIPT="$SCRIPT_DIR/setup-env.sh"
    
    # Check if .env has placeholder values that need fixing
    if [ -f .env ]; then
        if grep -q "YOUR_.*_HERE" .env 2>/dev/null; then
            print_status "warning" "Environment file contains placeholder values"
            
            # If setup-env.sh exists, use it for proper setup
            if [ -f "$SETUP_ENV_SCRIPT" ] && [ -x "$SETUP_ENV_SCRIPT" ]; then
                print_status "info" "Running setup-env.sh for proper environment configuration..."
                # Run in non-interactive mode for build script
                echo -e "\n\n\nproduction\n" | "$SETUP_ENV_SCRIPT" >/dev/null 2>&1 || {
                    print_status "warning" "setup-env.sh had issues, falling back to simple fix"
                }
                
                # Verify it worked
                if ! grep -q "YOUR_.*_HERE" .env 2>/dev/null; then
                    print_status "success" "Environment properly configured with setup-env.sh"
                else
                    # Fallback for placeholders
                    apply_simple_fixes
                fi
            else
                apply_simple_fixes
            fi
        fi
        
        # Fix EXTERNAL_URL and CORS settings regardless of placeholders
        fix_external_url_and_cors
        
    elif [ ! -f .env ]; then
        # .env doesn't exist at all
        if [ -f "$SETUP_ENV_SCRIPT" ] && [ -x "$SETUP_ENV_SCRIPT" ]; then
            print_status "warning" ".env file not found, running setup-env.sh..."
            echo -e "\n\n\nproduction\n" | "$SETUP_ENV_SCRIPT" >/dev/null 2>&1 || {
                print_status "warning" "setup-env.sh had issues"
            }
        elif [ -f .env.example ]; then
            print_status "warning" ".env file not found, creating from .env.example..."
            cp .env.example .env
            apply_simple_fixes
        else
            print_status "error" "Neither .env nor .env.example found!"
            exit 1
        fi
        
        # Fix EXTERNAL_URL and CORS after creating .env
        fix_external_url_and_cors
    else
        # .env exists and has no placeholders - still check EXTERNAL_URL
        fix_external_url_and_cors
    fi
    
    # Ensure other critical variables exist
    ensure_critical_variables
    
    # Sync to backend/.env if it exists
    if [ -d backend ]; then
        sync_backend_env
    fi
}

# Function to apply simple fixes for placeholders
apply_simple_fixes() {
    print_status "info" "Applying simple environment fixes..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - need to use sed -i'' (no space) or sed -i '.bak'
        sed -i'' -e 's/YOUR_GUACAMOLE_DB_PASSWORD_HERE/guacamole_pass123/' .env 2>/dev/null || true
        sed -i'' -e 's/YOUR_DB_PASSWORD_HERE/dashboard_pass123/' .env 2>/dev/null || true
        sed -i'' -e 's/YOUR_MYSQL_ROOT_PASSWORD_HERE/rootpass123/' .env 2>/dev/null || true
        sed -i'' -e 's/YOUR_MYSQL_USER_PASSWORD_HERE/dashboard_pass123/' .env 2>/dev/null || true
    else
        # Linux
        sed -i 's/YOUR_GUACAMOLE_DB_PASSWORD_HERE/guacamole_pass123/g' .env 2>/dev/null || true
        sed -i 's/YOUR_DB_PASSWORD_HERE/dashboard_pass123/g' .env 2>/dev/null || true
        sed -i 's/YOUR_MYSQL_ROOT_PASSWORD_HERE/rootpass123/g' .env 2>/dev/null || true
        sed -i 's/YOUR_MYSQL_USER_PASSWORD_HERE/dashboard_pass123/g' .env 2>/dev/null || true
    fi
}

# Function to fix EXTERNAL_URL and CORS settings
fix_external_url_and_cors() {
    print_status "info" "Configuring EXTERNAL_URL and CORS settings..."
    
    # Get hostname and IP addresses
    HOSTNAME=$(hostname -f 2>/dev/null || hostname)
    LOCAL_HOSTNAME=$(hostname -s 2>/dev/null || hostname)
    
    # Get primary IP address
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        PRIMARY_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
    else
        # Linux
        PRIMARY_IP=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v 127.0.0.1 | head -1)
    fi
    
    # Check if we already have a configured domain in .env
    CONFIGURED_DOMAIN=""
    if [ -f .env ]; then
        CONFIGURED_DOMAIN=$(grep "^CONFIGURED_DOMAIN=" .env | cut -d= -f2- || echo "")
    fi
    
    # Ask for domain if not configured or if refresh explicitly requested
    if [ -z "$CONFIGURED_DOMAIN" ] || [ "$ASK_DOMAIN" = true ]; then
        echo ""
        print_status "info" "🌐 Configure Access Domain"
        echo "========================"
        echo "The dashboard needs to know how it will be accessed."
        echo "This is important for CORS configuration and reverse proxy setups."
        echo ""
        echo "Detected system information (for reference):"
        echo "  Hostname: $HOSTNAME"
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
        
        # Read user input
        if [ -t 0 ]; then
            # Interactive mode
            read -p "Enter domain/hostname [press Enter for localhost]: " USER_DOMAIN
        else
            # Non-interactive mode
            print_status "warning" "Non-interactive mode detected. Using localhost."
            USER_DOMAIN=""
        fi
        
        # Process user input
        if [ -z "$USER_DOMAIN" ]; then
            # User pressed Enter - use only localhost
            CONFIGURED_DOMAIN="localhost"
        else
            CONFIGURED_DOMAIN="$USER_DOMAIN"
        fi
        
        # Save configured domain to .env
        if grep -q "^CONFIGURED_DOMAIN=" .env 2>/dev/null; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i'' -e "s|^CONFIGURED_DOMAIN=.*|CONFIGURED_DOMAIN=${CONFIGURED_DOMAIN}|" .env
            else
                sed -i "s|^CONFIGURED_DOMAIN=.*|CONFIGURED_DOMAIN=${CONFIGURED_DOMAIN}|" .env
            fi
        else
            echo "CONFIGURED_DOMAIN=${CONFIGURED_DOMAIN}" >> .env
        fi
        
        print_status "success" "Domain configured: ${CONFIGURED_DOMAIN}"
    fi
    
    # Parse configured domains
    IFS=',' read -ra DOMAINS <<< "$CONFIGURED_DOMAIN"
    
    # Always include localhost
    if [[ ! " ${DOMAINS[@]} " =~ " localhost " ]]; then
        DOMAINS+=("localhost")
    fi
    
    # Determine primary domain for EXTERNAL_URL
    PRIMARY_DOMAIN="${DOMAINS[0]}"
    
    # Build EXTERNAL_URL
    if [ "$PRIMARY_DOMAIN" = "localhost" ] && [ -n "$PRIMARY_IP" ]; then
        # If primary is localhost but we have an IP, use IP for better network access
        EXTERNAL_URL="http://${PRIMARY_IP}:9080"
    else
        EXTERNAL_URL="http://${PRIMARY_DOMAIN}:9080"
    fi
    
    # Build CORS origins list
    CORS_ORIGINS=""
    for DOMAIN in "${DOMAINS[@]}"; do
        if [ -n "$CORS_ORIGINS" ]; then
            CORS_ORIGINS="${CORS_ORIGINS},"
        fi
        CORS_ORIGINS="${CORS_ORIGINS}http://${DOMAIN},https://${DOMAIN}"
        
        # Add with ports
        CORS_ORIGINS="${CORS_ORIGINS},http://${DOMAIN}:9080,https://${DOMAIN}:9443"
    done
    
    # Also add detected system info if not already included
    if [ -n "$HOSTNAME" ] && [[ ! " ${DOMAINS[@]} " =~ " ${HOSTNAME} " ]]; then
        CORS_ORIGINS="${CORS_ORIGINS},http://${HOSTNAME}:9080,https://${HOSTNAME}:9443"
    fi
    if [ -n "$LOCAL_HOSTNAME" ] && [[ ! " ${DOMAINS[@]} " =~ " ${LOCAL_HOSTNAME} " ]]; then
        CORS_ORIGINS="${CORS_ORIGINS},http://${LOCAL_HOSTNAME}:9080,https://${LOCAL_HOSTNAME}:9443"
        CORS_ORIGINS="${CORS_ORIGINS},http://${LOCAL_HOSTNAME}.local:9080,https://${LOCAL_HOSTNAME}.local:9443"
    fi
    if [ -n "$PRIMARY_IP" ] && [[ ! " ${DOMAINS[@]} " =~ " ${PRIMARY_IP} " ]]; then
        CORS_ORIGINS="${CORS_ORIGINS},http://${PRIMARY_IP}:9080,https://${PRIMARY_IP}:9443"
    fi
    
    # Update or add EXTERNAL_URL in .env
    if grep -q "^EXTERNAL_URL=" .env; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i'' -e "s|^EXTERNAL_URL=.*|EXTERNAL_URL=${EXTERNAL_URL}|" .env
        else
            sed -i "s|^EXTERNAL_URL=.*|EXTERNAL_URL=${EXTERNAL_URL}|" .env
        fi
    else
        echo "EXTERNAL_URL=${EXTERNAL_URL}" >> .env
    fi
    
    # Update or add ALLOWED_ORIGINS in .env
    if grep -q "^ALLOWED_ORIGINS=" .env; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i'' -e "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=${CORS_ORIGINS}|" .env
        else
            sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=${CORS_ORIGINS}|" .env
        fi
    else
        echo "ALLOWED_ORIGINS=${CORS_ORIGINS}" >> .env
    fi
    
    # Also update CORS_ORIGIN for compatibility
    if grep -q "^CORS_ORIGIN=" .env; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i'' -e "s|^CORS_ORIGIN=.*|CORS_ORIGIN=${CORS_ORIGINS}|" .env
        else
            sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=${CORS_ORIGINS}|" .env
        fi
    fi
    
    print_status "success" "EXTERNAL_URL set to: ${EXTERNAL_URL}"
    print_status "success" "CORS configured for: ${CONFIGURED_DOMAIN}"
}

# Function to ensure critical variables exist
ensure_critical_variables() {
    local env_fixed=false
    
    # Check for critical variables and generate if missing
    if ! grep -q "^DB_PASSWORD=" .env || grep -q "^DB_PASSWORD=YOUR_" .env; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i'' -e 's/^DB_PASSWORD=.*/DB_PASSWORD=dashboard_pass123/' .env 2>/dev/null || echo "DB_PASSWORD=dashboard_pass123" >> .env
        else
            sed -i 's/^DB_PASSWORD=.*/DB_PASSWORD=dashboard_pass123/g' .env 2>/dev/null || echo "DB_PASSWORD=dashboard_pass123" >> .env
        fi
        env_fixed=true
    fi
    
    if ! grep -q "^JWT_SECRET=" .env || grep -q "^JWT_SECRET=YOUR_" .env; then
        JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo 'default-jwt-secret-change-in-production')
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i'' -e "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env 2>/dev/null || echo "JWT_SECRET=$JWT_SECRET" >> .env
        else
            sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/g" .env 2>/dev/null || echo "JWT_SECRET=$JWT_SECRET" >> .env
        fi
        env_fixed=true
    fi
    
    if ! grep -q "^SSH_KEY_ENCRYPTION_SECRET=" .env || grep -q "^SSH_KEY_ENCRYPTION_SECRET=YOUR_" .env; then
        SSH_SECRET=$(openssl rand -hex 32 2>/dev/null || echo 'default-ssh-secret-change-in-production')
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i'' -e "s/^SSH_KEY_ENCRYPTION_SECRET=.*/SSH_KEY_ENCRYPTION_SECRET=$SSH_SECRET/" .env 2>/dev/null || echo "SSH_KEY_ENCRYPTION_SECRET=$SSH_SECRET" >> .env
        else
            sed -i "s/^SSH_KEY_ENCRYPTION_SECRET=.*/SSH_KEY_ENCRYPTION_SECRET=$SSH_SECRET/g" .env 2>/dev/null || echo "SSH_KEY_ENCRYPTION_SECRET=$SSH_SECRET" >> .env
        fi
        env_fixed=true
    fi
    
    if [ "$env_fixed" = true ]; then
        print_status "success" "Critical environment variables ensured"
    fi
}

# Function to sync backend/.env
sync_backend_env() {
    print_status "info" "Syncing to backend/.env..."
    
    # Create backend/.env if it doesn't exist
    if [ ! -f backend/.env ]; then
        touch backend/.env
    fi
    
    # Read important values from main .env
    DB_HOST=$(grep "^DB_HOST=" .env | cut -d= -f2- || echo "database")
    DB_PORT=$(grep "^DB_PORT=" .env | cut -d= -f2- || echo "3306")
    DB_USER=$(grep "^DB_USER=" .env | cut -d= -f2- || echo "dashboard_user")
    DB_PASSWORD=$(grep "^DB_PASSWORD=" .env | cut -d= -f2- || echo "")
    DB_NAME=$(grep "^DB_NAME=" .env | cut -d= -f2- || echo "appliance_dashboard")
    JWT_SECRET=$(grep "^JWT_SECRET=" .env | cut -d= -f2- || echo "")
    SSH_SECRET=$(grep "^SSH_KEY_ENCRYPTION_SECRET=" .env | cut -d= -f2- || echo "")
    EXTERNAL_URL=$(grep "^EXTERNAL_URL=" .env | cut -d= -f2- || echo "")
    ALLOWED_ORIGINS=$(grep "^ALLOWED_ORIGINS=" .env | cut -d= -f2- || echo "")
    
    # Create clean backend/.env
    cat > backend/.env << EOF
# Backend Configuration
PORT=3001

# Database Configuration
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}

# JWT Configuration
JWT_SECRET=${JWT_SECRET}

# SSH Key Encryption
SSH_KEY_ENCRYPTION_SECRET=${SSH_SECRET}

# Node Environment
NODE_ENV=production

# External URL (CRITICAL for Guacamole URLs!)
EXTERNAL_URL=${EXTERNAL_URL}

# CORS Settings
CORS_ORIGIN=${ALLOWED_ORIGINS}
ALLOWED_ORIGINS=${ALLOWED_ORIGINS}

# Logging
LOG_LEVEL=info

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# Session
SESSION_SECRET=${JWT_SECRET}
EOF
    
    print_status "success" "Synced to backend/.env"
}

# Function to initialize Guacamole database
init_guacamole_db() {
    print_status "info" "Checking Guacamole database..."
    
    # Wait for postgres to be ready
    sleep 5
    
    # Check if tables exist
    TABLES_EXIST=$(docker exec appliance_guacamole_db psql -U guacamole_user -d guacamole_db -tAc \
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'guacamole_connection');" 2>/dev/null || echo "f")
    
    if [ "$TABLES_EXIST" = "f" ]; then
        print_status "warning" "Guacamole tables missing - initializing database..."
        
        # Check for schema files
        if [ ! -f "guacamole/001-create-schema.sql" ] || [ ! -f "guacamole/002-create-admin-user.sql" ]; then
            print_status "warning" "Schema files not found locally, trying to extract from container..."
            
            # Extract from Guacamole container if available
            if docker ps | grep -q appliance_guacamole; then
                docker exec appliance_guacamole sh -c "cat /opt/guacamole/postgresql/schema/001-create-schema.sql" > guacamole/001-create-schema.sql 2>/dev/null
                docker exec appliance_guacamole sh -c "cat /opt/guacamole/postgresql/schema/002-create-admin-user.sql" > guacamole/002-create-admin-user.sql 2>/dev/null
            fi
        fi
        
        # Load schema files
        if [ -f "guacamole/001-create-schema.sql" ]; then
            print_status "info" "Loading Guacamole schema..."
            docker exec -i appliance_guacamole_db sh -c "PGPASSWORD=guacamole_pass123 psql -U guacamole_user -d guacamole_db" < guacamole/001-create-schema.sql >/dev/null 2>&1
            
            if [ -f "guacamole/002-create-admin-user.sql" ]; then
                docker exec -i appliance_guacamole_db sh -c "PGPASSWORD=guacamole_pass123 psql -U guacamole_user -d guacamole_db" < guacamole/002-create-admin-user.sql >/dev/null 2>&1
            fi
            
            if [ -f "guacamole/custom-sftp.sql" ]; then
                docker exec -i appliance_guacamole_db sh -c "PGPASSWORD=guacamole_pass123 psql -U guacamole_user -d guacamole_db" < guacamole/custom-sftp.sql >/dev/null 2>&1
            fi
            
            print_status "success" "Guacamole database initialized"
            
            # Restart Guacamole to apply changes
            docker compose restart guacamole >/dev/null 2>&1
            sleep 5
        else
            print_status "error" "Could not find or create schema files!"
            print_status "warning" "Guacamole may not work properly"
        fi
    else
        print_status "success" "Guacamole database OK"
    fi
}

# Function to wait for container to be healthy
wait_for_healthy() {
    local container=$1
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        # Check if container exists first
        if ! docker ps -a --format "{{.Names}}" | grep -q "^${container}$"; then
            sleep 2
            attempt=$((attempt + 1))
            continue
        fi
        
        STATUS=$(docker inspect -f '{{.State.Health.Status}}' $container 2>/dev/null || echo "not_found")
        
        if [ "$STATUS" = "healthy" ]; then
            return 0
        elif [ "$STATUS" = "not_found" ]; then
            # Container doesn't have health check, just check if running
            if docker ps | grep -q $container; then
                return 0
            fi
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo ""
    return 1
}

# Function to perform quick refresh
quick_refresh() {
    print_status "info" "Performing quick refresh of frontend and backend..."
    
    # Fix env first
    fix_env_file
    
    # Check if EXTERNAL_URL changed - if yes, we need to recreate containers
    CURRENT_EXTERNAL_URL=$(docker exec appliance_backend env 2>/dev/null | grep "^EXTERNAL_URL=" | cut -d= -f2- || echo "")
    EXPECTED_EXTERNAL_URL=$(grep "^EXTERNAL_URL=" .env | cut -d= -f2- || echo "")
    
    if [ "$CURRENT_EXTERNAL_URL" != "$EXPECTED_EXTERNAL_URL" ] && [ -n "$EXPECTED_EXTERNAL_URL" ]; then
        print_status "warning" "EXTERNAL_URL changed, recreating backend container..."
        docker compose up -d --force-recreate backend
        print_status "success" "Backend recreated with new environment"
    else
        # Just restart backend
        print_status "info" "Restarting backend..."
        docker compose restart backend
        print_status "success" "Backend restarted"
    fi
    
    # Wait for backend
    echo -n "⏳ Waiting for backend to be ready"
    if wait_for_healthy "appliance_backend"; then
        echo ""
        print_status "success" "Backend is healthy"
    else
        echo ""
        print_status "warning" "Backend health check timed out, but might still work"
    fi
    
    # Rebuild frontend if source changed
    print_status "info" "Checking frontend changes..."
    if [ -d "frontend" ]; then
        cd frontend
        if [ -f "package.json" ]; then
            print_status "info" "Rebuilding frontend..."
            npm run build >/dev/null 2>&1 || true
            print_status "success" "Frontend rebuilt"
        fi
        cd ..
    fi
    
    # Restart webserver
    print_status "info" "Restarting webserver..."
    docker compose restart webserver
    print_status "success" "Webserver restarted"
    
    print_status "success" "Quick refresh complete!"
    show_access_info
}

# Function to show access information
show_access_info() {
    echo ""
    print_status "success" "All services are running!"
    echo ""
    print_status "info" "Access points:"
    echo "   🌐 Dashboard: http://localhost:9080"
    echo "   🔒 HTTPS: https://localhost:9443"
    echo "   🖥️  Backend API: http://localhost:3001"
    
    if docker ps | grep -q guacamole; then
        echo "   📊 Guacamole: http://localhost:9080/guacamole"
    fi
    
    echo ""
    print_status "info" "Default credentials:"
    echo "   Dashboard: admin / admin123"
    
    if docker ps | grep -q guacamole; then
        echo "   Guacamole: guacadmin / guacadmin"
    fi
    
    echo ""
    print_status "info" "View logs with:"
    echo "   docker compose logs -f backend"
    echo "   docker compose logs -f webserver"
}

# Function to show help
show_help() {
    echo ""
    print_status "blue" "Web Appliance Dashboard Build Script v$VERSION"
    echo "============================================"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "OPTIONS:"
    echo "  --help                Show this help message"
    echo "  --refresh             Quick restart of frontend and backend"
    echo "  --cold-start          Full system start with all checks (default)"
    echo "  --configure-domain    Reconfigure domain/hostname for CORS"
    echo "  --no-remote-desktop   Disable Remote Desktop (Guacamole)"
    echo "  --nocache             Clear all caches before building"
    echo ""
    echo "EXAMPLES:"
    echo "  $0                    # Full start with all checks"
    echo "  $0 --refresh          # Quick restart for development"
    echo "  $0 --configure-domain # Change domain configuration"
    echo "  $0 --nocache          # Full rebuild with cache clearing"
    echo ""
    echo "AFTER CLONE/RESTART:"
    echo "  Just run: $0"
    echo "  The script will automatically fix any configuration issues"
    echo ""
    exit 0
}

# Parse command line arguments
ENABLE_REMOTE_DESKTOP=true
CLEAR_CACHE=false
REFRESH_MODE=false
ASK_DOMAIN=false

for arg in "$@"; do
    case $arg in
        --help)
            show_help
            ;;
        --refresh)
            REFRESH_MODE=true
            ;;
        --no-remote-desktop)
            ENABLE_REMOTE_DESKTOP=false
            ;;
        --nocache)
            CLEAR_CACHE=true
            ;;
        --cold-start)
            # This is now default behavior
            ;;
        --configure-domain)
            ASK_DOMAIN=true
            ;;
        *)
            print_status "warning" "Unknown option: $arg"
            ;;
    esac
done

# Quick refresh mode
if [ "$REFRESH_MODE" = true ]; then
    quick_refresh
    exit 0
fi

# MAIN BUILD PROCESS
print_status "info" "Starting full build process..."
echo ""

# Step 1: Fix environment
fix_env_file

# Step 2: Clear cache if requested
if [ "$CLEAR_CACHE" = true ]; then
    print_status "info" "Clearing caches..."
    
    # Clear npm cache
    if command -v npm &> /dev/null; then
        npm cache clean --force >/dev/null 2>&1 || true
    fi
    
    # Clear Docker build cache
    docker builder prune -f >/dev/null 2>&1 || true
    
    # Remove node_modules if they exist
    if [ -d "frontend/node_modules" ]; then
        rm -rf frontend/node_modules
    fi
    if [ -d "backend/node_modules" ]; then
        rm -rf backend/node_modules
    fi
    
    print_status "success" "Caches cleared"
fi

# Step 3: Ensure Docker is running
if ! docker info >/dev/null 2>&1; then
    print_status "error" "Docker is not running!"
    echo "Please start Docker Desktop and try again."
    exit 1
fi

# Step 4: Create network if it doesn't exist
NETWORK_NAME="appliance_network"
if docker network ls | grep -q "$NETWORK_NAME"; then
    print_status "info" "Checking Docker network..."
    # Check if it's managed by compose
    if ! docker network inspect $NETWORK_NAME | grep -q "com.docker.compose.network"; then
        print_status "warning" "Removing unmanaged network..."
        docker network rm $NETWORK_NAME >/dev/null 2>&1 || true
        print_status "info" "Network will be recreated by docker compose"
    else
        print_status "success" "Network exists and is managed by compose"
    fi
else
    print_status "info" "Network will be created by docker compose"
fi

# Step 5: Build frontend
if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
    print_status "info" "Building frontend..."
    cd frontend
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ] || [ "$CLEAR_CACHE" = true ]; then
        print_status "info" "Installing frontend dependencies..."
        if npm install >/dev/null 2>&1; then
            print_status "success" "Frontend dependencies installed"
        else
            print_status "warning" "Failed to install frontend dependencies, trying with --force..."
            npm install --force >/dev/null 2>&1 || {
                print_status "warning" "Could not install dependencies, skipping frontend build"
            }
        fi
    fi
    
    # Build frontend
    if [ -d "node_modules" ]; then
        print_status "info" "Compiling frontend..."
        if npm run build >/dev/null 2>&1; then
            print_status "success" "Frontend built successfully"
        else
            print_status "warning" "Frontend build failed, checking for existing build..."
            if [ -d "build" ]; then
                print_status "info" "Using existing frontend build"
            else
                print_status "warning" "No frontend build available, dashboard may not work properly"
            fi
        fi
    elif [ -d "build" ]; then
        print_status "info" "Using pre-built frontend"
    else
        print_status "warning" "No frontend available, dashboard UI will not work"
    fi
    
    cd ..
elif [ -d "frontend/build" ]; then
    print_status "info" "Using pre-built frontend (no source code available)"
else
    print_status "warning" "No frontend found - dashboard UI will not be available"
    print_status "info" "This is normal for production Docker images"
fi

# Step 6: Start services in order
print_status "info" "Starting services..."

# Start database first
print_status "info" "Starting database..."
docker compose up -d database

echo -n "⏳ Waiting for database"
if wait_for_healthy "appliance_db"; then
    echo ""
    print_status "success" "Database is ready"
else
    echo ""
    print_status "error" "Database failed to start"
    docker logs appliance_db --tail 20
    exit 1
fi

# Start backend
print_status "info" "Starting backend..."
docker compose up -d backend

echo -n "⏳ Waiting for backend"
if wait_for_healthy "appliance_backend"; then
    echo ""
    print_status "success" "Backend is ready"
else
    echo ""
    print_status "warning" "Backend health check failed, but continuing..."
fi

# Start ttyd
print_status "info" "Starting terminal service..."
docker compose up -d ttyd

# Start webserver
print_status "info" "Starting webserver..."
docker compose up -d webserver

# Start Guacamole if enabled
if [ "$ENABLE_REMOTE_DESKTOP" = true ]; then
    print_status "info" "Starting Remote Desktop services (Guacamole)..."
    
    # Start Guacamole database
    docker compose up -d guacamole-postgres
    
    echo -n "⏳ Waiting for Guacamole database"
    if wait_for_healthy "appliance_guacamole_db"; then
        echo ""
        print_status "success" "Guacamole database is ready"
        
        # Initialize database if needed
        init_guacamole_db
    else
        echo ""
        print_status "warning" "Guacamole database health check failed"
    fi
    
    # Start guacd
    docker compose up -d guacd
    
    # Start Guacamole web
    docker compose up -d guacamole
    
    echo -n "⏳ Waiting for Guacamole"
    if wait_for_healthy "appliance_guacamole"; then
        echo ""
        print_status "success" "Guacamole is ready"
    else
        echo ""
        print_status "warning" "Guacamole health check failed"
    fi
    
    # Start RustDesk services
    print_status "info" "Starting RustDesk Remote Desktop services..."
    
    # Start RustDesk ID/Rendezvous Server
    docker compose up -d rustdesk-server
    
    # Start RustDesk Relay Server
    docker compose up -d rustdesk-relay
    
    # Give them a moment to start
    sleep 3
    
    # Check if they're running
    if docker ps | grep -q "rustdesk-server"; then
        print_status "success" "RustDesk ID Server is running"
    else
        print_status "warning" "RustDesk ID Server failed to start"
    fi
    
    if docker ps | grep -q "rustdesk-relay"; then
        print_status "success" "RustDesk Relay Server is running"
    else
        print_status "warning" "RustDesk Relay Server failed to start"
    fi
fi

# Step 7: Verify all services
print_status "info" "Verifying services..."
sleep 3

ALL_HEALTHY=true
SERVICES="database backend webserver ttyd"
if [ "$ENABLE_REMOTE_DESKTOP" = true ]; then
    SERVICES="$SERVICES guacamole guacamole-postgres guacd rustdesk-server rustdesk-relay"
fi

for SERVICE in $SERVICES; do
    CONTAINER="appliance_${SERVICE}"
    if [ "$SERVICE" = "guacamole-postgres" ]; then
        CONTAINER="appliance_guacamole_db"
    elif [ "$SERVICE" = "database" ]; then
        CONTAINER="appliance_db"
    elif [ "$SERVICE" = "rustdesk-server" ]; then
        CONTAINER="rustdesk-server"
    elif [ "$SERVICE" = "rustdesk-relay" ]; then
        CONTAINER="rustdesk-relay"
    fi
    
    if docker ps | grep -q "$CONTAINER"; then
        echo "   ✅ $SERVICE: running"
    else
        echo "   ❌ $SERVICE: not running"
        ALL_HEALTHY=false
    fi
done

echo ""
if [ "$ALL_HEALTHY" = true ]; then
    show_access_info
    print_status "success" "Build complete! System is ready."
else
    print_status "warning" "Some services may need attention"
    echo "Check logs with: docker compose logs <service-name>"
fi