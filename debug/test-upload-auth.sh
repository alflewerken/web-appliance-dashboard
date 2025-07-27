#!/bin/bash
# Test SSH File Upload with correct credentials

echo "🔍 Testing SSH File Upload with Auth..."
echo "======================================"

# Create test file
TEST_FILE="/tmp/test-upload-$(date +%s).txt"
echo "Test upload content - $(date)" > "$TEST_FILE"
echo "Created test file: $TEST_FILE"

# Get auth token
echo -e "\n1. Getting auth token..."
TOKEN=$(curl -X POST http://localhost:9080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  2>/dev/null | jq -r '.token')

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
  echo "✅ Got token: ${TOKEN:0:20}..."
  
  # Test upload
  echo -e "\n2. Testing file upload with authentication..."
  RESPONSE=$(curl -X POST http://localhost:9080/api/ssh/upload \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@$TEST_FILE" \
    -F "hostId=5" \
    -F "targetPath=/tmp" \
    -s)
  
  echo "Response:"
  echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
  
  # Check if successful
  if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "\n✅ Upload successful!"
    
    # Verify file on remote host
    echo -e "\n3. Verifying file on remote host..."
    docker exec appliance_backend ssh -i /root/.ssh/id_rsa_dashboard \
      -o StrictHostKeyChecking=no \
      alflewerken@192.168.178.70 \
      "ls -la /tmp/$(basename $TEST_FILE)" 2>&1 || echo "Could not verify remote file"
  else
    echo -e "\n❌ Upload failed"
    
    # Check backend logs
    echo -e "\n4. Checking backend logs..."
    docker logs --tail 20 appliance_backend 2>&1 | grep -i -E "(upload|SSH|DEBUG)" | tail -10
  fi
else
  echo "❌ Failed to get auth token"
fi

# Clean up
rm -f "$TEST_FILE"

echo -e "\n======================================"
echo "Done!"
