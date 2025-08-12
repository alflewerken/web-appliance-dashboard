#!/bin/bash

# Trigger GitHub Actions Workflows to build and publish Docker images

echo "🚀 Triggering GitHub Actions Workflows to build Docker images..."
echo ""
echo "This will build and publish all Docker images to ghcr.io"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo ""
    echo "Please install it with:"
    echo "  brew install gh"
    echo ""
    echo "Or trigger the workflows manually at:"
    echo "  https://github.com/alflewerken/web-appliance-dashboard/actions"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI."
    echo ""
    echo "Please authenticate with:"
    echo "  gh auth login"
    exit 1
fi

echo "✅ GitHub CLI is ready"
echo ""

# Trigger the main workflow
echo "📦 Triggering docker-publish workflow..."
gh workflow run docker-publish.yml --repo alflewerken/web-appliance-dashboard

# Wait a moment
sleep 2

# Trigger nginx build
echo "📦 Triggering build-nginx workflow..."
gh workflow run build-nginx.yml --repo alflewerken/web-appliance-dashboard

# Wait a moment
sleep 2

# Trigger ttyd build
echo "📦 Triggering build-ttyd workflow..."
gh workflow run build-ttyd.yml --repo alflewerken/web-appliance-dashboard

echo ""
echo "✅ All workflows triggered!"
echo ""
echo "📊 Monitor progress at:"
echo "   https://github.com/alflewerken/web-appliance-dashboard/actions"
echo ""
echo "⏱️  The build process will take approximately 10-15 minutes."
echo ""
echo "Once complete, the images will be available at:"
echo "  ghcr.io/alflewerken/web-appliance-dashboard-backend"
echo "  ghcr.io/alflewerken/web-appliance-dashboard-frontend"
echo "  ghcr.io/alflewerken/web-appliance-dashboard-guacamole"
echo "  ghcr.io/alflewerken/web-appliance-dashboard-nginx"
echo "  ghcr.io/alflewerken/web-appliance-dashboard-ttyd"
