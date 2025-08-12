#!/bin/bash
# Guacamole Schema Initialization Script
# This script ensures the Guacamole database schema is properly initialized

set -e

echo "Waiting for PostgreSQL to be ready..."
until PGPASSWORD=$POSTGRES_PASSWORD psql -h localhost -U $POSTGRES_USER -d $POSTGRES_DB -c '\q' 2>/dev/null; do
    echo "PostgreSQL is unavailable - sleeping"
    sleep 2
done

echo "PostgreSQL is ready - checking for existing schema..."

# Check if guacamole_connection table exists
TABLE_EXISTS=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h localhost -U $POSTGRES_USER -d $POSTGRES_DB -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'guacamole_connection');")

if [ "$TABLE_EXISTS" = "f" ]; then
    echo "Guacamole schema not found - downloading and installing..."
    
    # Download schema files from Guacamole
    SCHEMA_VERSION="1.5.5"
    SCHEMA_URL="https://raw.githubusercontent.com/apache/guacamole-client/${SCHEMA_VERSION}/extensions/guacamole-auth-jdbc/modules/guacamole-auth-jdbc-postgresql/schema"
    
    # Create temporary directory
    TEMP_DIR=$(mktemp -d)
    cd $TEMP_DIR
    
    # Download schema files
    echo "Downloading Guacamole schema files..."
    wget -q "${SCHEMA_URL}/001-create-schema.sql" || {
        echo "Failed to download schema - using bundled version if available"
        if [ -f /docker-entrypoint-initdb.d/001-create-schema.sql ]; then
            cp /docker-entrypoint-initdb.d/001-create-schema.sql .
        else
            echo "ERROR: No schema files available!"
            exit 1
        fi
    }
    
    wget -q "${SCHEMA_URL}/002-create-admin-user.sql" || {
        echo "Using bundled admin user script"
        if [ -f /docker-entrypoint-initdb.d/002-create-admin-user.sql ]; then
            cp /docker-entrypoint-initdb.d/002-create-admin-user.sql .
        fi
    }
    
    # Apply schema
    echo "Applying Guacamole schema..."
    PGPASSWORD=$POSTGRES_PASSWORD psql -h localhost -U $POSTGRES_USER -d $POSTGRES_DB < 001-create-schema.sql
    
    if [ -f 002-create-admin-user.sql ]; then
        echo "Creating admin user..."
        PGPASSWORD=$POSTGRES_PASSWORD psql -h localhost -U $POSTGRES_USER -d $POSTGRES_DB < 002-create-admin-user.sql
    fi
    
    # Clean up
    cd /
    rm -rf $TEMP_DIR
    
    echo "Guacamole schema installed successfully!"
else
    echo "Guacamole schema already exists - skipping installation"
fi

# Apply custom configurations
if [ -f /docker-entrypoint-initdb.d/custom-sftp.sql ]; then
    echo "Applying custom SFTP configuration..."
    PGPASSWORD=$POSTGRES_PASSWORD psql -h localhost -U $POSTGRES_USER -d $POSTGRES_DB < /docker-entrypoint-initdb.d/custom-sftp.sql
fi

echo "Database initialization complete!"
