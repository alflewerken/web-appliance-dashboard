#!/bin/bash

# Update VNC password for Guacamole connections
echo "=== Updating VNC Password for Guacamole ==="

# Check if password provided as argument
if [ -z "$1" ]; then
    echo "Usage: $0 <new-vnc-password>"
    echo "Example: $0 mysecretpassword"
    exit 1
fi

NEW_PASSWORD="$1"

echo "Updating VNC password to: ${NEW_PASSWORD:0:3}***"

docker exec appliance_guacamole_db psql -U guacamole_user -d guacamole_db <<EOF
-- Update VNC password for all VNC connections
UPDATE guacamole_connection_parameter 
SET parameter_value = '$NEW_PASSWORD'
WHERE parameter_name = 'password' 
AND connection_id IN (
    SELECT connection_id FROM guacamole_connection 
    WHERE protocol = 'vnc'
);

-- Show updated connections
SELECT 
    c.connection_name,
    c.protocol,
    cp.parameter_value as password_set
FROM guacamole_connection c
LEFT JOIN guacamole_connection_parameter cp 
    ON c.connection_id = cp.connection_id AND cp.parameter_name = 'password'
WHERE c.protocol = 'vnc';
EOF

echo ""
echo "✅ VNC password updated successfully!"
echo ""
echo "Next steps:"
echo "1. Update your VNC server with the same password"
echo "2. Restart Guacamole: docker restart appliance_guacamole"
echo "3. Test the connection through the web interface"
