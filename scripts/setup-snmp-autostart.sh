#!/bin/bash

# =============================================================================
# SNMP Auto-Start Setup Script for macOS
# =============================================================================
# This script configures net-snmp to start automatically at boot/login
# using macOS LaunchAgent mechanism
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_status() {
    if [ "$1" = "error" ]; then
        echo -e "${RED}✗ $2${NC}"
    elif [ "$1" = "success" ]; then
        echo -e "${GREEN}✓ $2${NC}"
    elif [ "$1" = "warning" ]; then
        echo -e "${YELLOW}⚠ $2${NC}"
    else
        echo -e "$2"
    fi
}

echo "==========================================="
echo "SNMP Auto-Start Setup for macOS"
echo "==========================================="
echo

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_status "error" "This script is only for macOS"
    exit 1
fi

# Check if net-snmp is installed via Homebrew
if ! brew list net-snmp &>/dev/null; then
    print_status "error" "net-snmp is not installed via Homebrew"
    echo "Please install it first with: brew install net-snmp"
    exit 1
fi

print_status "success" "net-snmp is installed via Homebrew"

# Get the snmpd binary path
SNMPD_PATH=$(brew list net-snmp | grep -E "sbin/snmpd$" | head -1)
if [ -z "$SNMPD_PATH" ]; then
    print_status "error" "Could not find snmpd binary"
    exit 1
fi
print_status "success" "Found snmpd at: $SNMPD_PATH"

# Check if snmpd.conf exists
SNMPD_CONF="/opt/homebrew/etc/snmp/snmpd.conf"
if [ ! -f "$SNMPD_CONF" ]; then
    print_status "warning" "snmpd.conf not found at $SNMPD_CONF"
    echo "Creating basic configuration..."
    
    mkdir -p /opt/homebrew/etc/snmp
    cat > "$SNMPD_CONF" << 'EOF'
# Basic SNMP configuration for monitoring
# Community string for read-only access
rocommunity public localhost

# System information
syslocation "MacBook Pro"
syscontact "admin@localhost"

# Load monitoring
load 12 10 5

# Process monitoring
proc sshd

# Disk monitoring (monitor root filesystem)
disk / 10%

# Interface monitoring
interface en0
interface en1

# Allow access to system information
view systemonly included .1.3.6.1.2.1.1
view systemonly included .1.3.6.1.2.1.2
view systemonly included .1.3.6.1.2.1.4
view systemonly included .1.3.6.1.2.1.25.1

# Grant read-only access to systemonly view
rocommunity public default -V systemonly
EOF
    print_status "success" "Created basic snmpd.conf"
fi

# Create log directory
mkdir -p /opt/homebrew/var/log
print_status "success" "Log directory ensured"

# Create LaunchAgent plist
PLIST_NAME="homebrew.mxcl.net-snmp"
PLIST_FILE="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"

print_status "info" "Creating LaunchAgent configuration..."

cat > "/tmp/${PLIST_NAME}.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>${SNMPD_PATH}</string>
        <string>-f</string>
        <string>-Lo</string>
        <string>-C</string>
        <string>-c</string>
        <string>${SNMPD_CONF}</string>
    </array>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>/opt/homebrew/var/log/snmpd.log</string>
    
    <key>StandardErrorPath</key>
    <string>/opt/homebrew/var/log/snmpd.error.log</string>
    
    <key>WorkingDirectory</key>
    <string>/opt/homebrew</string>
</dict>
</plist>
EOF

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$HOME/Library/LaunchAgents"

# Stop any running snmpd first
print_status "info" "Stopping any running snmpd processes..."
if pgrep snmpd > /dev/null; then
    sudo killall snmpd 2>/dev/null || true
    sleep 2
fi

# Unload existing service if present
if [ -f "$PLIST_FILE" ]; then
    print_status "info" "Unloading existing LaunchAgent..."
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
fi

# Copy new plist file
cp "/tmp/${PLIST_NAME}.plist" "$PLIST_FILE"
print_status "success" "LaunchAgent configuration created"

# Load the service
print_status "info" "Loading LaunchAgent..."
launchctl load "$PLIST_FILE"

# Wait a moment for service to start
sleep 3

# Check if snmpd is running
if pgrep snmpd > /dev/null; then
    print_status "success" "snmpd is now running!"
    
    # Test SNMP
    echo
    print_status "info" "Testing SNMP connection..."
    if snmpget -v 2c -c public localhost sysDescr.0 2>/dev/null | grep -q "Darwin"; then
        print_status "success" "SNMP is responding correctly!"
    else
        print_status "warning" "SNMP test failed - check configuration"
    fi
else
    print_status "error" "snmpd failed to start"
    echo "Check logs at: /opt/homebrew/var/log/snmpd.error.log"
    exit 1
fi

echo
echo "==========================================="
print_status "success" "SNMP Auto-Start Setup Complete!"
echo "==========================================="
echo
echo "snmpd will now start automatically at login."
echo "To start at boot (requires admin privileges), run:"
echo "  sudo cp $PLIST_FILE /Library/LaunchDaemons/"
echo "  sudo launchctl load /Library/LaunchDaemons/${PLIST_NAME}.plist"
echo
echo "Useful commands:"
echo "  launchctl list | grep snmp     # Check service status"
echo "  tail -f /opt/homebrew/var/log/snmpd.log     # View logs"
echo "  snmpwalk -v 2c -c public localhost     # Test SNMP"
echo

# Clean up temp file
rm -f "/tmp/${PLIST_NAME}.plist"
