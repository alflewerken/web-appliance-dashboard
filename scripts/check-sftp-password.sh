#!/bin/bash

# Check and fix SFTP password configuration

echo "========================================"
echo "SFTP Password Configuration Check"
echo "========================================"
echo ""

# First, let's see what credentials are configured
echo "1. Current SFTP configuration:"
docker exec -i appliance_guacamole_db psql -U guacamole_user -d guacamole_db -x -c "
SELECT 
    c.connection_name,
    MAX(CASE WHEN p.parameter_name = 'hostname' THEN p.parameter_value END) as vnc_host,
    MAX(CASE WHEN p.parameter_name = 'username' THEN p.parameter_value END) as vnc_user,
    MAX(CASE WHEN p.parameter_name = 'sftp-hostname' THEN p.parameter_value END) as sftp_host,
    MAX(CASE WHEN p.parameter_name = 'sftp-username' THEN p.parameter_value END) as sftp_user,
    LENGTH(MAX(CASE WHEN p.parameter_name = 'sftp-password' THEN p.parameter_value END)) as sftp_pass_length
FROM guacamole_connection c
LEFT JOIN guacamole_connection_parameter p ON c.connection_id = p.connection_id
WHERE c.connection_name LIKE 'dashboard-%'
GROUP BY c.connection_id, c.connection_name;
"

echo ""
echo "2. Checking appliance SSH configuration in main database:"
docker exec -i appliance_database mysql -uroot -prootpassword123 appliance_dashboard -e "
SELECT 
    a.id,
    a.name,
    a.ssh_host_id,
    h.hostname as ssh_hostname,
    h.username as ssh_username,
    CASE WHEN h.password_encrypted IS NOT NULL THEN 'SET' ELSE 'NOT SET' END as ssh_password
FROM appliances a
LEFT JOIN ssh_hosts h ON a.ssh_host_id = h.id
WHERE a.remote_desktop_enabled = 1;
" 2>/dev/null || echo "Could not query SSH hosts"

echo ""
echo "3. Let me set a default password for SFTP (you should change this):"
read -p "Enter SSH password for SFTP (or press Enter to skip): " SSH_PASS

if [ ! -z "$SSH_PASS" ]; then
    # Update SFTP password for all connections
    docker exec -i appliance_guacamole_db psql -U guacamole_user -d guacamole_db <<EOF
UPDATE guacamole_connection_parameter
SET parameter_value = '$SSH_PASS'
WHERE parameter_name = 'sftp-password'
AND connection_id IN (
    SELECT connection_id FROM guacamole_connection 
    WHERE connection_name LIKE 'dashboard-%'
);
EOF
    echo "Password updated!"
else
    echo "Skipped password update"
fi

echo ""
echo "4. Final check - restart services:"
docker-compose restart guacd guacamole

echo ""
echo "========================================"
echo "✅ Configuration checked!"
echo "========================================"
echo ""
echo "Important: For SFTP to work, you need:"
echo "1. Valid SSH credentials (username/password)"
echo "2. SSH access to the target host"
echo "3. Write permissions in the upload directory (/tmp)"
echo ""
echo "Test SSH access with:"
echo "ssh username@hostname"
