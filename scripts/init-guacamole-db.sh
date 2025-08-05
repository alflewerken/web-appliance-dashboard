#!/bin/bash

# Guacamole Database Initialization Script
# This script properly initializes the Guacamole PostgreSQL database

echo "🐦 Guacamole Database Initialization"
echo "===================================="

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to print colored output
print_status() {
    case $1 in
        "success") echo -e "${GREEN}✅ $2${NC}" ;;
        "error") echo -e "${RED}❌ $2${NC}" ;;
        "warning") echo -e "${YELLOW}⚠️  $2${NC}" ;;
        "info") echo -e "📌 $2" ;;
    esac
}

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    print_status "error" "This script must be run from the project root directory"
    exit 1
fi

# Check if Guacamole containers are running
if ! docker compose ps | grep -q "guacamole-postgres.*Up"; then
    print_status "error" "Guacamole PostgreSQL container is not running"
    print_status "info" "Start it with: docker compose up -d guacamole-postgres"
    exit 1
fi

if ! docker compose ps | grep -q "guacamole.*Up"; then
    print_status "error" "Guacamole container is not running"
    print_status "info" "Start it with: docker compose up -d guacamole"
    exit 1
fi

# Database credentials from environment
DB_PASSWORD="${GUACAMOLE_DB_PASSWORD:-guacamole_pass123}"
DB_USER="${GUACAMOLE_DB_USER:-guacamole_user}"
DB_NAME="${GUACAMOLE_DB_NAME:-guacamole_db}"

print_status "info" "Using database: $DB_NAME"
print_status "info" "Using user: $DB_USER"

# Check if database is already initialized
print_status "info" "Checking if database is already initialized..."
table_count=$(docker compose exec -T -e PGPASSWORD="$DB_PASSWORD" guacamole-postgres psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")

if [ "$table_count" -gt "0" ]; then
    print_status "warning" "Database already contains $table_count tables"
    echo ""
    read -p "Do you want to reinitialize the database? This will DROP all existing data! (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "info" "Keeping existing database"
        
        # Just ensure admin password is set
        print_status "info" "Ensuring admin password is set..."
        if docker compose exec -T -e PGPASSWORD="$DB_PASSWORD" guacamole-postgres psql -U "$DB_USER" -d "$DB_NAME" -c "UPDATE guacamole_user SET password_hash = decode('CA458A7D494E3BE824F5E1E175A1556C0F8EEF2C2D7DF3633BEC4A29C4411960', 'hex'), password_salt = decode('FE24ADC5E11E2B25288D1704ABE67A79E342ECC26064CE69C5B3177795A82264', 'hex'), password_date = CURRENT_TIMESTAMP WHERE entity_id = (SELECT entity_id FROM guacamole_entity WHERE name = 'guacadmin' AND type = 'USER');" 2>/dev/null; then
            print_status "success" "Admin password updated"
        else
            print_status "warning" "Could not update admin password"
        fi
        
        exit 0
    fi
    
    # Drop and recreate database
    print_status "warning" "Dropping existing database..."
    docker compose exec -T -e PGPASSWORD="$DB_PASSWORD" guacamole-postgres psql -U postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null
    docker compose exec -T -e PGPASSWORD="$DB_PASSWORD" guacamole-postgres psql -U postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null
fi

# Initialize database schema
print_status "info" "Initializing Guacamole database schema..."

# Check if schema files exist in container
if ! docker compose exec -T guacamole ls /opt/guacamole/postgresql/schema/ >/dev/null 2>&1; then
    print_status "error" "Schema files not found in Guacamole container"
    exit 1
fi

# Apply schema
if docker compose exec -T -e PGPASSWORD="$DB_PASSWORD" guacamole sh -c "cd /opt/guacamole/postgresql && cat schema/*.sql | psql -h guacamole-postgres -U $DB_USER -d $DB_NAME" 2>&1 | grep -E "(CREATE|INSERT)" | wc -l | read created_count; then
    print_status "success" "Database schema applied successfully"
else
    print_status "error" "Failed to apply database schema"
    exit 1
fi

# Verify initialization
table_count=$(docker compose exec -T -e PGPASSWORD="$DB_PASSWORD" guacamole-postgres psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
print_status "info" "Created $table_count tables"

# List important tables
print_status "info" "Important tables:"
docker compose exec -T -e PGPASSWORD="$DB_PASSWORD" guacamole-postgres psql -U "$DB_USER" -d "$DB_NAME" -c "\dt" 2>/dev/null | grep -E "(guacamole_user|guacamole_connection|guacamole_entity)" || true

# Set admin password
print_status "info" "Setting default admin password (guacadmin/guacadmin)..."
if docker compose exec -T -e PGPASSWORD="$DB_PASSWORD" guacamole-postgres psql -U "$DB_USER" -d "$DB_NAME" -c "UPDATE guacamole_user SET password_hash = decode('CA458A7D494E3BE824F5E1E175A1556C0F8EEF2C2D7DF3633BEC4A29C4411960', 'hex'), password_salt = decode('FE24ADC5E11E2B25288D1704ABE67A79E342ECC26064CE69C5B3177795A82264', 'hex'), password_date = CURRENT_TIMESTAMP WHERE entity_id = (SELECT entity_id FROM guacamole_entity WHERE name = 'guacadmin' AND type = 'USER');" 2>/dev/null; then
    print_status "success" "Admin password set successfully"
else
    print_status "warning" "Could not set admin password (user might not exist)"
fi

# Create a test connection (optional)
print_status "info" "Creating test VNC connection..."
docker compose exec -T -e PGPASSWORD="$DB_PASSWORD" guacamole-postgres psql -U "$DB_USER" -d "$DB_NAME" <<EOF 2>/dev/null || true
-- Create test connection
INSERT INTO guacamole_connection (connection_name, protocol) 
VALUES ('Test VNC Connection', 'vnc') 
ON CONFLICT DO NOTHING
RETURNING connection_id;

-- Add connection parameters
INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
SELECT 
    (SELECT connection_id FROM guacamole_connection WHERE connection_name = 'Test VNC Connection'),
    'hostname',
    'localhost'
WHERE EXISTS (SELECT 1 FROM guacamole_connection WHERE connection_name = 'Test VNC Connection')
ON CONFLICT DO NOTHING;

INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
SELECT 
    (SELECT connection_id FROM guacamole_connection WHERE connection_name = 'Test VNC Connection'),
    'port',
    '5900'
WHERE EXISTS (SELECT 1 FROM guacamole_connection WHERE connection_name = 'Test VNC Connection')
ON CONFLICT DO NOTHING;

-- Grant permission to admin
INSERT INTO guacamole_connection_permission (entity_id, connection_id, permission)
SELECT 
    (SELECT entity_id FROM guacamole_entity WHERE name = 'guacadmin'),
    (SELECT connection_id FROM guacamole_connection WHERE connection_name = 'Test VNC Connection'),
    'READ'
WHERE EXISTS (SELECT 1 FROM guacamole_connection WHERE connection_name = 'Test VNC Connection')
ON CONFLICT DO NOTHING;
EOF

# Restart Guacamole to ensure it picks up the changes
print_status "info" "Restarting Guacamole..."
docker compose restart guacamole >/dev/null 2>&1

echo ""
print_status "success" "Guacamole database initialization complete!"
echo ""
print_status "info" "You can now log in to Guacamole:"
echo "   URL: http://localhost:9080/guacamole/"
echo "   Username: guacadmin"
echo "   Password: guacadmin"
echo ""
print_status "warning" "Remember to change the default password after first login!"
echo ""
