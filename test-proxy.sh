#!/bin/bash

# Test Guacamole JWT Proxy

echo "Testing Guacamole JWT Proxy Integration..."
echo "=========================================="

# Generiere einen Test JWT Token
JWT_SECRET="BkwjTqg+LYnBXlibieVm8k4jEeYSPLroceS3MQYQjJEcVGZrTLGbAFoLHqG+Pj0G4xx5lbfQNCZg8XL2kZoNdQ=="

# Test 1: Health Check
echo -e "\n1. Testing Health Check:"
curl -s http://localhost:8070/health

# Test 2: Access ohne Token (sollte 401 zurückgeben)
echo -e "\n\n2. Testing access without token (should return 401):"
curl -s -o /dev/null -w "%{http_code}" http://localhost:8070/guacamole/

# Test 3: Mit gültigem Token
echo -e "\n\n3. Testing with valid token:"
# Hier müssten wir einen echten JWT Token generieren...

echo -e "\n\nTest completed."
