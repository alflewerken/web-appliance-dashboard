#!/bin/bash

# Enable SFTP for all Guacamole connections - One-time setup

echo "===========================================" 
echo "Guacamole SFTP Auto-Enable Setup"
echo "==========================================="
echo ""
echo "Dieses Script aktiviert SFTP für alle Guacamole-Verbindungen."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env Datei nicht gefunden!"
    echo "Bitte kopieren Sie .env.example nach .env und setzen Sie DEFAULT_SSH_USER und DEFAULT_SSH_PASS"
    exit 1
fi

# Load environment variables
source .env

# Check for required variables
if [ -z "$DEFAULT_SSH_USER" ]; then
    echo "WARNUNG: DEFAULT_SSH_USER ist nicht gesetzt in .env"
    read -p "Bitte geben Sie den Standard SSH-Benutzernamen ein: " DEFAULT_SSH_USER
fi

if [ -z "$DEFAULT_SSH_PASS" ]; then
    echo "WARNUNG: DEFAULT_SSH_PASS ist nicht gesetzt in .env"
    read -sp "Bitte geben Sie das Standard SSH-Passwort ein: " DEFAULT_SSH_PASS
    echo ""
fi

# Update .env if needed
if ! grep -q "DEFAULT_SSH_USER=" .env; then
    echo "" >> .env
    echo "# Default SSH credentials for SFTP in Guacamole" >> .env
    echo "DEFAULT_SSH_USER=$DEFAULT_SSH_USER" >> .env
    echo "DEFAULT_SSH_PASS=$DEFAULT_SSH_PASS" >> .env
fi

echo ""
echo "Aktiviere SFTP mit folgenden Einstellungen:"
echo "- SSH-Benutzer: $DEFAULT_SSH_USER"
echo "- Upload-Verzeichnis: /home/$DEFAULT_SSH_USER/Desktop"
echo ""

# Rebuild Guacamole with new configuration
echo "1. Rebuilde Guacamole Container..."
docker-compose build guacamole

# Restart Guacamole services
echo "2. Starte Guacamole Services neu..."
docker-compose down guacamole guacamole-postgres guacd
docker-compose up -d guacamole-postgres
sleep 10  # Wait for database

# Initialize database with SFTP settings
echo "3. Initialisiere Datenbank mit SFTP-Einstellungen..."
docker-compose up -d guacd guacamole

# Wait for services to be ready
echo "4. Warte auf Service-Start..."
sleep 20

# Run SFTP configuration
echo "5. Konfiguriere SFTP für alle Verbindungen..."
docker exec -i appliance_guacamole_db psql -U guacamole_user -d guacamole_db <<EOF
-- Enable SFTP for all existing connections
DO \$\$
DECLARE
    conn RECORD;
BEGIN
    FOR conn IN SELECT connection_id, protocol FROM guacamole_connection
    LOOP
        -- Enable SFTP
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES (conn.connection_id, 'enable-sftp', 'true')
        ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = 'true';
        
        -- SFTP Port
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES (conn.connection_id, 'sftp-port', '22')
        ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = '22';
        
        -- SFTP Username
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES (conn.connection_id, 'sftp-username', '$DEFAULT_SSH_USER')
        ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = '$DEFAULT_SSH_USER';
        
        -- SFTP Password
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES (conn.connection_id, 'sftp-password', '$DEFAULT_SSH_PASS')
        ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = '$DEFAULT_SSH_PASS';
        
        -- Upload Directory
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES (conn.connection_id, 'sftp-root-directory', '/home/$DEFAULT_SSH_USER/Desktop')
        ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = '/home/$DEFAULT_SSH_USER/Desktop';
        
        -- Enable Upload/Download
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES 
            (conn.connection_id, 'sftp-disable-download', 'false'),
            (conn.connection_id, 'sftp-disable-upload', 'false')
        ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = 'false';
    END LOOP;
END\$\$;

-- Show results
SELECT c.connection_name, 
       p1.parameter_value as sftp_enabled,
       p2.parameter_value as sftp_user
FROM guacamole_connection c
LEFT JOIN guacamole_connection_parameter p1 ON c.connection_id = p1.connection_id AND p1.parameter_name = 'enable-sftp'
LEFT JOIN guacamole_connection_parameter p2 ON c.connection_id = p2.connection_id AND p2.parameter_name = 'sftp-username';
EOF

echo ""
echo "==========================================="
echo "✅ SFTP wurde erfolgreich aktiviert!"
echo "==========================================="
echo ""
echo "Dateiübertragung funktioniert jetzt automatisch:"
echo "- Drag & Drop von Dateien ins Browser-Fenster"
echo "- Dateien landen in: /home/$DEFAULT_SSH_USER/Desktop"
echo "- Guacamole-Menü: Strg+Alt+Shift"
echo ""
echo "Hinweis: Browser-Cache leeren (Strg+Shift+R) und Verbindung neu aufbauen!"
