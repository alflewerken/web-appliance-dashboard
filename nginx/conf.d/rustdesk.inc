# RustDesk Web Client Proxy Configuration

# WebSocket upgrade map
map $http_upgrade $rustdesk_connection_upgrade {
    default upgrade;
    '' close;
}

# RustDesk API Server
upstream rustdesk_api {
    server rustdesk-server:21119;
}

# RustDesk Web Client
upstream rustdesk_web {
    server rustdesk-web:21121;
}

# RustDesk WebSocket
upstream rustdesk_ws {
    server rustdesk-relay:21120;
}

# API Proxy
location /rustdesk/api/ {
    proxy_pass http://rustdesk_api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $rustdesk_connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}

# Web Client Proxy
location /rustdesk/web/ {
    proxy_pass http://rustdesk_web/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $rustdesk_connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Security headers
    add_header X-Frame-Options "";
    add_header Content-Security-Policy "frame-ancestors 'self' http://localhost:* https://localhost:*;";
    
    # Large buffer for streaming
    proxy_buffering off;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    proxy_busy_buffers_size 8k;
    
    # Timeouts for long connections
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
}

# WebSocket Proxy
location /rustdesk/ws/ {
    proxy_pass http://rustdesk_ws/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $rustdesk_connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # WebSocket specific
    proxy_buffering off;
    proxy_read_timeout 86400;
    
    # Large frames
    proxy_max_temp_file_size 0;
    client_max_body_size 0;
}

# Static resources with caching
location ~* ^/rustdesk/.*\.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg)$ {
    proxy_pass http://rustdesk_web;
    proxy_cache_valid 200 302 10m;
    proxy_cache_valid 404 1m;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
