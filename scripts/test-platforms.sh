#!/bin/bash

# Platform Compatibility Test Script
# Usage: ./test-platforms.sh

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Platform detection
detect_platform() {
    case "$(uname -s)" in
        Linux*)     
            PLATFORM="linux"
            if [ -f /etc/os-release ]; then
                . /etc/os-release
                DISTRO="$NAME"
            fi
            ;;
        Darwin*)    
            PLATFORM="macos"
            DISTRO="macOS $(sw_vers -productVersion)"
            ;;
        MINGW*|MSYS*|CYGWIN*) 
            PLATFORM="windows"
            DISTRO="Windows (WSL/Git Bash)"
            ;;
        *)          
            PLATFORM="unknown"
            DISTRO="Unknown"
            ;;
    esac
}

# Test Docker networking
test_docker_network() {
    echo -e "${YELLOW}Testing Docker Network...${NC}"
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}✗ Docker is not running${NC}"
        return 1
    fi
    
    # Test network modes
    if [ "$PLATFORM" = "macos" ]; then
        echo "  Platform: macOS - Using Docker Desktop VM"
        echo "  Note: External IPs will show Docker VM IP"
        echo "  Solution: Using X-Forwarded-For headers"
    elif [ "$PLATFORM" = "linux" ]; then
        echo "  Platform: Linux - Native Docker"
        echo "  Network: Direct access to host network"
    elif [ "$PLATFORM" = "windows" ]; then
        echo "  Platform: Windows - WSL2/Docker Desktop"
        echo "  Note: Similar limitations as macOS"
    fi
    
    echo -e "${GREEN}✓ Docker network test completed${NC}"
}

# Test sed/awk compatibility
test_sed_awk() {
    echo -e "${YELLOW}Testing sed/awk compatibility...${NC}"
    
    # Create test file
    echo "test_content" > /tmp/sed_test.txt
    
    # Test sed
    if sed --version 2>/dev/null | grep -q GNU; then
        echo "  sed: GNU sed detected (Linux)"
        sed -i 's/test/TEST/g' /tmp/sed_test.txt
    else
        echo "  sed: BSD sed detected (macOS)"
        sed -i '' 's/test/TEST/g' /tmp/sed_test.txt
    fi
    
    # Test awk
    echo "1 2 3" | awk '{print $2}' > /dev/null
    echo "  awk: Working"
    
    # Cleanup
    rm -f /tmp/sed_test.txt
    
    echo -e "${GREEN}✓ sed/awk test completed${NC}"
}

# Test browser compatibility
test_browser_rendering() {
    echo -e "${YELLOW}Testing browser rendering notes...${NC}"
    
    cat << EOF
  Browser-specific issues to check:
  - Safari: Backdrop-filter, -webkit prefixes needed
  - Firefox: Scrollbar styling, grid layout differences  
  - Chrome: Generally most compatible
  - Edge: Similar to Chrome (Chromium-based)
  
  Test URLs:
  - http://localhost:9080 (HTTP)
  - https://localhost:9443 (HTTPS)
EOF
    
    echo -e "${GREEN}✓ Browser notes displayed${NC}"
}

# Test backup/restore paths
test_backup_restore() {
    echo -e "${YELLOW}Testing backup/restore paths...${NC}"
    
    # Check if backup directory exists
    BACKUP_DIR="./backups"
    if [ ! -d "$BACKUP_DIR" ]; then
        echo "  Creating backup directory..."
        mkdir -p "$BACKUP_DIR"
    fi
    
    # Check permissions
    if [ -w "$BACKUP_DIR" ]; then
        echo "  Backup directory: Writable ✓"
    else
        echo -e "${RED}  Backup directory: Not writable ✗${NC}"
    fi
    
    echo -e "${GREEN}✓ Backup/restore test completed${NC}"
}

# Main test execution
main() {
    echo "========================================="
    echo "Web Appliance Dashboard Platform Testing"
    echo "========================================="
    
    detect_platform
    echo -e "Platform: ${GREEN}$PLATFORM${NC}"
    echo -e "Distribution: ${GREEN}$DISTRO${NC}"
    echo "========================================="
    
    test_docker_network
    echo
    test_sed_awk
    echo
    test_browser_rendering
    echo
    test_backup_restore
    
    echo
    echo "========================================="
    echo -e "${GREEN}Platform testing completed!${NC}"
    echo "========================================="
}

# Run tests
main
