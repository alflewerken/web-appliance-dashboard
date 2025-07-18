#!/bin/bash

echo "Checking audit log details for deleted services..."

docker-compose exec database mariadb -u dashboard_user -pdashboard_pass123 -D appliance_dashboard -e "
SELECT 
  id, 
  action, 
  resource_type,
  SUBSTRING(details, 1, 200) as details_preview
FROM audit_logs 
WHERE action = 'appliance_delete' 
ORDER BY created_at DESC 
LIMIT 2;
" 2>/dev/null

echo -e "\n\nChecking full details for latest deleted service..."

docker-compose exec database mariadb -u dashboard_user -pdashboard_pass123 -D appliance_dashboard -e "
SELECT details
FROM audit_logs 
WHERE action = 'appliance_delete' 
ORDER BY created_at DESC 
LIMIT 1;
" 2>/dev/null | tail -n +2
