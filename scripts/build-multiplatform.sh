#!/bin/bash

# Build Multi-Platform Docker Images
# Builds images for both linux/amd64 and linux/arm64

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Default settings
REGISTRY="ghcr.io"
NAMESPACE="alflewerken"
PUSH=false
PLATFORMS="linux/amd64,linux/arm64"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --push)
            PUSH=true
            shift
            ;;
        --platform)
            PLATFORMS="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --push          Push images to registry after building"
            echo "  --platform      Specify platforms (default: linux/amd64,linux/arm64)"
            echo "  --help          Show this help message"
            exit 0
            ;;
        *)
            print_message "$RED" "Unknown option: $1"
            exit 1
            ;;
    esac
done

print_message "$BLUE" "============================================"
print_message "$BLUE" "Building Multi-Platform Docker Images"
print_message "$BLUE" "Platforms: $PLATFORMS"
print_message "$BLUE" "Push to registry: $PUSH"
print_message "$BLUE" "============================================"

# Check if Docker buildx is available
if ! docker buildx version &> /dev/null; then
    print_message "$RED" "Docker buildx not found. Please install Docker Desktop or enable buildx."
    exit 1
fi

# Create or use existing buildx builder
BUILDER_NAME="multiplatform-builder"
if ! docker buildx ls | grep -q "$BUILDER_NAME"; then
    print_message "$YELLOW" "Creating new buildx builder: $BUILDER_NAME"
    docker buildx create --name "$BUILDER_NAME" --use --platform="$PLATFORMS"
else
    print_message "$GREEN" "Using existing buildx builder: $BUILDER_NAME"
    docker buildx use "$BUILDER_NAME"
fi

# Bootstrap builder if needed
docker buildx inspect --bootstrap

# Build Frontend first (needed for nginx)
print_message "$YELLOW" "Building frontend..."
cd frontend
npm ci
npm run build
cd ..

# Copy frontend build to nginx
print_message "$YELLOW" "Copying frontend build to nginx..."
rm -rf nginx/static
cp -r frontend/build/static nginx/
cp frontend/build/*.* nginx/ 2>/dev/null || true

# Array of services to build
declare -a services=(
    "backend"
    "nginx"
    "ttyd"
    "guacamole"
)

# Build each service
for service in "${services[@]}"; do
    print_message "$YELLOW" "Building $service..."
    
    TAG="${REGISTRY}/${NAMESPACE}/web-appliance-dashboard-${service}:latest"
    
    BUILD_ARGS="--platform=$PLATFORMS"
    BUILD_ARGS="$BUILD_ARGS --tag $TAG"
    
    if [ "$PUSH" = true ]; then
        BUILD_ARGS="$BUILD_ARGS --push"
    else
        BUILD_ARGS="$BUILD_ARGS --load"
    fi
    
    # Add cache options for faster builds
    BUILD_ARGS="$BUILD_ARGS --cache-from type=local,src=/tmp/.buildx-cache-$service"
    BUILD_ARGS="$BUILD_ARGS --cache-to type=local,dest=/tmp/.buildx-cache-$service,mode=max"
    
    # Build the image
    if docker buildx build $BUILD_ARGS "./$service"; then
        print_message "$GREEN" "✓ Successfully built $service"
    else
        print_message "$RED" "✗ Failed to build $service"
        exit 1
    fi
done

print_message "$GREEN" "============================================"
print_message "$GREEN" "All images built successfully!"
if [ "$PUSH" = true ]; then
    print_message "$GREEN" "Images have been pushed to $REGISTRY"
else
    print_message "$YELLOW" "Images built locally. Use --push to push to registry"
fi
print_message "$GREEN" "============================================"

# List built images
print_message "$BLUE" "\nBuilt images:"
docker images | grep "${NAMESPACE}/web-appliance-dashboard" | head -n 5