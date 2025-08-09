#!/bin/bash
# Fix für Terminal Redirect Loop - Finale Lösung
# Ändert nginx config um den Redirect zu verhindern

echo "🔧 Applying final terminal fix..."

# Erstelle neue nginx config die den Redirect verhindert
cat << 'EOF' | ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cat > /tmp/wetty-fix.conf"
        # Terminal (ttyd/wetty) - Fixed redirect loop
        location = /wetty {
            # Redirect /wetty to /wetty/ to match what iframe expects
            return 301 /wetty/;
        }
        
        location /wetty/ {
            set $ttyd_upstream ttyd:3000;
            
            # Important: proxy to /wetty (without slash) to prevent WeTTy redirect
            proxy_pass http://$ttyd_upstream/wetty;
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

# Backup current config
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cp /Users/alflewerken/docker/web-appliance-dashboard-20250809_202443/nginx.conf /Users/alflewerken/docker/web-appliance-dashboard-20250809_202443/nginx.conf.bak3"

# Remove existing /wetty/ location
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cd /Users/alflewerken/docker/web-appliance-dashboard-20250809_202443 && sed -i '' '/location \/wetty\//,/^        }/d' nginx.conf"

# Add the fixed config after /uploads
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cd /Users/alflewerken/docker/web-appliance-dashboard-20250809_202443 && awk '/location \/uploads/ {p=1} p && /^        }$/ && !done {print; print \"\"; system(\"cat /tmp/wetty-fix.conf\"); done=1; next} 1' nginx.conf > nginx.conf.new && mv nginx.conf.new nginx.conf"

# Restart nginx
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cd /Users/alflewerken/docker/web-appliance-dashboard-20250809_202443 && /usr/local/bin/docker compose restart webserver"

echo "✅ Terminal fix applied!"
