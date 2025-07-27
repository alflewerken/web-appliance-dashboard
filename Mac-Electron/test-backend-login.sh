#!/bin/bash

echo "🔍 Teste Login zum Backend..."
echo ""

# Test mit curl
echo "Sende Login-Request an http://localhost:9080/api/auth/login"
echo ""

# Führe Login-Request aus
response=$(curl -s -X POST http://localhost:9080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  -w "\n\nHTTP Status: %{http_code}\n")

echo "$response"
echo ""

# Prüfe auch die health endpoint
echo "Prüfe Health-Endpoint:"
curl -s http://localhost:9080/api/health | jq . 2>/dev/null || curl -s http://localhost:9080/api/health
