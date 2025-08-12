#!/bin/bash

# Create Admin User Script for Web Appliance Dashboard
# This script creates a default admin user if none exists

# Read version from VERSION file
VERSION=$(cat "$(dirname "$0")/../VERSION" 2>/dev/null || echo "unknown")

echo "🔐 Web Appliance Dashboard v$VERSION - Checking for admin user..."

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if backend container is running
if ! docker ps | grep -q appliance_backend; then
    echo -e "${RED}❌ Backend container is not running${NC}"
    echo "Please ensure the application is running with: docker compose up -d"
    exit 1
fi

# Function to generate a secure random password
generate_password() {
    # Generate a 12-character password with letters and numbers
    # Avoid special characters for easier initial login
    < /dev/urandom tr -dc 'A-Za-z0-9' | head -c12
}

# Create a Node.js script to check for admin user
CHECK_SCRIPT='
const pool = require("./utils/database");

async function checkAdmin() {
    try {
        const [users] = await pool.query("SELECT * FROM users WHERE role = ?", ["admin"]);
        if (users && users.length > 0) {
            console.log("EXISTS");
        } else {
            console.log("NOT_EXISTS");
        }
        process.exit(0);
    } catch (err) {
        console.error("ERROR:", err.message);
        process.exit(1);
    }
}

checkAdmin();
'

# Check if any admin user exists
echo "Checking database for existing admin users..."
ADMIN_EXISTS=$(docker compose exec -T backend sh -c "cd /app && node -e '$CHECK_SCRIPT'" 2>&1)

if [[ "$ADMIN_EXISTS" == *"EXISTS"* ]]; then
    echo -e "${GREEN}✅ Admin user already exists${NC}"
    echo "Use the web interface to manage users or reset passwords"
    exit 0
elif [[ "$ADMIN_EXISTS" == *"NOT_EXISTS"* ]]; then
    echo -e "${YELLOW}⚠️  No admin user found, creating one...${NC}"
    
    # Generate default credentials
    DEFAULT_USERNAME="admin"
    DEFAULT_PASSWORD=$(generate_password)
    DEFAULT_EMAIL="admin@localhost"
    
    # Create script for adding admin user
    CREATE_SCRIPT="
const pool = require('./utils/database');
const { hashPassword } = require('./utils/auth');

async function createAdmin() {
    try {
        const hashedPassword = await hashPassword('$DEFAULT_PASSWORD');
        const [result] = await pool.query(
            'INSERT INTO users (username, email, password, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            ['$DEFAULT_USERNAME', '$DEFAULT_EMAIL', hashedPassword, 'admin', 1]
        );
        console.log('CREATED');
        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
}

createAdmin();
"
    
    # Create the admin user
    echo "Creating admin user..."
    CREATE_RESULT=$(docker compose exec -T backend sh -c "cd /app && node -e \"$CREATE_SCRIPT\"" 2>&1)
    
    if [[ "$CREATE_RESULT" == *"CREATED"* ]]; then
        echo -e "${GREEN}✅ Admin user created successfully!${NC}"
        echo ""
        echo "==================================="
        echo "Admin Login Credentials:"
        echo "==================================="
        echo -e "Username: ${GREEN}$DEFAULT_USERNAME${NC}"
        echo -e "Password: ${GREEN}$DEFAULT_PASSWORD${NC}"
        echo "==================================="
        echo ""
        echo -e "${YELLOW}⚠️  IMPORTANT: Please change the password after first login!${NC}"
        echo ""
        
        # Save credentials to a file (optional)
        CREDS_FILE="./admin-credentials.txt"
        cat > "$CREDS_FILE" << EOF
Web Appliance Dashboard Admin Credentials
=========================================
Created: $(date)

Username: $DEFAULT_USERNAME
Password: $DEFAULT_PASSWORD

IMPORTANT: Change this password after first login!
Access the dashboard at: http://localhost:9080

This file can be deleted after you've logged in.
EOF
        
        chmod 600 "$CREDS_FILE"
        echo -e "Credentials saved to: ${GREEN}$CREDS_FILE${NC}"
        
    else
        echo -e "${RED}❌ Failed to create admin user${NC}"
        echo "Error details: $CREATE_RESULT"
        
        # Check if it's a duplicate entry error
        if [[ "$CREATE_RESULT" == *"Duplicate entry"* ]] || [[ "$CREATE_RESULT" == *"ER_DUP_ENTRY"* ]]; then
            echo -e "${YELLOW}An admin user might already exist with username: $DEFAULT_USERNAME${NC}"
        fi
        
        exit 1
    fi
else
    echo -e "${RED}❌ Error checking for admin user${NC}"
    echo "Error details: $ADMIN_EXISTS"
    echo ""
    echo "Possible issues:"
    echo "1. Database connection problem"
    echo "2. Backend container not ready" 
    echo "3. Database not initialized"
    echo ""
    echo "Try running: docker compose logs backend"
    
    # Try to check if the database tables exist
    echo ""
    echo "Checking database structure..."
    TABLE_CHECK=$(docker compose exec -T backend sh -c "cd /app && node -e \"
        const pool = require('./utils/database');
        pool.query('SHOW TABLES LIKE \\'users\\'')
            .then(([tables]) => {
                if (tables.length > 0) {
                    console.log('TABLE_EXISTS');
                } else {
                    console.log('TABLE_NOT_EXISTS');
                }
                process.exit(0);
            })
            .catch(err => {
                console.error('DB_ERROR:', err.message);
                process.exit(1);
            });
    \"" 2>&1)
    
    if [[ "$TABLE_CHECK" == *"TABLE_NOT_EXISTS"* ]]; then
        echo -e "${RED}The 'users' table does not exist in the database.${NC}"
        echo "The database might not be initialized properly."
        echo "Try running the database migrations or rebuilding the application."
    elif [[ "$TABLE_CHECK" == *"TABLE_EXISTS"* ]]; then
        echo -e "${YELLOW}The 'users' table exists, but there might be a connection issue.${NC}"
    fi
    
    exit 1
fi
