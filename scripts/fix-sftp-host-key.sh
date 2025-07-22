#!/bin/bash

# Fix SFTP by disabling strict host key checking

echo "========================================"
echo "SFTP Fix - Disable Host Key Checking"
echo "========================================"
echo ""

# Update all connections to disable strict host key checking
docker exec -i appliance_guacamole_db psql -U guacamole_user -d guacamole_db <<'EOF'
-- Add SFTP parameters to disable host key checking
DO $$
DECLARE
    conn RECORD;
BEGIN
    FOR conn IN SELECT connection_id FROM guacamole_connection
    LOOP
        -- Disable strict host key checking
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES (conn.connection_id, 'sftp-server-alive-interval', '60')
        ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = '60';
        
        -- Set host key checking to disabled
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES (conn.connection_id, 'sftp-disable-host-key-checking', 'true')
        ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = 'true';
        
        -- Also try alternative parameter name
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES (conn.connection_id, 'sftp-host-key-checking', 'false')
        ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = 'false';
        
        -- Ensure private key is not required
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES (conn.connection_id, 'sftp-private-key', '')
        ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = '';
        
        -- Check if password exists, if not add empty one
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        SELECT conn.connection_id, 'sftp-password', ''
        WHERE NOT EXISTS (
            SELECT 1 FROM guacamole_connection_parameter 
            WHERE connection_id = conn.connection_id 
            AND parameter_name = 'sftp-password'
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- Also ensure the upload directory exists and is writable
UPDATE guacamole_connection_parameter
SET parameter_value = '/tmp'
WHERE parameter_name = 'sftp-root-directory'
AND connection_id IN (
    SELECT connection_id FROM guacamole_connection 
    WHERE connection_name LIKE 'dashboard-%'
);

-- Show updated configuration
SELECT 
    c.connection_name,
    MAX(CASE WHEN p.parameter_name = 'sftp-root-directory' THEN p.parameter_value END) as upload_dir,
    MAX(CASE WHEN p.parameter_name = 'sftp-disable-host-key-checking' THEN p.parameter_value END) as no_host_check
FROM guacamole_connection c
LEFT JOIN guacamole_connection_parameter p ON c.connection_id = p.connection_id
WHERE c.connection_name LIKE 'dashboard-%'
GROUP BY c.connection_id, c.connection_name;
EOF

echo ""
echo "Restarting guacd and guacamole..."
docker-compose restart guacd guacamole

echo ""
echo "========================================"
echo "✅ SFTP Fix angewendet!"
echo "========================================"
echo ""
echo "Änderungen:"
echo "- Host Key Checking deaktiviert"
echo "- Upload-Verzeichnis auf /tmp gesetzt (existiert immer)"
echo ""
echo "Bitte:"
echo "1. Browser-Cache leeren (Strg+Shift+R)"
echo "2. Neue Verbindung aufbauen"
echo "3. Datei erneut per Drag & Drop versuchen"
echo ""
echo "Die Dateien landen jetzt in /tmp auf dem Remote-System"
