#!/bin/bash

# Test service creation with SSE

# Get auth token
echo "Getting auth token..."
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "Alf", "password": "admin"}' | \
  jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "Using hardcoded token for testing..."
  # You need to get a valid token from the browser console
  TOKEN="YOUR_TOKEN_HERE"
fi

echo "Creating test service..."
curl -X POST http://localhost:3001/api/appliances \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Service SSE",
    "url": "https://example.com",
    "icon": "TestTube",
    "color": "#FF0000",
    "description": "Testing SSE events"
  }' | jq

echo -e "\nCheck the browser console and audit log for SSE events!"
