#!/bin/bash
# Fix für Terminal-Route in nginx
# Fügt /terminal/ Location hinzu, die auf /wetty/ zeigt

echo "🔧 Fixing terminal route in nginx configuration..."

# Füge die /terminal location nach /uploads ein
cat << 'EOF' | ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cat > /tmp/terminal.conf"
        
        # Terminal route for frontend compatibility
        location /terminal/ {
            set $ttyd_upstream ttyd:3000;
            proxy_pass http://$ttyd_upstream/wetty/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;
            
            # Return 503 if service unavailable
            proxy_intercept_errors on;
            error_page 502 503 504 = @service_unavailable;
        }
EOF

# Insert it into nginx.conf after /uploads location
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cd /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333 && awk '/location \/uploads/ {p=1} p && /^        }$/ && !done {print; print \"\"; system(\"cat /tmp/terminal.conf\"); done=1; next} 1' nginx.conf > nginx.conf.new && mv nginx.conf.new nginx.conf"

# Restart nginx
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "/usr/local/bin/docker compose -f /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333/docker-compose.yml restart webserver"

echo "✅ Terminal route fixed! The terminal should now work properly."
