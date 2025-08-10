    # Appliance Proxy - Interne Services über Backend-Proxy
    location ~ ^/api/appliances/(\d+)/proxy/(.*)$ {
        # Diese Route leitet zum Backend weiter, das die eigentliche Proxy-Logik übernimmt
        proxy_pass http://backend:3001/api/appliances/$1/proxy/$2$is_args$args;
        proxy_http_version 1.1;
        
        # Standard Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $real_client_ip;
        proxy_set_header X-Forwarded-For $real_client_ip;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        
        # Authorization Header weitergeben
        proxy_set_header Authorization $http_authorization;
        
        # Token aus Query-Parameter in Authorization Header umwandeln
        set $auth_header $http_authorization;
        if ($arg_token) {
            set $auth_header "Bearer $arg_token";
        }
        proxy_set_header Authorization $auth_header;
        
        # WebSocket Support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Buffering deaktivieren für Echtzeit-Daten
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_cache off;
        
        # Erweiterte Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        # Große Dateien erlauben
        client_max_body_size 100M;
        
        # SSE Support
        proxy_set_header X-Accel-Buffering no;
    }
