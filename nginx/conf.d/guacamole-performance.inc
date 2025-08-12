# Guacamole Performance Optimizations
upstream guacamole {
    server guacamole:8080;
    keepalive 64;
}

# Main Guacamole location
location /guacamole/ {
    proxy_pass http://guacamole/guacamole/;
    proxy_buffering off;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $http_connection;
    
    # Performance optimizations
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
    
    # Disable buffering for better performance
    proxy_request_buffering off;
    
    # TCP optimizations
    tcp_nodelay on;
    tcp_nopush off;
    
    # Larger buffers for better throughput
    proxy_buffer_size 64k;
    proxy_buffers 16 32k;
    proxy_busy_buffers_size 64k;
    
    # Disable access logs for performance
    access_log off;
}

# WebSocket tunnel with optimizations
location /guacamole/websocket-tunnel {
    proxy_pass http://guacamole/guacamole/websocket-tunnel;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_buffering off;
    
    # WebSocket specific timeouts
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
    
    # TCP optimizations for real-time data
    tcp_nodelay on;
    tcp_nopush off;
    
    # Disable access logs
    access_log off;
}

# HTTP tunnel with optimizations
location /guacamole/tunnel {
    proxy_pass http://guacamole/guacamole/tunnel;
    proxy_buffering off;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Performance settings
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
    
    # Disable buffering
    proxy_request_buffering off;
    
    # TCP optimizations
    tcp_nodelay on;
    tcp_nopush off;
    
    # Larger buffers
    proxy_buffer_size 64k;
    proxy_buffers 16 32k;
    proxy_busy_buffers_size 64k;
    
    # Disable access logs
    access_log off;
}
