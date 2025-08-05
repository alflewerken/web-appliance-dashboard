#!/bin/bash

# Enhanced Build Script with Remote Desktop Support (Default)
# Version 3.1 - Added --help and --refresh options

echo "🚀 Web Appliance Dashboard Build Script"
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

# Function to show help
show_help() {
    echo ""
    print_status "blue" "Web Appliance Dashboard Build Script - Help"
    echo "============================================"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "OPTIONS:"
    echo "  --help                Show this help message"
    echo "  --refresh             Quick restart of frontend and backend (for code changes)"
    echo "  --no-remote-desktop   Disable Remote Desktop support (Guacamole)"
    echo "  --nocache             Clear all caches before building"
    echo "  --macos-app           Also build macOS app containers"
    echo ""
    echo "EXAMPLES:"
    echo "  $0                    # Standard build with Remote Desktop support"
    echo "  $0 --refresh          # Quick restart for development"
    echo "  $0 --nocache          # Full rebuild with cache clearing"
    echo "  $0 --no-remote-desktop --nocache  # Full rebuild without Remote Desktop"
    echo ""
    echo "QUICK DEVELOPMENT:"
    echo "  The --refresh option is perfect for development. It quickly restarts"
    echo "  the frontend and backend containers to apply code changes without"
    echo "  rebuilding everything."
    echo ""
    exit 0
}

# Function to perform quick refresh
quick_refresh() {
    print_status "info" "Performing quick refresh of frontend and backend..."
    echo ""
    
    # Check if containers are running
    if ! docker compose ps | grep -q "Up"; then
        print_status "error" "No running containers found. Please run a full build first."
        echo "Run: $0"
        exit 1
    fi
    
    # Restart backend
    print_status "info" "Restarting backend..."
    if docker compose restart backend; then
        print_status "success" "Backend restarted"
    else
        print_status "error" "Failed to restart backend"
        exit 1
    fi
    
    # Wait for backend to be ready
    echo "⏳ Waiting for backend to be ready..."
    sleep 5
    
    # Verify backend is accessible
    if curl -f -s http://localhost:3001/api/health >/dev/null 2>&1; then
        print_status "success" "Backend API is responding"
    else
        print_status "warning" "Backend health check failed, but service might still be starting"
    fi
    
    # Rebuild frontend if needed
    print_status "info" "Checking frontend changes..."
    cd frontend
    
    # Check if build directory exists
    if [ -d "build" ]; then
        print_status "info" "Rebuilding frontend..."
        if npm run build; then
            print_status "success" "Frontend rebuilt successfully"
        else
            print_status "warning" "Frontend build failed, using existing build"
        fi
    else
        print_status "warning" "No frontend build directory found, skipping frontend refresh"
    fi
    cd ..
    
    # Restart webserver to pick up frontend changes
    print_status "info" "Restarting webserver..."
    if docker compose restart webserver; then
        print_status "success" "Webserver restarted"
    else
        print_status "error" "Failed to restart webserver"
        exit 1
    fi
    
    echo ""
    print_status "success" "Quick refresh complete!"
    echo ""
    print_status "info" "Services refreshed:"
    echo "   ✅ Backend (code changes applied)"
    echo "   ✅ Frontend (if build was successful)"
    echo "   ✅ Webserver (serving updated content)"
    echo ""
    print_status "info" "Access points:"
    echo "   📌 Dashboard: http://localhost:9080"
    echo "   📌 Backend API: http://localhost:9080/api"
    echo ""
    print_status "info" "View logs with:"
    echo "   docker compose logs -f backend"
    echo "   docker compose logs -f webserver"
    echo ""
    
    exit 0
}

# Function to check if a container is healthy
wait_for_healthy() {
    local container=$1
    local max_attempts=30
    local attempt=0
    
    echo "⏳ Waiting for $container to be healthy..."
    
    while [ $attempt -lt $max_attempts ]; do
        health_status=$(docker inspect --format='{{.State.Health.Status}}' $container 2>/dev/null || echo "not_found")
        
        if [ "$health_status" = "healthy" ]; then
            print_status "success" "$container is healthy"
            return 0
        elif [ "$health_status" = "not_found" ]; then
            echo "⏳ $container not found yet..."
        else
            echo "⏳ $container status: $health_status (attempt $((attempt+1))/$max_attempts)"
        fi
        
        sleep 2
        ((attempt++))
    done
    
    print_status "error" "$container failed to become healthy after $max_attempts attempts"
    return 1
}

