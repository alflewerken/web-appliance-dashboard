#!/bin/bash

# Quick fix to enable SFTP for all existing Guacamole connections
# using credentials already stored in the appliances

echo "========================================"
echo "Quick SFTP Enable for Existing Setup"
echo "========================================"
echo ""

# Run SQL to copy credentials and enable SFTP
docker exec -i appliance_guacamole_db psql -U guacamole_user -d guacamole_db <<'EOF'
-- Enable SFTP for all connections that don't have it yet
DO $$
DECLARE
    conn RECORD;
    host_value TEXT;
    user_value TEXT;
    pass_value TEXT;
BEGIN
    FOR conn IN 
        SELECT c.connection_id, c.connection_name
        FROM guacamole_connection c
        WHERE NOT EXISTS (
            SELECT 1 FROM guacamole_connection_parameter p
            WHERE p.connection_id = c.connection_id
            AND p.parameter_name = 'enable-sftp'
            AND p.parameter_value = 'true'
        )
    LOOP
        -- Get existing credentials
        SELECT parameter_value INTO host_value
        FROM guacamole_connection_parameter
        WHERE connection_id = conn.connection_id AND parameter_name = 'hostname'
        LIMIT 1;
        
        SELECT parameter_value INTO user_value
        FROM guacamole_connection_parameter
        WHERE connection_id = conn.connection_id AND parameter_name = 'username'
        LIMIT 1;
        
        SELECT parameter_value INTO pass_value
        FROM guacamole_connection_parameter
        WHERE connection_id = conn.connection_id AND parameter_name = 'password'
        LIMIT 1;
        
        -- Enable SFTP
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES (conn.connection_id, 'enable-sftp', 'true')
        ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = 'true';
        
        -- Set SFTP parameters using same credentials
        IF host_value IS NOT NULL THEN
            INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
            VALUES 
                (conn.connection_id, 'sftp-hostname', host_value),
                (conn.connection_id, 'sftp-port', '22'),
                (conn.connection_id, 'sftp-username', COALESCE(user_value, 'root')),
                (conn.connection_id, 'sftp-password', COALESCE(pass_value, '')),
                (conn.connection_id, 'sftp-root-directory', '/home/' || COALESCE(user_value, 'root') || '/Desktop'),
                (conn.connection_id, 'sftp-disable-download', 'false'),
                (conn.connection_id, 'sftp-disable-upload', 'false')
            ON CONFLICT (connection_id, parameter_name) DO UPDATE 
            SET parameter_value = EXCLUDED.parameter_value;
            
            RAISE NOTICE 'Enabled SFTP for connection %: %', conn.connection_id, conn.connection_name;
        END IF;
    END LOOP;
END $$;

-- Show status
SELECT 
    c.connection_name,
    c.protocol,
    MAX(CASE WHEN p.parameter_name = 'enable-sftp' THEN p.parameter_value END) as sftp_enabled,
    MAX(CASE WHEN p.parameter_name = 'sftp-hostname' THEN p.parameter_value END) as sftp_host,
    MAX(CASE WHEN p.parameter_name = 'sftp-username' THEN p.parameter_value END) as sftp_user
FROM guacamole_connection c
LEFT JOIN guacamole_connection_parameter p ON c.connection_id = p.connection_id
GROUP BY c.connection_id, c.connection_name, c.protocol
ORDER BY c.connection_name;
EOF

echo ""
echo "Restarting Guacamole..."
docker-compose restart guacamole

echo ""
echo "========================================"
echo "✅ Fertig! SFTP ist jetzt aktiviert"
echo "========================================"
echo ""
echo "Drag & Drop funktioniert jetzt automatisch!"
echo "Browser-Cache leeren (Strg+Shift+R) und neu verbinden."
