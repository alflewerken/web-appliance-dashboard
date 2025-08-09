#!/bin/bash
# Fix WeTTy Konfiguration - lokales Terminal statt SSH

echo "🔧 Fixing WeTTy configuration..."

# Stoppe ttyd Container
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cd /Users/alflewerken/docker/web-appliance-dashboard-20250809_202443 && /usr/local/bin/docker compose stop ttyd"

# Ändere docker-compose.yml um command hinzuzufügen
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cd /Users/alflewerken/docker/web-appliance-dashboard-20250809_202443 && cat > docker-compose-ttyd-fix.yml" << 'EOF'
version: '3.8'
services:
  ttyd:
    image: wettyoss/wetty:latest
    container_name: appliance_ttyd
    hostname: ttyd
    environment:
      WETTY_PORT: 3000
    # Wichtig: Starte WeTTy mit lokalem Shell statt SSH
    command: ["yarn", "start", "--", "--base", "/wetty", "--port", "3000", "--host", "0.0.0.0"]
    networks:
      - appliance_network
    restart: unless-stopped
EOF

# Merge die Änderung
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cd /Users/alflewerken/docker/web-appliance-dashboard-20250809_202443 && /usr/local/bin/docker compose -f docker-compose.yml -f docker-compose-ttyd-fix.yml up -d ttyd"

echo "✅ WeTTy configuration fixed!"
echo "⏳ Waiting for service to start..."
sleep 5

# Test
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "curl -I http://localhost/wetty/"
