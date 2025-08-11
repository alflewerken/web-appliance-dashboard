#!/bin/bash
# Create Customer Package Script v3.0
# Open-source version for public repository (no authentication required)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo -e "${GREEN}=== Web Appliance Dashboard Customer Package Creator v3.0 ===${NC}"
echo -e "${GREEN}=== Open Source Edition (MIT License) ===${NC}"
echo ""

# Validate required files
echo "🔍 Validating project structure..."

required_files=(
    "init.sql"
    "docker-compose.yml"
)

for file in "${required_files[@]}"; do
    if [ ! -f "${PROJECT_ROOT}/${file}" ]; then
        echo -e "${RED}❌ Missing required file: ${file}${NC}"
        exit 1
    fi
done

# Create package directory
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="web-appliance-dashboard-${TIMESTAMP}"
PACKAGE_DIR="${PROJECT_ROOT}/customer-package/${PACKAGE_NAME}"

echo "📦 Creating package: ${PACKAGE_NAME}"
mkdir -p "${PACKAGE_DIR}"
cd "${PACKAGE_DIR}"

# Create directory structure
mkdir -p init-db ssl

# Copy init.sql as database initialization script
echo "📄 Copying database schema..."
cp "${PROJECT_ROOT}/init.sql" init-db/01-init-schema.sql

# Add admin password update to ensure admin123 works
cat >> init-db/01-init-schema.sql << 'EOF'

-- Ensure admin user has correct password (admin123)
UPDATE users SET password_hash='$2a$10$ZU7Jq5cGnGSkrm2Y3HNVF.jFpRcF5Q1Sc0YW1XqBvxVBx8rFpjPLq' WHERE username='admin';
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

