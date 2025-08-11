#!/bin/bash

# Script to make all Docker packages public via GitHub CLI
# Requires: gh CLI tool and authentication

echo "Making Docker packages public..."

packages=(
    "web-appliance-dashboard-backend"
    "web-appliance-dashboard-nginx"
    "web-appliance-dashboard-ttyd"
    "web-appliance-dashboard-guacamole"
)

for package in "${packages[@]}"; do
    echo "Processing $package..."
    
    # Make package public using gh api
    gh api \
        --method PATCH \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "/user/packages/container/$package" \
        -f visibility='public' \
        && echo "✅ $package is now public" \
        || echo "❌ Failed to make $package public"
done

echo "Done! Now test with:"
echo "docker pull ghcr.io/alflewerken/web-appliance-dashboard-backend:latest"
