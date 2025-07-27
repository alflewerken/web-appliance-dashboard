#!/bin/bash
# Test Upload for Nextcloud-Mac directly

echo "🔍 Testing Upload to Nextcloud-Mac..."
echo "===================================="

# Create test file
TEST_FILE="/tmp/test-mac-upload-$(date +%s).txt"
echo "Test upload to Mac - $(date)" > "$TEST_FILE"

# Get auth token
TOKEN=$(curl -s -X POST http://localhost:9080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to get auth token"
  exit 1
fi

echo "✅ Got auth token"

# Test upload to Mac (host ID 5)
echo -e "\nUploading to Mac (host ID 5)..."
RESPONSE=$(curl -s -X POST http://localhost:9080/api/ssh/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_FILE" \
  -F "hostId=5" \
  -F "targetPath=/Users/alflewerken/Desktop" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS:")

echo "HTTP Status: $HTTP_STATUS"
echo "Response body:"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"

# Check if file exists on Mac
if echo "$BODY" | grep -q '"success":true'; then
  echo -e "\n✅ Upload reported as successful"
  echo "Verifying file on Mac..."
  
  docker exec appliance_backend ssh -i /root/.ssh/id_rsa_dashboard \
    -o StrictHostKeyChecking=no \
    alflewerken@192.168.178.70 \
    "ls -la /Users/alflewerken/Desktop/$(basename $TEST_FILE)" 2>&1
else
  echo -e "\n❌ Upload failed"
  
  # Check logs
  echo -e "\nChecking backend logs..."
  docker logs --tail 30 appliance_backend 2>&1 | grep -i -E "(upload|DEBUG|ERROR)" | tail -10
fi

# Cleanup
rm -f "$TEST_FILE"

echo -e "\n===================================="
