#!/bin/bash
# Temporary fix script for nginx issue

cd ~/web-appliance-dashboard

# Stop webserver
docker compose stop webserver

# Edit docker-compose.yml to use standard nginx
sed -i.bak 's|image: ghcr.io/alflewerken/web-appliance-dashboard-nginx:latest|image: nginx:alpine|' docker-compose.yml

# Create nginx config without Lua
mkdir -p nginx-config
cat > nginx-config/default.conf << 'EOF'
server {
    listen 80 default_server;
    server_name _;
    
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://backend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /terminal {
        proxy_pass http://ttyd:7681;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

# Start with standard nginx
docker run -d --name appliance_webserver \
  --network appliance_network \
  -p 80:80 -p 443:443 \
  -v $(pwd)/nginx-config/default.conf:/etc/nginx/conf.d/default.conf:ro \
  nginx:alpine

echo "Temporary nginx fix applied!"
echo "Access the dashboard at http://localhost"
