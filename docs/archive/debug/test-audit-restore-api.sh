#!/bin/bash

# Test the audit-restore endpoint directly

AUDIT_LOG_ID=381  # The latest appliance_delete entry

echo "Testing audit-restore endpoint for log ID: $AUDIT_LOG_ID"
echo "Getting auth token..."

# Get a token (you'll need to replace this with a valid token from your browser)
TOKEN="YOUR_VALID_TOKEN_HERE"

echo -e "\nFetching audit log details..."
curl -s -X GET "http://localhost:3001/api/audit-restore/$AUDIT_LOG_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

echo -e "\n\nPlease replace YOUR_VALID_TOKEN_HERE with a valid token from your browser's localStorage"
echo "You can get it by running in browser console: localStorage.getItem('token')"
