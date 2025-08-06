#!/bin/bash

echo "🔧 Docker Login Helper for macOS"
echo "================================"
echo ""
echo "This script helps fix Docker login issues on macOS."
echo ""

# Backup current config
if [ -f ~/.docker/config.json ]; then
    cp ~/.docker/config.json ~/.docker/config.json.backup
    echo "✅ Backed up existing Docker config"
fi

# Remove the credsStore to avoid keychain issues
if grep -q "credsStore" ~/.docker/config.json 2>/dev/null; then
    echo "🔧 Removing credential store from Docker config..."
    # Use python to safely modify JSON
    python3 -c "
import json
with open('$HOME/.docker/config.json', 'r') as f:
    config = json.load(f)
if 'credsStore' in config:
    del config['credsStore']
with open('$HOME/.docker/config.json', 'w') as f:
    json.dump(config, f, indent=2)
"
    echo "✅ Credential store removed"
fi

echo ""
echo "Now try running ./install.sh again"
echo ""
echo "If it still fails, you can manually login:"
echo "  docker login ghcr.io"
echo "  Username: [provided username]"
echo "  Password: [provided token]"
