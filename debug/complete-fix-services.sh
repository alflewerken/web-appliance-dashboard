#!/bin/bash
# Complete fix for services loading issue

echo "🔧 Applying complete fix for services loading..."
echo "=============================================="

# 1. Clear all docker volumes (cache)
echo -e "\n1. Stopping all containers..."
cd /Users/alflewerken/Desktop/web-appliance-dashboard
docker-compose down

# 2. Remove old build artifacts
echo -e "\n2. Removing old build artifacts..."
rm -rf frontend/build/*
rm -rf frontend/node_modules/.cache

# 3. Rebuild frontend
echo -e "\n3. Rebuilding frontend..."
cd frontend
npm run build

# 4. Start everything fresh
echo -e "\n4. Starting containers..."
cd ..
docker-compose up -d

# 5. Wait for services to be ready
echo -e "\n5. Waiting for services to be ready..."
sleep 20

# 6. Test the services endpoint
echo -e "\n6. Testing services endpoint..."
TOKEN=$(curl -s -X POST http://localhost:9080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
  echo "✅ Got auth token"
  
  echo -e "\nTesting /api/services..."
  curl -s -H "Authorization: Bearer $TOKEN" \
    http://localhost:9080/api/services | jq '.services[0]' || echo "Failed"
else
  echo "❌ Failed to get auth token"
fi

echo -e "\n=============================================="
echo "✅ Fix applied!"
echo ""
echo "Please:"
echo "1. Clear your browser cache (Ctrl+Shift+Del)"
echo "2. Open http://localhost:9080 in an incognito/private window"
echo "3. Login with admin/admin123"
