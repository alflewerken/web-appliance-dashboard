#!/bin/bash
# Health Check für Web Appliance Dashboard Mac App

echo "🔍 Web Appliance Dashboard Mac App Health Check"
echo "=============================================="
echo ""

# Farben für Output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Container Status
echo "📦 Container Status:"
for container in wad_app_db wad_app_backend wad_app_webserver wad_app_ttyd; do
    if docker ps | grep -q $container; then
        status=$(docker inspect -f '{{.State.Health.Status}}' $container 2>/dev/null || echo "running")
        if [[ $status == "healthy" ]] || [[ $status == "running" ]]; then
            echo -e "  ✅ ${GREEN}$container: $status${NC}"
        else
            echo -e "  ❌ ${RED}$container: $status${NC}"
        fi
    else
        echo -e "  ❌ ${RED}$container: not running${NC}"
    fi
done

echo ""
echo "🌐 Service Checks:"

# Frontend
if curl -s -o /dev/null -w "%{http_code}" http://localhost:9081 | grep -q "200"; then
    echo -e "  ✅ ${GREEN}Frontend: OK${NC}"
else
    echo -e "  ❌ ${RED}Frontend: Not responding${NC}"
fi

# Backend API
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/health | grep -q "200"; then
    echo -e "  ✅ ${GREEN}Backend API: OK${NC}"
else
    echo -e "  ❌ ${RED}Backend API: Not responding${NC}"
fi

# Terminal
if curl -s -o /dev/null -w "%{http_code}" http://localhost:7682 | grep -q "200"; then
    echo -e "  ✅ ${GREEN}Terminal Service: OK${NC}"
else
    echo -e "  ❌ ${RED}Terminal Service: Not responding${NC}"
fi

# SSH in ttyd
if docker exec wad_app_ttyd which ssh >/dev/null 2>&1; then
    echo -e "  ✅ ${GREEN}SSH Client: Installed${NC}"
else
    echo -e "  ❌ ${RED}SSH Client: Not installed${NC}"
fi

echo ""
echo "💾 Database Check:"
table_count=$(docker exec wad_app_db mariadb -u root -prootpassword123 appliance_dashboard -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'appliance_dashboard';" -s 2>/dev/null || echo "0")
echo -e "  📊 Tables in database: ${YELLOW}$table_count${NC}"

echo ""
echo "📁 Important Files:"
if [[ -f "/Users/alflewerken/Desktop/web-appliance-dashboard/nginx/nginx-macapp-docker.conf" ]]; then
    echo -e "  ✅ ${GREEN}Nginx Config: Found${NC}"
else
    echo -e "  ❌ ${RED}Nginx Config: Missing${NC}"
fi

if [[ -d "/Users/alflewerken/Desktop/web-appliance-dashboard/frontend/build" ]]; then
    echo -e "  ✅ ${GREEN}Frontend Build: Found${NC}"
else
    echo -e "  ❌ ${RED}Frontend Build: Missing${NC}"
fi

echo ""
echo "🔧 Quick Fixes:"
echo "  - Restart all: docker-compose -f docker-compose.app.yml restart"
echo "  - View logs:   docker logs wad_app_backend"
echo "  - Rebuild:     ./setup-mac-app.sh"
