#!/bin/bash
# Temporärer Fix für fehlende /uploads Location in nginx
# Für: web-appliance-dashboard auf macbook.fritz.box

echo "🔧 Applying nginx fix for /uploads location..."

# Backup der aktuellen nginx.conf
echo "📋 Creating backup of nginx.conf..."
cp /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333/nginx.conf \
   /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333/nginx.conf.backup

# Füge die /uploads Location nach socket.io ein
echo "✏️ Adding /uploads location to nginx.conf..."
sed -i '' '/location \/socket.io\//,/^        }$/a\
\
        # Uploads directory (images, etc) - CRITICAL for background images\
        location /uploads {\
            proxy_pass http://backend_upstream;\
            proxy_http_version 1.1;\
            proxy_pass_request_headers on;\
            proxy_set_header Host $host;\
            proxy_set_header X-Real-IP $remote_addr;\
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
            proxy_set_header X-Forwarded-Proto $scheme;\
            proxy_set_header Authorization $http_authorization;\
            \
            # Cache images\
            location ~* \\.(jpg|jpeg|png|gif|webp|svg)$ {\
                proxy_pass http://backend_upstream;\
                expires 7d;\
                add_header Cache-Control "public, immutable";\
            }\
        }\
' /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333/nginx.conf

echo "🔄 Restarting nginx container..."
cd /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333
/usr/local/bin/docker compose restart webserver

echo "✅ Fix applied! Background images should now be visible."
echo "📌 Please reload the web page (Cmd+R) to see the changes."
