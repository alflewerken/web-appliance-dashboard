# Guacamole Proxy Configuration
# WICHTIG: Diese Datei ersetzt die alte guacamole-websocket.inc

# Statische Dateien direkt von Guacamole
location ~ ^/guacamole/(.*\.(js|css|png|jpg|gif|ico|html|json|map))$ {
    proxy_pass http://guacamole:8080/guacamole/$1;
    proxy_set_header Host $host;
    proxy_cache_bypass 1;
    expires 1h;
}

# WebSocket tunnel
location /guacamole/websocket-tunnel {
    proxy_pass http://guacamole:8080/guacamole/websocket-tunnel;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_buffering off;
    access_log off;
}

# HTTP tunnel  
location /guacamole/tunnel {
    proxy_pass http://guacamole:8080/guacamole/tunnel;
    proxy_buffering off;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    access_log off;
}

# API endpoints
location /guacamole/api/ {
    proxy_pass http://guacamole:8080/guacamole/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

# Main Guacamole app
location /guacamole/ {
    proxy_pass http://guacamole:8080/guacamole/;
    proxy_buffering off;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_cookie_path /guacamole/ /guacamole/;
}
