#!/bin/bash

# Docker container startup script with SNMP Polling Service
# This script starts the main application and the polling service

echo "Starting Web Appliance Dashboard Backend..."

# Function to handle shutdown
shutdown() {
    echo "Shutting down services..."
    
    # Stop polling service if running
    if [ ! -z "$POLLING_PID" ]; then
        echo "Stopping SNMP Polling Service (PID: $POLLING_PID)..."
        kill -TERM $POLLING_PID 2>/dev/null
        wait $POLLING_PID 2>/dev/null
    fi
    
    # Stop main application
    if [ ! -z "$APP_PID" ]; then
        echo "Stopping main application (PID: $APP_PID)..."
        kill -TERM $APP_PID 2>/dev/null
        wait $APP_PID 2>/dev/null
    fi
    
    echo "Shutdown complete"
    exit 0
}

# Set up signal handlers
trap shutdown SIGTERM SIGINT

# Start the main application in background
echo "Starting main application..."
node server.js &
APP_PID=$!

# Wait for main app to be ready (check health endpoint)
echo "Waiting for main application to be ready..."
for i in {1..30}; do
    if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "Main application is ready"
        break
    fi
    sleep 1
done

# Check if SNMP polling should be enabled (default: yes)
ENABLE_SNMP_POLLING=${ENABLE_SNMP_POLLING:-true}

if [ "$ENABLE_SNMP_POLLING" = "true" ]; then
    echo "Starting SNMP Polling Service..."
    node polling-worker.js &
    POLLING_PID=$!
    echo "SNMP Polling Service started (PID: $POLLING_PID)"
else
    echo "SNMP Polling Service is disabled"
fi

# Keep the script running and wait for signals
echo "All services started. Waiting for shutdown signal..."
wait $APP_PID

# If main app exits, trigger shutdown
shutdown
