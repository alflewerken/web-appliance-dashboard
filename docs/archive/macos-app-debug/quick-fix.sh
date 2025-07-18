#!/bin/bash

# Web Appliance Dashboard macOS App - Quick Fix Script
# Behebt das nginx mime.types Problem

echo "Web Appliance Dashboard - Quick Fix"
echo "==================================="
echo ""

# Definiere Pfade
APP_SUPPORT_DIR="$HOME/Library/Application Support/web-appliance-dashboard"
PROJECT_DIR="/Users/alflewerken/Desktop/web-appliance-dashboard"

# Erstelle Application Support Verzeichnis
echo "1. Erstelle Application Support Verzeichnis..."
mkdir -p "$APP_SUPPORT_DIR"

# Erstelle docker-compose.yml mit absoluten Pfaden
echo "2. Erstelle docker-compose.yml..."
cat > "$APP_SUPPORT_DIR/docker-compose.yml" << EOF
# Docker Compose für Web Appliance Dashboard macOS App
# Automatisch generiert am $(date)

services:
  # MariaDB Database
  database:
    image: mariadb:latest
    container_name: wad_app_db
    restart: always
    ports:
      - "3307:3306"
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword123
      MYSQL_DATABASE: appliance_dashboard
      MYSQL_USER: dashboard_user
      MYSQL_PASSWORD: dashboard_pass123
    volumes:
      - app_db_data:/var/lib/mysql
      - ${PROJECT_DIR}/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - app_network
    healthcheck:
      test: ["CMD", "mariadb-admin", "ping", "-h", "localhost"]
      timeout: 10s
      retries: 20
      start_period: 40s

  # Node.js Backend API
  backend:
    build:
      context: ${PROJECT_DIR}/backend
      dockerfile: Dockerfile
    container_name: wad_app_backend
    restart: always
    ports:
      - "3002:3001"
    environment:
      DB_HOST: database
      DB_PORT: 3306
      DB_USER: dashboard_user
      DB_PASSWORD: dashboard_pass123
      DB_NAME: appliance_dashboard
      JWT_SECRET: V2FUAJ3cOAghJY8B3FprwknN5/ZktN0gX+x/D4GEhQv+dk2dDoYYwWjIhNR7KPkXWNXrX/+Sx2C9U/UCDYiaSw==
      SSH_KEY_ENCRYPTION_SECRET: o2ZGotcuB3cTBhs/7xQoAj3WXCIZEs8CyOLbmgdHx5M=
      NODE_ENV: production
      ALLOWED_ORIGINS: "http://localhost,https://localhost,http://localhost:9081,https://localhost:9444"
      SSH_TOOLS_ENABLED: "true"
      SSH_AUTO_INIT: "true"
    depends_on:
      database:
        condition: service_healthy
    networks:
      - app_network
    volumes:
      - ${PROJECT_DIR}/backend:/app
      - /app/node_modules
      - app_ssh_keys:/root/.ssh
    healthcheck:
      test: ["CMD", "sh", "-c", "curl -f http://localhost:3001/api/health && which ssh && which ssh-copy-id && which sshpass"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Nginx Web Server
  webserver:
    image: nginx:alpine
    container_name: wad_app_webserver
    restart: always
    ports:
      - "9081:80"
      - "9444:443"
    volumes:
      - ${PROJECT_DIR}/nginx/nginx-docker.conf:/etc/nginx/nginx.conf:ro
      - ${PROJECT_DIR}/nginx/conf.d:/etc/nginx/conf.d:ro
      - ${PROJECT_DIR}/frontend/build:/usr/share/nginx/html:ro
      - ${PROJECT_DIR}/nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - backend
      - ttyd
    networks:
      - app_network

  # ttyd Web Terminal
  ttyd:
    image: tsl0922/ttyd:latest
    container_name: wad_app_ttyd
    restart: always
    ports:
      - "7682:7681"
    command: >
      ttyd
      --writable
      --port 7681
      --base-path /terminal
      --terminal-type xterm-256color
      /bin/bash
    networks:
      - app_network
    volumes:
      - app_ssh_keys:/root/.ssh:ro
      - ${PROJECT_DIR}/scripts:/scripts:ro

volumes:
  app_db_data:
    driver: local
    name: wad_app_db_data
  app_ssh_keys:
    driver: local
    name: wad_app_ssh_keys

networks:
  app_network:
    driver: bridge
    name: wad_app_network
EOF

# Erstelle Setup-Marker
echo "3. Erstelle Setup-Marker..."
touch "$APP_SUPPORT_DIR/setup-completed.marker"

# Erstelle project-path.txt
echo "4. Speichere Projekt-Pfad..."
echo "$PROJECT_DIR" > "$APP_SUPPORT_DIR/project-path.txt"

echo ""
echo "✅ Quick Fix abgeschlossen!"
echo ""
echo "Die App sollte jetzt funktionieren."
echo "Bitte starten Sie die Web Appliance Dashboard App neu."
echo ""

# Optional: Container direkt starten
read -p "Möchten Sie die Container jetzt starten? (j/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Jj]$ ]]; then
    echo "Starte Container..."
    cd "$PROJECT_DIR"
    docker-compose -f "$APP_SUPPORT_DIR/docker-compose.yml" -p wad_app up -d
fi
