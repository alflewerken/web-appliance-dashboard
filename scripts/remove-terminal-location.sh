#!/bin/bash
# Fix für Terminal im Customer Package
# Entfernt problematische /terminal/ location

echo "🔧 Removing problematic /terminal/ location..."

# Backup
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cp /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333/nginx.conf /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333/nginx.conf.terminal-fix"

# Entferne die /terminal/ location die den Redirect-Loop verursacht
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cd /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333 && sed -i '' '/location \/terminal\//,/^        }/d' nginx.conf"

# Restart nginx
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "/usr/local/bin/docker compose -f /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333/docker-compose.yml restart webserver"

echo "✅ Terminal location removed. Terminal will not work until frontend is updated."
echo "⚠️  This is a temporary fix. The frontend needs to be updated to use /wetty/ instead of /terminal/"
