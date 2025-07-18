#!/bin/bash

# Enhanced Build script for macOS App with Standalone Support
# This script builds Docker containers AND the Electron app with embedded Docker images

echo "🍎 Building macOS App with Standalone Support..."
echo "======================================================================="
echo "📍 This will build the standalone macOS app with embedded Docker images"
echo "📍 The app will be fully functional without internet access"
echo "📍 Guacamole will be available on port 9782"
echo "======================================================================="

# Color codes for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    case $1 in
        "success") echo -e "${GREEN}✅ $2${NC}" ;;
        "error") echo -e "${RED}❌ $2${NC}" ;;
        "warning") echo -e "${YELLOW}⚠️  $2${NC}" ;;
        "info") echo -e "${BLUE}📌 $2${NC}" ;;
        "progress") echo -e "${PURPLE}⏳ $2${NC}" ;;
    esac
}

# Parse command line arguments
BUILD_DMG=true
SKIP_CONTAINERS=false
CLEAN_BUILD=false
STANDALONE_MODE=false
COMPRESS_IMAGES=true

for arg in "$@"; do
    case $arg in
        --standalone)
            STANDALONE_MODE=true
            print_status "info" "Building in STANDALONE mode - will embed Docker images"
            ;;
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
        --no-compress)
            COMPRESS_IMAGES=false
            print_status "info" "Will not compress Docker images"
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --standalone      Build with embedded Docker images for offline installation"
            echo "  --no-dmg          Skip DMG file creation"
            echo "  --skip-containers Skip Docker container build"
            echo "  --clean           Clean build (remove node_modules and dist)"
            echo "  --no-compress     Don't compress Docker images (faster but larger)"
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
    rm -rf node_modules dist docker-images
    print_status "success" "Cleaned node_modules, dist and docker-images directories"
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

    # If standalone mode, export Docker images
    if [ "$STANDALONE_MODE" = true ]; then
        echo ""
        echo "======================================================================="
        echo "📦 Exporting Docker Images for Standalone Mode"
        echo "======================================================================="
        
        # Create docker-images directory
        mkdir -p docker-images
        
        # List of images to export
        IMAGES=(
            "mariadb:latest"
            "nginx:alpine"
            "guacamole/guacd:1.5.5"
            "guacamole/guacamole:1.5.5"
            "postgres:15-alpine"
            "web-appliance-app-backend"
            "web-appliance-app-ttyd"
        )
        
        # Export each image
        for image in "${IMAGES[@]}"; do
            print_status "progress" "Exporting $image..."
            image_file="docker-images/$(echo $image | tr '/:' '_').tar"
            
            if docker save "$image" -o "$image_file"; then
                if [ "$COMPRESS_IMAGES" = true ]; then
                    print_status "progress" "Compressing $image..."
                    gzip -f "$image_file"
                    image_file="${image_file}.gz"
                fi
                size=$(du -h "$image_file" | cut -f1)
                print_status "success" "Exported $image ($size)"
            else
                print_status "error" "Failed to export $image"
                exit 1
            fi
        done
        
        # Create image manifest
        print_status "info" "Creating image manifest..."
        if [ "$COMPRESS_IMAGES" = true ]; then
            COMPRESSED_VALUE="true"
            FILE_EXT=".tar.gz"
        else
            COMPRESSED_VALUE="false"
            FILE_EXT=".tar"
        fi
        
        cat > docker-images/manifest.json << EOF
{
  "version": "1.0",
  "images": [
    {"name": "mariadb:latest", "file": "mariadb_latest${FILE_EXT}"},
    {"name": "nginx:alpine", "file": "nginx_alpine${FILE_EXT}"},
    {"name": "guacamole/guacd:1.5.5", "file": "guacamole_guacd_1.5.5${FILE_EXT}"},
    {"name": "guacamole/guacamole:1.5.5", "file": "guacamole_guacamole_1.5.5${FILE_EXT}"},
    {"name": "postgres:15-alpine", "file": "postgres_15-alpine${FILE_EXT}"},
    {"name": "web-appliance-app-backend", "file": "web-appliance-app-backend${FILE_EXT}"},
    {"name": "web-appliance-app-ttyd", "file": "web-appliance-app-ttyd${FILE_EXT}"}
  ],
  "compressed": ${COMPRESSED_VALUE}
}
EOF
        
        # Copy necessary files for offline installation
        print_status "info" "Copying installation files..."
        cp docker-compose.app.yml docker-images/
        cp ../init.sql docker-images/
        cp -r ../guacamole docker-images/
        cp -r ../nginx docker-images/
        cp -r ../scripts docker-images/
        cp -r ../backend docker-images/
        cp -r ../ttyd docker-images/
        
        # Create offline installation script
        print_status "info" "Creating offline installation script..."
        cat > docker-images/install-offline.sh << 'EOF'
#!/bin/bash

echo "🚀 Installing Web Appliance Dashboard from embedded images..."

# Load Docker images
echo "📦 Loading Docker images..."
for image_file in *.tar*; do
    if [[ -f "$image_file" ]]; then
        echo "Loading $image_file..."
        if [[ "$image_file" == *.gz ]]; then
            gunzip -c "$image_file" | docker load
        else
            docker load -i "$image_file"
        fi
    fi
done

echo "✅ Docker images loaded successfully!"

# Initialize database
echo "🗄️ Initializing databases..."
docker compose -f docker-compose.app.yml -p web-appliance-app up -d database guacamole-postgres
sleep 10

