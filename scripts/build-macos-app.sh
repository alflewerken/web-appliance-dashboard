#!/bin/bash

# Build script for macOS App - Containers and Electron App
# This script builds Docker containers AND the Electron app with Guacamole on port 9782

echo "🍎 Building macOS App (Containers + Electron App)..."
echo "======================================================================="
echo "📍 This will build the standalone macOS app containers"
echo "📍 AND create the Electron app DMG file"
echo "📍 Guacamole will be available on port 9782"
echo "======================================================================="

# Check if --standalone parameter is passed
if [[ "$*" == *"--standalone"* ]]; then
    echo ""
    echo "🚀 STANDALONE MODE DETECTED!"
    echo "   Redirecting to enhanced standalone build script..."
    echo ""
    # Call the standalone build script with all parameters
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    exec "$SCRIPT_DIR/build-macos-app-standalone.sh" "$@"
fi

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
        "info") echo -e "${BLUE}📌 $2${NC}" ;;
    esac
}

# Parse command line arguments
BUILD_DMG=true
SKIP_CONTAINERS=false
CLEAN_BUILD=false

for arg in "$@"; do
    case $arg in
        --no-dmg)
            BUILD_DMG=false
            print_status "info" "Will skip DMG creation"
            ;;
        --skip-containers)
            SKIP_CONTAINERS=true
            print_status "info" "Will skip Docker container build"
            ;;
        --clean)
            CLEAN_BUILD=true
            print_status "info" "Will perform clean build"
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --no-dmg          Skip DMG file creation"
            echo "  --skip-containers Skip Docker container build"
            echo "  --clean           Clean build (remove node_modules and dist)"
            echo "  --help            Show this help message"
            exit 0
            ;;
        *)
            print_status "warning" "Unknown argument: $arg"
            ;;
    esac
done

# Change to project root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.." || exit 1

# Ensure we have the macos-app directory
if [ ! -d "macos-app" ]; then
    print_status "error" "macos-app directory not found!"
    exit 1
fi

# Build main project first to ensure frontend is built
print_status "info" "Building main project frontend..."
cd frontend
if [ ! -d "build" ] || [ "$CLEAN_BUILD" = true ]; then
    print_status "info" "Installing frontend dependencies..."
    npm install --legacy-peer-deps || {
        print_status "error" "Failed to install frontend dependencies"
        exit 1
    }
    
    print_status "info" "Building frontend..."
    npm run build || {
        print_status "warning" "Frontend build failed, but continuing..."
    }
fi
cd ..

# Now work on macOS app
cd macos-app

# Clean build if requested
if [ "$CLEAN_BUILD" = true ]; then
    print_status "info" "Performing clean build..."
    rm -rf node_modules dist
    print_status "success" "Cleaned node_modules and dist directories"
fi

# Build Docker containers unless skipped
if [ "$SKIP_CONTAINERS" = false ]; then
    echo ""
    echo "======================================================================="
    echo "🐳 Building Docker Containers"
    echo "======================================================================="
    
    # Stop any existing app containers
    print_status "info" "Stopping existing macOS app containers..."
    docker compose -f docker-compose.app.yml -p web-appliance-app down --remove-orphans 2>/dev/null || true

    # Build the containers
    print_status "info" "Building macOS app containers..."
    if docker compose -f docker-compose.app.yml -p web-appliance-app build; then
        print_status "success" "Container images built successfully"
    else
        print_status "error" "Failed to build container images"
        exit 1
    fi

    # Start the containers
    print_status "info" "Starting macOS app containers..."
    if docker compose -f docker-compose.app.yml -p web-appliance-app up -d; then
        print_status "success" "Containers started successfully"
    else
        print_status "error" "Failed to start containers"
        exit 1
    fi

    # Wait for services to be ready
    print_status "info" "Waiting for services to initialize..."
    sleep 15

    # Check container status
    print_status "info" "Checking container status..."
    docker compose -f docker-compose.app.yml -p web-appliance-app ps

    # Test if services are accessible
    echo ""
    print_status "info" "Testing service endpoints..."

    # Test backend
    if curl -f -s http://localhost:3002/api/health >/dev/null 2>&1; then
        print_status "success" "Backend API is responding at http://localhost:3002"
    else
        print_status "warning" "Backend API not yet responding"
    fi

    # Test frontend
    if curl -f -s http://localhost:9081 >/dev/null 2>&1; then
        print_status "success" "Frontend is accessible at http://localhost:9081"
    else
        print_status "warning" "Frontend not yet accessible"
    fi

    # Test Guacamole
    if curl -f -s http://localhost:9782/guacamole/ >/dev/null 2>&1; then
        print_status "success" "Guacamole is accessible at http://localhost:9782/guacamole"
    else
        print_status "warning" "Guacamole not yet accessible"
    fi
