#!/bin/bash

# Script zum Pushen des nginx Images in die GitHub Container Registry
# Autor: Web Appliance Dashboard Team
# Datum: 2025-01-12

set -e

echo "🚀 Web Appliance Dashboard - Push nginx Image to GitHub Container Registry"
echo "=========================================================================="

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Prüfe ob Docker läuft
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker ist nicht gestartet oder nicht installiert${NC}"
    exit 1
fi

# GitHub Container Registry Details
REGISTRY="ghcr.io"
NAMESPACE="alflewerken"
IMAGE_NAME="web-appliance-dashboard-nginx"
LOCAL_IMAGE="web-appliance-dashboard-webserver:latest"
REMOTE_IMAGE="${REGISTRY}/${NAMESPACE}/${IMAGE_NAME}:latest"

echo "📌 Checking for local nginx image..."
if ! docker image inspect ${LOCAL_IMAGE} >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Local image not found. Building...${NC}"
    docker build -t ${LOCAL_IMAGE} ./nginx
fi

echo "🏷️  Tagging image for GitHub Container Registry..."
docker tag ${LOCAL_IMAGE} ${REMOTE_IMAGE}

echo ""
echo "📌 To push the image, you need a GitHub Personal Access Token (PAT) with:"
echo "   - read:packages"
echo "   - write:packages"
echo "   - delete:packages (optional)"
echo ""
echo "You can create one at: https://github.com/settings/tokens/new"
echo ""

# Frage nach dem Token
read -p "Enter your GitHub Personal Access Token (PAT): " -s GITHUB_TOKEN
echo ""

if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}❌ No token provided. Exiting.${NC}"
    exit 1
fi

echo "🔐 Logging in to GitHub Container Registry..."
echo $GITHUB_TOKEN | docker login ${REGISTRY} -u ${NAMESPACE} --password-stdin

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Login failed. Please check your token.${NC}"
    exit 1
fi

echo "📤 Pushing image to registry..."
docker push ${REMOTE_IMAGE}

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Image successfully pushed to ${REMOTE_IMAGE}${NC}"
    echo ""
    echo "📌 The image is now available for deployment!"
    echo "📌 Customer packages will now be able to pull this image."
else
    echo -e "${RED}❌ Failed to push image${NC}"
    exit 1
fi

echo ""
echo "🔒 Logging out from registry..."
docker logout ${REGISTRY}

echo -e "${GREEN}✅ Done!${NC}"
