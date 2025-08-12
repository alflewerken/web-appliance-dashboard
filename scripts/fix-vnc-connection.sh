#!/bin/bash

# Fix VNC Connection for macOS Screen Sharing
# This script updates the Guacamole connection parameters for macOS

echo "=== Fixing VNC Connection Parameters for macOS ==="

# Check if Screen Sharing is enabled
if system_profiler SPFirewallDataType | grep -q "Screen Sharing: On"; then
    echo "✅ Screen Sharing is enabled"
else
    echo "⚠️  Screen Sharing is NOT enabled!"
    echo "Please enable it in System Settings > General > Sharing > Screen Sharing"
    echo ""
fi

# Get the local IP address
LOCAL_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || echo "localhost")
echo "Local IP: $LOCAL_IP"

# Update connection parameters in Guacamole database
docker exec appliance_guacamole_db psql -U guacamole_user -d guacamole_db <<EOF
-- Update VNC connections to use correct hostname
UPDATE guacamole_connection_parameter 
SET parameter_value = '$LOCAL_IP'
WHERE parameter_name = 'hostname' 
AND connection_id IN (
    SELECT connection_id FROM guacamole_connection 
    WHERE protocol = 'vnc'
);

-- Set correct VNC password if needed
UPDATE guacamole_connection_parameter 
SET parameter_value = 'vnc123'
WHERE parameter_name = 'password' 
AND connection_id IN (
    SELECT connection_id FROM guacamole_connection 
    WHERE protocol = 'vnc'
);

-- Disable authentication for VNC (macOS doesn't need username)
DELETE FROM guacamole_connection_parameter 
WHERE parameter_name = 'username' 
AND connection_id IN (
    SELECT connection_id FROM guacamole_connection 
    WHERE protocol = 'vnc'
);

-- Show current configuration
SELECT 
    c.connection_name,
    c.protocol,
    cp_host.parameter_value as hostname,
    cp_port.parameter_value as port,
    cp_pass.parameter_value as password
FROM guacamole_connection c
LEFT JOIN guacamole_connection_parameter cp_host 
    ON c.connection_id = cp_host.connection_id AND cp_host.parameter_name = 'hostname'
LEFT JOIN guacamole_connection_parameter cp_port 
    ON c.connection_id = cp_port.connection_id AND cp_port.parameter_name = 'port'
LEFT JOIN guacamole_connection_parameter cp_pass 
    ON c.connection_id = cp_pass.connection_id AND cp_pass.parameter_name = 'password'
WHERE c.protocol = 'vnc';
EOF

echo ""
echo "=== Configuration Updated ==="
echo ""
echo "Next steps:"
echo "1. Enable Screen Sharing in macOS System Settings"
echo "2. Set VNC password to 'vnc123' (or update the script with your password)"
echo "3. Restart Guacamole container: docker restart appliance_guacamole"
echo "4. Try connecting again through the web interface"
echo ""
echo "Alternative: Use RustDesk instead of VNC for better performance"
