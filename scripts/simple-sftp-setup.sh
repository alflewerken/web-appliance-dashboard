#!/bin/bash

# Simple SFTP fix - set credentials directly

echo "========================================"
echo "Einfache SFTP-Konfiguration"
echo "========================================"
echo ""

# Get user input
read -p "SSH-Benutzername (z.B. alflewerken): " SSH_USER
read -sp "SSH-Passwort: " SSH_PASS
echo ""
read -p "SSH-Host (z.B. 192.168.178.70): " SSH_HOST

# Set default values if empty
SSH_USER=${SSH_USER:-alflewerken}
SSH_HOST=${SSH_HOST:-192.168.178.70}

echo ""
echo "Konfiguriere SFTP mit:"
echo "- Host: $SSH_HOST"
echo "- User: $SSH_USER"
echo "- Upload-Verzeichnis: /home/$SSH_USER/Desktop"
echo ""

# Update all dashboard connections
docker exec -i appliance_guacamole_db psql -U guacamole_user -d guacamole_db <<EOF
-- Update SFTP settings for all dashboard connections
UPDATE guacamole_connection_parameter
SET parameter_value = CASE parameter_name
    WHEN 'sftp-hostname' THEN '$SSH_HOST'
    WHEN 'sftp-username' THEN '$SSH_USER'
    WHEN 'sftp-password' THEN '$SSH_PASS'
    WHEN 'sftp-root-directory' THEN '/home/$SSH_USER/Desktop'
    ELSE parameter_value
END
WHERE parameter_name IN ('sftp-hostname', 'sftp-username', 'sftp-password', 'sftp-root-directory')
AND connection_id IN (
    SELECT connection_id FROM guacamole_connection 
    WHERE connection_name LIKE 'dashboard-%'
);

-- Ensure all necessary parameters exist
DO \$\$
DECLARE
    conn RECORD;
BEGIN
    FOR conn IN SELECT connection_id FROM guacamole_connection WHERE connection_name LIKE 'dashboard-%'
    LOOP
        -- Essential SFTP parameters
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES 
            (conn.connection_id, 'enable-sftp', 'true'),
            (conn.connection_id, 'sftp-hostname', '$SSH_HOST'),
            (conn.connection_id, 'sftp-port', '22'),
            (conn.connection_id, 'sftp-username', '$SSH_USER'),
            (conn.connection_id, 'sftp-password', '$SSH_PASS'),
            (conn.connection_id, 'sftp-root-directory', '/home/$SSH_USER/Desktop'),
            (conn.connection_id, 'sftp-server-alive-interval', '10'),
            (conn.connection_id, 'sftp-disable-host-key-checking', 'true')
        ON CONFLICT (connection_id, parameter_name) DO UPDATE 
        SET parameter_value = EXCLUDED.parameter_value;
    END LOOP;
END\$\$;

-- Show configuration
SELECT 
    c.connection_name,
    MAX(CASE WHEN p.parameter_name = 'sftp-hostname' THEN p.parameter_value END) as host,
    MAX(CASE WHEN p.parameter_name = 'sftp-username' THEN p.parameter_value END) as user,
    MAX(CASE WHEN p.parameter_name = 'sftp-root-directory' THEN p.parameter_value END) as directory
FROM guacamole_connection c
LEFT JOIN guacamole_connection_parameter p ON c.connection_id = p.connection_id
WHERE c.connection_name LIKE 'dashboard-%'
GROUP BY c.connection_id, c.connection_name;
EOF

echo ""
echo "Erstelle Desktop-Verzeichnis auf Remote-Host (falls nicht vorhanden)..."
ssh -o StrictHostKeyChecking=no ${SSH_USER}@${SSH_HOST} "mkdir -p ~/Desktop && chmod 755 ~/Desktop" 2>/dev/null || echo "Konnte Verzeichnis nicht erstellen (SSH-Zugriff prüfen)"

echo ""
echo "Restart Guacamole..."
docker-compose restart guacd guacamole

echo ""
echo "========================================"
echo "✅ SFTP ist jetzt konfiguriert!"
echo "========================================"
echo ""
echo "Wichtig:"
echo "1. Browser komplett neu laden (Strg+F5)"
echo "2. Remote Desktop Verbindung neu aufbauen"
echo "3. Datei per Drag & Drop ins Fenster ziehen"
echo ""
echo "Dateien landen in: /home/$SSH_USER/Desktop"
echo ""
echo "Falls es nicht funktioniert, prüfen Sie:"
echo "- SSH-Zugang: ssh $SSH_USER@$SSH_HOST"
echo "- Verzeichnis existiert: ls -la /home/$SSH_USER/Desktop"
