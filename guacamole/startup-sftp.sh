#!/bin/bash

# Guacamole SFTP Auto-Configuration Script
# This runs when the container starts to ensure SFTP is enabled

echo "Starting Guacamole SFTP auto-configuration..."

# Wait for Guacamole to be fully started
sleep 30

# Database connection
export PGPASSWORD="${POSTGRES_PASSWORD}"
DB_HOST="${POSTGRES_HOSTNAME}"
DB_NAME="${POSTGRES_DATABASE}"
DB_USER="${POSTGRES_USER}"

# Run the auto-configuration function
echo "Configuring SFTP for all connections..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT auto_configure_sftp();" 2>/dev/null || true

# Also configure any connections that might not have SSH credentials
# Use environment defaults if available
if [ ! -z "$DEFAULT_SSH_USER" ]; then
    echo "Setting default SSH credentials for connections without them..."
    psql -h $DB_HOST -U $DB_USER -d $DB_NAME <<EOF
UPDATE guacamole_connection_parameter
SET parameter_value = '$DEFAULT_SSH_USER'
WHERE parameter_name = 'sftp-username'
AND (parameter_value IS NULL OR parameter_value = '');

-- Also set for connections that don't have SFTP username at all
INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
SELECT c.connection_id, 'sftp-username', '$DEFAULT_SSH_USER'
FROM guacamole_connection c
WHERE NOT EXISTS (
    SELECT 1 FROM guacamole_connection_parameter p
    WHERE p.connection_id = c.connection_id
    AND p.parameter_name = 'sftp-username'
)
ON CONFLICT DO NOTHING;
EOF
fi

echo "SFTP auto-configuration completed!"

# Keep running to handle new connections
while true; do
    sleep 300  # Check every 5 minutes
    psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT auto_configure_sftp();" 2>/dev/null || true
done
