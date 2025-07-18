#!/bin/bash

# Test-Skript für die User API

echo "=== Testing User API ==="
echo ""

# Erst einloggen um ein Token zu bekommen
echo "1. Login as admin..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | grep -o '[^"]*$')

if [ -z "$TOKEN" ]; then
  echo "Login failed!"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "Login successful! Token: ${TOKEN:0:20}..."
echo ""

# Jetzt die Users API testen
echo "2. Fetching all users..."
USERS_RESPONSE=$(curl -s -X GET http://localhost:3001/api/auth/users \
  -H "Authorization: Bearer $TOKEN")

echo "Response:"
echo $USERS_RESPONSE | python3 -m json.tool 2>/dev/null || echo $USERS_RESPONSE

# Anzahl der Benutzer zählen
USER_COUNT=$(echo $USERS_RESPONSE | grep -o '"id"' | wc -l)
echo ""
echo "Found $USER_COUNT users"

# Backend Logs der letzten Minuten zeigen
echo ""
echo "=== Recent Backend Logs ==="
docker-compose logs backend --tail 20 | grep -E "(GET /api/auth/users|User:|Role:|Found users:)"
