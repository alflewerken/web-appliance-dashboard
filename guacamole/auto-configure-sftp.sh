#!/bin/bash

# Auto-Configure SFTP for Guacamole connections
# This script runs periodically to ensure all connections have SFTP enabled

# Wait for database to be ready
sleep 10

# Database connection details from environment
DB_HOST="${POSTGRES_HOSTNAME:-guacamole-postgres}"
DB_NAME="${POSTGRES_DATABASE:-guacamole_db}"
DB_USER="${POSTGRES_USER:-guacamole_user}"
DB_PASS="${POSTGRES_PASSWORD:-guacamole_pass123}"

# Function to configure SFTP for a connection
configure_sftp() {
    local conn_id=$1
    local hostname=$2
    local username=$3
    local password=$4
    
    # Use environment variables if credentials not provided
    if [ -z "$username" ]; then
        username="${DEFAULT_SSH_USER:-${username}}"
    fi
    
    if [ -z "$password" ]; then
        password="${DEFAULT_SSH_PASS:-${password}}"
    fi
    
    # Set SFTP parameters
    PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES 
            ($conn_id, 'enable-sftp', 'true'),
            ($conn_id, 'sftp-hostname', '$hostname'),
            ($conn_id, 'sftp-port', '22'),
            ($conn_id, 'sftp-username', '$username'),
            ($conn_id, 'sftp-password', '$password'),
            ($conn_id, 'sftp-root-directory', '/home/$username/Desktop'),
            ($conn_id, 'sftp-disable-download', 'false'),
            ($conn_id, 'sftp-disable-upload', 'false')
        ON CONFLICT (connection_id, parameter_name) 
        DO UPDATE SET parameter_value = EXCLUDED.parameter_value;"
}

# Main loop - check every 30 seconds
while true; do
    # Get all connections without SFTP
    CONNECTIONS=$(PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -A -F"|" -c "
        SELECT c.connection_id, 
               (SELECT parameter_value FROM guacamole_connection_parameter WHERE connection_id = c.connection_id AND parameter_name = 'hostname' LIMIT 1) as hostname,
               (SELECT parameter_value FROM guacamole_connection_parameter WHERE connection_id = c.connection_id AND parameter_name = 'username' LIMIT 1) as username,
               (SELECT parameter_value FROM guacamole_connection_parameter WHERE connection_id = c.connection_id AND parameter_name = 'password' LIMIT 1) as password
        FROM guacamole_connection c
        WHERE NOT EXISTS (
            SELECT 1 FROM guacamole_connection_parameter p 
            WHERE p.connection_id = c.connection_id 
            AND p.parameter_name = 'enable-sftp' 
            AND p.parameter_value = 'true'
        )")
    
    # Configure SFTP for each connection
    if [ ! -z "$CONNECTIONS" ]; then
        echo "$CONNECTIONS" | while IFS="|" read -r conn_id hostname username password; do
            if [ ! -z "$conn_id" ] && [ ! -z "$hostname" ]; then
                echo "Configuring SFTP for connection $conn_id..."
                configure_sftp "$conn_id" "$hostname" "$username" "$password"
            fi
        done
    fi
    
    # Wait before next check
    sleep 30
done
