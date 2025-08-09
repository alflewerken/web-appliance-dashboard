#!/bin/bash
# Intelligenter Fix für Terminal-Route
# Verwendet sub_filter um die URLs im HTML zu ändern

echo "🔧 Applying intelligent terminal fix with URL rewriting..."

# Create nginx config that rewrites /terminal to /wetty in the response
cat << 'EOF' | ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cat > /tmp/terminal-smart.conf"
        # Terminal - rewrite URLs in response
        location /terminal/ {
            set $ttyd_upstream ttyd:3000;
            
            # Pass to wetty but rewrite the response
            proxy_pass http://$ttyd_upstream/wetty/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;
            
            # Rewrite URLs in the response
            sub_filter '/wetty' '/terminal';
            sub_filter 'wetty/' 'terminal/';
            sub_filter_once off;
            sub_filter_types text/html text/css text/javascript application/javascript;
            
            # Return 503 if service unavailable
            proxy_intercept_errors on;
            error_page 502 503 504 = @service_unavailable;
        }
EOF

# Remove any existing /terminal/ location first
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cd /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333 && sed -i '' '/location \/terminal\//,/^        }/d' nginx.conf"

# Add the new config after /wetty/
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cd /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333 && awk '/location \/wetty\// {p=1} p && /^        }$/ && !done {print; print \"\"; system(\"cat /tmp/terminal-smart.conf\"); done=1; next} 1' nginx.conf > nginx.conf.new && mv nginx.conf.new nginx.conf"

# Restart nginx
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "/usr/local/bin/docker compose -f /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333/docker-compose.yml restart webserver"

echo "✅ Smart terminal fix applied with URL rewriting!"
