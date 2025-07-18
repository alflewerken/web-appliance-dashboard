#!/bin/bash

# Test Audit Log API

# First, let's get a token by logging in
echo "Getting auth token..."
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin"}' | \
  jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "Failed to get auth token"
  exit 1
fi

echo "Token received: ${TOKEN:0:20}..."

# Now fetch audit logs
echo -e "\nFetching audit logs..."
curl -s -X GET http://localhost:3001/api/audit-logs \
  -H "Authorization: Bearer $TOKEN" | \
  jq '.[0:3]'
