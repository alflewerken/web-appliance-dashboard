#!/bin/bash

echo "Detaillierter Terminal-Test für macOS App"
echo "========================================"
echo ""

# 1. Test ob ttyd läuft
echo "1. Checking ttyd container status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ttyd
echo ""

# 2. Test ttyd direkt
echo "2. Testing ttyd directly (should return 404 because of base-path):"
curl -s http://localhost:7682/ | head -n 5
echo ""

# 3. Test ttyd mit base-path
echo "3. Testing ttyd with base-path:"
curl -s http://localhost:7682/terminal/ | head -n 5
echo ""

# 4. Test über nginx
echo "4. Testing through nginx proxy:"
curl -s http://localhost:9081/terminal/ | grep -E "<title>|ttyd" | head -n 5
echo ""

# 5. Prüfe nginx Konfiguration
echo "5. Checking nginx config for terminal location:"
docker exec wad_app_webserver cat /etc/nginx/nginx.conf | grep -A 10 "location /terminal"
echo ""

# 6. Test ob ttyd image vorhanden ist
echo "6. Checking ttyd image:"
docker images | grep ttyd
echo ""

# 7. Prüfe ttyd logs ausführlicher
echo "7. Detailed ttyd logs:"
docker logs wad_app_ttyd --tail 20
echo ""

# 8. Test WebSocket Verbindung
echo "8. Testing WebSocket endpoint:"
curl -s -o /dev/null -w "WebSocket endpoint status: %{http_code}\n" http://localhost:9081/terminal/ws
echo ""

# 9. Prüfe ob der ttyd-ssh-wrapper existiert
echo "9. Checking ttyd-ssh-wrapper script:"
docker exec wad_app_ttyd ls -la /scripts/ttyd-ssh-wrapper.sh 2>&1 || echo "Script not found!"
echo ""

# 10. Test mit wget im nginx container
echo "10. Testing from nginx container:"
docker exec wad_app_webserver sh -c "wget -O - -q http://wad_app_ttyd:7681/terminal/ 2>&1 | head -n 10"
