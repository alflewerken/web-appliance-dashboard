#!/bin/bash

# Script to make Docker images public on GitHub Container Registry
# This script is called by GitHub Actions after pushing images

set -e

# Check if required environment variables are set
if [ -z "$GITHUB_TOKEN" ] || [ -z "$GITHUB_REPOSITORY_OWNER" ]; then
    echo "Error: GITHUB_TOKEN and GITHUB_REPOSITORY_OWNER must be set"
    exit 1
fi

# Function to make a package public
make_package_public() {
    local package_name=$1
    
    echo "Making package $package_name public..."
    
    # Get the package visibility
    visibility=$(curl -s \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        "https://api.github.com/user/packages/container/$package_name" \
        | jq -r '.visibility // "unknown"')
    
    if [ "$visibility" = "private" ]; then
        echo "Package $package_name is private, making it public..."
        
        # Make the package public
        curl -X PATCH \
            -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github.v3+json" \
            "https://api.github.com/user/packages/container/$package_name/visibility" \
            -d '{"visibility":"public"}'
        
        echo "✅ Package $package_name is now public"
    elif [ "$visibility" = "public" ]; then
        echo "✅ Package $package_name is already public"
    else
        echo "⚠️  Could not determine visibility for $package_name"
    fi
}

# List of packages to make public
packages=(
    "web-appliance-dashboard-backend"
    "web-appliance-dashboard-frontend"
    "web-appliance-dashboard-guacamole"
    "web-appliance-dashboard-nginx"
    "web-appliance-dashboard-ttyd"
)

# Also check with full repository name for ttyd (it uses different naming)
packages_alt=(
    "web-appliance-dashboard-ttyd"
)

# Make each package public
for package in "${packages[@]}"; do
    make_package_public "$package"
done

echo "✅ All packages processed"