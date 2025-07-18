#!/bin/bash

echo "🍎 Cleaning macOS App build artifacts..."

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Change to macos-app directory
cd "$(dirname "$0")/.." || exit 1

echo -e "${YELLOW}Removing build artifacts...${NC}"

# Remove build directories
rm -rf dist/
rm -rf build/
rm -rf docker-images/

# Remove node modules and lock file
rm -rf node_modules/
rm -f package-lock.json
rm -f yarn.lock

# Remove logs
rm -f *.log
rm -f npm-debug.log*
rm -f yarn-debug.log*
rm -f yarn-error.log*

# Remove temporary files
rm -f .DS_Store
rm -f package.json.backup

# Remove electron cache
rm -rf ~/.electron/
rm -rf ~/.cache/electron/

echo -e "${GREEN}✅ macOS app cleaned!${NC}"
echo ""
echo "Next steps:"
echo "1. Run: npm install"
echo "2. Run: npm start (for development)"
echo "3. Or: npm run dist (to build DMG)"