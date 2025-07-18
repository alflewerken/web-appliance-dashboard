#!/bin/bash

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "ERROR: nginx is not installed!"
    echo ""
    echo "Please install nginx using Homebrew:"
    echo "  brew install nginx"
    echo ""
    echo "Or if nginx is installed but not in PATH, update this script with the full path."
    exit 1
fi

# Start nginx with Mac app configuration
echo "Starting nginx for Mac app on port 9081..."

# Stop any running nginx
sudo nginx -s stop 2>/dev/null || true

# Start nginx with Mac app configuration
sudo nginx -c /Users/alflewerken/Desktop/web-appliance-dashboard/nginx/nginx-macapp.conf

echo "Nginx started for Mac app!"
echo "Access the app at: http://localhost:9081"
