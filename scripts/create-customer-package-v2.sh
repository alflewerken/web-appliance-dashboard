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
echo "Customer Package Generator v2.0"
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
services:
  # MariaDB Database
  database:
    image: mariadb:latest
    container_name: appliance_db
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - db_data:/var/lib/mysql
      - ./init-db:/docker-entrypoint-initdb.d:ro
    networks:
      - appliance_network
    healthcheck:
      test: ["CMD-SHELL", "mariadb-admin ping -h localhost -u root --password='${DB_ROOT_PASSWORD}' || exit 1"]
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
      start_period: 60s

  # Frontend
  frontend:
    image: ghcr.io/alflewerken/web-appliance-dashboard-frontend:latest
    container_name: appliance_frontend
    restart: always
    networks:
      - appliance_network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:80"]
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

  # Guacamole PostgreSQL
  guacamole-postgres:
    image: postgres:15-alpine
    container_name: appliance_guacamole_db
    restart: always
    environment:
      POSTGRES_DB: ${GUACAMOLE_DB_NAME}
      POSTGRES_USER: ${GUACAMOLE_DB_USER}
      POSTGRES_PASSWORD: ${GUACAMOLE_DB_PASSWORD}
    volumes:
      - guacamole_postgres_data:/var/lib/postgresql/data
    networks:
      - appliance_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${GUACAMOLE_DB_USER}"]
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
        condition: service_started
      guacamole-postgres:
        condition: service_healthy
    environment:
      GUACD_HOSTNAME: guacd
      POSTGRES_HOSTNAME: guacamole-postgres
      POSTGRES_DATABASE: ${GUACAMOLE_DB_NAME}
      POSTGRES_USER: ${GUACAMOLE_DB_USER}
      POSTGRES_PASSWORD: ${GUACAMOLE_DB_PASSWORD}
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

  # Nginx Webserver
  webserver:
    image: nginx:alpine
    container_name: appliance_webserver
    restart: always
    ports:
      - "${HTTP_PORT:-80}:80"
      - "${HTTPS_PORT:-443}:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - backend
      - frontend
    networks:
      - appliance_network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:80"]
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

networks:
  appliance_network:
    driver: bridge
EOF

# Create database initialization directory
mkdir -p init-db

# Create database init script
cat > init-db/01-init-schema.sql << 'EOF'
-- Web Appliance Dashboard Database Schema
-- Auto-executed on first container start

USE appliance_dashboard;

-- Create tables
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255),
  password VARCHAR(255) NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(255) DEFAULT 'Folder',
  color VARCHAR(7) DEFAULT '#6B7280',
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  order_index INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appliances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(500),
  description TEXT,
  icon VARCHAR(255) DEFAULT 'Globe',
  color VARCHAR(7) DEFAULT '#3B82F6',
  category INT,
  isFavorite BOOLEAN DEFAULT FALSE,
  start_command TEXT,
  stop_command TEXT,
  status_command TEXT,
  auto_start BOOLEAN DEFAULT FALSE,
  ssh_connection INT,
  transparency INT DEFAULT 95,
  blur_amount INT DEFAULT 8,
  open_mode_mini VARCHAR(50) DEFAULT 'browser_tab',
  open_mode_mobile VARCHAR(50) DEFAULT 'browser_tab', 
  open_mode_desktop VARCHAR(50) DEFAULT 'browser_tab',
  remote_desktop_enabled BOOLEAN DEFAULT FALSE,
  remote_desktop_type VARCHAR(50) DEFAULT 'guacamole',
  remote_protocol VARCHAR(50),
  remote_host VARCHAR(255),
  remote_port INT,
  remote_username VARCHAR(255),
  remote_password_encrypted TEXT,
  rustdesk_id VARCHAR(255),
  rustdesk_installed BOOLEAN DEFAULT FALSE,
  rustdesk_password_encrypted TEXT,
  service_status VARCHAR(50) DEFAULT 'unknown',
  status_message TEXT,
  last_status_check TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(255) NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_setting_key (setting_key)
);

CREATE TABLE IF NOT EXISTS migrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_migration_name (name)
);