# Function to check if a service is running
check_service_running() {
    local service=$1
    if docker compose ps $service | grep -q "Up"; then
        return 0
    else
        return 1
    fi
}

# Change to project root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.." || exit 1

# Check if ANY .env file is missing
if [ ! -f .env ] || [ ! -f backend/.env ] || [ ! -f frontend/.env ]; then
    print_status "warning" "One or more .env files are missing or out of sync!"
    
    # Show which files are missing
    [ ! -f .env ] && echo "  ❌ Missing: .env"
    [ ! -f backend/.env ] && echo "  ❌ Missing: backend/.env"
    [ ! -f frontend/.env ] && echo "  ❌ Missing: frontend/.env"
    
    echo ""
    print_status "info" "To ensure consistency, ALL .env files will be recreated."
    
    # Remove existing .env files to ensure clean state
    [ -f .env ] && rm -f .env && echo "  🗑️  Removed existing .env"
    [ -f backend/.env ] && rm -f backend/.env && echo "  🗑️  Removed existing backend/.env"
    [ -f frontend/.env ] && rm -f frontend/.env && echo "  🗑️  Removed existing frontend/.env"
    
    echo ""
    echo "The application needs environment configuration to run."
    echo "Starting automatic setup..."
    echo ""
    
    # Check if setup-env.sh exists
    if [ -f ./scripts/setup-env.sh ]; then
        # Make it executable
        chmod +x ./scripts/setup-env.sh
        
        # Run setup script ONCE for all .env files
        if ./scripts/setup-env.sh; then
            print_status "success" "All .env files created successfully"
            
            # Verify all files were created
            if [ -f .env ] && [ -f backend/.env ] && [ -f frontend/.env ]; then
                print_status "success" "Environment setup complete"
                echo "  ✅ .env"
                echo "  ✅ backend/.env"
                echo "  ✅ frontend/.env"
            else
                print_status "error" "Some .env files are still missing after setup"
                [ ! -f .env ] && echo "  ❌ Still missing: .env"
                [ ! -f backend/.env ] && echo "  ❌ Still missing: backend/.env"
                [ ! -f frontend/.env ] && echo "  ❌ Still missing: frontend/.env"
                exit 1
            fi
            
            echo ""
            echo "Continuing with build..."
            echo ""
            sleep 2
        else
            print_status "error" "Failed to create .env files"
            echo "Please run ./scripts/setup-env.sh manually"
            exit 1
        fi
    else
        print_status "error" "setup-env.sh not found!"
        echo "Please copy .env.example to .env and configure it manually:"
        echo "  cp .env.example .env"
        echo "  nano .env"
        exit 1
    fi
else
    # .env files exist, but we should sync them to ensure consistency
    print_status "info" "Environment files exist, syncing to ensure consistency..."
    
    if [ -f ./scripts/sync-env.sh ]; then
        chmod +x ./scripts/sync-env.sh
        if ./scripts/sync-env.sh >/dev/null 2>&1; then
            print_status "success" "Environment files synchronized"
        else
            print_status "warning" "Environment sync failed, continuing anyway..."
        fi
    else
        print_status "warning" "sync-env.sh not found, skipping synchronization"
    fi
fi

# Parse command line arguments
ENABLE_REMOTE_DESKTOP=true  # Remote Desktop ist jetzt Standard!
CLEAR_CACHE=false
BUILD_MACOS_APP=false
REFRESH_MODE=false

for arg in "$@"; do
    case $arg in
        --help|-h)
            show_help
            ;;
        --refresh)
            REFRESH_MODE=true
            ;;
        --no-remote-desktop)
            ENABLE_REMOTE_DESKTOP=false
            print_status "warning" "Remote Desktop support will be disabled"
            ;;
        --nocache)
            CLEAR_CACHE=true
            print_status "info" "Cache will be cleared"
            ;;
        --macos-app)
            BUILD_MACOS_APP=true
            print_status "info" "Will also build macOS app containers"
            ;;
        *)
            print_status "warning" "Unknown argument: $arg"
            echo "Use --help to see available options"
            exit 1
            ;;
    esac
