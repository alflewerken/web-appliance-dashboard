#!/bin/bash

echo "Testing Docker image availability..."
echo ""

# List of images to test
images=(
    "ghcr.io/alflewerken/web-appliance-dashboard-backend:latest"
    "ghcr.io/alflewerken/web-appliance-dashboard-nginx:latest"
    "ghcr.io/alflewerken/web-appliance-dashboard-ttyd:latest"
    "ghcr.io/alflewerken/web-appliance-dashboard-guacamole:latest"
)

echo "Attempting to pull images..."
echo "================================"

for image in "${images[@]}"; do
    echo ""
    echo "Testing: $image"
    echo "---"
    
    # Try to pull just the manifest (faster than full image)
    if docker manifest inspect "$image" > /dev/null 2>&1; then
        echo "✅ $image is accessible"
    else
        echo "❌ $image is NOT accessible (may be private or not exist)"
        
        # Try alternative name for ttyd
        if [[ "$image" == *"ttyd"* ]]; then
            alt_image="ghcr.io/alflewerken/web-appliance-dashboard-ttyd:main"
            echo "   Trying alternative: $alt_image"
            if docker manifest inspect "$alt_image" > /dev/null 2>&1; then
                echo "   ✅ Alternative image found: $alt_image"
            else
                echo "   ❌ Alternative also not accessible"
            fi
        fi
    fi
done

echo ""
echo "================================"
echo ""
echo "Possible solutions:"
echo "1. Go to: https://github.com/alflewerken?tab=packages"
echo "2. Click on each package"
echo "3. Go to 'Package settings' (gear icon)"
echo "4. Change visibility to 'Public'"
echo ""
echo "Or wait for the GitHub Actions to complete and make them public automatically."