# Create simplified docker-compose.yml
cat > docker-compose.yml << 'EOF'
services:
  database:
    image: mariadb:latest
    container_name: appliance_db
    hostname: database
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
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "mariadb-admin", "ping", "-h", "localhost", "-u", "root", "-p${DB_ROOT_PASSWORD}"]
      interval: 10s
      timeout: 5s
      retries: 30
      start_period: 30s

  backend:
    image: ghcr.io/alflewerken/web-appliance-dashboard-backend:latest
    container_name: appliance_backend
    hostname: backend
    depends_on:
      database:
        condition: service_healthy
    environment:
      # Database
      DB_HOST: database
      DB_PORT: 3306
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: ${DB_NAME}
      # Security
      JWT_SECRET: ${JWT_SECRET}
      SSH_KEY_ENCRYPTION_SECRET: ${SSH_KEY_ENCRYPTION_SECRET}
      # CORS
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS}
      # Features
      SSH_AUTO_INIT: "true"
      NODE_ENV: production
    volumes:
      - backend_uploads:/app/uploads
      - backend_logs:/app/logs
      - ssh_keys:/app/ssh-keys
    networks:
      - appliance_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s

  webserver:
    image: ghcr.io/alflewerken/web-appliance-dashboard-nginx:latest
    container_name: appliance_webserver
    hostname: webserver
    ports:
      - "${HTTP_PORT}:80"
      - "${HTTPS_PORT}:443"
    depends_on:
      - backend
      - ttyd
      - guacamole
    networks:
      - appliance_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  ttyd:
    image: ghcr.io/alflewerken/web-appliance-dashboard-ttyd:latest
    container_name: appliance_ttyd
    hostname: ttyd
    command: >
      ttyd
      --writable
      --port 7681
      --base-path /
      --terminal-type xterm-256color
      /scripts/ttyd-ssh-wrapper.sh
    environment:
      SSH_PORT: 22
    networks:
      - appliance_network
    volumes:
      - ssh_keys:/root/.ssh
      - terminal_sessions:/tmp/terminal-sessions
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "sh", "-c", "pidof ttyd || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5

  guacd:
    image: guacamole/guacd:latest
    container_name: appliance_guacd
    hostname: guacd
    networks:
      - appliance_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "nc -z localhost 4822 || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5

  guacamole-postgres:
    image: postgres:15-alpine
    container_name: appliance_guacamole_db
    hostname: guacamole-postgres
    environment:
      POSTGRES_DB: ${GUACAMOLE_DB_NAME}
      POSTGRES_USER: ${GUACAMOLE_DB_USER}
      POSTGRES_PASSWORD: ${GUACAMOLE_DB_PASSWORD}
    volumes:
      - guacamole_postgres_data:/var/lib/postgresql/data
    networks:
      - appliance_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${GUACAMOLE_DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  guacamole:
    image: ghcr.io/alflewerken/web-appliance-dashboard-guacamole:latest
    container_name: appliance_guacamole
    hostname: guacamole
    depends_on:
      - guacd
      - guacamole-postgres
    environment:
      GUACD_HOSTNAME: guacd
      POSTGRES_HOSTNAME: guacamole-postgres
      POSTGRES_DATABASE: ${GUACAMOLE_DB_NAME}
      POSTGRES_USER: ${GUACAMOLE_DB_USER}
      POSTGRES_PASSWORD: ${GUACAMOLE_DB_PASSWORD}
      GUACAMOLE_HOME: /guacamole-home
    volumes:
      - guacamole_home:/guacamole-home
    networks:
      - appliance_network
    restart: unless-stopped

networks:
  appliance_network:
    name: appliance_network
    driver: bridge

volumes:
  db_data:
  backend_uploads:
  backend_logs:
  ssh_keys:
  terminal_sessions:
  guacamole_home:
  guacamole_postgres_data:
  rustdesk_data:
EOF

# No nginx.conf needed - using custom Docker image

# Generate self-signed SSL certificate
echo "🔐 Generating self-signed SSL certificate..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" \
    2>/dev/null

# Create install script
cat > install.sh << 'EOF'
#!/bin/bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Web Appliance Dashboard Installer ===${NC}"
echo -e "${GREEN}=== Open Source Edition (MIT License) ===${NC}"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed!${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check Docker Compose
COMPOSE_COMMAND=""
if command -v docker-compose &> /dev/null; then
    COMPOSE_COMMAND="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_COMMAND="docker compose"
else
    echo -e "${RED}❌ Docker Compose is not installed!${NC}"
    exit 1
fi

echo "✅ Using Docker Compose command: $COMPOSE_COMMAND"

# Detect hostname and update CORS
HOSTNAME=$(hostname)
HOSTNAME_FQDN=$(hostname -f 2>/dev/null || hostname)

echo "🌐 Detected hostname: $HOSTNAME"
echo "🌐 Detected FQDN: $HOSTNAME_FQDN"

# Update ALLOWED_ORIGINS in .env - include both lowercase and original case
echo "📝 Updating CORS configuration..."
HOSTNAME_LOWER=$(echo "$HOSTNAME" | tr '[:upper:]' '[:lower:]')
HOSTNAME_FQDN_LOWER=$(echo "$HOSTNAME_FQDN" | tr '[:upper:]' '[:lower:]')

# Build ALLOWED_ORIGINS with both cases
ALLOWED_ORIGINS="http://localhost,https://localhost"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS},http://$HOSTNAME,https://$HOSTNAME"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS},http://$HOSTNAME_LOWER,https://$HOSTNAME_LOWER"
if [ "$HOSTNAME" != "$HOSTNAME_FQDN" ]; then
    ALLOWED_ORIGINS="${ALLOWED_ORIGINS},http://$HOSTNAME_FQDN,https://$HOSTNAME_FQDN"
    ALLOWED_ORIGINS="${ALLOWED_ORIGINS},http://$HOSTNAME_FQDN_LOWER,https://$HOSTNAME_FQDN_LOWER"
fi

sed -i.bak "s|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=$ALLOWED_ORIGINS|" .env

# Update SSL certificate with correct CN
echo "🔐 Regenerating SSL certificate for $HOSTNAME..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$HOSTNAME" \
    2>/dev/null

# NO LOGIN REQUIRED FOR PUBLIC IMAGES
echo ""
echo "📥 Pulling Docker images from public repository..."
echo "ℹ️  No authentication required - images are publicly available"

# Pull images individually to avoid rate limits
echo "   Pulling backend..."
docker pull ghcr.io/alflewerken/web-appliance-dashboard-backend:latest || true

echo "   Pulling nginx webserver..."
docker pull ghcr.io/alflewerken/web-appliance-dashboard-nginx:latest || true

echo "   Pulling terminal (ttyd)..."
docker pull ghcr.io/alflewerken/web-appliance-dashboard-ttyd:latest || true

echo "   Pulling remote desktop (guacamole)..."
docker pull ghcr.io/alflewerken/web-appliance-dashboard-guacamole:latest || true

echo "   Pulling standard images..."
docker pull mariadb:latest || true
docker pull guacamole/guacd:latest || true
docker pull postgres:15-alpine || true

echo ""
echo "✅ Image pull complete (some may have failed but will retry during startup)"

# Start services with proper order
echo ""
echo "🚀 Starting services..."

# Start database first
echo "   Starting database..."
$COMPOSE_COMMAND up -d database

# Wait for database to be ready
echo "   Waiting for database to be ready..."
sleep 10

# Load DB password from .env
DB_ROOT_PWD=$(grep "^DB_ROOT_PASSWORD=" .env | cut -d'=' -f2)

# Check if database is healthy
for i in {1..30}; do
    if $COMPOSE_COMMAND exec database mariadb -u root -p${DB_ROOT_PWD} -e "SELECT 1" &>/dev/null; then
        echo -e "${GREEN}   ✅ Database is ready${NC}"
        break
    fi
    echo "   Waiting for database... ($i/30)"
    sleep 2
done

# Start core services
echo "   Starting core services..."
$COMPOSE_COMMAND up -d backend webserver

# Start optional services (continue even if they fail)
echo "   Starting optional services..."
$COMPOSE_COMMAND up -d ttyd || echo -e "${YELLOW}   ⚠️  Terminal service failed to start${NC}"
$COMPOSE_COMMAND up -d guacd guacamole-postgres guacamole || echo -e "${YELLOW}   ⚠️  Remote desktop service failed to start${NC}"

# Final check
echo ""
echo "🔍 Checking service status..."
$COMPOSE_COMMAND ps

# Check if services are actually running
BACKEND_RUNNING=$($COMPOSE_COMMAND ps | grep "appliance_backend" | grep -c "Up\|running")
WEBSERVER_RUNNING=$($COMPOSE_COMMAND ps | grep "appliance_webserver" | grep -c "Up\|running")

if [ "$BACKEND_RUNNING" -eq 1 ] && [ "$WEBSERVER_RUNNING" -eq 1 ]; then
    echo ""
    echo -e "${GREEN}✅ Installation complete!${NC}"
    echo ""
    echo "🌐 Access the dashboard at:"
    echo "   - http://localhost"
    echo "   - http://$HOSTNAME"
    echo "   - http://$HOSTNAME_LOWER"
    if [ "$HOSTNAME" != "$HOSTNAME_FQDN" ]; then
        echo "   - http://$HOSTNAME_FQDN"
        echo "   - http://$HOSTNAME_FQDN_LOWER"
    fi
    echo ""
    echo "👤 Default login:"
    echo "   Username: admin"
    echo "   Password: admin123"
    echo ""
    echo "📝 Logs: $COMPOSE_COMMAND logs -f"
    echo "🛑 Stop: $COMPOSE_COMMAND down"
    echo ""
    echo "📖 Source Code: https://github.com/alflewerken/web-appliance-dashboard"
    echo "📄 License: MIT"
else
    echo ""
    echo -e "${RED}❌ Some services failed to start properly${NC}"
    echo "Check logs with: $COMPOSE_COMMAND logs"
    exit 1
fi
EOF

chmod +x install.sh

# Create uninstall script
cat > uninstall.sh << 'EOF'
#!/bin/bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== Web Appliance Dashboard Uninstaller ===${NC}"
echo ""

# Detect Docker Compose command
COMPOSE_COMMAND=""
if command -v docker-compose &> /dev/null; then
    COMPOSE_COMMAND="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_COMMAND="docker compose"
else
    echo -e "${RED}❌ Docker Compose is not found!${NC}"
    exit 1
fi

read -p "⚠️  This will stop and remove all containers. Continue? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo "🛑 Stopping services..."
$COMPOSE_COMMAND down

read -p "⚠️  Remove all data volumes? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Removing volumes..."
    $COMPOSE_COMMAND down -v
fi

echo -e "${GREEN}✅ Uninstall complete${NC}"
EOF

chmod +x uninstall.sh

# Create troubleshoot script
cat > troubleshoot.sh << 'EOF'
#!/bin/bash
# Troubleshooting script for Web Appliance Dashboard

echo "=== Web Appliance Dashboard Troubleshooting ==="
echo ""

# Detect Docker Compose
COMPOSE_COMMAND=""
if command -v docker-compose &> /dev/null; then
    COMPOSE_COMMAND="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_COMMAND="docker compose"
fi

echo "1. Container Status:"
$COMPOSE_COMMAND ps
echo ""

echo "2. Recent Backend Logs:"
$COMPOSE_COMMAND logs --tail=20 backend
echo ""

echo "3. Database Connection Test:"
DB_ROOT_PWD=$(grep "^DB_ROOT_PASSWORD=" .env | cut -d'=' -f2)
$COMPOSE_COMMAND exec database mariadb -u root -p${DB_ROOT_PWD} -e "SELECT COUNT(*) as user_count FROM appliance_dashboard.users;" 2>&1
echo ""

echo "4. Network Connectivity:"
$COMPOSE_COMMAND exec backend ping -c 1 database || echo "Cannot reach database"
echo ""

echo "5. Port Bindings:"
netstat -tln | grep -E ":(80|443|3001|3306)\s" || ss -tln | grep -E ":(80|443|3001|3306)\s"
echo ""

echo "6. CORS Configuration:"
grep ALLOWED_ORIGINS .env
echo ""

echo "7. Backend Environment:"
$COMPOSE_COMMAND exec backend env | grep -E "(ALLOWED_ORIGINS|DB_|NODE_ENV)"
echo ""

echo "💡 Common Issues:"
echo "- Port 80/443 already in use: Change HTTP_PORT/HTTPS_PORT in .env"
echo "- Cannot connect to database: Wait for database to fully start"
echo "- Login fails: Ensure database is initialized (check logs)"
echo "- CORS errors: Check that hostname matches ALLOWED_ORIGINS"
echo "- Services not starting: Check 'docker-compose logs [service]'"
echo ""
echo "📖 For more help, visit: https://github.com/alflewerken/web-appliance-dashboard"
EOF

chmod +x troubleshoot.sh

# Create README
cat > README.md << 'EOF'
# Web Appliance Dashboard - Customer Package

## 🎉 Open Source Edition (MIT License)

This is the open-source version of Web Appliance Dashboard. No authentication or tokens required!

## Quick Start

1. Extract the package
2. Run the installer:
   ```bash
   ./install.sh
   ```
3. Access the dashboard:
   - http://localhost
   - http://[your-hostname]

Default credentials:
- Username: `admin`
- Password: `admin123`

## Requirements

- Docker Engine 20.10+
- Docker Compose 2.0+ (or docker-compose 1.29+)
- Ports 80 and 443 available (configurable in .env)

## Commands

- **Start services**: `docker compose up -d`
- **Stop services**: `docker compose down`
- **View logs**: `docker compose logs -f`
- **Restart a service**: `docker compose restart [service]`
- **Troubleshoot**: `./troubleshoot.sh`

## Configuration

Edit `.env` file to customize:
- Database passwords
- Port numbers
- CORS origins
- Admin credentials

## Services Included

- **Frontend**: React-based web interface
- **Backend**: Node.js API server
- **Database**: MariaDB
- **Terminal**: Web-based terminal (ttyd)
- **Remote Desktop**: Guacamole (VNC/RDP)
- **Reverse Proxy**: Nginx

## Troubleshooting

1. **Login fails**: 
   - Check if database is running: `docker compose ps`
   - Check backend logs: `docker compose logs backend`
   - Run `./troubleshoot.sh` for diagnostics

2. **CORS errors**:
   - Check browser console for the exact origin
   - Verify ALLOWED_ORIGINS in `.env` includes your access URL
   - Restart backend after changes: `docker compose restart backend`

3. **Port conflicts**:
   - Edit `.env` and change HTTP_PORT/HTTPS_PORT
   - Restart services

4. **Services not starting**:
   - Run `./troubleshoot.sh` for diagnostics
   - Check individual service logs

## Building from Source

If you want to build the images yourself instead of using pre-built ones:

```bash
git clone https://github.com/alflewerken/web-appliance-dashboard.git
cd web-appliance-dashboard
./scripts/build.sh --all
```

## Uninstall

To remove the installation:
```bash
./uninstall.sh
```

## Support & Contributing

- **GitHub**: https://github.com/alflewerken/web-appliance-dashboard
- **Issues**: https://github.com/alflewerken/web-appliance-dashboard/issues
- **License**: MIT

We welcome contributions! Please feel free to submit pull requests.

## Security Notes

- Default installation uses self-signed SSL certificates
- Change the admin password after first login
- Review and update security keys in `.env` for production use
- All images are publicly available on GitHub Container Registry

## Version

This is v3.0 of the customer package:
- Open source edition (MIT License)
- No authentication required for pulling images
- Full database schema compatibility
- Automatic CORS configuration
- Robust error handling
- Built-in troubleshooting tools

## License

MIT License - See https://github.com/alflewerken/web-appliance-dashboard/blob/main/LICENSE
EOF

# Create LICENSE file
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2024 Alf Lewerken

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF

# Create the package
cd ..
echo ""
echo "📦 Creating tar.gz package..."
tar -czf "${PACKAGE_NAME}.tar.gz" "${PACKAGE_NAME}"

# Cleanup
rm -rf "${PACKAGE_NAME}"

# Final message
echo ""
echo -e "${GREEN}✅ Package created successfully!${NC}"
echo ""
echo "📦 Package location: ${PACKAGE_DIR}.tar.gz"
echo "📏 Package size: $(du -h "${PACKAGE_NAME}.tar.gz" | cut -f1)"
echo ""
echo "📋 Installation instructions:"
echo "1. Copy the package to the target server"
echo "2. Extract: tar -xzf ${PACKAGE_NAME}.tar.gz"
echo "3. Install: cd ${PACKAGE_NAME} && ./install.sh"
echo ""
echo -e "${GREEN}🎉 Open Source Edition Features:${NC}"
echo "- No authentication required for Docker images"
echo "- Public GitHub Container Registry access"
echo "- MIT License included"
echo "- Full source code available at: https://github.com/alflewerken/web-appliance-dashboard"
echo ""
echo -e "${YELLOW}📖 Note:${NC}"
echo "This version pulls images from the public ghcr.io registry."
echo "No tokens or login required!"