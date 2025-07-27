#!/bin/bash
# Debug-Script für Terminal-Session-Files

echo "🔍 Checking Terminal Session Files..."
echo "====================================="

# Prüfe Docker Container
echo -e "\n📦 Docker Container Status:"
docker ps | grep -E "(ttyd|backend)" | awk '{print $NF " - " $7}'

# Prüfe Session-Verzeichnis im ttyd Container
echo -e "\n📁 Session directory in ttyd container:"
docker exec appliance_ttyd ls -la /tmp/terminal-sessions/ 2>/dev/null || echo "Directory not found in ttyd container"

# Prüfe Session-Verzeichnis im backend Container
echo -e "\n📁 Session directory in backend container:"
docker exec appliance_backend ls -la /tmp/terminal-sessions/ 2>/dev/null || echo "Directory not found in backend container"

# Prüfe Volume Mounts
echo -e "\n🔗 Volume Mounts:"
docker inspect appliance_ttyd | jq -r '.[0].Mounts[] | select(.Destination | contains("terminal-sessions")) | "\(.Source) -> \(.Destination)"'
docker inspect appliance_backend | jq -r '.[0].Mounts[] | select(.Destination | contains("terminal-sessions")) | "\(.Source) -> \(.Destination)"'

# Prüfe ttyd logs
echo -e "\n📋 Recent ttyd logs:"
docker logs --tail 20 appliance_ttyd 2>&1 | grep -v "GET /health"

# Prüfe backend logs für terminal-session
echo -e "\n📋 Recent backend terminal-session logs:"
docker logs --tail 50 appliance_backend 2>&1 | grep -i "terminal.session\|SSH.*session"

echo -e "\n====================================="
echo "✅ Debug check complete"
