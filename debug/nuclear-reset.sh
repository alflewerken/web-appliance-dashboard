#!/bin/bash
# Nuclear Option - Complete Reset

echo "🔥 NUCLEAR RESET - Komplette Neuinstallation"
echo "==========================================="

cd /Users/alflewerken/Desktop/web-appliance-dashboard

# 1. Stop everything
echo "1. Stopping all containers..."
docker-compose down -v

# 2. Clean Docker
echo "2. Cleaning Docker system..."
docker system prune -f

# 3. Remove ALL build artifacts
echo "3. Removing ALL build artifacts..."
rm -rf frontend/build
rm -rf frontend/node_modules/.cache
rm -rf frontend/.parcel-cache
rm -rf backend/node_modules/.cache

# 4. Clear any service worker files
echo "4. Clearing service worker files..."
find frontend/public -name "*sw*.js" -type f -delete 2>/dev/null || true
find frontend/build -name "*sw*.js" -type f -delete 2>/dev/null || true

# 5. Rebuild frontend
echo "5. Rebuilding frontend..."
cd frontend
npm run build

# 6. Start fresh
echo "6. Starting fresh containers..."
cd ..
docker-compose up -d

# 7. Wait for startup
echo "7. Waiting for services to start..."
sleep 20

# 8. Test
echo "8. Testing services..."
curl -s http://localhost:9080/api/health | jq .

echo ""
echo "==========================================="
echo "✅ Complete reset done!"
echo ""
echo "WICHTIG: Öffne die App in einem NEUEN Browser:"
echo "1. Schließe ALLE Browser-Fenster"
echo "2. Öffne einen anderen Browser (z.B. Safari statt Chrome)"
echo "3. Gehe zu http://localhost:9080"
echo "4. Login mit admin/admin123"
