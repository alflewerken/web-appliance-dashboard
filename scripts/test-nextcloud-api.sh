#!/bin/bash

# Quick test script for Nextcloud API endpoint

echo "🔍 Testing Nextcloud API endpoint..."

# Get JWT token (you need to be logged in)
TOKEN=$(cat <<'EOF'
# Please copy your JWT token from the browser's localStorage
# In Browser Console: localStorage.getItem('token')
EOF
)

echo "Please enter your JWT token (from browser console: localStorage.getItem('token')):"
read -r TOKEN

echo ""
echo "📡 Testing connection..."
curl -X POST http://localhost:3001/api/nextcloud/connections \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Connection",
    "url": "http://localhost:8080",
    "username": "admin",
    "password": "admin"
  }' \
  -v

echo ""
echo "✅ Test complete"
