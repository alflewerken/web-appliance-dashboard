#!/bin/bash
# Database migrations for Web Appliance Dashboard

echo "Running database migrations..."

# Load environment variables from .env file
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if [ -f "$SCRIPT_DIR/../.env" ]; then
    export $(grep -E '^[A-Z]' "$SCRIPT_DIR/../.env" | xargs)
fi

# Get database credentials from environment
DB_HOST="${DB_HOST:-database}"
DB_USER="${DB_USER:-dashboard_user}"
DB_PASSWORD="${DB_PASSWORD}"
DB_NAME="${DB_NAME:-appliance_dashboard}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD}"

# Check if required variables are set
if [ -z "$MYSQL_ROOT_PASSWORD" ] || [ -z "$DB_PASSWORD" ]; then
    echo "Error: Database credentials not found in environment variables."
    echo "Please ensure .env file exists and contains MYSQL_ROOT_PASSWORD and DB_PASSWORD."
    exit 1
fi

# Wait for database to be ready
echo "Waiting for database to be ready..."
COUNTER=0
MAX_TRIES=30
until docker exec appliance_db mariadb -u root -p"$MYSQL_ROOT_PASSWORD" -e "SELECT 1" >/dev/null 2>&1; do
    COUNTER=$((COUNTER+1))
    if [ $COUNTER -gt $MAX_TRIES ]; then
        echo "Error: Database did not become ready after $MAX_TRIES attempts."
        echo "Checking database logs..."
        docker logs appliance_db --tail 20
        exit 1
    fi
    echo "Database is not ready yet... (attempt $COUNTER/$MAX_TRIES)"
    sleep 2
done

echo "Database is ready. Running migrations..."

# Add missing columns to appliances table
docker exec appliance_db mariadb -u root -p"$MYSQL_ROOT_PASSWORD" "$DB_NAME" -e "
-- Add remote_desktop_type column if it doesn't exist
ALTER TABLE appliances ADD COLUMN IF NOT EXISTS remote_desktop_type VARCHAR(50) DEFAULT 'guacamole';

-- Add other potentially missing columns
ALTER TABLE appliances ADD COLUMN IF NOT EXISTS rustdesk_id VARCHAR(20);
ALTER TABLE appliances ADD COLUMN IF NOT EXISTS rustdesk_installed BOOLEAN DEFAULT FALSE;
ALTER TABLE appliances ADD COLUMN IF NOT EXISTS rustdesk_installation_date DATETIME;
ALTER TABLE appliances ADD COLUMN IF NOT EXISTS rustdesk_password_encrypted TEXT;
ALTER TABLE appliances ADD COLUMN IF NOT EXISTS guacamole_performance_mode VARCHAR(20) DEFAULT 'balanced';
"

# Add missing columns to hosts table
echo "Adding missing columns to hosts table..."
docker exec appliance_db mariadb -u root -p"$MYSQL_ROOT_PASSWORD" "$DB_NAME" -e "
-- Add description column if it doesn't exist
ALTER TABLE hosts ADD COLUMN IF NOT EXISTS description TEXT AFTER name;
"

# Add missing columns to ssh_keys table
echo "Adding missing columns to ssh_keys table..."
docker exec appliance_db mariadb -u root -p"$MYSQL_ROOT_PASSWORD" "$DB_NAME" -e "
-- Add fingerprint and user tracking columns
ALTER TABLE ssh_keys 
ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(255) AFTER public_key,
ADD COLUMN IF NOT EXISTS created_by INT(11) AFTER is_default,
ADD COLUMN IF NOT EXISTS updated_by INT(11) AFTER created_by;
"

echo "Database migrations completed."
