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
echo ""

# Get GitHub credentials
echo "Enter GitHub access credentials for this customer:"
read -p "GitHub Username: " GITHUB_USER
read -s -p "GitHub Access Token: " GITHUB_TOKEN
echo ""
echo ""

# Validate token is not empty
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Error: GitHub token cannot be empty"
    exit 1
fi

echo "✅ Credentials received"
echo ""

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
    depends_on:
      - backend
      - frontend
      - ttyd
      - guacamole
    networks:
      - appliance_network

  # Frontend static files server
  frontend:
    image: ghcr.io/alflewerken/web-appliance-dashboard-frontend:latest
    container_name: appliance_frontend
    restart: always
    networks:
      - appliance_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  db_data:
  backend_uploads:
  backend_logs:
  ssh_keys:
  guacamole_home:
  guacamole_postgres_data:
  rustdesk_data:

networks:
  appliance_network:
    driver: bridge
EOF

# Generate passwords for .env
MYSQL_ROOT_PWD=$(openssl rand -hex 32)
MYSQL_PWD=$(openssl rand -hex 32)
DB_PWD=$(openssl rand -hex 32)
JWT=$(openssl rand -hex 32)
SSH_KEY=$(openssl rand -hex 32)
GUAC_PWD=$(openssl rand -hex 32)

# Create .env.example with pre-generated passwords
cat > .env.example << EOF
# Database Configuration
MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PWD
MYSQL_DATABASE=appliance_dashboard
MYSQL_USER=appliance_user
MYSQL_PASSWORD=$MYSQL_PWD

# Backend Database Connection
DB_HOST=database
DB_PORT=3306
DB_USER=appliance_user
DB_PASSWORD=$DB_PWD
DB_NAME=appliance_dashboard

# Security Keys
JWT_SECRET=$JWT
SSH_KEY_ENCRYPTION_SECRET=$SSH_KEY

# CORS Configuration
ALLOWED_ORIGINS=http://localhost,http://localhost:80,https://localhost,https://localhost:443

# Guacamole Database
GUACAMOLE_DB_NAME=guacamole_db
GUACAMOLE_DB_USER=guacamole_user
GUACAMOLE_DB_PASSWORD=$GUAC_PWD

