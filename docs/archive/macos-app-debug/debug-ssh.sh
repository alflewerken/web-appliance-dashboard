#!/bin/bash

echo "🔍 Debugging Web Appliance Dashboard SSH Configuration"
echo "======================================================"
echo ""

# Teste API-Zugriff
echo "📡 Teste API-Zugriff..."
API_RESPONSE=$(curl -s -H "Authorization: Bearer $(cat ~/.wad-token 2>/dev/null || echo '')" http://localhost:9081/api/appliances)

if [ $? -eq 0 ]; then
    echo "✅ API erreichbar"
    echo ""
    echo "📋 Appliances mit SSH-Konfiguration:"
    echo "$API_RESPONSE" | python3 -m json.tool | grep -E '"name"|"ssh_host_id"|"sshHost"|"sshUser"|"sshPort"' | sed 's/^/  /'
else
    echo "❌ API nicht erreichbar"
fi

echo ""
echo "🔧 SSH-Hosts in der Datenbank:"
docker exec wad_app_db mysql -u dashboard_user -pdashboard_pass123 appliance_dashboard -e "SELECT id, name, hostname, username, port FROM ssh_hosts;" 2>/dev/null || echo "❌ Konnte SSH-Hosts nicht abrufen"

echo ""
echo "🔗 Appliances mit SSH-Verbindungen:"
docker exec wad_app_db mysql -u dashboard_user -pdashboard_pass123 appliance_dashboard -e "SELECT a.name, s.hostname, s.username, s.port FROM appliances a JOIN ssh_hosts s ON a.ssh_host_id = s.id WHERE a.ssh_host_id IS NOT NULL;" 2>/dev/null || echo "❌ Konnte Verbindungen nicht abrufen"

echo ""
echo "📂 SSH-Keys im Container:"
docker exec wad_app_ttyd ls -la /root/.ssh/ | grep -E "id_rsa|config" || echo "❌ Konnte SSH-Keys nicht auflisten"

echo ""
echo "🧪 Test-URLs für Terminal:"
echo "  - Standard: http://localhost:9081/terminal-dynamic.html"
echo "  - Mit Debug: http://localhost:9081/terminal-dynamic.html?debug=1"
echo "  - Direkt ttyd: http://localhost:7682/terminal/"

echo ""
echo "💡 Tipp: Öffnen Sie die Mac-App mit Developer Tools:"
echo "  ENABLE_DEVTOOLS=true npm start"
