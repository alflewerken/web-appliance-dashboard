#!/bin/bash

echo "🧽 Deep Cleaning Web Appliance Dashboard..."
echo "======================================================================="
echo "⚠️  This will remove ALL build artifacts and generated files!"
echo "⚠️  Only source code will remain."
echo "======================================================================="

# Color codes for output
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
CLEAN_DOCKER=true
CLEAN_VOLUMES=false
CLEAN_APP_DATA=false
FORCE_CLEAN=false

for arg in "$@"; do
    case $arg in
        --keep-docker)
            CLEAN_DOCKER=false
            print_status "info" "Will keep Docker containers and images"
            ;;
        --volumes)
            CLEAN_VOLUMES=true
            print_status "warning" "Will also remove Docker volumes (DATA LOSS WARNING)"
            ;;
        --all)
            CLEAN_VOLUMES=true
            CLEAN_APP_DATA=true
            print_status "warning" "Will remove EVERYTHING including macOS app data"
            print_status "info" "NOTE: my-data directory will be preserved"
            ;;
        --force)
            FORCE_CLEAN=true
            print_status "warning" "Force mode - no confirmation prompts"
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --keep-docker  Keep Docker containers and images"
            echo "  --volumes      Also remove Docker volumes (WARNING: Data loss!)"
            echo "  --all          Remove everything including macOS app data and .env files (COMPLETE RESET!)"
            echo "  --force        Skip confirmation prompts"
            echo "  --help         Show this help message"
            echo ""
            echo "NOTE: The my-data directory is always preserved and will never be deleted."
            exit 0
            ;;
        *)
            print_status "warning" "Unknown argument: $arg"
            ;;
    esac
done

# Confirmation prompt
if [ "$FORCE_CLEAN" != true ]; then
    echo ""
    read -p "⚠️  Are you sure you want to clean all build artifacts? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "info" "Cleaning cancelled"
        exit 0
    fi
    
    # Extra warning for my-data directory
    if [ -d "my-data" ] && [ "$CLEAN_APP_DATA" = true ]; then
        echo ""
        print_status "warning" "Found my-data directory. It will be preserved during cleanup."
        read -p "Continue? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "info" "Cleaning cancelled to protect my-data"
            exit 0
        fi
    fi
fi

# Change to project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.." || exit 1

echo ""
echo "🚀 Starting deep clean..."
echo ""

# 1. Docker cleanup (if requested)
if [ "$CLEAN_DOCKER" = true ]; then
    print_status "info" "Stopping and removing Docker containers..."
    
    # Main project containers
    docker compose down 2>/dev/null || true
    
    # macOS app containers
    if [ -f "Mac-Standalone/docker-compose.app.yml" ]; then
        cd Mac-Standalone
        docker compose -f docker-compose.app.yml -p web-appliance-app down 2>/dev/null || true
        cd ..
    fi
    
    if [ "$CLEAN_VOLUMES" = true ]; then
        print_status "warning" "Removing Docker volumes..."
        # Haupt-Projekt Volumes
        docker volume rm web-appliance-dashboard_db_data 2>/dev/null || true
        docker volume rm web-appliance-dashboard_ssh_keys 2>/dev/null || true
        docker volume rm web-appliance-dashboard_uploads 2>/dev/null || true
        docker volume rm web-appliance-dashboard_guacamole_db 2>/dev/null || true
        docker volume rm web-appliance-dashboard_guacamole_drive 2>/dev/null || true
        docker volume rm web-appliance-dashboard_guacamole_record 2>/dev/null || true
        docker volume rm web-appliance-dashboard_guacamole_home 2>/dev/null || true
        
        # Legacy Volume Namen (falls vorhanden)
        docker volume rm wad_db_data 2>/dev/null || true
        docker volume rm wad_ssh_keys 2>/dev/null || true
        docker volume rm wad_uploads 2>/dev/null || true
        docker volume rm wad_guacamole_db 2>/dev/null || true
        docker volume rm wad_guacamole_drive 2>/dev/null || true
        docker volume rm wad_guacamole_record 2>/dev/null || true
        docker volume rm wad_guacamole_home 2>/dev/null || true
        
        # macOS App Volumes
        docker volume rm wad_app_db_data 2>/dev/null || true
        docker volume rm wad_app_ssh_keys 2>/dev/null || true
        docker volume rm wad_app_uploads 2>/dev/null || true
        docker volume rm wad_app_guacamole_db 2>/dev/null || true
        docker volume rm wad_app_guacamole_drive 2>/dev/null || true
        docker volume rm wad_app_guacamole_record 2>/dev/null || true
        docker volume rm wad_app_guacamole_home 2>/dev/null || true
    fi
    
    print_status "success" "Docker cleanup complete"
fi