# Admin User (will be created on first run)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

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
    
    upstream frontend {
        server frontend:80;
    }

    server {
        listen 80;
        server_name _;
        
        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
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

    server {
        listen 443 ssl;
        server_name _;
        
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        
        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
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

# Create the auth string for Docker
AUTH_STRING=$(echo -n "$GITHUB_USER:$GITHUB_TOKEN" | base64)

# Create installation script with embedded credentials
cat > install.sh << EOF
#!/bin/bash

echo "========================================="
echo "Web Appliance Dashboard Installation"
echo "========================================="

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check Docker Compose
COMPOSE_COMMAND=""
if docker compose version &> /dev/null; then
    COMPOSE_COMMAND="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_COMMAND="docker-compose"
else
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Using Docker Compose command: \$COMPOSE_COMMAND"

# Create .env from example
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created with secure defaults"
fi

# Generate SSL certificate
if [ ! -d ssl ]; then
    echo "🔒 Generating self-signed SSL certificate..."
    mkdir -p ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\
        -keyout ssl/key.pem \\
        -out ssl/cert.pem \\
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" \\
        2>/dev/null
    echo "✅ SSL certificate generated"
fi

# Setup Docker authentication (works around macOS keychain issues)
echo ""
echo "🔑 Setting up GitHub Container Registry access..."

# Create docker config directory
mkdir -p ~/.docker

# Check if we're on macOS
if [[ "\$(uname)" == "Darwin" ]]; then
    echo "📱 Detected macOS - using manual authentication method"
    
    # Backup existing config
    if [ -f ~/.docker/config.json ]; then
        cp ~/.docker/config.json ~/.docker/config.json.backup
    fi
    
    # Create config with auth directly (bypasses keychain)
    cat > ~/.docker/config.json << 'DOCKEREOF'
{
  "auths": {
    "ghcr.io": {
      "auth": "$AUTH_STRING"
    }
  }
}
DOCKEREOF
    
    echo "✅ Docker authentication configured"
else
    # For Linux, try normal login first
    echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USER" --password-stdin 2>/dev/null || {
        echo "⚠️  Standard login failed, using manual method..."
        cat > ~/.docker/config.json << 'DOCKEREOF'
{
  "auths": {
    "ghcr.io": {
      "auth": "$AUTH_STRING"
    }
  }
}
DOCKEREOF
    }
fi

# Test authentication by trying to pull one image
echo "🔍 Testing registry access..."
if docker pull ghcr.io/alflewerken/web-appliance-dashboard-backend:latest &> /dev/null; then
    echo "✅ Successfully authenticated with GitHub Container Registry"
else
    echo "❌ Authentication test failed."
    echo ""
    echo "Troubleshooting steps:"
    echo "1. Try manual login:"
    echo "   docker login ghcr.io -u $GITHUB_USER"
    echo "   Password: [use your access token]"
    echo ""
    echo "2. If on macOS, disable keychain in Docker Desktop:"
    echo "   Docker Desktop → Settings → General"
    echo "   Uncheck 'Securely store Docker logins in macOS keychain'"
    echo ""
    echo "3. Contact support with this error"
    exit 1
fi

# Pull all images
echo ""
echo "📥 Pulling Docker images..."
echo "This may take a few minutes depending on your internet speed..."

\$COMPOSE_COMMAND pull || {
    echo "❌ Failed to pull images."
    echo "Please check your internet connection and try again."
    exit 1
}

# Start services
echo ""
echo "🚀 Starting services..."
\$COMPOSE_COMMAND up -d

# Wait for services with progress indicator
echo ""
echo "⏳ Waiting for services to start..."
for i in {1..30}; do
    echo -n "."
    sleep 1
done
echo ""

# Check health
echo ""
echo "🏥 Checking service health..."
\$COMPOSE_COMMAND ps

# Check if services are actually running
BACKEND_RUNNING=\$(\$COMPOSE_COMMAND ps backend | grep -c "Up")
WEBSERVER_RUNNING=\$(\$COMPOSE_COMMAND ps webserver | grep -c "Up")

if [ "\$BACKEND_RUNNING" -eq 0 ] || [ "\$WEBSERVER_RUNNING" -eq 0 ]; then
    echo ""
    echo "⚠️  Some services didn't start properly."
    echo "Check logs with: \$COMPOSE_COMMAND logs"
else
    echo ""
    echo "========================================="
    echo "✅ Installation Complete!"
    echo "========================================="
    echo ""
    echo "Access the dashboard at:"
    echo "  📌 http://localhost"
    echo "  🔒 https://localhost (self-signed cert warning is normal)"
    echo ""
    echo "Login credentials:"
    echo "  👤 Username: admin"
    echo "  🔑 Password: admin123"
    echo ""
    echo "Available services:"
    echo "  📊 Dashboard: https://localhost"
    echo "  🔌 API: https://localhost/api"
    echo "  💻 Terminal: https://localhost/terminal/"
    echo "  🖥️  Remote Desktop: https://localhost/guacamole/"
    echo ""
    echo "Useful commands:"
    echo "  View logs: \$COMPOSE_COMMAND logs -f"
    echo "  Stop services: \$COMPOSE_COMMAND stop"
    echo "  Start services: \$COMPOSE_COMMAND start"
    echo "  Restart services: \$COMPOSE_COMMAND restart"
    echo "  Remove everything: ./uninstall.sh"
    echo ""
fi
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
   - Username: **admin**
   - Password: **admin123**

## System Requirements

- Docker Desktop (macOS/Windows) or Docker Engine (Linux)
- Docker Compose
- 4GB RAM minimum
- 10GB free disk space

## Services Included

- **Dashboard**: Web-based management interface
- **API Backend**: Node.js backend with SSH tools
- **Terminal**: Web-based SSH terminal
- **Remote Desktop**: Guacamole for RDP/VNC access
- **Database**: MariaDB for data storage

## Troubleshooting

### Docker Login Issues (macOS)

If you see "Error saving credentials", try:

1. Open Docker Desktop → Settings → General
2. Uncheck "Securely store Docker logins in macOS keychain"
3. Apply & Restart
4. Run `./install.sh` again

### Manual Docker Login

If automatic login fails:
```bash
docker login ghcr.io
Username: [provided username]
Password: [provided token]
```

### View Logs

To see what's happening:
```bash
docker-compose logs -f
# Or for specific service:
docker-compose logs -f backend
```

### Port Conflicts

If ports 80/443 are already in use:
1. Stop conflicting services, or
2. Edit `docker-compose.yml` to change ports:
   ```yaml
   ports:
     - "8080:80"
     - "8443:443"
   ```

## Daily Operations

### Start Services
```bash
docker-compose start
```

### Stop Services
```bash
docker-compose stop
```

### Restart Services
```bash
docker-compose restart
```

### Update Images
```bash
docker-compose pull
docker-compose up -d
```

### Backup Data
```bash
docker-compose exec database mysqldump -u root -p appliance_dashboard > backup.sql
```

## Support

- Email: support@alflewerken.com
- Documentation: [Coming Soon]

## Uninstall

To completely remove the installation:
```bash
./uninstall.sh
```

⚠️ **Warning**: This will delete all data!
EOF

# Create uninstall script
cat > uninstall.sh << 'EOF'
#!/bin/bash

echo "========================================="
echo "Web Appliance Dashboard Uninstaller"
echo "========================================="
echo ""
echo "⚠️  WARNING: This will remove:"
echo "   - All containers"
echo "   - All volumes (INCLUDING YOUR DATA)"
echo "   - Docker images"
echo ""
read -p "Are you SURE you want to continue? Type 'yes' to confirm: " -r CONFIRM

if [[ "$CONFIRM" != "yes" ]]; then
    echo "❌ Uninstall cancelled"
    exit 0
fi

# Detect compose command
if docker compose version &> /dev/null; then
    COMPOSE_COMMAND="docker compose"
else
    COMPOSE_COMMAND="docker-compose"
fi

echo ""
echo "🛑 Stopping services..."
$COMPOSE_COMMAND down -v

echo "🗑️  Removing images..."
$COMPOSE_COMMAND down --rmi all

echo "🧹 Cleaning up SSL certificates..."
rm -rf ssl/

echo ""
echo "✅ Uninstall complete!"
echo ""
echo "Note: The .env file was preserved in case you need it."
echo "To remove it: rm .env"
EOF

chmod +x uninstall.sh

# Create a fix-docker-login.sh helper script
cat > fix-docker-login.sh << 'EOF'
#!/bin/bash

echo "🔧 Docker Login Helper for macOS"
echo "================================"
echo ""
echo "This script helps fix Docker login issues on macOS."
echo ""

# Backup current config
if [ -f ~/.docker/config.json ]; then
    cp ~/.docker/config.json ~/.docker/config.json.backup
    echo "✅ Backed up existing Docker config"
fi

# Remove the credsStore to avoid keychain issues
if grep -q "credsStore" ~/.docker/config.json 2>/dev/null; then
    echo "🔧 Removing credential store from Docker config..."
    # Use python to safely modify JSON
    python3 -c "
import json
with open('$HOME/.docker/config.json', 'r') as f:
    config = json.load(f)
if 'credsStore' in config:
    del config['credsStore']
with open('$HOME/.docker/config.json', 'w') as f:
    json.dump(config, f, indent=2)
"
    echo "✅ Credential store removed"
fi

echo ""
echo "Now try running ./install.sh again"
echo ""
echo "If it still fails, you can manually login:"
echo "  docker login ghcr.io"
echo "  Username: [provided username]"
echo "  Password: [provided token]"
EOF

chmod +x fix-docker-login.sh

# Package everything
cd ..
tar -czf "$PACKAGE_NAME.tar.gz" "$PACKAGE_NAME/"

echo ""
echo "========================================="
echo "✅ Customer package created successfully!"
echo "========================================="
echo ""
echo "📦 Package: $PACKAGE_DIR/$PACKAGE_NAME.tar.gz"
echo ""
echo "This package includes:"
echo "  ✓ docker-compose.yml - Service definitions"
echo "  ✓ .env.example - Pre-configured environment"
echo "  ✓ nginx.conf - Web server configuration"
echo "  ✓ install.sh - Automated installer (macOS compatible)"
echo "  ✓ uninstall.sh - Clean removal script"
echo "  ✓ fix-docker-login.sh - macOS helper script"
echo "  ✓ README.md - Complete documentation"
echo ""
echo "📋 Deployment info:"
echo "  • GitHub User: $GITHUB_USER"
echo "  • Auth Token: [EMBEDDED]"
echo "  • Admin Login: admin / admin123"
echo ""
echo "🚀 Customer instructions:"
echo "  1. Extract: tar -xzf $PACKAGE_NAME.tar.gz"
echo "  2. Install: cd $PACKAGE_NAME && ./install.sh"
echo "  3. Access: https://localhost (admin/admin123)"
echo ""
echo "✨ Features:"
echo "  • Automatic macOS keychain workaround"
echo "  • No manual input required"
echo "  • Self-signed SSL included"
echo "  • Complete error handling"
echo ""
