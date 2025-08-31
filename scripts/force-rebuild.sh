#!/bin/bash

# Force rebuild script for web-appliance-dashboard
# This ensures webpack actually rebuilds everything

echo "🔧 FORCE REBUILD - web-appliance-dashboard"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Clear all caches
echo -e "${YELLOW}Step 1: Clearing all caches...${NC}"
rm -rf frontend/build
rm -rf frontend/node_modules/.cache
rm -rf nginx/static/js/*
echo -e "${GREEN}✓ Caches cleared${NC}"

# Step 2: Build frontend with visible output
echo -e "${YELLOW}Step 2: Building frontend (with output)...${NC}"
cd frontend

# Touch all CSS files to force webpack to recognize changes
find src -name "*.css" -exec touch {} \;
echo -e "${GREEN}✓ CSS files touched${NC}"

# Run build with output
echo -e "${YELLOW}Running webpack build...${NC}"
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

# Step 3: Copy to nginx
echo -e "${YELLOW}Step 3: Copying to nginx...${NC}"
cp -r build/* ../nginx/
echo -e "${GREEN}✓ Files copied${NC}"

# Step 4: Clean old bundles
echo -e "${YELLOW}Step 4: Cleaning old bundles...${NC}"
cd ../nginx/static/js
BUNDLE_COUNT=$(ls -1 bundle.*.js 2>/dev/null | wc -l)
if [ $BUNDLE_COUNT -gt 2 ]; then
    # Keep only the 2 newest bundles
    ls -t bundle.*.js | tail -n +3 | xargs rm -f
    echo -e "${GREEN}✓ Old bundles removed${NC}"
else
    echo -e "${GREEN}✓ No old bundles to remove${NC}"
fi
cd ../../..

# Step 5: Restart containers
echo -e "${YELLOW}Step 5: Restarting containers...${NC}"
docker compose restart backend webserver
echo -e "${GREEN}✓ Containers restarted${NC}"

# Step 6: Show new bundle hash
echo -e "${YELLOW}Step 6: New bundle info:${NC}"
NEW_BUNDLE=$(ls -t nginx/static/js/bundle.*.js | head -1)
echo -e "${GREEN}New bundle: $(basename $NEW_BUNDLE)${NC}"

# Step 7: Clear browser cache reminder
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Clear your browser cache!${NC}"
echo "=================================="
echo "Desktop: CMD+SHIFT+R (Mac) or CTRL+SHIFT+F5 (Windows)"
echo "iPhone Safari: Settings → Safari → Clear History and Website Data"
echo "Or open in Private/Incognito mode"
echo ""
echo -e "${GREEN}✅ Force rebuild complete!${NC}"
