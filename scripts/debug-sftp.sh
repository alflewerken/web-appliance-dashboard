#!/bin/bash

# Debug SFTP configuration for Guacamole

echo "========================================"
echo "SFTP Debug für Guacamole"
echo "========================================"
echo ""

# Zeige aktuelle SFTP-Konfiguration
echo "1. Aktuelle SFTP-Konfiguration in Guacamole:"
docker exec -i appliance_guacamole_db psql -U guacamole_user -d guacamole_db -x -c "
SELECT 
    c.connection_name,
    c.protocol,
    MAX(CASE WHEN p.parameter_name = 'enable-sftp' THEN p.parameter_value END) as sftp_enabled,
    MAX(CASE WHEN p.parameter_name = 'sftp-hostname' THEN p.parameter_value END) as sftp_host,
    MAX(CASE WHEN p.parameter_name = 'sftp-port' THEN p.parameter_value END) as sftp_port,
    MAX(CASE WHEN p.parameter_name = 'sftp-username' THEN p.parameter_value END) as sftp_user,
    MAX(CASE WHEN p.parameter_name = 'sftp-root-directory' THEN p.parameter_value END) as sftp_directory,
    MAX(CASE WHEN p.parameter_name = 'sftp-disable-upload' THEN p.parameter_value END) as upload_disabled,
    MAX(CASE WHEN p.parameter_name = 'sftp-disable-download' THEN p.parameter_value END) as download_disabled
FROM guacamole_connection c
LEFT JOIN guacamole_connection_parameter p ON c.connection_id = p.connection_id
WHERE c.connection_name LIKE 'dashboard-%'
GROUP BY c.connection_id, c.connection_name, c.protocol
ORDER BY c.connection_name;
"

echo ""
echo "2. Teste SSH-Verbindung zu den konfigurierten Hosts:"
# Hole SSH-Hosts aus der Datenbank
docker exec -i appliance_database mysql -uroot -prootpassword123 appliance_dashboard -e "
SELECT id, hostname, username FROM ssh_hosts;
" 2>/dev/null

echo ""
echo "3. Überprüfe guacd Logs für SFTP-Fehler:"
docker logs appliance_guacd --tail 50 | grep -i "sftp\|file\|upload" || echo "Keine SFTP-bezogenen Logs gefunden"

echo ""
echo "4. Überprüfe Guacamole Web-App Logs:"
docker logs appliance_guacamole --tail 50 | grep -i "sftp\|file\|upload" || echo "Keine SFTP-bezogenen Logs gefunden"

echo ""
echo "5. Verzeichnis-Check auf dem Remote-System:"
echo "Bitte prüfen Sie folgende Verzeichnisse auf dem Remote-System:"
echo "- /home/[username]/Desktop"
echo "- /tmp"
echo "- /home/[username]"
echo ""
echo "Mit dem Befehl: ls -la /home/*/Desktop/"