done

# If refresh mode, perform quick refresh and exit
if [ "$REFRESH_MODE" = true ]; then
    quick_refresh
fi

# Show build configuration
echo "📍 Architecture: $(uname -m)"
echo "📍 Platform: $(uname -s)"
echo ""

if [ "$ENABLE_REMOTE_DESKTOP" = true ]; then
    print_status "info" "Remote Desktop support will be enabled (default)"
fi

# Clean up any existing containers
print_status "info" "Cleaning up existing containers..."
docker compose down --remove-orphans 2>/dev/null || true

# # Check for existing database volume
DB_VOLUME="web-appliance-dashboard_db_data"
if docker volume ls | grep -q "$DB_VOLUME"; then
    print_status "warning" "Existing database volume found: $DB_VOLUME"
    echo ""
    echo "This volume might contain data from a previous installation with different credentials."
    echo "If you're experiencing database connection issues, you may need to remove it."
    echo ""
    echo "Options:"
    echo "1) Keep existing volume (data will be preserved)"
    echo "2) Remove volume and start fresh (ALL DATA WILL BE LOST)"
    echo ""
    read -p "Your choice [1-2] (default: 1): " -n 1 -r VOLUME_CHOICE
    echo ""
    
    if [[ "$VOLUME_CHOICE" == "2" ]]; then
        print_status "warning" "Removing existing database volume..."
        docker volume rm "$DB_VOLUME" 2>/dev/null || {
            print_status "error" "Failed to remove volume. Make sure no containers are using it."
            echo "Try running: docker compose down -v"
            exit 1
        }
        print_status "success" "Database volume removed. Fresh database will be created."
    else
        print_status "info" "Keeping existing database volume."
        echo "If you experience connection issues, run: docker compose down -v"
    fi
fi

# Clear cache if requested
if [ "$CLEAR_CACHE" = true ]; then
    print_status "info" "Clearing Docker build cache..."
    docker builder prune -af
    print_status "success" "Docker build cache cleared"
    
    print_status "info" "Clearing npm cache..."
    npm cache clean --force 2>/dev/null || true
    print_status "success" "npm cache cleared"
    
    # Clear node_modules if they exist
    if [ -d "frontend/node_modules" ]; then
        print_status "info" "Removing frontend node_modules..."
        rm -rf frontend/node_modules
        print_status "success" "frontend node_modules removed"
    fi
    
    if [ -d "backend/node_modules" ]; then
        print_status "info" "Removing backend node_modules..."
        rm -rf backend/node_modules
        print_status "success" "backend node_modules removed"
    fi
    
    # Clear frontend build directory
    if [ -d "frontend/build" ]; then
        print_status "info" "Removing frontend build directory..."
        rm -rf frontend/build
        print_status "success" "frontend build directory removed"
    fi
fi

# Copy SSH restoration script to backend directory for Docker build
echo "📋 Preparing SSH key restoration script..."
if [ -f "scripts/restore-ssh-keys.sh" ]; then
    cp scripts/restore-ssh-keys.sh backend/
    print_status "success" "SSH restoration script copied"
else
    print_status "warning" "No restore script found, skipping..."
fi

# Setup Node.js environment
print_status "info" "Setting up Node.js environment..."
unset npm_config_prefix
if [ -f ~/.nvm/nvm.sh ]; then
    source ~/.nvm/nvm.sh
    
    # Check if Node.js 20 is installed
    if ! nvm list | grep -q "v20"; then
        print_status "warning" "Node.js 20 not found, installing..."
        nvm install 20
        print_status "success" "Node.js 20 installed"
    fi
    
    # Use Node.js 20
    nvm use 20
    print_status "success" "Using Node.js $(node --version)"
else
    print_status "warning" "NVM not found, using system Node.js"
    print_status "info" "Current Node.js version: $(node --version)"
fi

# Skip root npm install to avoid workspace issues
print_status "info" "Skipping root npm install (will install in subdirectories)..."

# Clean npm cache
print_status "info" "Cleaning npm cache..."
npm cache clean --force 2>/dev/null || true

