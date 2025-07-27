#!/bin/bash
# Debug-Version des SSH-Wrappers

echo "=== DEBUG START ==="
echo "Current directory: $(pwd)"
echo "Session directory contents:"
ls -la /tmp/terminal-sessions/ 2>/dev/null || echo "Directory not found"
echo "Environment variables:"
env | grep -E "(TTYD|SSH|SESSION)" || echo "No relevant env vars"
echo "Script arguments: $@"
echo "=== DEBUG END ==="
echo ""

# Original script weiter...
exec /scripts/ttyd-ssh-wrapper.sh
