#!/bin/bash
# Sync docker-compose.yml changes to production template
# This script helps maintain consistency between development and production

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔄 Docker-Compose Sync Tool"
echo "========================="
echo ""

# Files to compare
DEV_COMPOSE="$PROJECT_ROOT/docker-compose.yml"
PROD_COMPOSE="$PROJECT_ROOT/docker-compose.production.yml"

# Check if files exist
if [ ! -f "$DEV_COMPOSE" ]; then
    echo "❌ Development docker-compose.yml not found!"
    exit 1
fi

if [ ! -f "$PROD_COMPOSE" ]; then
    echo "❌ Production docker-compose.production.yml not found!"
    exit 1
fi

# Function to extract services from docker-compose
extract_services() {
    local file=$1
    grep "^  [a-z]" "$file" | sed 's/://' | sed 's/^  //' | sort
}

# Function to show differences
show_differences() {
    echo "📊 Comparing docker-compose files..."
    echo ""
    
    # Extract service names
    DEV_SERVICES=$(extract_services "$DEV_COMPOSE")
    PROD_SERVICES=$(extract_services "$PROD_COMPOSE")
    
    # Compare services
    echo "Services in Development:"
    echo "$DEV_SERVICES" | sed 's/^/  - /'
    echo ""
    
    echo "Services in Production:"
    echo "$PROD_SERVICES" | sed 's/^/  - /'
    echo ""
    
    # Find differences
    ONLY_IN_DEV=$(comm -23 <(echo "$DEV_SERVICES") <(echo "$PROD_SERVICES"))
    ONLY_IN_PROD=$(comm -13 <(echo "$DEV_SERVICES") <(echo "$PROD_SERVICES"))
    
    if [ -n "$ONLY_IN_DEV" ]; then
        echo "⚠️  Services only in Development:"
        echo "$ONLY_IN_DEV" | sed 's/^/  - /'
        echo ""
    fi
    
    if [ -n "$ONLY_IN_PROD" ]; then
        echo "⚠️  Services only in Production:"
        echo "$ONLY_IN_PROD" | sed 's/^/  - /'
        echo ""
    fi
    
    if [ -z "$ONLY_IN_DEV" ] && [ -z "$ONLY_IN_PROD" ]; then
        echo "✅ Service names are synchronized!"
    else
        echo "⚠️  Service names differ between environments!"
    fi
}

# Function to update production template
update_production() {
    echo ""
    echo "🔧 Updating Production Template"
    echo "================================"
    echo ""
    echo "This will convert the development docker-compose.yml to production format:"
    echo "  1. Replace local build contexts with ghcr.io images"
    echo "  2. Remove development-specific volumes"
    echo "  3. Adjust environment variables for production"
    echo ""
    
    read -p "Do you want to update docker-compose.production.yml? (y/N): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Update cancelled."
        return
    fi
    
    # Create backup
    cp "$PROD_COMPOSE" "$PROD_COMPOSE.bak"
    echo "✅ Backup created: docker-compose.production.yml.bak"
    
    # Copy and modify
    cp "$DEV_COMPOSE" "$PROD_COMPOSE"
    
    # Use GNU sed without the empty string parameter
    # Replace build contexts with images
    sed -i 's|build: ./backend|image: ghcr.io/alflewerken/web-appliance-dashboard-backend:latest|g' "$PROD_COMPOSE"
    sed -i 's|build: ./nginx|image: ghcr.io/alflewerken/web-appliance-dashboard-nginx:latest|g' "$PROD_COMPOSE"
    sed -i 's|build: ./ttyd|image: ghcr.io/alflewerken/web-appliance-dashboard-ttyd:latest|g' "$PROD_COMPOSE"
    sed -i 's|build: ./guacamole|image: ghcr.io/alflewerken/web-appliance-dashboard-guacamole:latest|g' "$PROD_COMPOSE"
    
    # Remove build context blocks (multi-line)
    sed -i '/^    build:$/,/^    [a-z]/{ /^    build:$/d; /^      context:/d; /^      dockerfile:/d; }' "$PROD_COMPOSE"
    
    # Remove development volumes
    sed -i 's|- ./backend:/app||g' "$PROD_COMPOSE"
    sed -i 's|- /app/node_modules||g' "$PROD_COMPOSE"
    sed -i 's|- ./frontend/build:/usr/share/nginx/html:ro||g' "$PROD_COMPOSE"
    sed -i 's|- ./nginx/conf.d:/etc/nginx/conf.d:ro||g' "$PROD_COMPOSE"
    sed -i 's|- ./scripts:/scripts:ro||g' "$PROD_COMPOSE"
    
    # Clean up empty volume sections
    sed -i '/^    volumes:$/{ N; s/volumes:\n    $/volumes:\n      - dummy:\/dummy/; }' "$PROD_COMPOSE"
    
    echo "✅ Production template updated!"
    echo ""
    echo "⚠️  Please review the changes manually:"
    echo "   diff docker-compose.production.yml.bak docker-compose.production.yml"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  check    - Compare development and production configs (default)"
    echo "  update   - Update production template from development"
    echo "  diff     - Show detailed diff between configs"
    echo "  help     - Show this help message"
}

# Main logic
case "${1:-check}" in
    check)
        show_differences
        ;;
    update)
        show_differences
        update_production
        ;;
    diff)
        echo "📄 Detailed differences:"
        echo "======================"
        diff -u "$PROD_COMPOSE" "$DEV_COMPOSE" || true
        ;;
    help)
        show_usage
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac

echo ""
echo "💡 Tip: After making changes to docker-compose.yml, run:"
echo "   ./scripts/sync-compose.sh update"
echo "   to update the production template"
