#!/bin/bash
# Check if FileTransferButton is in the build

echo "🔍 Checking FileTransferButton in Build..."
echo "========================================"

# Check if component is in source
echo "1. Source files:"
grep -r "FileTransferButton" /Users/alflewerken/Desktop/web-appliance-dashboard/frontend/src/ | grep -E "\.js:|\.jsx:" | wc -l
echo "   FileTransferButton references found"

# Check if it's in the build
echo -e "\n2. Build bundle:"
if [ -f "/Users/alflewerken/Desktop/web-appliance-dashboard/frontend/build/static/js/"*.js ]; then
  grep -o "FileTransferButton" /Users/alflewerken/Desktop/web-appliance-dashboard/frontend/build/static/js/*.js | wc -l
  echo "   FileTransferButton references in build"
else
  echo "   ❌ No build bundle found"
fi

# Check component CSS
echo -e "\n3. CSS files:"
find /Users/alflewerken/Desktop/web-appliance-dashboard/frontend/src -name "*.css" -exec grep -l "file-transfer" {} \; | head -5

# Test in browser
echo -e "\n4. To test in browser console:"
echo "document.querySelectorAll('[class*=\"file-transfer\"]').length"
echo "document.querySelectorAll('[title*=\"Datei\"]').length"

# Check for SSH connection in appliances
echo -e "\n5. Checking appliances with SSH connection:"
docker exec appliance_backend mysql -h database -u${DB_USER:-dashboard_user} -p${DB_PASSWORD:-dashboardpass123} ${DB_NAME:-appliance_dashboard} -e "SELECT id, name, ssh_connection FROM appliances WHERE ssh_connection IS NOT NULL AND deleted_at IS NULL;" 2>/dev/null | tail -n +2

echo -e "\n========================================"
echo "If FileTransferButton is not showing:"
echo "1. Check if appliance has ssh_connection configured"
echo "2. Clear browser cache and reload"
echo "3. Check browser console for errors"
