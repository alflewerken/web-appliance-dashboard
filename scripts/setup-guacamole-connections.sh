#!/bin/bash

# Guacamole Admin Credentials
GUAC_USER="guacadmin"
GUAC_PASS="guacadmin"
GUAC_URL="http://localhost:9070/guacamole"

# Funktion zum Einloggen und Token holen
get_auth_token() {
    curl -s -X POST "${GUAC_URL}/api/tokens" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=${GUAC_USER}&password=${GUAC_PASS}" | \
        jq -r '.authToken'
}

# Funktion zum Erstellen einer VNC Verbindung
create_vnc_connection() {
    local name=$1
    local host=$2
    local port=$3
    local vnc_pass=$4
    local vnc_user=$5
    local token=$6
    
    # JSON Payload für die Verbindung
    local payload=$(cat <<EOF
{
    "parentIdentifier": "ROOT",
    "name": "${name}",
    "protocol": "vnc",
    "parameters": {
        "hostname": "${host}",
        "port": "${port}",
        "password": "${vnc_pass}"
    },
    "attributes": {
        "max-connections": "",
        "max-connections-per-user": ""
    }
}
EOF
)

    # Wenn VNC User angegeben ist, füge ihn hinzu
    if [ ! -z "$vnc_user" ]; then
        payload=$(echo "$payload" | jq --arg user "$vnc_user" '.parameters.username = $user')
    fi

    # Erstelle die Verbindung
    curl -s -X POST "${GUAC_URL}/api/session/data/postgresql/connections" \
        -H "Authorization: Bearer ${token}" \
        -H "Content-Type: application/json" \
        -d "$payload"
}

# Hauptprogramm
echo "Setting up Guacamole connections..."

# Hole Auth Token
TOKEN=$(get_auth_token)
if [ -z "$TOKEN" ]; then
    echo "Failed to authenticate with Guacamole"
    exit 1
fi

echo "Successfully authenticated with Guacamole"

# Erstelle Verbindung für Nextcloud-Mac
echo "Creating VNC connection for Nextcloud-Mac..."
create_vnc_connection \
    "Nextcloud-Mac" \
    "192.168.178.70" \
    "5900" \
    "YOUR_VNC_PASSWORD" \
    "alflewerken" \
    "$TOKEN"

echo "Done! You can now access the connection in Guacamole"
echo "Login with: ${GUAC_USER} / ${GUAC_PASS}"
