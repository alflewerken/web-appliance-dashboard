#!/bin/bash

echo "🔍 Testing WebSocket connection to /api/terminal-session..."

# Test mit curl (unterstützt WebSocket upgrade)
echo -e "\n📡 Testing WebSocket upgrade..."
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Host: localhost:9081" \
  -H "Origin: http://localhost:9081" \
  -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:9081/api/terminal-session

echo -e "\n\n🔍 Testing direct backend connection..."
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Host: localhost:3002" \
  -H "Origin: http://localhost:9081" \
  -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:3002/api/terminal-session
