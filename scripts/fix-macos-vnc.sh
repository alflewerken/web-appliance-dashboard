#!/bin/bash

# Update VNC connection for macOS compatibility
echo "Updating VNC connection for macOS compatibility..."

docker exec appliance_guacamole_db psql -U guacamole_user -d guacamole_db << 'EOF'
-- Update VNC parameters for macOS
UPDATE guacamole_connection_parameter 
SET parameter_value = CASE parameter_name
    WHEN 'color_depth' THEN '16'  -- macOS prefers 16-bit
    WHEN 'swap-red-blue' THEN 'true'  -- macOS uses BGR
    ELSE parameter_value
END
WHERE parameter_name IN ('color_depth', 'swap-red-blue')
AND connection_id IN (SELECT connection_id FROM guacamole_connection WHERE protocol = 'vnc');

-- Add macOS specific encoding
INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
SELECT connection_id, 'encodings', 'zrle ultra copyrect hextile zlib corre rre raw'
FROM guacamole_connection 
WHERE protocol = 'vnc'
AND connection_id NOT IN (
    SELECT connection_id FROM guacamole_connection_parameter 
    WHERE parameter_name = 'encodings'
);

-- Show current VNC settings
SELECT 
    c.connection_name,
    cp.parameter_name,
    cp.parameter_value
FROM guacamole_connection c
JOIN guacamole_connection_parameter cp ON c.connection_id = cp.connection_id
WHERE c.protocol = 'vnc'
ORDER BY c.connection_name, cp.parameter_name;
EOF

echo ""
echo "VNC connections updated for macOS compatibility!"
echo "Please restart Guacamole: docker restart appliance_guacamole"
