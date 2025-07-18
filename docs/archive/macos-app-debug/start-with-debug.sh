#!/bin/bash

# Start macOS App with Developer Tools enabled
cd /Users/alflewerken/Desktop/web-appliance-dashboard/macos-app

echo "Starting Web Appliance Dashboard macOS App with Developer Tools..."
echo ""
echo "Developer Tools Shortcuts:"
echo "- Cmd+Option+I: Open Developer Tools"
echo "- F12: Alternative to open Developer Tools"
echo ""
echo "Terminal Debug Tips:"
echo "1. Open Developer Tools when app starts"
echo "2. Look for '[Terminal Fix]' messages in Console"
echo "3. Click a Terminal button and watch Console output"
echo ""

# Enable Developer Tools via environment variable
ENABLE_DEVTOOLS=true npm start
