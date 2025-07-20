#!/bin/bash

# Dieses Script erstellt automatisch eine Guacamole-Verbindung über die Datenbank
# Wird im Backend-Container ausgeführt

DB_HOST="appliance_guacamole_db"
DB_NAME="guacamole_db"
DB_USER="guacamole_user"
DB_PASS="${GUACAMOLE_DB_PASSWORD:-xF40lexuP7qe1fb8MkkW40bXdXd+jrCe}"

# Funktion zum Erstellen einer VNC-Verbindung direkt in der DB
create_vnc_connection() {
    local name=$1
    local host=$2
    local port=$3
    local vnc_pass=$4
    local vnc_user=$5
    
    # Erstelle Verbindung in Guacamole DB
    PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -d $DB_NAME <<EOF
-- Erstelle neue Verbindung
INSERT INTO guacamole_connection (connection_name, protocol)
VALUES ('$name', 'vnc')
ON CONFLICT (connection_name) DO UPDATE
SET protocol = 'vnc'
RETURNING connection_id;

-- Hole connection_id
DO \$\$
DECLARE
    conn_id INTEGER;
BEGIN
    SELECT connection_id INTO conn_id FROM guacamole_connection WHERE connection_name = '$name';
    
    -- Setze Parameter
    DELETE FROM guacamole_connection_parameter WHERE connection_id = conn_id;
    
    INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
    VALUES 
        (conn_id, 'hostname', '$host'),
        (conn_id, 'port', '$port'),
        (conn_id, 'password', '$vnc_pass');
    
    -- Wenn Username vorhanden
    IF '$vnc_user' != '' THEN
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES (conn_id, 'username', '$vnc_user');
    END IF;
    
    -- Erlaube allen Benutzern Zugriff (für Demo)
    INSERT INTO guacamole_connection_permission (entity_id, connection_id, permission)
    SELECT entity_id, conn_id, 'READ'
    FROM guacamole_entity 
    WHERE type = 'USER'
    ON CONFLICT DO NOTHING;
END\$\$;
EOF
}

# Export die Funktion für Verwendung im Node.js Backend
export -f create_vnc_connection
