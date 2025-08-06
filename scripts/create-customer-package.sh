#!/bin/bash

# Web Appliance Dashboard - Customer Deployment Package Generator
# This script creates a complete deployment package for customers

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
PACKAGE_DIR="$PROJECT_ROOT/customer-package"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="web-appliance-dashboard-${TIMESTAMP}"

echo "========================================="
echo "Customer Package Generator"
echo "========================================="

# Clean up old package
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR/$PACKAGE_NAME"

cd "$PACKAGE_DIR/$PACKAGE_NAME"

# Create docker-compose.yml for customer
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  # MariaDB Database
  database:
    image: mariadb:latest
    container_name: appliance_db
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - db_data:/var/lib/mysql
    networks:
      - appliance_network
    healthcheck:
      test: ["CMD-SHELL", "mariadb-admin ping -h localhost -u root --password='${MYSQL_ROOT_PASSWORD}' || exit 1"]
      timeout: 10s
      retries: 20
      start_period: 40s

  # Backend API
  backend:
    image: ghcr.io/alflewerken/web-appliance-dashboard-backend:latest
    container_name: appliance_backend
    restart: always
    environment:
      DB_HOST: database
      DB_PORT: 3306
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: ${DB_NAME}
      JWT_SECRET: ${JWT_SECRET}
      SSH_KEY_ENCRYPTION_SECRET: ${SSH_KEY_ENCRYPTION_SECRET}
      NODE_ENV: production
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS}
    volumes:
      - backend_uploads:/app/uploads
      - backend_logs:/app/logs
      - ssh_keys:/root/.ssh
    depends_on:
      database:
        condition: service_healthy
    networks:
      - appliance_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ttyd Terminal Service
  ttyd:
    image: wettyoss/wetty:latest
    container_name: appliance_ttyd
    restart: always
    environment:
      - SSHHOST=host.docker.internal
      - SSHPORT=22
    networks:
      - appliance_network

  # Guacamole daemon
  guacd:
    image: guacamole/guacd:latest
    container_name: appliance_guacd
    restart: always
    networks:
      - appliance_network
    healthcheck:
      test: ["CMD-SHELL", "test -S /var/run/guacd/guacd.sock || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Guacamole PostgreSQL
  guacamole-postgres:
    image: postgres:15-alpine
    container_name: appliance_guacamole_db
    restart: always
    environment:
      POSTGRES_DB: ${GUACAMOLE_DB_NAME:-guacamole_db}
      POSTGRES_USER: ${GUACAMOLE_DB_USER:-guacamole_user}
      POSTGRES_PASSWORD: ${GUACAMOLE_DB_PASSWORD:-guacamole_pass123}
    volumes:
      - guacamole_postgres_data:/var/lib/postgresql/data
    networks:
      - appliance_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${GUACAMOLE_DB_USER:-guacamole_user}"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Guacamole Web Application
  guacamole:
    image: ghcr.io/alflewerken/web-appliance-dashboard-guacamole:latest
    container_name: appliance_guacamole
    restart: always
    depends_on:
      guacd:
        condition: service_healthy
      guacamole-postgres:
        condition: service_healthy
    environment:
      GUACD_HOSTNAME: guacd
      POSTGRES_HOSTNAME: guacamole-postgres
      POSTGRES_DATABASE: ${GUACAMOLE_DB_NAME:-guacamole_db}
      POSTGRES_USER: ${GUACAMOLE_DB_USER:-guacamole_user}
      POSTGRES_PASSWORD: ${GUACAMOLE_DB_PASSWORD:-guacamole_pass123}
      JWT_SECRET: ${JWT_SECRET}
      DB_HOST: database
      DB_PORT: 3306
      DB_NAME: ${DB_NAME}
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
    volumes:
      - guacamole_home:/etc/guacamole
    networks:
      - appliance_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/guacamole/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  # RustDesk ID Server (optional)
  rustdesk-server:
    image: rustdesk/rustdesk-server:latest
    container_name: rustdesk-server
    command: hbbs
    restart: always
    ports:
      - "21116:21116"
      - "21116:21116/udp"
      - "21118:21118"
      - "21119:21119"
    volumes:
      - rustdesk_data:/root
    networks:
      - appliance_network

  # RustDesk Relay Server (optional)
  rustdesk-relay:
    image: rustdesk/rustdesk-server:latest
    container_name: rustdesk-relay
    command: hbbr
    restart: always
    ports:
      - "21117:21117"
      - "21120:21120"
    volumes:
      - rustdesk_data:/root
    networks:
      - appliance_network

  # Nginx Webserver
  webserver:
    image: nginx:alpine
    container_name: appliance_webserver
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - frontend_static:/usr/share/nginx/html:ro
    depends_on:
      - backend
      - ttyd
      - guacamole
    networks:
      - appliance_network

  # Frontend static files server
  frontend:
    image: ghcr.io/alflewerken/web-appliance-dashboard-frontend:latest
    container_name: appliance_frontend_builder
    volumes:
      - frontend_static:/app/build
    command: ["sh", "-c", "cp -r /app/build/* /app/build/"]
    networks:
      - appliance_network

volumes:
  db_data:
  backend_uploads:
  backend_logs:
  ssh_keys:
  guacamole_home:
  guacamole_postgres_data:
  rustdesk_data:
  frontend_static:

networks:
  appliance_network:
    driver: bridge
EOF

# Create .env.example
cat > .env.example << 'EOF'
# Database Configuration
MYSQL_ROOT_PASSWORD=your_secure_root_password
MYSQL_DATABASE=appliance_dashboard
MYSQL_USER=appliance_user
MYSQL_PASSWORD=your_secure_db_password

# Backend Database Connection
DB_HOST=database
DB_PORT=3306
DB_USER=appliance_user
DB_PASSWORD=your_secure_db_password
DB_NAME=appliance_dashboard

# Security Keys (generate with: openssl rand -base64 32)
JWT_SECRET=your_jwt_secret_key_here
SSH_KEY_ENCRYPTION_SECRET=your_ssh_encryption_key_here

# CORS Configuration
ALLOWED_ORIGINS=http://localhost,http://localhost:80

# Guacamole Database
GUACAMOLE_DB_NAME=guacamole_db
GUACAMOLE_DB_USER=guacamole_user
GUACAMOLE_DB_PASSWORD=your_guacamole_db_password

# Admin User (will be created on first run)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme

# SSH Default User (for terminal access)
DEFAULT_SSH_USER=root
DEFAULT_SSH_PASS=
EOF

# Create nginx configuration
cat > nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    upstream backend {
        server backend:3001;
    }
    
    upstream ttyd {
        server ttyd:3000;
    }
    
    upstream guacamole {
        server guacamole:8080;
    }

    server {
        listen 80;
        server_name _;
        
        # Redirect to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl;
        server_name _;
        
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        
        # Frontend
        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
        }
        
        # Backend API
        location /api {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # WebSocket for Backend
        location /api/terminal-session {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        
        # ttyd Terminal
        location /terminal/ {
            proxy_pass http://ttyd/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        
        # Guacamole
        location /guacamole/ {
            proxy_pass http://guacamole:8080/guacamole/;
            proxy_buffering off;
            proxy_http_version 1.1;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $http_connection;
            access_log off;
        }
    }
}
EOF

# Create installation script
cat > install.sh << 'EOF'
#!/bin/bash

echo "========================================="
echo "Web Appliance Dashboard Installation"
echo "========================================="

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env from example
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    
    # Generate secure passwords
    echo "🔐 Generating secure passwords..."
    sed -i.bak "s/your_secure_root_password/$(openssl rand -base64 32 | tr -d '=')/g" .env
    sed -i.bak "s/your_secure_db_password/$(openssl rand -base64 32 | tr -d '=')/g" .env
    sed -i.bak "s/your_jwt_secret_key_here/$(openssl rand -base64 32 | tr -d '=')/g" .env
    sed -i.bak "s/your_ssh_encryption_key_here/$(openssl rand -base64 32 | tr -d '=')/g" .env
    sed -i.bak "s/your_guacamole_db_password/$(openssl rand -base64 32 | tr -d '=')/g" .env
    rm -f .env.bak
    
    echo "✅ .env file created with secure defaults"
    echo "⚠️  Please edit .env to set your admin password!"
fi

# Generate SSL certificate
if [ ! -d ssl ]; then
    echo "🔒 Generating self-signed SSL certificate..."
    mkdir -p ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/key.pem \
        -out ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" \
        2>/dev/null
    echo "✅ SSL certificate generated"
fi

# Login to GitHub Container Registry
echo ""
echo "🔑 Please login to GitHub Container Registry"
echo "You need the access token provided by Alflewerken"
echo ""
read -p "GitHub Username: " github_user
read -s -p "Access Token: " github_token
echo ""

echo "$github_token" | docker login ghcr.io -u "$github_user" --password-stdin

if [ $? -ne 0 ]; then
    echo "❌ Login failed. Please check your credentials."
    exit 1
fi

echo "✅ Successfully logged in to GitHub Container Registry"

# Pull images
echo "📥 Pulling Docker images..."
docker-compose pull

# Start services
echo "🚀 Starting services..."
docker-compose up -d

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 30

# Check health
echo "🏥 Checking service health..."
docker-compose ps

echo ""
echo "========================================="
echo "✅ Installation Complete!"
echo "========================================="
echo ""
echo "Access the dashboard at: https://localhost"
echo "Default login: admin / (password from .env)"
echo ""
echo "Services:"
echo "  - Dashboard: https://localhost"
echo "  - API: https://localhost/api"
echo "  - Terminal: https://localhost/terminal/"
echo "  - Remote Desktop: https://localhost/guacamole/"
echo ""
echo "For help: docker-compose logs -f"
echo ""
EOF

chmod +x install.sh

# Create README
cat > README.md << 'EOF'
# Web Appliance Dashboard

## Quick Start

1. Run the installation script:
   ```bash
   ./install.sh
   ```

2. Access the dashboard at https://localhost

## Manual Installation

1. Copy `.env.example` to `.env` and configure
2. Generate SSL certificates in `ssl/` directory
3. Login to GitHub Container Registry
4. Run `docker-compose up -d`

## Services Included

- **Dashboard**: Web-based management interface
- **API Backend**: Node.js backend with SSH tools
- **Terminal**: Web-based SSH terminal (ttyd)
- **Remote Desktop**: Guacamole for RDP/VNC access
- **RustDesk**: Modern remote desktop solution (optional)

## Configuration

Edit `.env` file for:
- Database passwords
- JWT secrets
- Admin credentials
- CORS origins

## Support

Contact: support@alflewerken.com
EOF

# Create uninstall script
cat > uninstall.sh << 'EOF'
#!/bin/bash

echo "⚠️  This will remove all containers and data!"
read -p "Are you sure? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose down -v
    echo "✅ All containers and volumes removed"
fi
EOF

chmod +x uninstall.sh

# Package everything
cd ..
tar -czf "$PACKAGE_NAME.tar.gz" "$PACKAGE_NAME/"

echo ""
echo "========================================="
echo "✅ Customer package created successfully!"
echo "========================================="
echo ""
echo "Package: $PACKAGE_DIR/$PACKAGE_NAME.tar.gz"
echo ""
echo "The package contains:"
echo "  - docker-compose.yml"
echo "  - .env.example"
echo "  - nginx.conf"
echo "  - install.sh"
echo "  - uninstall.sh"
echo "  - README.md"
echo ""
echo "To deploy to customer:"
echo "1. Send the .tar.gz file"
echo "2. Provide GitHub access token"
echo "3. Customer runs: tar -xzf $PACKAGE_NAME.tar.gz && cd $PACKAGE_NAME && ./install.sh"
echo ""
