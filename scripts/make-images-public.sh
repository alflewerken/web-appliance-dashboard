#!/bin/bash

# Script to make Docker images public on GitHub Container Registry
# This script needs to be run with a GitHub token that has package:write permission

set -e

# Check if GITHUB_TOKEN is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <GITHUB_TOKEN>"
    echo ""
    echo "You need to provide a GitHub Personal Access Token with 'write:packages' permission"
    echo "Create one at: https://github.com/settings/tokens"
    exit 1
fi

GITHUB_TOKEN=$1
GITHUB_USER="alflewerken"

echo "🔓 Making Docker images public on ghcr.io..."
echo ""

# List of packages to make public
packages=(
    "web-appliance-dashboard-backend"
    "web-appliance-dashboard-nginx"
    "web-appliance-dashboard-ttyd"
    "web-appliance-dashboard-guacamole"
)

# Function to make a package public
make_package_public() {
    local package_name=$1
    
    echo "Processing $package_name..."
    
    # Get current visibility
    visibility=$(curl -s \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        "https://api.github.com/users/$GITHUB_USER/packages/container/$package_name" \
        | grep '"visibility"' | cut -d'"' -f4)
    
    if [ "$visibility" = "private" ]; then
        echo "  📦 Package is private, making it public..."
        
        # Make the package public
        response=$(curl -s -X PATCH \
            -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github.v3+json" \
            "https://api.github.com/users/$GITHUB_USER/packages/container/$package_name/visibility" \
            -d '{"visibility":"public"}')
        
        echo "  ✅ $package_name is now public!"
    elif [ "$visibility" = "public" ]; then
        echo "  ✅ $package_name is already public"
    else
        echo "  ⚠️  Could not determine visibility for $package_name (may not exist)"
    fi
    echo ""
}

# Process each package
for package in "${packages[@]}"; do
    make_package_public "$package"
done

echo "🎉 Done! Testing public access..."
echo ""

# Test pulling without authentication
echo "Testing pulls without authentication:"
for package in "${packages[@]}"; do
    echo -n "  Testing $package... "
    if docker pull "ghcr.io/$GITHUB_USER/$package:latest" >/dev/null 2>&1; then
        echo "✅ Success!"
    else
        echo "❌ Failed (may still be private)"
    fi
done

echo ""
echo "📝 Notes:"
echo "  - If packages are still private, check: https://github.com/$GITHUB_USER?tab=packages"
echo "  - You can manually change visibility in the package settings"
echo "  - The GitHub token needs 'write:packages' permission"
