#!/bin/bash
# Status Script - Zeigt den aktuellen Status inklusive Remote Desktop

echo "📊 Web Appliance Dashboard Status"
echo "================================="

# Check main services
echo ""
echo "🐳 Main Services:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

# Check if Guacamole is running
echo ""
echo "🖥️  Remote Desktop Services:"
if docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "appliance_guacamole|appliance_guacd"; then
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "appliance_guacamole|appliance_guacd"
else
    echo "   Remote Desktop services are not running"
    echo "   Start with: docker compose up -d guacamole-postgres guacd guacamole"
fi

# Show access URLs
echo ""
echo "🌐 Access URLs:"
echo "   Dashboard:      http://localhost:9080"
echo "   API:           http://localhost:3001/api/health"
echo "   Terminal:      http://localhost:7681"
if docker ps | grep -q guacamole; then
    echo "   Remote Desktop: http://localhost:8080/guacamole"
    echo "                  (Login: guacadmin/guacadmin)"
fi

# Check for Remote Desktop enabled appliances
echo ""
echo "📋 Remote Desktop Configuration:"
if docker exec -i appliance_db mysql -u dashboard_user -pdashboard_pass123 -e "SELECT COUNT(*) as count FROM appliance_dashboard.appliances WHERE remote_desktop_enabled = 1;" 2>/dev/null | grep -q "0"; then
    echo "   No appliances have Remote Desktop enabled yet"
else
    count=$(docker exec -i appliance_db mysql -u dashboard_user -pdashboard_pass123 -e "SELECT COUNT(*) as count FROM appliance_dashboard.appliances WHERE remote_desktop_enabled = 1;" -s -N appliance_dashboard 2>/dev/null || echo "0")
    echo "   $count appliance(s) have Remote Desktop configured"
fi

echo ""
echo "💡 Tips:"
echo "   - Configure Remote Desktop in appliance settings"
echo "   - Supports VNC (Linux) and RDP (Windows)"
echo "   - Credentials are encrypted and stored securely"
echo ""