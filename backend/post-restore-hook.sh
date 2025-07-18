#!/bin/bash
# Minimal post-restore hook - fast and reliable
# Only does the essential SSH fixes without hanging

echo "🔧 Running minimal post-restore fixes..."
echo "================================"

# 1. Quick permissions fix (non-blocking)
if [ -d /root/.ssh ]; then
  chmod 700 /root/.ssh 2>/dev/null
  chmod 600 /root/.ssh/id_rsa_* 2>/dev/null
  chmod 644 /root/.ssh/id_rsa_*.pub 2>/dev/null
  chmod 600 /root/.ssh/config 2>/dev/null
  echo "✅ SSH permissions fixed"
fi

# 2. Quick database check (5 second timeout)
echo "⏳ Checking database..."
if timeout 5s mysqladmin ping -h database -u dashboard_user -pdashboard_pass123 --silent 2>/dev/null; then
  echo "✅ Database is ready"
else
  echo "⚠️ Database not immediately available"
  exit 0  # Exit gracefully, don't block
fi

# 3. Run only the SSH key restoration (with timeout)
if [ -f /app/utils/ssh-post-restore-fix.js ]; then
  echo "🔧 Restoring SSH keys..."
  # Run with strict 20-second timeout
  timeout 20s node /app/utils/ssh-post-restore-fix.js 2>&1 | head -20
  echo "✅ SSH restoration attempted"
fi

echo "✅ Minimal post-restore fixes complete!"
exit 0
