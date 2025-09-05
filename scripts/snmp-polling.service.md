# SNMP Polling Service - Systemd Unit File

## Overview

`snmp-polling.service` is a systemd service unit file for running the SNMP Background Polling Service as a system daemon on production Linux servers. It provides automatic startup, restart on failure, and comprehensive security sandboxing.

## Purpose

This systemd service is designed for:
- **Production Linux servers**
- **Automatic service management**
- **High availability deployments**
- **Secure, resource-limited execution**

## Requirements

### System Requirements
- Linux with systemd (version 232+)
- Node.js (version 18+) installed system-wide
- MySQL/MariaDB server
- User account `www-data` (or configured service user)

### Directory Structure
```
/opt/web-appliance-dashboard/
├── backend/
│   ├── polling-worker.js
│   └── services/
└── .env
```

## Installation

### 1. Copy Service File
```bash
# Copy to systemd directory
sudo cp scripts/snmp-polling.service /etc/systemd/system/

# Set correct permissions
sudo chmod 644 /etc/systemd/system/snmp-polling.service
```

### 2. Create Required Directories
```bash
# Application directory
sudo mkdir -p /opt/web-appliance-dashboard
sudo cp -r backend /opt/web-appliance-dashboard/
sudo cp .env /opt/web-appliance-dashboard/

# Log directory
sudo mkdir -p /var/log
sudo chown www-data:www-data /var/log

# Data directory (if needed)
sudo mkdir -p /opt/web-appliance-dashboard/data
sudo chown www-data:www-data /opt/web-appliance-dashboard/data
```

### 3. Enable and Start Service
```bash
# Reload systemd configuration
sudo systemctl daemon-reload

# Enable auto-start at boot
sudo systemctl enable snmp-polling.service

# Start the service
sudo systemctl start snmp-polling.service

# Check status
sudo systemctl status snmp-polling.service
```

## Service Configuration

### Unit Section
```ini
[Unit]
Description=SNMP Polling Service for Web Appliance Dashboard
After=network.target mysql.service
Wants=mysql.service
```

- **Description**: Human-readable service description
- **After**: Ensures network and MySQL are available before starting
- **Wants**: Soft dependency on MySQL (will start even if MySQL fails)

### Service Section

#### Basic Configuration
```ini
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/web-appliance-dashboard/backend
```

- **Type=simple**: Main process doesn't fork
- **User/Group**: Runs as non-root user for security
- **WorkingDirectory**: Sets current directory for relative paths

#### Environment
```ini
Environment="NODE_ENV=production"
EnvironmentFile=/opt/web-appliance-dashboard/.env
```

- **NODE_ENV**: Sets production mode
- **EnvironmentFile**: Loads variables from `.env`

#### Execution
```ini
ExecStart=/usr/bin/node /opt/web-appliance-dashboard/backend/polling-worker.js
ExecReload=/bin/kill -USR2 $MAINPID
Restart=always
RestartSec=10
```

- **ExecStart**: Command to start the service
- **ExecReload**: Graceful reload command
- **Restart=always**: Automatic restart on failure
- **RestartSec**: Wait 10 seconds between restarts

#### Logging
```ini
StandardOutput=append:/var/log/snmp-polling.log
StandardError=append:/var/log/snmp-polling-error.log
```

- Separate files for standard output and errors
- Append mode preserves log history

### Security Settings

```ini
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log
ReadWritePaths=/opt/web-appliance-dashboard/data
```

#### Security Features Explained

