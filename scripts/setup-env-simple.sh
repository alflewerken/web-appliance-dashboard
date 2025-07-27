#!/bin/bash

# Simple setup script that creates working .env files

echo "🔧 Creating .env files for Web Appliance Dashboard..."

# Create main .env
cat > .env << 'EOF'
# Environment Configuration for Docker Compose

# Database Configuration
MYSQL_ROOT_PASSWORD=rootpassword123
MYSQL_DATABASE=appliance_dashboard
MYSQL_USER=dashboard_user
MYSQL_PASSWORD=dashboardpass123
DB_HOST=database
DB_PORT=3306
DB_USER=dashboard_user
DB_PASSWORD=dashboardpass123
DB_NAME=appliance_dashboard

# Security Keys
JWT_SECRET=your-very-long-secret-key-that-should-be-changed-in-production
SSH_KEY_ENCRYPTION_SECRET=your-ssh-encryption-key-32chars

# Node Environment
NODE_ENV=production
LOG_LEVEL=info

# CORS Configuration
ALLOWED_ORIGINS=http://localhost,https://localhost,http://macbookpro.local,https://macbookpro.local

# External URL (for Remote Desktop)
EXTERNAL_URL=http://macbookpro.local:9080

# Container Names
DB_CONTAINER_NAME=appliance_db
BACKEND_CONTAINER_NAME=appliance_backend
WEBSERVER_CONTAINER_NAME=appliance_webserver
TTYD_CONTAINER_NAME=appliance_ttyd

# Network
NETWORK_NAME=appliance_network

# Guacamole Configuration
GUACAMOLE_ENABLED=true
GUACAMOLE_CONTAINER_NAME=appliance_guacamole
GUACD_CONTAINER_NAME=appliance_guacd
GUACAMOLE_DB_CONTAINER_NAME=appliance_guacamole_db
GUACAMOLE_MYSQL_DATABASE=guacamole_db
GUACAMOLE_MYSQL_USER=guacamole_user
GUACAMOLE_MYSQL_PASSWORD=guacamole_pass
POSTGRES_USER=guacamole_user
POSTGRES_PASSWORD=guacamole_pass
POSTGRES_DB=guacamole_db

# Health Check Settings
HEALTH_CHECK_TIMEOUT=10s
HEALTH_CHECK_RETRIES=20
HEALTH_CHECK_INTERVAL=30s

# Development Settings
DISABLE_RATE_LIMIT=true
EOF

echo "✅ Created .env"

# Create backend/.env
mkdir -p backend
cat > backend/.env << 'EOF'
# Backend Configuration
PORT=3001

# Database Configuration
DB_HOST=database
DB_PORT=3306
DB_USER=dashboard_user
DB_PASSWORD=dashboardpass123
DB_NAME=appliance_dashboard

# JWT Configuration
JWT_SECRET=your-very-long-secret-key-that-should-be-changed-in-production

# SSH Key Encryption
SSH_KEY_ENCRYPTION_SECRET=your-ssh-encryption-key-32chars

# Node Environment
NODE_ENV=production

# CORS Settings
CORS_ORIGIN=http://localhost,https://localhost,http://macbookpro.local,https://macbookpro.local
ALLOWED_ORIGINS=http://localhost,https://localhost,http://macbookpro.local,https://macbookpro.local

# External URL (for generating links)
EXTERNAL_URL=http://macbookpro.local:9080

# Logging
LOG_LEVEL=info

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# Session
SESSION_SECRET=your-very-long-secret-key-that-should-be-changed-in-production

# Rate Limiting
DISABLE_RATE_LIMIT=true
EOF

echo "✅ Created backend/.env"

# Create frontend/.env
mkdir -p frontend
cat > frontend/.env << 'EOF'
# Frontend Configuration
NODE_ENV=production

# API Configuration
REACT_APP_API_URL=http://macbookpro.local:9080/api
REACT_APP_WS_URL=ws://macbookpro.local:9080
REACT_APP_API_TIMEOUT=30000

# Terminal Configuration
REACT_APP_TERMINAL_URL=http://macbookpro.local:9080/terminal
REACT_APP_TERMINAL_ENABLED=true

# Guacamole Configuration
REACT_APP_GUACAMOLE_URL=http://macbookpro.local:9080/guacamole

# Application Settings
REACT_APP_NAME=Web Appliance Dashboard
REACT_APP_VERSION=1.1.0
REACT_APP_ENVIRONMENT=production

# Feature Flags
REACT_APP_FEATURE_SSH=true
REACT_APP_FEATURE_TERMINAL=true
REACT_APP_FEATURE_BACKUP=true
REACT_APP_FEATURE_AUDIT_LOG=true
REACT_APP_FEATURE_SERVICE_CONTROL=true
REACT_APP_FEATURE_DARK_MODE=true
REACT_APP_ENABLE_REMOTE_DESKTOP=true

# External URL (for generating public links)
REACT_APP_EXTERNAL_URL=http://macbookpro.local:9080

# UI Configuration
REACT_APP_DEFAULT_THEME=dark
REACT_APP_ITEMS_PER_PAGE=20

# Polling Intervals (in milliseconds)
REACT_APP_STATUS_CHECK_INTERVAL=30000
REACT_APP_NOTIFICATION_DURATION=5000

# Session Configuration
REACT_APP_SESSION_TIMEOUT=86400000
REACT_APP_SESSION_WARNING_TIME=300000

# Public URL Configuration
PUBLIC_URL=/
EOF

echo "✅ Created frontend/.env"

echo ""
echo "🎉 All .env files created successfully!"
echo ""
echo "⚠️  IMPORTANT: These files contain default passwords."
echo "   Please change them before using in production!"
echo ""
echo "You can now run: ./scripts/build.sh"
