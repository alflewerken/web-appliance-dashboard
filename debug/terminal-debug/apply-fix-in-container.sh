#!/bin/bash
# Comprehensive Terminal Fix Script

echo "🔧 Applying Comprehensive Terminal Fix..."
echo "========================================"

# 1. Backup original wrapper script
echo "1. Backing up original wrapper script..."
cp /scripts/ttyd-ssh-wrapper.sh /scripts/ttyd-ssh-wrapper.sh.backup 2>/dev/null || echo "No original script found"

# 2. Copy improved wrapper script
echo "2. Installing improved wrapper script..."
cp /scripts/ttyd-ssh-wrapper-improved.sh /scripts/ttyd-ssh-wrapper.sh
chmod +x /scripts/ttyd-ssh-wrapper.sh

# 3. Fix permissions on session directory
echo "3. Fixing session directory permissions..."
mkdir -p /tmp/terminal-sessions
chmod 777 /tmp/terminal-sessions

# 4. Test session file creation
echo "4. Testing session file creation..."
cat > /tmp/terminal-sessions/test-session.conf <<EOF
SSH_HOST="test-host"
SSH_USER="test-user"
SSH_PORT="22"
EOF

if [ -f /tmp/terminal-sessions/test-session.conf ]; then
    echo "✅ Session file creation works"
    rm -f /tmp/terminal-sessions/test-session.conf
else
    echo "❌ Session file creation failed"
fi

# 5. Show current ttyd command
echo -e "\n5. Current ttyd process:"
ps aux | grep ttyd | grep -v grep

echo -e "\n========================================"
echo "✅ Fix applied inside container"
echo ""
echo "To complete the fix, run these commands on the host:"
echo "1. docker cp appliance_ttyd:/scripts/ttyd-ssh-wrapper.sh ./scripts/ttyd-ssh-wrapper-fixed.sh"
echo "2. docker-compose restart ttyd"