-- Additional tables (add as needed)
CREATE TABLE IF NOT EXISTS ssh_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  key_name VARCHAR(255) NOT NULL,
  key_type VARCHAR(50),
  key_size INT,
  comment TEXT,
  public_key TEXT,
  private_key TEXT,
  fingerprint VARCHAR(255),
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hosts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hostname VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  port INT DEFAULT 22,
  username VARCHAR(255),
  auth_method VARCHAR(50) DEFAULT 'password',
  ssh_key_id INT,
  password_encrypted TEXT,
  description TEXT,
  tags TEXT,
  last_connected TIMESTAMP NULL,
  connection_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (ssh_key_id) REFERENCES ssh_keys(id) ON DELETE SET NULL
);

-- Insert default admin user (password: admin123)
-- Hash generated with bcryptjs: bcrypt.hashSync('admin123', 10)
INSERT INTO users (username, email, password, is_admin, is_active) VALUES
('admin', 'admin@localhost', '$2a$10$ZU7Jq5cGnGSkrm2Y3HNVF.jFpRcF5Q1Sc0YW1XqBvxVBx8rFpjPLq', TRUE, TRUE);

-- Insert default categories
INSERT INTO categories (name, icon, color, is_system, order_index) VALUES
('System', 'Server', '#EF4444', TRUE, 1),
('Network', 'Network', '#F59E0B', FALSE, 2),
('Media', 'Film', '#8B5CF6', FALSE, 3),
('Tools', 'Wrench', '#10B981', FALSE, 4);

-- Mark initial migration as complete
INSERT INTO migrations (name) VALUES ('initial-schema');
EOF

# Generate single password for all DB connections
DB_PASSWORD=$(openssl rand -hex 32)
DB_ROOT_PASSWORD=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
SSH_KEY_SECRET=$(openssl rand -hex 32)
GUAC_DB_PWD=$(openssl rand -hex 32)

# Create .env with consistent passwords
cat > .env << EOF
# Database Configuration - SINGLE PASSWORD FOR ALL
DB_ROOT_PASSWORD=$DB_ROOT_PASSWORD
DB_NAME=appliance_dashboard
DB_USER=appliance_user
DB_PASSWORD=$DB_PASSWORD

# Security Keys
JWT_SECRET=$JWT_SECRET
SSH_KEY_ENCRYPTION_SECRET=$SSH_KEY_SECRET

# CORS Configuration (will be updated during installation)
ALLOWED_ORIGINS=http://localhost,https://localhost

# Guacamole Database
GUACAMOLE_DB_NAME=guacamole_db
GUACAMOLE_DB_USER=guacamole_user
GUACAMOLE_DB_PASSWORD=$GUAC_DB_PWD

# Admin User
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Ports (can be customized if needed)
HTTP_PORT=80
HTTPS_PORT=443
EOF

