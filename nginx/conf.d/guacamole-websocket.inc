# WebSocket Support für Guacamole (bessere Performance)
location /guacamole/websocket-tunnel {
    proxy_pass http://guacamole:8080/guacamole/websocket-tunnel;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
}

# Optimierungen für normale Guacamole Requests
location /guacamole/ {
    proxy_pass http://guacamole:8080/guacamole/;
    proxy_buffering off;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $http_connection;
    proxy_cookie_path /guacamole/ /guacamole/;
    
    # Auto-authenticate for host connections with tokens
    set $remote_user "";
    if ($arg_token) {
        set $remote_user "guacadmin";
    }
    proxy_set_header X-Remote-User $remote_user;
    
    # Performance Headers
    proxy_set_header Accept-Encoding gzip;
    
    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    
    # Größere Buffer für bessere Performance
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    proxy_busy_buffers_size 8k;
}
