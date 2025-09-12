# SNMP Polling Service - Bash Management Script

## Overview

`polling-service.sh` is a bash script for managing the SNMP Background Polling Service during development and testing. It provides simple commands to start, stop, restart, and check the status of the polling service.

## Purpose

This script is designed for:
- **Local development environments**
- **Docker containers**
- **Quick testing and debugging**
- **Manual service control**

## Requirements

- Bash shell (version 4.0+)
- Node.js (version 18+)
- Write access to `/tmp` for PID file
- Optional: Write access to `/var/log` for log files

## Installation

No installation required. The script is ready to use from the project directory:

```bash
chmod +x scripts/polling-service.sh
```

## Usage

### Basic Commands

```bash
# Start the service
./scripts/polling-service.sh start

# Stop the service
./scripts/polling-service.sh stop

# Restart the service
./scripts/polling-service.sh restart

# Check service status
./scripts/polling-service.sh status
```

### Docker Usage

```bash
# Inside container
docker exec appliance_backend ./scripts/polling-service.sh start

# From host
docker exec appliance_backend bash -c "cd /app && ./scripts/polling-service.sh status"
```

## Features

### PID File Management
- Creates PID file at `/tmp/snmp-polling-service.pid`
- Prevents multiple instances from running
- Automatic cleanup on stop

### Color-Coded Output
- 🔴 **Red**: Errors and failures
- 🟢 **Green**: Success messages
- 🟡 **Yellow**: Status and informational messages

### Environment Variables
Automatically loads from `.env` file:
```env
ENABLE_SNMP_POLLING=true
SNMP_POLL_INTERVAL=60
LOG_LEVEL=info
DB_HOST=localhost
DB_USER=web_user
DB_PASSWORD=yourpassword
DB_NAME=appliance_dashboard
```

### Process Management

#### Start Behavior
1. Checks if service is already running
2. Creates necessary log directories
3. Starts `polling-worker.js` in background
4. Saves PID for future reference
5. Verifies successful start

#### Stop Behavior
1. Reads PID from PID file
2. Sends SIGTERM for graceful shutdown
3. Waits up to 10 seconds for process to exit
4. Forces kill if necessary
5. Removes PID file

#### Restart Behavior
1. Executes stop command
2. Waits 2 seconds
3. Executes start command

## File Locations

| File | Purpose | Location |
|------|---------|----------|
| PID File | Process tracking | `/tmp/snmp-polling-service.pid` |
| Log File | Service output | `/var/log/snmp-polling.log` |
| Error Log | Error messages | `/var/log/snmp-polling-error.log` |
| Worker Script | Actual service | `backend/polling-worker.js` |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Service already running (on start) |
| 2 | Service not running (on stop) |
| 3 | Failed to start service |
| 4 | Invalid command |

## Troubleshooting

### Service won't start
```bash
# Check if already running
ps aux | grep polling-worker

# Check PID file
ls -la /tmp/snmp-polling-service.pid

# Remove stale PID file if needed
rm /tmp/snmp-polling-service.pid

# Check logs
tail -f /var/log/snmp-polling.log
```

### Service crashes immediately
```bash
# Run in foreground for debugging
cd backend
node polling-worker.js

# Check database connection
mysql -u web_user -p -h localhost appliance_dashboard -e "SELECT 1"

# Verify environment variables
env | grep -E "DB_|SNMP_"
```

### Permission Issues
```bash
# Log directory permissions
sudo mkdir -p /var/log
sudo chmod 755 /var/log

# For development, use user directory
LOG_FILE="$HOME/snmp-polling.log"
```

## Integration with Docker

### Dockerfile Integration
```dockerfile
# Copy script
COPY scripts/polling-service.sh /app/scripts/

# Make executable
RUN chmod +x /app/scripts/polling-service.sh

# Use in startup
CMD ["/app/scripts/polling-service.sh", "start"]
```

### Docker Compose
```yaml
services:
  backend:
    command: bash -c "npm start & ./scripts/polling-service.sh start"
    volumes:
      - ./scripts:/app/scripts
```

## Comparison with Systemd Service

| Feature | polling-service.sh | snmp-polling.service |
|---------|-------------------|---------------------|
| Environment | Development | Production |
| Auto-start | No | Yes |
| Auto-restart | No | Yes |
| Resource limits | No | Yes |
| Security sandbox | No | Yes |
| User management | Current user | www-data |
| Installation | None | Systemd setup |

## Examples

### Development Workflow
```bash
# Start development
./scripts/polling-service.sh start

# Make code changes
vim backend/services/BackgroundPollingService.js

# Restart to test changes
./scripts/polling-service.sh restart

# Check status
./scripts/polling-service.sh status

# Stop when done
./scripts/polling-service.sh stop
```

### Docker Development
```bash
# Build container
docker-compose build backend

# Start with polling
docker-compose up -d
docker exec appliance_backend ./scripts/polling-service.sh start

# Monitor logs
docker exec appliance_backend tail -f /var/log/snmp-polling.log

# Stop service
docker exec appliance_backend ./scripts/polling-service.sh stop
```

### Testing Specific Hosts
```bash
# Start service
./scripts/polling-service.sh start

# Add host to monitoring
curl -X POST http://localhost:9080/api/polling/hosts/1/add \
  -H "Authorization: Bearer $TOKEN"

# Check metrics
mysql -e "SELECT * FROM snmp_metrics WHERE host_id=1 ORDER BY timestamp DESC LIMIT 10"

# Stop service
./scripts/polling-service.sh stop
```

## Best Practices

1. **Always check status before starting**
   ```bash
   ./scripts/polling-service.sh status || ./scripts/polling-service.sh start
   ```

2. **Use restart for configuration changes**
   ```bash
   # After changing .env
   ./scripts/polling-service.sh restart
   ```

3. **Monitor logs during development**
   ```bash
   tail -f /var/log/snmp-polling.log &
   ./scripts/polling-service.sh start
   ```

4. **Clean shutdown in containers**
   ```bash
   trap './scripts/polling-service.sh stop' SIGTERM SIGINT
   ```

## Related Documentation

- [SNMP Polling Service (Systemd)](./snmp-polling.service.md) - Production deployment
- [Background Polling Service](../backend/services/BackgroundPollingService.js) - Service implementation
- [Polling Worker](../backend/polling-worker.js) - Worker process
- [Environment Configuration](../.env.example) - Configuration options

## License

Part of Web Appliance Dashboard - MIT License
