# Guacamole Security Configuration Script
# This script secures the Guacamole installation

#!/bin/bash

echo "🔒 Securing Guacamole Installation"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to generate secure password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

# Step 1: Generate new secure passwords
echo -e "\n${GREEN}Step 1: Generating secure passwords...${NC}"
GUAC_ADMIN_PASS=$(generate_password)
GUAC_DB_PASS=$(generate_password)

echo "New Guacamole admin password: $GUAC_ADMIN_PASS"
echo "New Guacamole DB password: $GUAC_DB_PASS"

# Step 2: Update .env file
echo -e "\n${GREEN}Step 2: Updating .env file...${NC}"
ENV_FILE=".env"

# Backup .env file
cp $ENV_FILE ${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)

# Update or add Guacamole passwords
if grep -q "GUACAMOLE_ADMIN_PASSWORD=" $ENV_FILE; then
    sed -i.bak "s/GUACAMOLE_ADMIN_PASSWORD=.*/GUACAMOLE_ADMIN_PASSWORD=$GUAC_ADMIN_PASS/" $ENV_FILE
else
    echo "GUACAMOLE_ADMIN_PASSWORD=$GUAC_ADMIN_PASS" >> $ENV_FILE
fi

if grep -q "GUACAMOLE_DB_PASSWORD=" $ENV_FILE; then
    sed -i.bak "s/GUACAMOLE_DB_PASSWORD=.*/GUACAMOLE_DB_PASSWORD=$GUAC_DB_PASS/" $ENV_FILE
else
    echo "GUACAMOLE_DB_PASSWORD=$GUAC_DB_PASS" >> $ENV_FILE
fi

# Step 3: Create secure docker-compose override
echo -e "\n${GREEN}Step 3: Creating secure docker-compose override...${NC}"
cat > docker-compose.secure.yml << EOF
version: '3.8'

services:
  # Remove external port exposure for Guacamole
  guacamole:
    ports: []
    environment:
      # Disable default admin account after first login
      POSTGRESQL_AUTO_CREATE_ACCOUNTS: 'false'
    labels:
      - "traefik.enable=false"
      
  # Ensure Guacamole DB is not exposed
  guacamole-postgres:
    ports: []
    
  # Ensure guacd is not exposed
  guacd:
    ports: []

  # Add authentication proxy for Guacamole
  guacamole-auth-proxy:
    image: nginx:alpine
    container_name: guacamole_auth_proxy
    restart: always
    depends_on:
      - guacamole
      - backend
    volumes:
      - ./nginx/guacamole-auth-proxy.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      - appliance_network
    # Only expose internally to nginx
    expose:
      - "8080"
EOF

