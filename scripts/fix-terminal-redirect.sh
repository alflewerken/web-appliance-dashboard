#!/bin/bash
# Fix für Terminal - verwendet rewrite statt proxy_pass

echo "🔧 Applying terminal rewrite fix..."

# Erstelle die korrekte nginx config mit rewrite
cat << 'EOF' | ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cat > /tmp/terminal-fix.conf"
        # Terminal rewrite - Frontend uses /terminal, wetty expects /wetty
        location /terminal {
            return 301 /wetty/;
        }
        
        location /terminal/ {
            return 301 /wetty/;
        }
EOF

# Backup current nginx.conf
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cp /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333/nginx.conf /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333/nginx.conf.bak2"

# Remove any existing /terminal/ location
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cd /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333 && awk '/location \/terminal\// {skip=1} skip && /^        }$/ {skip=0; next} !skip {print}' nginx.conf > nginx.conf.tmp && mv nginx.conf.tmp nginx.conf"

# Add the redirect after /uploads
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cd /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333 && awk '/location \/uploads/ {p=1} p && /^        }$/ && !done {print; print \"\"; system(\"cat /tmp/terminal-fix.conf\"); done=1; next} 1' nginx.conf > nginx.conf.new && mv nginx.conf.new nginx.conf"

# Restart nginx
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "/usr/local/bin/docker compose -f /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333/docker-compose.yml restart webserver"

echo "✅ Terminal redirect fixed!"
