#!/bin/bash
# Set RustDesk password on macOS

if [ $# -ne 1 ]; then
    echo "Usage: $0 <password>"
    exit 1
fi

PASSWORD="$1"

# Check if RustDesk is installed
if [ ! -d "/Applications/RustDesk.app" ]; then
    echo "RustDesk is not installed"
    exit 1
fi

echo "Setting RustDesk password..."

# Kill RustDesk if running
pkill -x RustDesk 2>/dev/null || true
sleep 2

# Set password using CLI
echo "Attempting to set password using CLI..."
/Applications/RustDesk.app/Contents/MacOS/RustDesk --password "$PASSWORD"

# Start RustDesk to apply settings
echo "Starting RustDesk to apply settings..."
open -a RustDesk

echo "Password set. Please verify in RustDesk settings."
echo "Note: You may need to restart RustDesk for the password to take effect."
