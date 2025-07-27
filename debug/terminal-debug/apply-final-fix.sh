#!/bin/bash
# Final fix application and container restart

echo "🚀 Applying Terminal Fix and Restarting Services..."
echo "=================================================="

cd /Users/alflewerken/Desktop/web-appliance-dashboard

# 1. Zeige aktuelle Container
echo "1. Current container status:"
docker-compose ps | grep -E "(ttyd|backend|webserver)"

# 2. Restart nur ttyd container
echo -e "\n2. Restarting ttyd container..."
docker-compose restart ttyd

# 3. Warte kurz
echo -e "\n3. Waiting for container to start..."
sleep 5

# 4. Prüfe Health Status
echo -e "\n4. Checking container health:"
docker-compose ps ttyd

# 5. Zeige ttyd logs
echo -e "\n5. Recent ttyd logs:"
docker-compose logs --tail 20 ttyd

# 6. Test Terminal URL
echo -e "\n6. Testing terminal endpoint:"
curl -I http://localhost:9080/terminal/ 2>/dev/null | head -n 5

echo -e "\n=================================================="
echo "✅ Fix applied!"
echo ""
echo "Teste jetzt das Terminal mit:"
echo "1. Öffne http://localhost:9080 im Browser"
echo "2. Wähle eine Appliance"
echo "3. Klicke auf 'Terminal' und dann 'In neuem Fenster öffnen'"
echo ""
echo "Die Terminal-URL sollte jetzt Parameter enthalten wie:"
echo "http://localhost:9080/terminal/?host=hostname&user=username&port=22"
