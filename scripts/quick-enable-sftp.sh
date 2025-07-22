#!/bin/bash

# Schnell-Konfiguration für SFTP in Guacamole

echo "=== Guacamole SFTP Aktivierung ==="
echo ""
echo "Dieses Script aktiviert die Dateiübertragung für Ihre Remote Desktop Verbindungen."
echo ""

# Verbindung zur Datenbank
DB_CONTAINER="appliance_guacamole_db"
DB_USER="guacamole_user"
DB_NAME="guacamole_db"

# Zeige aktuelle Verbindungen
echo "Aktuelle Verbindungen:"
docker exec -it $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "
SELECT connection_id || ': ' || connection_name || ' (' || protocol || ')' 
FROM guacamole_connection;"

echo ""
read -p "Geben Sie die Connection ID ein (oder 'all' für alle): " CONNECTION_ID

# SSH-Zugangsdaten abfragen
read -p "SSH-Benutzername: " SSH_USER
read -sp "SSH-Passwort (wird nicht angezeigt): " SSH_PASS
echo ""

if [ "$CONNECTION_ID" = "all" ]; then
    # Für alle Verbindungen
    CONDITION=""
else
    # Für eine spezifische Verbindung
    CONDITION="AND connection_id = $CONNECTION_ID"
fi

# SQL-Befehle ausführen
docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME <<EOF
-- Aktiviere SFTP
UPDATE guacamole_connection_parameter 
SET parameter_value = 'true' 
WHERE parameter_name = 'enable-sftp' $CONDITION;

INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
SELECT connection_id, 'enable-sftp', 'true'
FROM guacamole_connection
WHERE connection_id NOT IN (
    SELECT connection_id FROM guacamole_connection_parameter 
    WHERE parameter_name = 'enable-sftp'
) $CONDITION;

-- Setze SFTP-Parameter
DO \$\$
DECLARE
    conn RECORD;
BEGIN
    FOR conn IN SELECT connection_id FROM guacamole_connection WHERE 1=1 $CONDITION
    LOOP
        -- SFTP aktivieren
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES (conn.connection_id, 'enable-sftp', 'true')
        ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = 'true';
        
        -- SFTP-Hostname (gleich wie RDP/VNC-Host)
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        SELECT conn.connection_id, 'sftp-hostname', parameter_value
        FROM guacamole_connection_parameter
        WHERE connection_id = conn.connection_id AND parameter_name = 'hostname'
        ON CONFLICT (connection_id, parameter_name) DO NOTHING;
        
        -- SFTP-Port
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES (conn.connection_id, 'sftp-port', '22')
        ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = '22';
        
        -- SFTP-Benutzername
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES (conn.connection_id, 'sftp-username', '$SSH_USER')
        ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = '$SSH_USER';
        
        -- SFTP-Passwort
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES (conn.connection_id, 'sftp-password', '$SSH_PASS')
        ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = '$SSH_PASS';
        
        -- Upload-Verzeichnis
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES (conn.connection_id, 'sftp-root-directory', '/home/$SSH_USER/Desktop')
        ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = '/home/$SSH_USER/Desktop';
    END LOOP;
END\$\$;

-- Zeige Ergebnis
SELECT c.connection_name, 
       p1.parameter_value as sftp_enabled,
       p2.parameter_value as sftp_host,
       p3.parameter_value as sftp_user
FROM guacamole_connection c
LEFT JOIN guacamole_connection_parameter p1 ON c.connection_id = p1.connection_id AND p1.parameter_name = 'enable-sftp'
LEFT JOIN guacamole_connection_parameter p2 ON c.connection_id = p2.connection_id AND p2.parameter_name = 'sftp-hostname'
LEFT JOIN guacamole_connection_parameter p3 ON c.connection_id = p3.connection_id AND p3.parameter_name = 'sftp-username'
WHERE 1=1 $CONDITION;
EOF

echo ""
echo "=== SFTP wurde aktiviert! ==="
echo ""
echo "Nächste Schritte:"
echo "1. Guacamole neu starten: docker-compose restart guacamole"
echo "2. Browser-Cache leeren (Strg+Shift+R)"
echo "3. Verbindung neu aufbauen"
echo ""
echo "Danach können Sie Dateien per Drag & Drop übertragen!"
echo "Die Dateien landen in: /home/$SSH_USER/Desktop"