| Setting | Purpose | Effect |
|---------|---------|--------|
| **NoNewPrivileges** | Prevent privilege escalation | Service cannot gain new privileges |
| **PrivateTmp** | Isolated /tmp directory | Private temporary file namespace |
| **ProtectSystem** | Read-only system directories | Only specified paths are writable |
| **ProtectHome** | Hide user home directories | Cannot access /home/* |
| **ReadWritePaths** | Whitelist writable directories | Only logs and data can be written |

### Resource Limits

```ini
MemoryLimit=512M
CPUQuota=50%
```

- **MemoryLimit**: Maximum 512MB RAM usage
- **CPUQuota**: Maximum 50% of one CPU core

## Management Commands

### Basic Operations
```bash
# Start service
sudo systemctl start snmp-polling

# Stop service
sudo systemctl stop snmp-polling

# Restart service
sudo systemctl restart snmp-polling

# Reload configuration (graceful)
sudo systemctl reload snmp-polling

# Check status
sudo systemctl status snmp-polling
```

### Enable/Disable
```bash
# Enable auto-start at boot
sudo systemctl enable snmp-polling

# Disable auto-start
sudo systemctl disable snmp-polling

# Check if enabled
sudo systemctl is-enabled snmp-polling
```

### Logs and Debugging
```bash
# View recent logs
sudo journalctl -u snmp-polling -n 50

# Follow logs in real-time
sudo journalctl -u snmp-polling -f

# View logs since last boot
sudo journalctl -u snmp-polling -b

# View logs from specific time
sudo journalctl -u snmp-polling --since "2025-09-05 12:00:00"

# Check service logs
sudo tail -f /var/log/snmp-polling.log
sudo tail -f /var/log/snmp-polling-error.log
```

## Monitoring

### Service Status
```bash
# Detailed status
sudo systemctl status snmp-polling --full --no-pager

# Check if running
sudo systemctl is-active snmp-polling

# Show service properties
sudo systemctl show snmp-polling
```

### Resource Usage
```bash
# Memory usage
sudo systemctl status snmp-polling | grep Memory

# CPU usage
sudo systemctl status snmp-polling | grep CPU

# Full resource statistics
sudo systemd-cgtop
```

### Health Checks
```bash
# Check if service is running
if systemctl is-active --quiet snmp-polling; then
    echo "Service is running"
else
    echo "Service is not running"
fi

# Monitor with curl
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:9080/api/polling/status
```

## Troubleshooting

### Service Won't Start

#### Check Dependencies
```bash
# Verify MySQL is running
sudo systemctl status mysql

# Check network
sudo systemctl status network.target

# Check dependencies
sudo systemctl list-dependencies snmp-polling
```

#### Verify Installation
```bash
# Check Node.js
which node
node --version

# Check working directory
ls -la /opt/web-appliance-dashboard/backend/

# Check permissions
ls -la /opt/web-appliance-dashboard/backend/polling-worker.js

# Check user exists
id www-data
```

#### Environment Issues
```bash
# Check environment file
sudo cat /opt/web-appliance-dashboard/.env

# Test with manual start
sudo -u www-data NODE_ENV=production \
  /usr/bin/node /opt/web-appliance-dashboard/backend/polling-worker.js
```

### Service Crashes

#### Check Logs
```bash
# System logs
sudo journalctl -u snmp-polling -n 100 --no-pager

# Application logs
sudo tail -100 /var/log/snmp-polling-error.log

# Database connection
mysql -u web_user -p -e "SELECT 1"
```

#### Resource Limits
```bash
# Check if hitting memory limit
sudo journalctl -u snmp-polling | grep -i memory

# Increase limits if needed (edit service file)
sudo systemctl edit snmp-polling
# Add: MemoryLimit=1G
```

### Permission Errors

```bash
# Fix ownership
sudo chown -R www-data:www-data /opt/web-appliance-dashboard
sudo chown www-data:www-data /var/log/snmp-polling*.log

# Fix permissions
sudo chmod 755 /opt/web-appliance-dashboard
sudo chmod 644 /opt/web-appliance-dashboard/.env
```

## Advanced Configuration

### Custom User
```ini
# Create dedicated user
sudo useradd -r -s /bin/false snmp-polling

# Update service file
User=snmp-polling
Group=snmp-polling
```

### Multiple Instances
```bash
# Create instance service
sudo cp snmp-polling.service snmp-polling@.service

# Start multiple instances
sudo systemctl start snmp-polling@host1
sudo systemctl start snmp-polling@host2
```

### Environment Overrides
```bash
# Create override directory
sudo systemctl edit snmp-polling

# Add overrides
[Service]
Environment="SNMP_POLL_INTERVAL=30"
Environment="LOG_LEVEL=debug"
MemoryLimit=1G
CPUQuota=100%
```

### Custom Restart Policy
```ini
# Restart only on failure
Restart=on-failure
RestartSec=30
StartLimitInterval=600
StartLimitBurst=5
```

## Integration

### With Docker
```yaml
# Alternative to systemd for containers
services:
  polling:
    image: node:18
    working_dir: /app/backend
    command: node polling-worker.js
    restart: always
    mem_limit: 512m
    cpus: 0.5
```

### With Monitoring Tools

#### Prometheus
```yaml
# prometheus.yml
- job_name: 'snmp_polling'
  static_configs:
  - targets: ['localhost:9080']
  metric_path: '/api/polling/metrics'
```

#### Nagios/Icinga
```bash
# Check command
define command {
    command_name    check_snmp_polling
    command_line    $USER1$/check_http -H $HOSTADDRESS$ -u /api/polling/status -a $ARG1$:$ARG2$
}
```

## Security Considerations

### Hardening Options
```ini
# Additional security settings
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_INET6
RestrictNamespaces=true
LockPersonality=true
MemoryDenyWriteExecute=true
RestrictRealtime=true
RestrictSUIDSGID=true
```

### Network Isolation
```ini
# Restrict network access
IPAccounting=true
IPAddressAllow=192.168.1.0/24
IPAddressDeny=any
```

### Capability Restrictions
```ini
# Drop all capabilities
CapabilityBoundingSet=
AmbientCapabilities=
```

## Migration from Development

### From polling-service.sh
```bash
# Stop development script
./scripts/polling-service.sh stop

# Install systemd service
sudo cp scripts/snmp-polling.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start snmp-polling
```

### From PM2
```bash
# Stop PM2 process
pm2 stop polling-worker

# Remove from PM2
pm2 delete polling-worker
pm2 save

# Start systemd service
sudo systemctl start snmp-polling
```

## Backup and Recovery

### Backup Service Configuration
```bash
# Backup service file
sudo cp /etc/systemd/system/snmp-polling.service /backup/

# Backup environment
sudo cp /opt/web-appliance-dashboard/.env /backup/

# Export service status
sudo systemctl show snmp-polling > /backup/snmp-polling.status
```

### Restore Service
```bash
# Restore files
sudo cp /backup/snmp-polling.service /etc/systemd/system/
sudo cp /backup/.env /opt/web-appliance-dashboard/

# Reload and start
sudo systemctl daemon-reload
sudo systemctl start snmp-polling
```

## Performance Tuning

### Optimize Restart Behavior
```ini
# Exponential backoff
RestartSec=1
RestartSteps=10
RestartMaxDelaySec=300
```

### Adjust Resource Limits
```ini
# Based on host count
# 10-50 hosts
MemoryLimit=256M
CPUQuota=25%

# 50-200 hosts
MemoryLimit=512M
CPUQuota=50%

# 200+ hosts
MemoryLimit=1G
CPUQuota=100%
```

## Comparison with polling-service.sh

| Feature | snmp-polling.service | polling-service.sh |
|---------|---------------------|-------------------|
| **Environment** | Production | Development |
| **Startup** | Automatic | Manual |
| **User** | www-data | Current user |
| **Restart** | Automatic | Manual |
| **Logging** | journald + files | Console + files |
| **Security** | Full sandboxing | None |
| **Resources** | Limited | Unlimited |
| **Monitoring** | Integrated | Basic |
| **Installation** | Required | None |

## Best Practices

1. **Always test configuration changes**
   ```bash
   sudo systemd-analyze verify snmp-polling.service
   ```

2. **Monitor after deployment**
   ```bash
   sudo journalctl -u snmp-polling -f &
   sudo systemctl restart snmp-polling
   ```

3. **Regular log rotation**
   ```bash
   # /etc/logrotate.d/snmp-polling
   /var/log/snmp-polling*.log {
       daily
       rotate 7
       compress
       missingok
       notifempty
   }
   ```

4. **Health monitoring**
   ```bash
   # Add to crontab
   */5 * * * * systemctl is-active --quiet snmp-polling || systemctl start snmp-polling
   ```

## Related Documentation

- [Polling Service Script](./polling-service.md) - Development management script
- [Systemd Documentation](https://www.freedesktop.org/software/systemd/man/)
- [Node.js Deployment](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Security Sandboxing](https://www.freedesktop.org/software/systemd/man/systemd.exec.html#Sandboxing)

## License

Part of Web Appliance Dashboard - MIT License
