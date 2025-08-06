#!/bin/bash

# Manual Docker login for macOS
echo "🔐 Setting up Docker authentication manually..."

# Get credentials
read -p "GitHub Username: " GITHUB_USER
read -s -p "GitHub Token: " GITHUB_TOKEN
echo ""

# Create auth string
AUTH=$(echo -n "$GITHUB_USER:$GITHUB_TOKEN" | base64)

# Create docker config directory
mkdir -p ~/.docker

# Write config
cat > ~/.docker/config.json << EOF
{
  "auths": {
    "ghcr.io": {
      "auth": "$AUTH"
    }
  }
}
EOF

echo "✅ Docker authentication configured"
echo ""
echo "Testing connection..."
docker pull ghcr.io/alflewerken/web-appliance-dashboard-backend:latest

if [ $? -eq 0 ]; then
    echo "✅ Success! You can now use the install script"
else
    echo "❌ Connection failed. Please check your token"
fi
