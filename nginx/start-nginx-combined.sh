#!/bin/bash

# Start nginx with combined configuration (both apps)
echo "Starting nginx for both main app and Mac app..."
echo "Main app on port 9080, Mac app on port 9081"

# Stop any running nginx
sudo nginx -s stop 2>/dev/null || true

# Start nginx with combined configuration
sudo nginx -c /Users/alflewerken/Desktop/web-appliance-dashboard/nginx/nginx-combined.conf

echo "Nginx started for both apps!"
echo "Main app: http://localhost:9080"
echo "Mac app:  http://localhost:9081"
