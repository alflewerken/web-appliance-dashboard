#!/bin/bash

# Script zum Aktivieren von SFTP für alle Guacamole-Verbindungen

# Datenbankverbindung
DB_HOST="localhost"
DB_NAME="guacamole_db"
DB_USER="guacamole_user"
DB_PASSWORD="guacamole_pass123"

# Docker Container Name
CONTAINER_NAME="appliance_guacamole_db"

echo "Aktiviere SFTP für alle Verbindungen..."

# SQL-Befehl zum Hinzufügen der SFTP-Parameter
docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME <<EOF
-- Füge SFTP-Parameter für alle RDP-Verbindungen hinzu
INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
SELECT c.connection_id, 'enable-sftp', 'true'
FROM guacamole_connection c
WHERE c.protocol = 'rdp'
AND NOT EXISTS (
    SELECT 1 FROM guacamole_connection_parameter p
    WHERE p.connection_id = c.connection_id
    AND p.parameter_name = 'enable-sftp'
)
ON CONFLICT (connection_id, parameter_name) DO UPDATE
SET parameter_value = 'true';

-- SFTP-Hostname (gleich wie RDP-Host)
INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
SELECT c.connection_id, 'sftp-hostname', p.parameter_value
FROM guacamole_connection c
JOIN guacamole_connection_parameter p ON c.connection_id = p.connection_id
WHERE c.protocol = 'rdp'
AND p.parameter_name = 'hostname'
AND NOT EXISTS (
    SELECT 1 FROM guacamole_connection_parameter p2
    WHERE p2.connection_id = c.connection_id
    AND p2.parameter_name = 'sftp-hostname'
)
ON CONFLICT (connection_id, parameter_name) DO NOTHING;

-- SFTP-Port
INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
SELECT c.connection_id, 'sftp-port', '22'
FROM guacamole_connection c
WHERE c.protocol = 'rdp'
AND NOT EXISTS (
    SELECT 1 FROM guacamole_connection_parameter p
    WHERE p.connection_id = c.connection_id
    AND p.parameter_name = 'sftp-port'
)
ON CONFLICT (connection_id, parameter_name) DO UPDATE
SET parameter_value = '22';

-- SFTP-Root-Verzeichnis
INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
SELECT c.connection_id, 'sftp-root-directory', '/home/\${GUAC_USERNAME}/Desktop'
FROM guacamole_connection c
WHERE c.protocol = 'rdp'
AND NOT EXISTS (
    SELECT 1 FROM guacamole_connection_parameter p
    WHERE p.connection_id = c.connection_id
    AND p.parameter_name = 'sftp-root-directory'
)
ON CONFLICT (connection_id, parameter_name) DO UPDATE
SET parameter_value = '/home/\${GUAC_USERNAME}/Desktop';

-- Erlaube das Erstellen des Upload-Verzeichnisses
INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
SELECT c.connection_id, 'sftp-disable-upload', 'false'
FROM guacamole_connection c
WHERE c.protocol = 'rdp'
AND NOT EXISTS (
    SELECT 1 FROM guacamole_connection_parameter p
    WHERE p.connection_id = c.connection_id
    AND p.parameter_name = 'sftp-disable-upload'
)
ON CONFLICT (connection_id, parameter_name) DO UPDATE
SET parameter_value = 'false';

-- Zeige aktuelle Verbindungen mit SFTP-Status
SELECT c.connection_name, 
       CASE WHEN p.parameter_value = 'true' THEN 'Aktiviert' ELSE 'Deaktiviert' END as sftp_status
FROM guacamole_connection c
LEFT JOIN guacamole_connection_parameter p ON c.connection_id = p.connection_id 
    AND p.parameter_name = 'enable-sftp'
WHERE c.protocol IN ('rdp', 'vnc');
EOF

echo "SFTP-Konfiguration abgeschlossen!"
echo ""
echo "Wichtig: Sie müssen noch folgende Schritte durchführen:"
echo "1. SSH-Benutzername für jede Verbindung setzen (sftp-username)"
echo "2. SSH-Passwort oder Private Key konfigurieren"
echo "3. Guacamole-Container neu starten: docker-compose restart guacamole"
