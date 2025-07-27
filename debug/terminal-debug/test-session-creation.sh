#!/bin/bash
# Test Terminal Session Creation

echo "🧪 Testing Terminal Session Creation..."
echo "======================================"

# Test-Parameter
TEST_HOST="localhost"
TEST_USER="alflewerken"
TEST_PORT="22"

# 1. Erstelle Session-Datei direkt im Volume
echo "1. Creating session file directly in volume..."
VOLUME_PATH=$(docker volume inspect web-appliance-dashboard_terminal_sessions --format '{{ .Mountpoint }}')
echo "Volume path: $VOLUME_PATH"

if [ -n "$VOLUME_PATH" ]; then
    sudo tee "$VOLUME_PATH/latest-session.conf" > /dev/null <<EOF
# SSH Session Configuration - Test
SSH_HOST="$TEST_HOST"
SSH_USER="$TEST_USER"
SSH_PORT="$TEST_PORT"
SSH_HOST_ID="test-123"
SSH_HOSTNAME="Test Host"
EOF
    echo "✅ Session file created"
    
    # Prüfe ob Datei in Containern sichtbar ist
    echo -e "\n2. Checking if file is visible in containers..."
    echo "In ttyd container:"
    docker exec appliance_ttyd cat /tmp/terminal-sessions/latest-session.conf 2>/dev/null || echo "❌ Not visible"
    
    echo -e "\nIn backend container:"
    docker exec appliance_backend cat /tmp/terminal-sessions/latest-session.conf 2>/dev/null || echo "❌ Not visible"
fi

# 3. Test API Endpoint
echo -e "\n3. Testing API endpoint..."
curl -X POST http://localhost:9080/api/ssh/terminal-session \
    -H "Content-Type: application/json" \
    -d "{\"sshConnection\": \"$TEST_USER@$TEST_HOST:$TEST_PORT\"}" \
    2>/dev/null | jq . || echo "❌ API call failed"

# 4. Prüfe Session-Dateien nach API-Call
echo -e "\n4. Checking session files after API call..."
docker exec appliance_ttyd ls -la /tmp/terminal-sessions/ | grep -E "session|latest" || echo "No session files found"

echo -e "\n======================================"
echo "✅ Test complete"