fi

# Build Electron App
echo ""
echo "======================================================================="
echo "📱 Building Electron App"
echo "======================================================================="

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_status "error" "npm is not installed. Please install Node.js and npm first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 16 ]; then
    print_status "warning" "Node.js 16 or higher is recommended. Current version: $(node -v 2>/dev/null || echo 'not found')"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ "$CLEAN_BUILD" = true ]; then
    print_status "info" "Installing Electron app dependencies..."
    if npm install; then
        print_status "success" "Dependencies installed successfully"
    else
        print_status "error" "Failed to install dependencies"
        exit 1
    fi
else
    print_status "info" "Dependencies already installed (use --clean to reinstall)"
fi

# Build the Electron app
if [ "$BUILD_DMG" = true ]; then
    print_status "info" "Building Electron app with DMG..."
    if npm run dist; then
        print_status "success" "Electron app built successfully!"
        
        # Show the created files
        echo ""
        print_status "info" "Created files:"
        if [ -f "dist/Web Appliance Dashboard-1.0.1-arm64.dmg" ]; then
            echo "   📦 DMG: $(pwd)/dist/Web Appliance Dashboard-1.0.1-arm64.dmg"
            echo "   📦 Size: $(du -h "dist/Web Appliance Dashboard-1.0.1-arm64.dmg" | cut -f1)"
        fi
        if [ -f "dist/Web Appliance Dashboard-1.0.1-arm64-mac.zip" ]; then
            echo "   📦 ZIP: $(pwd)/dist/Web Appliance Dashboard-1.0.1-arm64-mac.zip"
        fi
        if [ -d "dist/mac-arm64/Web Appliance Dashboard.app" ]; then
            echo "   📦 App: $(pwd)/dist/mac-arm64/Web Appliance Dashboard.app"
        fi
        
        # Offer to open the DMG
        echo ""
        read -p "🎯 Would you like to open the DMG file now? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            open "dist/Web Appliance Dashboard-1.0.1-arm64.dmg"
            print_status "success" "DMG opened!"
        fi
    else
        print_status "error" "Failed to build Electron app"
        exit 1
    fi
else
    print_status "info" "Building Electron app without DMG..."
    if npm run build; then
        print_status "success" "Electron app built successfully!"
    else
        print_status "error" "Failed to build Electron app"
        exit 1
    fi
fi

# Final summary
echo ""
echo "======================================================================="
print_status "success" "macOS App build complete!"
echo "======================================================================="
echo ""

if [ "$SKIP_CONTAINERS" = false ]; then
    print_status "info" "Docker Container Access Points:"
    echo "   📌 Dashboard: http://localhost:9081"
    echo "   📌 Backend API: http://localhost:3002"
    echo "   📌 Terminal: http://localhost:7682"
    echo "   🖥️  Guacamole: http://localhost:9782/guacamole/"
    echo "      (Default: guacadmin/guacadmin)"
    echo ""
fi

print_status "info" "Electron App:"
if [ "$BUILD_DMG" = true ] && [ -f "dist/Web Appliance Dashboard-1.0.1-arm64.dmg" ]; then
    echo "   💿 DMG Location: $(pwd)/dist/Web Appliance Dashboard-1.0.1-arm64.dmg"
    echo "   📦 To install: Double-click the DMG and drag to Applications"
else
    echo "   📦 App Location: $(pwd)/dist/mac-arm64/Web Appliance Dashboard.app"
fi

echo ""
print_status "info" "Next steps:"
echo "   1. Install the app from the DMG file"
echo "   2. Launch 'Web Appliance Dashboard' from Applications"
echo "   3. The app will manage Docker containers automatically"
echo ""
print_status "info" "Development commands:"
echo "   📱 Start in dev mode: cd macos-app && npm start"
echo "   🔄 Rebuild only app: cd macos-app && npm run dist"
echo "   🐳 Container logs: cd macos-app && docker compose -f docker-compose.app.yml logs -f"
echo ""