# Start all services
echo "🚀 Starting all services..."
docker compose -f docker-compose.app.yml -p web-appliance-app up -d

echo "✅ Installation complete!"
EOF
        chmod +x docker-images/install-offline.sh
        
        # Calculate total size
        total_size=$(du -sh docker-images | cut -f1)
        print_status "success" "Docker images exported successfully (Total: $total_size)"
    fi
fi

# Build Electron App
echo ""
echo "======================================================================="
echo "📱 Building Electron App"
echo "======================================================================="

# Update package.json for standalone mode
if [ "$STANDALONE_MODE" = true ]; then
    print_status "info" "Updating package.json for standalone mode..."
    
    # Backup original package.json
    cp package.json package.json.backup
    
    # Update extraResources in package.json
    node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Add docker-images to extraResources
    if (!pkg.build.extraResources.find(r => r.from === './docker-images')) {
        pkg.build.extraResources.push({
            from: './docker-images',
            to: 'docker-images'
        });
    }
    
    // Add installation scripts
    if (!pkg.build.files.includes('scripts/**/*')) {
        pkg.build.files.push('scripts/**/*');
    }
    
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    "
fi

# Create standalone startup script
if [ "$STANDALONE_MODE" = true ]; then
    print_status "info" "Creating standalone startup script..."
    mkdir -p src/standalone
    cat > src/standalone/installer.js << 'EOF'
const { app, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

class StandaloneInstaller {
    constructor() {
        this.resourcesPath = process.resourcesPath;
        this.dockerImagesPath = path.join(this.resourcesPath, 'docker-images');
        this.installedFlagPath = path.join(app.getPath('userData'), '.standalone-installed');
    }

    async checkAndInstall() {
        // Check if already installed
        if (fs.existsSync(this.installedFlagPath)) {
            console.log('Standalone images already installed');
            return true;
        }

        // Check if docker-images directory exists
        if (!fs.existsSync(this.dockerImagesPath)) {
            console.log('Not a standalone build, skipping image installation');
            return true;
        }

        // Show installation dialog
        const result = await dialog.showMessageBox({
            type: 'info',
            title: 'First Time Setup',
            message: 'This appears to be the first time running Web Appliance Dashboard.\n\nThe app needs to install Docker images for offline operation. This may take a few minutes.',
            buttons: ['Install Now', 'Cancel'],
            defaultId: 0
        });

        if (result.response !== 0) {
            return false;
        }

        // Install images
        return await this.installImages();
    }

    async installImages() {
        return new Promise((resolve, reject) => {
            const installer = spawn('bash', ['install-offline.sh'], {
                cwd: this.dockerImagesPath,
                env: process.env
            });

            installer.stdout.on('data', (data) => {
                console.log(`Installer: ${data}`);
            });

            installer.stderr.on('data', (data) => {
                console.error(`Installer error: ${data}`);
            });

            installer.on('close', (code) => {
                if (code === 0) {
                    // Mark as installed
                    fs.writeFileSync(this.installedFlagPath, new Date().toISOString());
                    dialog.showMessageBox({
                        type: 'info',
                        title: 'Installation Complete',
                        message: 'Docker images have been installed successfully!\n\nThe app will now start normally.',
                        buttons: ['OK']
                    });
                    resolve(true);
                } else {
                    dialog.showErrorBox('Installation Failed', 
                        'Failed to install Docker images. Please check Docker is running and try again.');
                    reject(new Error(`Installation failed with code ${code}`));
                }
            });
        });
    }
}

module.exports = StandaloneInstaller;
EOF
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
        
        # Restore original package.json if in standalone mode
        if [ "$STANDALONE_MODE" = true ] && [ -f "package.json.backup" ]; then
            mv package.json.backup package.json
        fi
    else
        print_status "error" "Failed to build Electron app"
        # Restore original package.json if in standalone mode
        if [ "$STANDALONE_MODE" = true ] && [ -f "package.json.backup" ]; then
            mv package.json.backup package.json
        fi
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

if [ "$STANDALONE_MODE" = true ]; then
    print_status "info" "📦 STANDALONE BUILD INFORMATION:"
    echo "   • Docker images embedded: Yes"
    echo "   • Total app size: $(du -sh dist/*.dmg 2>/dev/null | cut -f1 || echo 'N/A')"
    echo "   • Offline installation: Supported"
    echo "   • Internet required: No"
    echo ""
fi

print_status "info" "Installation:"
if [ "$BUILD_DMG" = true ] && [ -f "dist/Web Appliance Dashboard-1.0.1-arm64.dmg" ]; then
    echo "   💿 DMG Location: $(pwd)/dist/Web Appliance Dashboard-1.0.1-arm64.dmg"
    echo "   📦 To install: Double-click the DMG and drag to Applications"
fi

if [ "$STANDALONE_MODE" = true ]; then
    echo ""
    print_status "info" "Standalone features:"
    echo "   ✅ All Docker images embedded in app"
    echo "   ✅ Automatic installation on first launch"
    echo "   ✅ No internet connection required"
    echo "   ✅ Database auto-initialization"
fi

echo ""
print_status "info" "Next steps:"
echo "   1. Install the app from the DMG file"
echo "   2. Launch 'Web Appliance Dashboard' from Applications"
if [ "$STANDALONE_MODE" = true ]; then
    echo "   3. The app will install Docker images on first launch"
    echo "   4. All services will start automatically"
else
    echo "   3. The app will download Docker images on first launch"
fi
echo ""