#!/bin/bash
# Fix für Terminal Redirect-Loop
# Entfernt die problematische /terminal/ location und passt nginx an

echo "🔧 Fixing terminal redirect loop..."

# Erstelle eine korrigierte nginx.conf ohne die /terminal/ location
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "cd /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333 && cat nginx.conf" > /tmp/nginx-current.conf

# Entferne die /terminal/ location falls vorhanden
awk '
/location \/terminal\// { 
    in_terminal=1 
}
in_terminal && /^        }$/ { 
    in_terminal=0; 
    next 
}
!in_terminal { 
    print 
}
' /tmp/nginx-current.conf > /tmp/nginx-fixed.conf

# Kopiere zurück
scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null /tmp/nginx-fixed.conf alflewerken@macbook.fritz.box:/Users/alflewerken/docker/web-appliance-dashboard-20250809_194333/nginx.conf

# Restart nginx
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null alflewerken@macbook.fritz.box "/usr/local/bin/docker compose -f /Users/alflewerken/docker/web-appliance-dashboard-20250809_194333/docker-compose.yml restart webserver"

echo "✅ Redirect loop fixed!"
