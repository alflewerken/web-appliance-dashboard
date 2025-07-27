#!/bin/bash
# Test SSH connection directly in ttyd container

echo "🔍 Testing SSH Connection in ttyd Container"
echo "=========================================="

# Test data from your screenshot
SSH_HOST="192.168.178.70"
SSH_USER="alflewerken"
SSH_PORT="22"

echo "Testing connection to: $SSH_USER@$SSH_HOST:$SSH_PORT"
echo ""

# Test 1: Can we reach the host?
echo "1. Testing network connectivity..."
docker exec appliance_ttyd ping -c 1 $SSH_HOST >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Host is reachable"
else
    echo "❌ Host is not reachable"
fi

# Test 2: Is SSH port open?
echo -e "\n2. Testing SSH port..."
docker exec appliance_ttyd nc -zv $SSH_HOST $SSH_PORT 2>&1 | grep -q succeeded
if [ $? -eq 0 ]; then
    echo "✅ SSH port is open"
else
    echo "❌ SSH port is not accessible"
fi

# Test 3: Try SSH with password auth
echo -e "\n3. Testing SSH with password authentication..."
echo "Run this command manually in the ttyd container:"
echo "docker exec -it appliance_ttyd ssh -o PasswordAuthentication=yes -o PubkeyAuthentication=no $SSH_USER@$SSH_HOST"

# Test 4: Check if we have the right key
echo -e "\n4. Checking for SSH key for host 'mac'..."
docker exec appliance_ttyd ls -la /root/.ssh/id_rsa_mac* 2>/dev/null
if [ $? -ne 0 ]; then
    echo "No specific key for 'mac' host found"
    echo "Will use default dashboard key"
fi

echo -e "\n=========================================="
echo "If SSH is failing, you may need to:"
echo "1. Add the public key to the target host:"
echo "   docker exec appliance_ttyd cat /root/.ssh/id_rsa_dashboard.pub"
echo "2. Or ensure password authentication is enabled on the target host"
