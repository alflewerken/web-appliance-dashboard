#!/bin/bash
# Minimal post-restore hook - fast and reliable
# SSH config is now regenerated directly in the restore process

echo "🔧 Running minimal post-restore fixes..."
echo "================================"

# 1. Quick permissions fix (non-blocking)
if [ -d /root/.ssh ]; then
  chmod 700 /root/.ssh 2>/dev/null
  chmod 600 /root/.ssh/id_rsa_* 2>/dev/null
  chmod 644 /root/.ssh/id_rsa_*.pub 2>/dev/null
  chmod 600 /root/.ssh/config 2>/dev/null
  echo "✅ SSH permissions verified"
fi

# 2. Quick database check (5 second timeout)
echo "⏳ Checking database..."
if timeout 5s mysqladmin ping -h database -u dashboard_user -pdashboard_pass123 --silent 2>/dev/null; then
  echo "✅ Database is ready"
else
  echo "⚠️ Database not immediately available"
  exit 0  # Exit gracefully, don't block
fi

echo "✅ Post-restore verification complete!"
echo "Note: SSH config regeneration is now done automatically during restore"
exit 0
