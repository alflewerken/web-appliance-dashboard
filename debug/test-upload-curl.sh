#!/bin/bash
# Test SSH File Upload with curl

echo "🔍 Testing SSH File Upload..."
echo "============================"

# Create test file
TEST_FILE="/tmp/test-upload-$(date +%s).txt"
echo "Test upload content - $(date)" > "$TEST_FILE"
echo "Created test file: $TEST_FILE"

# Test 1: Check if upload route exists
echo -e "\n1. Testing upload route accessibility..."
curl -X POST http://localhost:9080/api/ssh/upload-test \
  -H "Content-Type: application/json" \
  2>/dev/null | jq . || echo "Failed to access upload test route"

# Test 2: Try file upload
echo -e "\n2. Testing actual file upload..."
curl -X POST http://localhost:9080/api/ssh/upload \
  -F "file=@$TEST_FILE" \
  -F "hostId=5" \
  -F "targetPath=/tmp" \
  -v 2>&1 | grep -E "(< HTTP|upload|Upload|error|Error)"

# Test 3: Check with auth token if needed
echo -e "\n3. Getting auth token..."
TOKEN=$(curl -X POST http://localhost:9080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  2>/dev/null | jq -r '.token')

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
  echo "Got token: ${TOKEN:0:20}..."
  
  echo -e "\n4. Testing upload with authentication..."
  curl -X POST http://localhost:9080/api/ssh/upload \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@$TEST_FILE" \
    -F "hostId=5" \
    -F "targetPath=/tmp" \
    2>/dev/null | jq . || echo "Upload failed"
else
  echo "❌ Failed to get auth token"
fi

# Clean up
rm -f "$TEST_FILE"

echo -e "\n============================"
echo "Check backend logs with:"
echo "docker logs --tail 50 appliance_backend 2>&1 | grep -i upload"
