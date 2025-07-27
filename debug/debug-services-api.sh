#!/bin/bash
# Debug Services API

echo "🔍 Debugging Services API..."
echo "==========================="

# 1. Get auth token
echo -e "\n1. Getting auth token..."
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:9080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token' 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to get token"
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi

echo "✅ Got token: ${TOKEN:0:20}..."

# 2. Test services endpoint
echo -e "\n2. Testing /api/services endpoint..."
SERVICES_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:9080/api/services)

HTTP_STATUS=$(echo "$SERVICES_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$SERVICES_RESPONSE" | grep -v "HTTP_STATUS:")

echo "HTTP Status: $HTTP_STATUS"
echo "Response (first 500 chars):"
echo "$BODY" | head -c 500

# 3. Check if it's HTML (error page)
if echo "$BODY" | grep -q "<html>"; then
  echo -e "\n❌ Got HTML error page instead of JSON"
  echo "This means the route is not found or misconfigured"
fi

# 4. Try alternative endpoints
echo -e "\n3. Testing alternative endpoints..."
for endpoint in "/api/services/status" "/api/appliances" "/api/service/all"; do
  echo -e "\nTrying $endpoint..."
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "http://localhost:9080$endpoint")
  echo "  Status: $STATUS"
done

echo -e "\n==========================="
