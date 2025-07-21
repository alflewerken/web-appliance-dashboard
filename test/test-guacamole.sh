#!/bin/bash

# Test Guacamole connectivity
echo "Testing Guacamole connectivity..."

# Test 1: Direct access to Guacamole
echo -e "\n1. Testing direct Guacamole access on port 9080:"
curl -I http://192.168.178.70:9080/guacamole/

# Test 2: Test API endpoint
echo -e "\n2. Testing Guacamole API:"
curl -X POST http://192.168.178.70:9080/guacamole/api/tokens \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=guacadmin&password=guacadmin" \
  -w "\nHTTP Status: %{http_code}\n"

# Test 3: Check if static resources are accessible
echo -e "\n3. Testing static resources:"
curl -I http://192.168.178.70:9080/guacamole/app.js

echo -e "\nDone."
