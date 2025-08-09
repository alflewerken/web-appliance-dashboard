#!/bin/bash
# Patch nginx.conf to add /uploads location

cat << 'EOF' | ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cat >> /tmp/uploads.conf"
        
        # Uploads directory for background images
        location /uploads {
            proxy_pass http://backend:3001;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
EOF

# Now insert it into nginx.conf
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cd /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333 && awk '/location \/socket.io\// {p=1} p && /^        }$/ && !done {print; print \"\"; system(\"cat /tmp/uploads.conf\"); done=1; next} 1' nginx.conf > nginx.conf.new && mv nginx.conf.new nginx.conf"

# Restart nginx
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "/usr/local/bin/docker compose -f /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333/docker-compose.yml restart webserver"
