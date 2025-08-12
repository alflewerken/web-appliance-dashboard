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

# 3. Restore SSH keys from database to filesystem
if [ -f /app/utils/restore-ssh-keys.js ]; then
  echo "🔧 Restoring SSH keys from database..."
  # Run with strict 20-second timeout
  timeout 20s node /app/utils/restore-ssh-keys.js 2>&1 | head -20
  echo "✅ SSH key restoration attempted"
else
  echo "⚠️ SSH key restore script not found, skipping"
fi

# 4. Regenerate SSH config
if [ -f /app/regenerate-ssh-config.js ]; then
  echo "🔑 Regenerating SSH config..."
  # Run with 20-second timeout
  timeout 20s node /app/regenerate-ssh-config.js 2>&1 | head -20
  echo "✅ SSH config regeneration attempted"
fi

# 5. Fix SSH key references (create symlinks for missing keys)
if [ -f /app/utils/fix-ssh-key-references.js ]; then
  echo "🔧 Fixing SSH key references..."
  # Run with 20-second timeout
  timeout 20s node /app/utils/fix-ssh-key-references.js 2>&1 | head -20
  echo "✅ SSH key reference fixing attempted"
fi

echo "✅ Minimal post-restore fixes complete!"
exit 0