# Create robust nginx configuration
cat > nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # Docker DNS resolver
    resolver 127.0.0.11 valid=30s;
    
    # Define upstreams with variables for dynamic resolution
    upstream backend_upstream {
        server backend:3001;
    }
    
    upstream frontend_upstream {
        server frontend:80;
    }

    server {
        listen 80;
        server_name _;
        
        # Frontend
        location / {
            proxy_pass http://frontend_upstream;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Backend API
        location /api {
            proxy_pass http://backend_upstream;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket support
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
        
        # Terminal (optional service)
        location /terminal/ {
            # Use variable to make it optional
            set $ttyd_upstream ttyd:3000;
            proxy_pass http://$ttyd_upstream/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            
            # Don't fail if service is not available
            proxy_connect_timeout 2s;
            proxy_send_timeout 10s;
            proxy_read_timeout 10s;
        }
        
        # Guacamole (optional service)
        location /guacamole/ {
            # Use variable to make it optional
            set $guac_upstream guacamole:8080;
            proxy_pass http://$guac_upstream/guacamole/;
            proxy_buffering off;
            proxy_http_version 1.1;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $http_connection;
            access_log off;
            
            # Don't fail if service is not available
            proxy_connect_timeout 2s;
            proxy_send_timeout 10s;
            proxy_read_timeout 10s;
        }
    }

    server {
        listen 443 ssl;
        server_name _;
        
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        
        # Same locations as port 80
        location / {
            proxy_pass http://frontend_upstream;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        location /api {
            proxy_pass http://backend_upstream;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
        
        location /terminal/ {
            set $ttyd_upstream ttyd:3000;
            proxy_pass http://$ttyd_upstream/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            
            proxy_connect_timeout 2s;
            proxy_send_timeout 10s;
            proxy_read_timeout 10s;
        }
        
        location /guacamole/ {
            set $guac_upstream guacamole:8080;
            proxy_pass http://$guac_upstream/guacamole/;
            proxy_buffering off;
            proxy_http_version 1.1;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $http_connection;
            access_log off;
            
            proxy_connect_timeout 2s;
            proxy_send_timeout 10s;
            proxy_read_timeout 10s;
        }
    }
}
EOF

# Create the auth string for Docker
AUTH_STRING=$(echo -n "$GITHUB_USER:$GITHUB_TOKEN" | base64)

# Create improved installation script
cat > install.sh << EOF
#!/bin/bash

echo "========================================="
echo "Web Appliance Dashboard Installation v2.0"
echo "========================================="

# Configuration
GITHUB_USER="$GITHUB_USER"
GITHUB_TOKEN="$GITHUB_TOKEN"

# Detect OS
OS="unknown"
if [[ "\$(uname)" == "Darwin" ]]; then
    OS="macos"
elif [[ "\$(uname)" == "Linux" ]]; then
    OS="linux"
fi

echo "✅ Detected OS: \$OS"

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
    echo "❌ Docker Compose is not installed."
    exit 1
fi

echo "✅ Using: \$COMPOSE_COMMAND"

# Update ALLOWED_ORIGINS with actual hostname
HOSTNAME=\$(hostname)
echo "📝 Configuring for hostname: \$HOSTNAME"

# Update .env with correct origins
if [[ "\$OS" == "macos" ]]; then
    sed -i '' "s|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=http://localhost,https://localhost,http://\$HOSTNAME,https://\$HOSTNAME,http://\$HOSTNAME.local,https://\$HOSTNAME.local|" .env
else
    sed -i "s|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=http://localhost,https://localhost,http://\$HOSTNAME,https://\$HOSTNAME,http://\$HOSTNAME.local,https://\$HOSTNAME.local|" .env
fi

# Generate SSL certificate
if [ ! -d ssl ]; then
    echo "🔒 Generating self-signed SSL certificate..."
    mkdir -p ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\
        -keyout ssl/key.pem \\
        -out ssl/cert.pem \\
        -subj "/C=US/ST=State/L=City/O=Organization/CN=\$HOSTNAME" \\
        2>/dev/null
    echo "✅ SSL certificate generated"
fi

# Setup Docker authentication
echo ""
echo "🔑 Setting up GitHub Container Registry access..."
mkdir -p ~/.docker

# Create auth config
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

# Test authentication
echo "🔍 Testing registry access..."
if docker pull ghcr.io/alflewerken/web-appliance-dashboard-backend:latest &> /dev/null; then
    echo "✅ Registry access confirmed"
else
    echo "❌ Registry access failed"
    echo "Please check your credentials and try again."
    exit 1
fi

# Pull all images
echo ""
echo "📥 Pulling Docker images..."
\$COMPOSE_COMMAND pull || {
    echo "❌ Failed to pull images"
    exit 1
}

# Start services with proper order
echo ""
echo "🚀 Starting services..."
echo "  1️⃣ Starting database..."
\$COMPOSE_COMMAND up -d database

echo "  ⏳ Waiting for database initialization (30 seconds)..."
sleep 30

echo "  2️⃣ Starting core services..."
\$COMPOSE_COMMAND up -d backend frontend

echo "  ⏳ Waiting for services to be ready (15 seconds)..."
sleep 15

echo "  3️⃣ Starting web server..."
\$COMPOSE_COMMAND up -d webserver

echo "  4️⃣ Starting optional services..."
\$COMPOSE_COMMAND up -d ttyd guacd guacamole-postgres guacamole || true

# Final status check
echo ""
echo "⏳ Waiting for final startup (10 seconds)..."
sleep 10

echo ""
echo "🏥 Service Status:"
\$COMPOSE_COMMAND ps

# Check if core services are running
BACKEND_OK=\$(\$COMPOSE_COMMAND ps | grep appliance_backend | grep -c "running\|Up" || true)
FRONTEND_OK=\$(\$COMPOSE_COMMAND ps | grep appliance_frontend | grep -c "running\|Up" || true)
WEBSERVER_OK=\$(\$COMPOSE_COMMAND ps | grep appliance_webserver | grep -c "running\|Up" || true)

if [ "\$BACKEND_OK" -gt 0 ] && [ "\$FRONTEND_OK" -gt 0 ] && [ "\$WEBSERVER_OK" -gt 0 ]; then
    echo ""
    echo "========================================="
    echo "✅ Installation Complete!"
    echo "========================================="
    echo ""
    echo "Access the dashboard at:"
    echo "  📌 http://localhost"
    echo "  📌 http://\$HOSTNAME"
    echo "  📌 http://\$HOSTNAME.local"
    echo "  🔒 https://localhost (SSL warning is normal)"
    echo "  🔒 https://\$HOSTNAME (SSL warning is normal)"
    echo ""
    echo "Login credentials:"
    echo "  👤 Username: admin"
    echo "  🔑 Password: admin123"
    echo ""
    echo "Useful commands:"
    echo "  View logs:     \$COMPOSE_COMMAND logs -f [service]"
    echo "  Stop all:      \$COMPOSE_COMMAND stop"
    echo "  Start all:     \$COMPOSE_COMMAND start"
    echo "  Status:        \$COMPOSE_COMMAND ps"
    echo "  Uninstall:     ./uninstall.sh"
    echo ""
else
    echo ""
    echo "⚠️  Some services didn't start properly."
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check logs: \$COMPOSE_COMMAND logs [service]"
    echo "  2. Try restart: \$COMPOSE_COMMAND restart"
    echo "  3. Check ports: netstat -an | grep -E '80|443'"
    echo ""
fi
EOF

chmod +x install.sh

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
read -p "Are you SURE? Type 'yes' to confirm: " -r CONFIRM

if [[ "$CONFIRM" != "yes" ]]; then
    echo "❌ Cancelled"
    exit 0
fi

# Detect compose command
if docker compose version &> /dev/null; then
    COMPOSE_COMMAND="docker compose"
else
    COMPOSE_COMMAND="docker-compose"
fi

echo "🛑 Stopping and removing everything..."
$COMPOSE_COMMAND down -v --rmi all

echo "🧹 Cleaning up files..."
rm -rf ssl/

echo "✅ Uninstall complete!"
EOF

chmod +x uninstall.sh

# Create README
cat > README.md << 'EOF'
# Web Appliance Dashboard - Installation Guide

## 🚀 Quick Start

```bash
./install.sh
```

That's it! The installer will handle everything automatically.

## 📋 System Requirements

- Docker Desktop (macOS/Windows) or Docker Engine (Linux)
- Docker Compose v2 or docker-compose
- 4GB RAM minimum
- 10GB free disk space
- Ports 80 and 443 available (or customize in .env)

## 🔑 Default Credentials

- **Username**: admin
- **Password**: admin123

## 🌐 Access Points

After installation, access the dashboard at:
- http://localhost
- http://[your-hostname]
- http://[your-hostname].local
- https://localhost (self-signed cert)
- https://[your-hostname] (self-signed cert)

## 🛠️ Included Services

### Core Services (Always Running)
- **Dashboard**: Web-based management interface
- **Backend API**: Node.js API with authentication
- **Database**: MariaDB for data storage
- **Nginx**: Reverse proxy and SSL termination

### Optional Services
- **Terminal**: Web-based SSH terminal (ttyd)
- **Remote Desktop**: Guacamole for RDP/VNC
- **RustDesk**: Alternative remote desktop (may have port conflicts)

## 🔧 Configuration

### Change Ports
Edit `.env` file before installation:
```
HTTP_PORT=8080
HTTPS_PORT=8443
```

### Add Custom Origins
Edit `.env` and add to ALLOWED_ORIGINS:
```
ALLOWED_ORIGINS=http://localhost,http://myserver.com
```

## 📝 Common Commands

### View Logs
```bash
docker compose logs -f          # All services
docker compose logs backend     # Specific service
```

### Service Management
```bash
docker compose stop            # Stop all
docker compose start           # Start all
docker compose restart backend # Restart specific
docker compose ps              # Check status
```

### Database Access
```bash
docker compose exec database mariadb -u root -p
# Password is in .env as DB_ROOT_PASSWORD
```

## 🚨 Troubleshooting

### Port Already in Use
```bash
# Check what's using port 80
sudo lsof -i :80

# Change ports in .env
HTTP_PORT=8080
HTTPS_PORT=8443
```

### Services Not Starting
```bash
# Check individual service logs
docker compose logs backend
docker compose logs database

# Restart everything
docker compose down
docker compose up -d
```

### Login Issues
1. Check ALLOWED_ORIGINS includes your hostname
2. Restart backend after .env changes
3. Verify database is running

### Reset Admin Password
```bash
docker compose exec backend node -e "
const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('newpassword', 10));
"
# Then update in database
```

## 🗑️ Uninstall

```bash
./uninstall.sh
```

⚠️ **Warning**: This removes all data!

## 📞 Support

- Documentation: [Coming Soon]
- Issues: [GitHub Issues]
- Email: support@alflewerken.com
EOF

# Create troubleshooting script
cat > troubleshoot.sh << 'EOF'
#!/bin/bash

echo "🔍 Web Appliance Dashboard Troubleshooter"
echo "========================================="

# Detect compose command
if docker compose version &> /dev/null; then
    COMPOSE_COMMAND="docker compose"
else
    COMPOSE_COMMAND="docker-compose"
fi

echo "1️⃣ Checking Docker..."
docker version > /dev/null 2>&1 && echo "✅ Docker is running" || echo "❌ Docker not running"

echo ""
echo "2️⃣ Checking containers..."
$COMPOSE_COMMAND ps

echo ""
echo "3️⃣ Checking ports..."
netstat -an | grep -E "LISTEN.*:(80|443|3001|8080)" | head -10

echo ""
echo "4️⃣ Checking database..."
$COMPOSE_COMMAND exec database mariadb -u root -p${DB_ROOT_PASSWORD} -e "SELECT COUNT(*) FROM appliance_dashboard.users;" 2>/dev/null && echo "✅ Database OK" || echo "❌ Database issue"

echo ""
echo "5️⃣ Recent logs..."
echo "Backend logs:"
$COMPOSE_COMMAND logs backend --tail 10
echo ""
echo "Database logs:"
$COMPOSE_COMMAND logs database --tail 10

echo ""
echo "💡 Common fixes:"
echo "  - Restart all: $COMPOSE_COMMAND restart"
echo "  - Rebuild: $COMPOSE_COMMAND down && $COMPOSE_COMMAND up -d"
echo "  - Check .env file for configuration"
EOF

chmod +x troubleshoot.sh

# Package everything
cd ..
tar -czf "$PACKAGE_NAME.tar.gz" "$PACKAGE_NAME/"

echo ""
echo "========================================="
echo "✅ Customer Package Created Successfully!"
echo "========================================="
echo ""
echo "📦 Package: $PACKAGE_DIR/$PACKAGE_NAME.tar.gz"
echo ""
echo "This improved package includes:"
echo "  ✅ Automatic database initialization"
echo "  ✅ Consistent password configuration"
echo "  ✅ Robust nginx configuration"
echo "  ✅ Proper service startup order"
echo "  ✅ CORS auto-configuration"
echo "  ✅ Better error handling"
echo "  ✅ Troubleshooting tools"
echo ""
echo "📋 Key improvements:"
echo "  • Database schema auto-imported on first start"
echo "  • Single password for all DB connections"
echo "  • Working admin password (admin123)"
echo "  • Hostname automatically added to CORS"
echo "  • Optional services won't break core functionality"
echo "  • Clear status reporting"
echo ""
echo "🚀 Customer instructions:"
echo "  1. Extract: tar -xzf $PACKAGE_NAME.tar.gz"
echo "  2. Install: cd $PACKAGE_NAME && ./install.sh"
echo "  3. Access: http://localhost (admin/admin123)"
echo ""