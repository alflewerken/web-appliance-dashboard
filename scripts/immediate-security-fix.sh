#!/bin/bash

echo "🚨 IMMEDIATE GUACAMOLE SECURITY FIX"
echo "==================================="
echo ""
echo "This script will:"
echo "1. Stop exposing Guacamole on port 9070"
echo "2. Change default passwords"
echo "3. Route Guacamole through authenticated proxy"
echo ""

# Check if user wants to proceed
read -p "Do you want to proceed? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Step 1: Stop current setup
echo -e "\n🛑 Stopping current containers..."
docker-compose down

# Step 2: Generate secure password
GUAC_NEW_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-20)
echo -e "\n🔑 New Guacamole admin password: $GUAC_NEW_PASS"
echo "(Save this password securely!)"

# Step 3: Start with security overlay (no external ports)
echo -e "\n🚀 Starting with security configuration..."
docker-compose -f docker-compose.yml -f docker-compose.security.yml up -d

# Step 4: Wait for database to be ready
echo -e "\n⏳ Waiting for database to be ready..."
sleep 10

# Step 5: Update Guacamole admin password
echo -e "\n🔐 Updating Guacamole admin password..."
docker-compose exec guacamole-postgres psql -U guacamole_user -d guacamole_db << EOF
UPDATE guacamole_user 
SET password_hash = encode(digest('${GUAC_NEW_PASS}', 'sha256'), 'hex'),
    password_salt = NULL,
    password_date = CURRENT_TIMESTAMP
WHERE username = 'guacadmin';
EOF

# Step 6: Restart backend to load new routes
echo -e "\n🔄 Restarting backend..."
docker-compose restart backend

echo -e "\n✅ SECURITY FIX COMPLETE!"
echo ""
echo "🔒 Security improvements:"
echo "   ✓ Guacamole no longer exposed on port 9070"
echo "   ✓ Default password changed"
echo "   ✓ Access only through authenticated dashboard"
echo ""
echo "📝 New Guacamole admin credentials:"
echo "   Username: guacadmin"
echo "   Password: $GUAC_NEW_PASS"
echo ""
echo "⚠️  IMPORTANT: Remote desktop will now only work through the dashboard!"
echo ""