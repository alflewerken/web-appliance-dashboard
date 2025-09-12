#!/bin/bash

# SNMP Polling Service Management Script
# Usage: ./scripts/polling-service.sh [start|stop|restart|status]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"
PID_FILE="/tmp/snmp-polling-service.pid"
LOG_FILE="/var/log/snmp-polling.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
fi

function start_service() {
    echo -e "${YELLOW}Starting SNMP Polling Service...${NC}"
    
    # Check if already running
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${RED}Service is already running with PID $PID${NC}"
            return 1
        fi
    fi
    
    # Start the service in background
    cd "$BACKEND_DIR"
    nohup node polling-worker.js >> "$LOG_FILE" 2>&1 &
    PID=$!
    echo $PID > "$PID_FILE"
    
    # Wait a bit to check if it started successfully
    sleep 2
    
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "${GREEN}SNMP Polling Service started successfully with PID $PID${NC}"
        echo -e "${GREEN}Log file: $LOG_FILE${NC}"
        return 0
    else
        echo -e "${RED}Failed to start SNMP Polling Service${NC}"
        rm -f "$PID_FILE"
        return 1
    fi
}

function stop_service() {
    echo -e "${YELLOW}Stopping SNMP Polling Service...${NC}"
    
    if [ ! -f "$PID_FILE" ]; then
        echo -e "${RED}PID file not found. Service may not be running.${NC}"
        return 1
    fi
    
    PID=$(cat "$PID_FILE")
    
    if ! ps -p $PID > /dev/null 2>&1; then
        echo -e "${YELLOW}Service is not running. Cleaning up PID file.${NC}"
        rm -f "$PID_FILE"
        return 0
    fi
    
    # Send SIGTERM for graceful shutdown
    kill -TERM $PID
    
    # Wait for process to stop (max 10 seconds)
    for i in {1..10}; do
        if ! ps -p $PID > /dev/null 2>&1; then
            echo -e "${GREEN}SNMP Polling Service stopped successfully${NC}"
            rm -f "$PID_FILE"
            return 0
        fi
        sleep 1
    done
    
    # Force kill if still running
    echo -e "${YELLOW}Force stopping service...${NC}"
    kill -9 $PID 2>/dev/null
    rm -f "$PID_FILE"
    echo -e "${GREEN}SNMP Polling Service stopped${NC}"
    return 0
}

function restart_service() {
    echo -e "${YELLOW}Restarting SNMP Polling Service...${NC}"
    stop_service
    sleep 2
    start_service
}

function service_status() {
    echo -e "${YELLOW}SNMP Polling Service Status${NC}"
    echo "================================"
    
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${GREEN}Service is running${NC}"
            echo "PID: $PID"
            echo "Process Info:"
            ps -p $PID -o pid,ppid,user,%cpu,%mem,etime,cmd
            
            # Show last 10 log lines
            if [ -f "$LOG_FILE" ]; then
                echo ""
                echo "Recent log entries:"
                tail -n 10 "$LOG_FILE"
            fi
        else
            echo -e "${RED}Service is not running${NC}"
            echo "Stale PID file found: $PID"
        fi
    else
        echo -e "${RED}Service is not running${NC}"
        echo "No PID file found"
    fi
    
    # Check if any polling process is running
    echo ""
    echo "Checking for polling processes:"
    ps aux | grep -E "polling-worker|BackgroundPolling" | grep -v grep || echo "No polling processes found"
}

# Docker-specific functions
function docker_start() {
    echo -e "${YELLOW}Starting SNMP Polling Service in Docker...${NC}"
    docker exec -d appliance_backend node /app/polling-worker.js
    echo -e "${GREEN}Service start command sent to container${NC}"
}

function docker_stop() {
    echo -e "${YELLOW}Stopping SNMP Polling Service in Docker...${NC}"
    docker exec appliance_backend pkill -f polling-worker || true
    echo -e "${GREEN}Service stop command sent to container${NC}"
}

function docker_status() {
    echo -e "${YELLOW}SNMP Polling Service Status in Docker${NC}"
    echo "================================"
    docker exec appliance_backend ps aux | grep -E "polling-worker|BackgroundPolling" | grep -v grep || echo "No polling processes found in container"
}

# Check if running in Docker environment
if [ -f /.dockerenv ]; then
    DOCKER_MODE=true
else
    DOCKER_MODE=false
fi

# Main script logic
case "$1" in
    start)
        if [ "$DOCKER_MODE" = true ]; then
            docker_start
        else
            start_service
        fi
        ;;
    stop)
        if [ "$DOCKER_MODE" = true ]; then
            docker_stop
        else
            stop_service
        fi
        ;;
    restart)
        if [ "$DOCKER_MODE" = true ]; then
            docker_stop
            sleep 2
            docker_start
        else
            restart_service
        fi
        ;;
    status)
        if [ "$DOCKER_MODE" = true ]; then
            docker_status
        else
            service_status
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the SNMP Polling Service"
        echo "  stop    - Stop the SNMP Polling Service"
        echo "  restart - Restart the SNMP Polling Service"
        echo "  status  - Show service status and recent logs"
        exit 1
        ;;
esac

exit $?