# 2. Backend cleanup
print_status "info" "Cleaning backend..."
rm -rf backend/node_modules
rm -f backend/package-lock.json
rm -rf backend/uploads/*
rm -rf backend/dist
rm -rf backend/build
rm -rf backend/.cache
rm -f backend/*.log
print_status "success" "Backend cleaned"

# 3. Frontend cleanup
print_status "info" "Cleaning frontend..."
rm -rf frontend/node_modules
rm -f frontend/package-lock.json
rm -rf frontend/build
rm -rf frontend/dist
rm -rf frontend/.cache
rm -rf frontend/coverage
rm -f frontend/*.log
rm -rf frontend/.eslintcache
print_status "success" "Frontend cleaned"

# 4. macOS App cleanup
if [ -d "Mac-Standalone" ]; then
    print_status "info" "Cleaning macOS app..."
    rm -rf Mac-Standalone/node_modules
    rm -f Mac-Standalone/package-lock.json
    rm -rf Mac-Standalone/dist
    rm -rf Mac-Standalone/build
    rm -rf Mac-Standalone/docker-images
    rm -f Mac-Standalone/*.log
    rm -f Mac-Standalone/package.json.backup
    print_status "success" "macOS app cleaned"
fi

# 5. Terminal app cleanup
if [ -d "terminal-app" ]; then
    print_status "info" "Cleaning terminal app..."
    rm -rf terminal-app/node_modules
    rm -f terminal-app/package-lock.json
    rm -rf terminal-app/dist
    rm -rf terminal-app/build
    rm -f terminal-app/*.log
    print_status "success" "Terminal app cleaned"
fi

# 6. General project cleanup
print_status "info" "Cleaning general project files..."
rm -f .env
rm -rf .cache
rm -rf .npm
rm -f *.log
rm -f npm-debug.log*
rm -f yarn-debug.log*
rm -f yarn-error.log*
rm -f .DS_Store
# Remove .DS_Store files but preserve my-data directory
find . -path ./my-data -prune -o -name ".DS_Store" -type f -print -delete 2>/dev/null || true
rm -rf coverage
rm -rf .nyc_output

# Protect my-data directory
print_status "info" "Preserving my-data directory..."

# Clean environment files if --all is specified
if [ "$CLEAN_APP_DATA" = true ]; then
    print_status "info" "Removing all .env files (--all specified)..."
    rm -f frontend/.env
    rm -f backend/.env
    print_status "success" "All .env files removed"
fi

# 7. Git cleanup (optional - be careful!)
print_status "info" "Cleaning Git ignored files (preserving my-data)..."

# Statt git clean -fdX zu verwenden (was my-data löschen könnte),
# machen wir es manuell für mehr Kontrolle
print_status "info" "Performing selective cleanup instead of git clean..."

# Clean common git-ignored files and directories manually
# Dies gibt uns volle Kontrolle und schützt my-data
rm -rf .env.local .env.development.local .env.test.local .env.production.local 2>/dev/null || true
rm -rf docker-compose.override.yml 2>/dev/null || true
rm -rf .docker 2>/dev/null || true
rm -rf logs 2>/dev/null || true
rm -rf coverage 2>/dev/null || true
rm -rf .nyc_output 2>/dev/null || true
rm -rf .cache 2>/dev/null || true
rm -rf .npm 2>/dev/null || true
rm -rf .eslintcache 2>/dev/null || true
rm -rf .electron 2>/dev/null || true
# Don't delete init.sql - it's needed for database initialization
find . -maxdepth 1 -name "*.sql" ! -name "init.sql" -type f -delete 2>/dev/null || true
rm -f *.db 2>/dev/null || true
rm -f appliances.db 2>/dev/null || true

# Remove certificates (but not the directory structure)
find nginx/certs -type f -name "*.pem" -delete 2>/dev/null || true
find nginx/certs -type f -name "*.key" -delete 2>/dev/null || true
find nginx/certs -type f -name "*.crt" -delete 2>/dev/null || true

# Clean Python artifacts
find . -path ./my-data -prune -o -type d -name "env" -print -exec rm -rf {} + 2>/dev/null || true
find . -path ./my-data -prune -o -type d -name "venv" -print -exec rm -rf {} + 2>/dev/null || true

print_status "success" "Selective cleanup complete (my-data preserved)"

# Optional: Show what would have been cleaned by git
if command -v git &> /dev/null; then
    echo ""
    print_status "info" "Files that would be cleaned by 'git clean -fdX' (excluding my-data):"
    git clean -fdXn | grep -v "my-data" | head -10 || true
    if [ $(git clean -fdXn | grep -v "my-data" | wc -l) -gt 10 ]; then
        echo "... and more files"
    fi
fi

# 8. Python cleanup if any
find . -path ./my-data -prune -o -type d -name "__pycache__" -print -exec rm -rf {} + 2>/dev/null || true
find . -path ./my-data -prune -o -type f -name "*.pyc" -print -delete 2>/dev/null || true
find . -path ./my-data -prune -o -type f -name "*.pyo" -print -delete 2>/dev/null || true

# 9. IDE and editor files
print_status "info" "Cleaning IDE files..."
rm -rf .idea
rm -rf .vscode/settings.json
rm -rf .vscode/launch.json
rm -rf *.iml
rm -f .project
rm -f .classpath

# 10. Temporary and backup files
print_status "info" "Cleaning temporary files..."
find . -path ./my-data -prune -o -type f -name "*~" -print -delete 2>/dev/null || true
find . -path ./my-data -prune -o -type f -name "*.bak" -print -delete 2>/dev/null || true
find . -path ./my-data -prune -o -type f -name "*.tmp" -print -delete 2>/dev/null || true
find . -path ./my-data -prune -o -type f -name "*.swp" -print -delete 2>/dev/null || true
find . -path ./my-data -prune -o -type f -name "*.swo" -print -delete 2>/dev/null || true

# 10. macOS Application Support cleanup
if [ "$CLEAN_APP_DATA" = true ]; then
    print_status "info" "Cleaning macOS Application Support data..."
    
    # macOS Application Support directories
    APP_SUPPORT_DIR="$HOME/Library/Application Support"
    
    # Possible app names/identifiers
    APP_NAMES=(
        "Web Appliance Dashboard"
        "WebApplianceDashboard"
        "web-appliance-dashboard"
        "com.webappliance.dashboard"
        "com.appliance.dashboard"
        "appliance-dashboard"
    )
    
    # Clean each possible directory
    for app_name in "${APP_NAMES[@]}"; do
        if [ -d "$APP_SUPPORT_DIR/$app_name" ]; then
            print_status "info" "Removing: $APP_SUPPORT_DIR/$app_name"
            rm -rf "$APP_SUPPORT_DIR/$app_name"
            print_status "success" "Removed $app_name data"
        fi
    done
    
    # Also check for Electron app data
    if [ -d "$HOME/Library/Caches/web-appliance-dashboard" ]; then
        print_status "info" "Removing Electron cache..."
        rm -rf "$HOME/Library/Caches/web-appliance-dashboard"
    fi
    
    # Check for preferences
    PREF_FILES=(
        "$HOME/Library/Preferences/com.webappliance.dashboard.plist"
        "$HOME/Library/Preferences/com.appliance.dashboard.plist"
        "$HOME/Library/Preferences/web-appliance-dashboard.plist"
    )
    
    for pref_file in "${PREF_FILES[@]}"; do
        if [ -f "$pref_file" ]; then
            print_status "info" "Removing preference file: $pref_file"
            rm -f "$pref_file"
        fi
    done
    
    # Remove logs
    LOG_DIRS=(
        "$HOME/Library/Logs/Web Appliance Dashboard"
        "$HOME/Library/Logs/web-appliance-dashboard"
    )
    
    for log_dir in "${LOG_DIRS[@]}"; do
        if [ -d "$log_dir" ]; then
            print_status "info" "Removing log directory: $log_dir"
            rm -rf "$log_dir"
        fi
    done
    
    print_status "success" "macOS application data cleaned"
fi

echo ""
echo "======================================================================="
print_status "success" "Deep clean complete!"
echo "======================================================================="
echo ""
print_status "info" "Removed:"
echo "   • All node_modules directories"
echo "   • All build/dist directories"
echo "   • All package-lock.json files"
echo "   • All log files"
echo "   • All cache directories"
echo "   • All temporary files"
if [ "$CLEAN_DOCKER" = true ]; then
    echo "   • All Docker containers"
    if [ "$CLEAN_VOLUMES" = true ]; then
        echo "   • All Docker volumes (DATA REMOVED)"
    fi
fi
if [ "$CLEAN_APP_DATA" = true ]; then
    echo "   • macOS Application Support data"
    echo "   • macOS app caches and preferences"
    echo "   • macOS app logs"
    echo "   • All .env files (main, frontend, backend)"
fi
echo ""
print_status "info" "Remaining:"
echo "   • Source code files"
echo "   • Configuration files (including init.sql)"
echo "   • Documentation"
echo "   • Scripts"
echo "   • my-data directory (preserved)"
echo ""
print_status "info" "Next steps:"
if [ "$CLEAN_APP_DATA" = true ]; then
    echo "   1. Run: ./scripts/setup-env.sh (to create new .env files)"
    echo "   2. Run: ./scripts/build.sh"
    echo "   3. Or for macOS: ./scripts/build-macos-app.sh"
else
    echo "   1. Run: cp .env.example .env (and configure)"
    echo "   2. Run: ./scripts/build.sh"
    echo "   3. Or for macOS: ./scripts/build-macos-app.sh"
fi
echo ""

# Show disk space saved
if command -v du &> /dev/null; then
    echo "💾 Disk space information:"
    echo "   Project size now: $(du -sh . 2>/dev/null | cut -f1)"
fi

echo "======================================================================="