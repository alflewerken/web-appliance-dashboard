#!/bin/bash

echo "🔧 Fixing Docker macOS Keychain issue..."

# Backup current config
if [ -f ~/.docker/config.json ]; then
    cp ~/.docker/config.json ~/.docker/config.json.backup
    echo "✅ Backed up existing config"
fi

# Create new config without credsStore
cat > ~/.docker/config.json << 'EOF'
{
  "auths": {},
  "experimental": "disabled"
}
EOF

echo "✅ Docker config reset"
echo ""
echo "Now try logging in again:"
echo "docker login ghcr.io"
