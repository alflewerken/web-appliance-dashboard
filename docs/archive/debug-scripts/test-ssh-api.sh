#!/bin/bash

echo "Testing SSH Management API"
echo "========================="

API_URL="http://localhost:3001/api"
TOKEN=$(cat ~/.appliance-token 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
    echo "No token found. Please login first."
    exit 1
fi

echo "1. Getting all SSH keys..."
curl -s -H "Authorization: Bearer $TOKEN" $API_URL/ssh/keys | jq '.'

echo -e "\n2. Getting all SSH hosts..."
curl -s -H "Authorization: Bearer $TOKEN" $API_URL/ssh/hosts | jq '.'

echo -e "\n3. Generating a test SSH key..."
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"keyName": "test-key", "keyType": "rsa", "keySize": 2048, "comment": "Test key for SSH management"}' \
  $API_URL/ssh/keys/generate | jq '.'

echo -e "\n4. Creating a test SSH host..."
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"hostname": "test-server", "host": "192.168.1.100", "username": "root", "port": 22, "key_name": "test-key"}' \
  $API_URL/ssh/hosts | jq '.'

echo -e "\nDone!"
