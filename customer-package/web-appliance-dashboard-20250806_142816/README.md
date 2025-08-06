# Web Appliance Dashboard

## Quick Start

1. Run the installation script:
   ```bash
   ./install.sh
   ```

2. Access the dashboard at https://localhost
   - Username: **admin**
   - Password: **admin123**

## System Requirements

- Docker Desktop (macOS/Windows) or Docker Engine (Linux)
- Docker Compose
- 4GB RAM minimum
- 10GB free disk space

## Services Included

- **Dashboard**: Web-based management interface
- **API Backend**: Node.js backend with SSH tools
- **Terminal**: Web-based SSH terminal
- **Remote Desktop**: Guacamole for RDP/VNC access
- **Database**: MariaDB for data storage

## Troubleshooting

### Docker Login Issues (macOS)

If you see "Error saving credentials", try:

1. Open Docker Desktop → Settings → General
2. Uncheck "Securely store Docker logins in macOS keychain"
3. Apply & Restart
4. Run `./install.sh` again

### Manual Docker Login

If automatic login fails:
```bash
docker login ghcr.io
Username: [provided username]
Password: [provided token]
```

### View Logs

To see what's happening:
```bash
docker-compose logs -f
# Or for specific service:
docker-compose logs -f backend
```

### Port Conflicts

If ports 80/443 are already in use:
1. Stop conflicting services, or
2. Edit `docker-compose.yml` to change ports:
   ```yaml
   ports:
     - "8080:80"
     - "8443:443"
   ```

## Daily Operations

### Start Services
```bash
docker-compose start
```

### Stop Services
```bash
docker-compose stop
```

### Restart Services
```bash
docker-compose restart
```

### Update Images
```bash
docker-compose pull
docker-compose up -d
```

### Backup Data
```bash
docker-compose exec database mysqldump -u root -p appliance_dashboard > backup.sql
```

## Support

- Email: support@alflewerken.com
- Documentation: [Coming Soon]

## Uninstall

To completely remove the installation:
```bash
./uninstall.sh
```

⚠️ **Warning**: This will delete all data!