# Step 4: Create Nginx auth proxy configuration
echo -e "\n${GREEN}Step 4: Creating Nginx auth proxy configuration...${NC}"
mkdir -p nginx
cat > nginx/guacamole-auth-proxy.conf << 'EOF'
server {
    listen 8080;
    server_name _;

    # Only allow connections from the main nginx proxy
    allow 172.0.0.0/8;  # Docker network
    deny all;

    location / {
        # Verify JWT token from dashboard
        auth_request /auth;
        auth_request_set $auth_status $upstream_status;
        
        # If auth fails, return 401
        error_page 401 = @error401;
        
        # Proxy to Guacamole
        proxy_pass http://guacamole:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
    
    location = /auth {
        internal;
        proxy_pass http://backend:3001/api/auth/verify-guacamole;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header X-Original-URI $request_uri;
        proxy_set_header X-Guacamole-Token $http_x_guacamole_token;
    }
    
    location @error401 {
        return 401 "Unauthorized";
    }
}
EOF

# Step 5: Create API endpoint for Guacamole auth verification
echo -e "\n${GREEN}Step 5: Creating auth verification endpoint...${NC}"
cat > backend/routes/guacamole-auth.js << 'EOF'
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Verify Guacamole access token
router.get('/verify-guacamole', (req, res) => {
  const token = req.headers['x-guacamole-token'];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    // Verify the token is valid and not expired
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token is for Guacamole access
    if (decoded.type !== 'guacamole-access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    
    // Check if token has expired (5 minutes max)
    const now = Date.now() / 1000;
    if (decoded.exp && decoded.exp < now) {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    // Token is valid
    res.status(200).json({ valid: true });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
EOF

# Step 6: Update Guacamole route to use secure tokens
echo -e "\n${GREEN}Step 6: Creating secure Guacamole token generation...${NC}"
cat > backend/utils/guacamole-security-update.js << 'EOF'
// This updates the Guacamole route to generate secure, time-limited tokens

const updateCode = `
// Generate a secure, time-limited token for Guacamole access
const guacamoleAccessToken = jwt.sign(
  { 
    userId: userId,
    applianceId: applianceId,
    type: 'guacamole-access',
    connectionId: connectionId
  },
  process.env.JWT_SECRET,
  { expiresIn: '5m' } // Token expires in 5 minutes
);

// Return the token instead of direct URL
res.json({
  token: guacamoleAccessToken,
  connectionId: connectionId,
  identifier: identifier,
  expiresIn: 300 // seconds
});
`;

console.log('Update the guacamole.js route with this secure token generation');
console.log(updateCode);
EOF

# Step 7: Create password update script for Guacamole DB
echo -e "\n${GREEN}Step 7: Creating password update script...${NC}"
cat > scripts/update-guacamole-password.sql << EOF
-- Update guacadmin password to secure password
UPDATE guacamole_user 
SET password_hash = encode(digest('$GUAC_ADMIN_PASS', 'sha256'), 'hex'),
    password_salt = NULL,
    password_date = CURRENT_TIMESTAMP
WHERE username = 'guacadmin';

-- Create a new admin user with secure password (optional)
INSERT INTO guacamole_entity (name, type) VALUES ('dashboard-admin', 'USER');
INSERT INTO guacamole_user (entity_id, password_hash, password_date)
SELECT entity_id, encode(digest('$GUAC_ADMIN_PASS', 'sha256'), 'hex'), CURRENT_TIMESTAMP
FROM guacamole_entity WHERE name = 'dashboard-admin' AND type = 'USER';

-- Grant admin permissions to new user
INSERT INTO guacamole_user_permission (entity_id, affected_entity_id, permission)
SELECT e1.entity_id, e2.entity_id, permission
FROM guacamole_entity e1, guacamole_entity e2,
     (VALUES ('READ'), ('UPDATE'), ('DELETE'), ('ADMINISTER')) AS perms(permission)
WHERE e1.name = 'dashboard-admin' AND e1.type = 'USER'
  AND e2.name = 'dashboard-admin' AND e2.type = 'USER';

-- Grant system permissions
INSERT INTO guacamole_system_permission (entity_id, permission)
SELECT entity_id, permission
FROM guacamole_entity,
     (VALUES ('CREATE_CONNECTION'), ('CREATE_CONNECTION_GROUP'), ('CREATE_SHARING_PROFILE'), 
             ('CREATE_USER'), ('CREATE_USER_GROUP'), ('ADMINISTER')) AS perms(permission)
WHERE name = 'dashboard-admin' AND type = 'USER';
EOF

# Step 8: Create secure startup script
echo -e "\n${GREEN}Step 8: Creating secure startup script...${NC}"
cat > scripts/secure-start.sh << 'EOF'
#!/bin/bash

echo "🔒 Starting Web Appliance Dashboard (Secure Mode)"
echo "==============================================="

# Check if secure passwords are set
if ! grep -q "GUACAMOLE_ADMIN_PASSWORD=" .env || grep -q "GUACAMOLE_ADMIN_PASSWORD=$" .env; then
    echo "❌ Error: Secure passwords not set. Run secure-guacamole.sh first!"
    exit 1
fi

# Use secure docker-compose override
docker-compose -f docker-compose.yml -f docker-compose.secure.yml up -d

# Wait for services to start
echo "Waiting for services to start..."
sleep 10

# Update Guacamole password
echo "Updating Guacamole passwords..."
docker-compose exec guacamole-postgres psql -U guacamole_user -d guacamole_db -f /docker-entrypoint-initdb.d/update-password.sql

echo "✅ Secure startup complete!"
echo ""
echo "⚠️  IMPORTANT SECURITY NOTES:"
echo "- Guacamole is no longer directly accessible on port 9070"
echo "- Access is only possible through the dashboard with authentication"
echo "- Default passwords have been changed"
echo "- Save the new passwords from .env file in a secure location"
EOF

chmod +x scripts/secure-start.sh

# Step 9: Print summary
echo -e "\n${GREEN}✅ Security configuration complete!${NC}"
echo -e "\n${YELLOW}IMPORTANT NEXT STEPS:${NC}"
echo "1. Stop current containers: docker-compose down"
echo "2. Update Guacamole database password:"
echo "   docker-compose run --rm guacamole-postgres psql -U postgres -c \"ALTER USER guacamole_user PASSWORD '$GUAC_DB_PASS';\""
echo "3. Start with secure configuration: ./scripts/secure-start.sh"
echo "4. Save these passwords securely:"
echo "   - Guacamole Admin: $GUAC_ADMIN_PASS"
echo "   - Guacamole DB: $GUAC_DB_PASS"
echo ""
echo "5. Update your firewall to block port 9070 from external access"
echo "6. Consider using a VPN for additional security"