# Build backend dependencies
print_status "info" "Building backend..."
cd backend
# Clear any existing lock files
rm -f package-lock.json
# Disable workspaces for this install
export npm_config_workspaces=false
export npm_config_workspace_root=false
if npm install --legacy-peer-deps --no-package-lock; then
    print_status "success" "Backend dependencies installed"
else
    print_status "error" "Backend npm install failed"
    exit 1
fi
unset npm_config_workspaces
unset npm_config_workspace_root
cd ..

# Build frontend
print_status "info" "Building frontend..."
cd frontend
# Clear any existing lock files
rm -f package-lock.json
# Disable workspaces for this install
export npm_config_workspaces=false
export npm_config_workspace_root=false
if npm install --legacy-peer-deps --no-package-lock; then
    print_status "success" "Frontend dependencies installed"
else
    print_status "error" "Frontend npm install failed"
    exit 1
fi
unset npm_config_workspaces
unset npm_config_workspace_root

# Skip macOS app and terminal app installations
print_status "info" "Skipping macOS app and terminal app installations..."

# Try to build frontend
if npm run build; then
    print_status "success" "Frontend build successful"
else
    print_status "warning" "Frontend build failed, creating fallback build directory..."
    # Create a minimal build directory
    mkdir -p build
    cp -r public/* build/ 2>/dev/null || true
    
    # Create a simple index.html if it doesn't exist
    if [ ! -f build/index.html ]; then
        echo "Creating fallback index.html..."
        cat > build/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Web Appliance Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; }
        .error { color: #d32f2f; }
        .warning { color: #f57c00; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Web Appliance Dashboard</h1>
        <p class="error">Frontend build failed. Please check the logs and rebuild.</p>
        <p>You can access the development server at <a href="http://localhost:3000">http://localhost:3000</a></p>
        <p>Run: <code>cd frontend && npm start</code></p>
        <hr>
        <p class="warning">Backend API is available at: <a href="http://localhost:3001/api/health">http://localhost:3001</a></p>
    </div>
</body>
</html>
EOF
    fi
fi
cd ..

# Build Docker images
print_status "info" "Building Docker images..."
if docker compose build --no-cache; then
    print_status "success" "Docker images built successfully"
else
    print_status "error" "Docker build failed"
    exit 1
fi

# Start services in correct order
print_status "info" "Starting services in dependency order..."

# 1. Start database first
print_status "info" "Starting database..."
docker compose up -d database

# Wait for database to be healthy
if ! wait_for_healthy "appliance_db"; then
    print_status "error" "Database failed to start properly"
    echo "📋 Database logs:"
    docker logs appliance_db --tail 50
    exit 1
fi

# Run database migrations
print_status "info" "Running database migrations..."
if [ -f "./scripts/migrate-db.sh" ]; then
    print_status "info" "Applying database migrations..."
    ./scripts/migrate-db.sh || {
        print_status "warning" "Migration script failed, but continuing..."
    }
fi
if [ -f "./scripts/migrate-remote-desktop.sh" ]; then
    print_status "info" "Applying Remote Desktop migration..."
    ./scripts/migrate-remote-desktop.sh || {
        print_status "warning" "Migration might have already been applied"
    }
fi

# 2. Start backend (depends on database)
print_status "info" "Starting backend..."
docker compose up -d backend

# Wait for backend to be healthy
if ! wait_for_healthy "appliance_backend"; then
    print_status "error" "Backend failed to start properly"
    echo "📋 Backend logs:"
    docker logs appliance_backend --tail 50
    exit 1
fi

# 3. Start ttyd terminal service
print_status "info" "Starting ttyd terminal service..."
docker compose up -d ttyd

# 4. Start webserver (nginx)
print_status "info" "Starting webserver..."
print_status "info" "Using nginx config: nginx-docker-with-optional-guacamole.conf"
docker compose up -d webserver

# 5. Start Guacamole if enabled
if [ "$ENABLE_REMOTE_DESKTOP" = true ]; then
    print_status "info" "Starting Guacamole services for Remote Desktop support..."
    
    # Start Guacamole services
    docker compose up -d guacamole-postgres guacd guacamole
    
    # Wait for Guacamole postgres to be ready
    print_status "info" "Waiting for Guacamole database..."
    sleep 10
    
    # Initialize Guacamole database
    print_status "info" "Initializing Guacamole database..."
    
    # Wait for Guacamole PostgreSQL to be healthy
    if ! wait_for_healthy "appliance_guacamole_db"; then
        print_status "warning" "Guacamole database container not healthy, but continuing..."
    fi
    
    # Check if database is already initialized
    db_initialized=$(docker compose exec -T -e PGPASSWORD=guacamole_pass123 guacamole-postgres psql -U guacamole_user -d guacamole_db -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'guacamole_user';" 2>/dev/null || echo "0")
    
    if [ "$db_initialized" = "0" ]; then
        print_status "info" "Guacamole database not initialized, initializing now..."
        
        # Initialize the database schema
        if docker compose exec -T -e PGPASSWORD=guacamole_pass123 guacamole sh -c 'cd /opt/guacamole/postgresql && cat schema/*.sql | psql -h guacamole-postgres -U guacamole_user -d guacamole_db' 2>/dev/null; then
            print_status "success" "Guacamole database schema initialized"
            
            # Set default admin password (guacadmin/guacadmin)
            docker compose exec -T -e PGPASSWORD=guacamole_pass123 guacamole-postgres psql -U guacamole_user -d guacamole_db -c "UPDATE guacamole_user SET password_hash = decode('CA458A7D494E3BE824F5E1E175A1556C0F8EEF2C2D7DF3633BEC4A29C4411960', 'hex'), password_salt = decode('FE24ADC5E11E2B25288D1704ABE67A79E342ECC26064CE69C5B3177795A82264', 'hex'), password_date = CURRENT_TIMESTAMP WHERE entity_id = (SELECT entity_id FROM guacamole_entity WHERE name = 'guacadmin' AND type = 'USER');" 2>/dev/null || {
                print_status "info" "Admin password already set or user doesn't exist yet"
            }
        else
            print_status "warning" "Failed to initialize Guacamole database schema, it might already be initialized"
        fi
    else
        print_status "info" "Guacamole database already initialized (found $db_initialized tables)"
    fi
    
    # Wait for Guacamole to be ready
    sleep 5
    
    # Verify Guacamole is accessible
    print_status "info" "Verifying Guacamole accessibility..."
    if curl -f -s -o /dev/null -w "%{http_code}" http://localhost:9080/guacamole/ | grep -q "200\|302"; then
        print_status "success" "Guacamole is accessible"
    else
        print_status "warning" "Guacamole might need more time to start"
    fi
    
    # Start RustDesk services
    print_status "info" "Starting RustDesk services..."
    docker compose up -d rustdesk-server rustdesk-relay
    
    # Wait for RustDesk to be ready (no health checks available)
    print_status "info" "Waiting for RustDesk services to start..."
    sleep 10
    
    # Check if RustDesk services are running
    if docker ps | grep -q rustdesk-server && docker ps | grep -q rustdesk-relay; then
        print_status "success" "RustDesk services are running"
    else
        print_status "warning" "RustDesk services might need more time to start"
    fi
fi

# Give services time to fully initialize
echo "⏳ Waiting for all services to initialize..."
sleep 5

# Check if all services are running
print_status "info" "Checking service status..."
docker compose ps

# Verify all services are up
all_services_up=true
for service in database backend ttyd webserver; do
    if check_service_running $service; then
        print_status "success" "$service is running"
    else
        print_status "error" "$service is not running"
        all_services_up=false
    fi
done

# Check Guacamole services if enabled
if [ "$ENABLE_REMOTE_DESKTOP" = true ]; then
    print_status "info" "Checking Guacamole services..."
    if docker ps | grep -q appliance_guacd && docker ps | grep -q appliance_guacamole; then
        print_status "success" "Guacamole services are running"
    else
        print_status "warning" "Some Guacamole services might not be running properly"
    fi
    
    print_status "info" "Checking RustDesk services..."
    if docker ps | grep -q rustdesk-server && docker ps | grep -q rustdesk-relay; then
        print_status "success" "RustDesk services are running"
    else
        print_status "warning" "Some RustDesk services might not be running properly"
    fi
fi

if [ "$all_services_up" = false ]; then
    print_status "error" "Some services failed to start"
    print_status "info" "Check logs with: docker compose logs"
    exit 1
fi

# Verify backend is accessible
print_status "info" "Verifying backend health..."
sleep 2
if curl -f -s http://localhost:3001/api/health >/dev/null 2>&1; then
    print_status "success" "Backend API is responding"
else
    print_status "warning" "Backend health check failed, but service is running"
fi

# Verify SSH tools in backend container
print_status "info" "Verifying SSH tools installation..."
SSH_CHECK=$(docker compose exec -T backend sh -c "which ssh && echo 'SSH_OK'" 2>/dev/null)
SSHCOPY_CHECK=$(docker compose exec -T backend sh -c "which ssh-copy-id && echo 'SSHCOPY_OK'" 2>/dev/null)
SSHPASS_CHECK=$(docker compose exec -T backend sh -c "which sshpass && echo 'SSHPASS_OK'" 2>/dev/null)

ssh_tools_ok=true
if [[ "$SSH_CHECK" == *"SSH_OK"* ]]; then
    print_status "success" "ssh available"
else
    print_status "error" "ssh missing"
    ssh_tools_ok=false
fi

if [[ "$SSHCOPY_CHECK" == *"SSHCOPY_OK"* ]]; then
    print_status "success" "ssh-copy-id available"
else
    print_status "error" "ssh-copy-id missing"
    ssh_tools_ok=false
fi

if [[ "$SSHPASS_CHECK" == *"SSHPASS_OK"* ]]; then
    print_status "success" "sshpass available"
else
    print_status "error" "sshpass missing"
    ssh_tools_ok=false
fi

# If SSH tools are missing, try to install them
if [ "$ssh_tools_ok" = false ]; then
    print_status "warning" "SSH tools missing, attempting to install..."
    
    if docker compose exec -T backend sh -c "apk add --no-cache openssh-client sshpass" 2>/dev/null; then
        print_status "success" "SSH tools installed successfully"
        
        # Verify installation
        if docker compose exec -T backend sh -c "which ssh && which ssh-copy-id && which sshpass" >/dev/null 2>&1; then
            print_status "success" "SSH tools verified"
        else
            print_status "warning" "SSH tools installed but verification failed"
        fi
    else
        print_status "error" "Failed to install SSH tools"
        echo "💡 Try running: docker compose exec backend sh"
        echo "   Then: apk add openssh-client sshpass"
    fi
fi

# Initialize SSH system
print_status "info" "Initializing SSH system..."
sleep 2

# Check if SSH keys exist
ssh_keys_count=$(docker compose exec -T backend sh -c "ls -1 /root/.ssh/id_rsa_* 2>/dev/null | wc -l" 2>/dev/null || echo "0")
if [ "$ssh_keys_count" -gt "0" ]; then
    print_status "success" "Found $ssh_keys_count SSH keys"
else
    print_status "warning" "No SSH keys found in container"
fi

# Verify WebSocket terminal endpoint
print_status "info" "Verifying WebSocket terminal endpoint..."
if curl -f -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/terminal-session | grep -q "426"; then
    print_status "success" "WebSocket terminal endpoint is available"
else
    print_status "warning" "WebSocket terminal endpoint check inconclusive"
fi

# Build macOS App containers if requested
if [ "$BUILD_MACOS_APP" = true ]; then
    print_status "info" "Building macOS App containers..."
    echo ""
    echo "=======================================================================" 
    echo "🍎 Building macOS App Containers"
    echo "======================================================================="
    
    # Change to Mac-Standalone directory
    cd Mac-Standalone
    
    # Use the app-specific compose file
    print_status "info" "Using docker-compose.app.yml for macOS app..."
    
    # Stop any existing app containers
    docker compose -f docker-compose.app.yml -p web-appliance-app down --remove-orphans 2>/dev/null || true
    
    # Build app containers
    if docker compose -f docker-compose.app.yml -p web-appliance-app build --no-cache; then
        print_status "success" "macOS app containers built successfully"
    else
        print_status "error" "macOS app container build failed"
        cd ..
        exit 1
    fi
    
    # Start app containers
    print_status "info" "Starting macOS app containers..."
    docker compose -f docker-compose.app.yml -p web-appliance-app up -d
    
    # Wait for services
    sleep 10
    
    # Check app container status
    print_status "info" "Checking macOS app container status..."
    docker compose -f docker-compose.app.yml -p web-appliance-app ps
    
    echo ""
    print_status "success" "macOS App containers are running!"
    echo "   📌 App Dashboard: http://localhost:9081"
    echo "   📌 App Backend: http://localhost:3002"
    echo "   📌 App Terminal: http://localhost:7682"
    if [ "$ENABLE_REMOTE_DESKTOP" = true ]; then
        echo "   🖥️  App Guacamole: http://localhost:9782/guacamole"
    fi
    echo ""
    
    cd ..
fi

echo ""
echo "======================================================================="
print_status "success" "Build complete! All containers are running."
echo "======================================================================="
echo ""
print_status "info" "Access points:"
echo "   📌 Dashboard: http://localhost:9080"
echo "   📌 Backend API: http://localhost:9080/api"
echo "   📌 Terminal: http://localhost:9080/terminal/"
if [ "$ENABLE_REMOTE_DESKTOP" = true ]; then
    echo "   🖥️  Guacamole: http://localhost:9080/guacamole/"
    echo "      (Default: guacadmin/guacadmin)"
    echo "   🖥️  RustDesk API: http://localhost:21119"
    echo "   🖥️  RustDesk Web: http://localhost:21118 (if enabled)"
fi
echo ""
print_status "info" "Container Configuration:"
echo "   🐳 Nginx Config: nginx/nginx-docker-with-optional-guacamole.conf"
echo "   🐳 Container: appliance_webserver"
echo "   🐳 Port: 9080 (HTTP), 9443 (HTTPS)"
echo ""
print_status "info" "Useful commands:"
echo "   📋 View logs: docker compose logs -f [service]"
echo "   🔄 Restart all: docker compose restart"
echo "   ⚡ Quick refresh: ./scripts/build.sh --refresh"
echo "   🛑 Stop all: docker compose down"
echo "   🔍 Check status: docker compose ps"
echo "   💻 Backend shell: docker compose exec backend sh"
if [ "$ENABLE_REMOTE_DESKTOP" = true ]; then
    echo "   🖥️  Guacamole logs: docker compose logs -f guacamole"
    echo "   🖥️  RustDesk logs: docker compose logs -f rustdesk-server rustdesk-relay"
fi
echo ""
print_status "info" "Features:"
echo "   ⚡ SSH Terminal: Click terminal button on service cards"
if [ "$ENABLE_REMOTE_DESKTOP" = true ]; then
    echo "   🖥️  Remote Desktop: Configure VNC/RDP in service settings"
    echo "   🖥️  RustDesk: Alternative remote desktop option (faster)"
fi
echo ""

# Create default admin user
print_status "info" "Creating default admin user..."
if [ -f "$SCRIPT_DIR/create-admin-user.sh" ]; then
    "$SCRIPT_DIR/create-admin-user.sh"
else
    print_status "warning" "Admin user creation script not found"
fi

# Final health check summary
if [ "$all_services_up" = true ] && [ "$ssh_tools_ok" = true ]; then
    print_status "success" "System is ready for use!"
    if [ "$ENABLE_REMOTE_DESKTOP" = true ]; then
        echo ""
        print_status "info" "Remote Desktop Setup:"
        echo "   1. Configure Remote Desktop in service settings"
        echo "   2. Choose between Guacamole (classic) or RustDesk (modern)"
        echo "   3. Enable VNC or RDP protocol (Guacamole) or install RustDesk client"
        echo "   4. Use the desktop buttons to connect"
    fi
else
    print_status "warning" "System is running with some issues - check warnings above"
fi

echo ""
print_status "info" "Build options:"
echo "   ./scripts/build.sh --help              # Show help message"
echo "   ./scripts/build.sh --refresh           # Quick restart for development"
echo "   ./scripts/build.sh --no-remote-desktop # Disable Remote Desktop support"
echo "   ./scripts/build.sh --nocache           # Clear all caches before building"
echo "   ./scripts/build.sh --macos-app         # Also build macOS app containers"
echo ""
