#!/bin/bash

echo "=== Testing Guacamole Connection directly ==="

# Get auth token
echo "Getting auth token..."
TOKEN=$(curl -s -X POST "http://localhost:9080/guacamole/api/tokens" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=guacadmin&password=guacadmin" | jq -r '.authToken')

if [ -z "$TOKEN" ]; then
  echo "Failed to get auth token"
  exit 1
fi

echo "Token received: ${TOKEN:0:20}..."

# List connections
echo -e "\nListing connections..."
curl -s "http://localhost:9080/guacamole/api/session/data/postgresql/connections?token=$TOKEN" | jq '.'

# Try to connect to connection 1
echo -e "\nTrying to connect to connection 1..."
IDENTIFIER=$(echo -n "1\0c\0postgresql" | base64)
echo "Identifier: $IDENTIFIER"

# Get connection parameters
echo -e "\nGetting connection parameters..."
curl -s "http://localhost:9080/guacamole/api/session/data/postgresql/connections/1?token=$TOKEN" | jq '.'

# Test WebSocket endpoint
echo -e "\nTesting WebSocket endpoint..."
curl -I "http://localhost:9080/guacamole/websocket-tunnel?token=$TOKEN"
