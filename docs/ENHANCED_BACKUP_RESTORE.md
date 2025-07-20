# Enhanced Backup & Restore System

## Overview

The Web Appliance Dashboard now includes a comprehensive backup and restore system that ensures complete data preservation and recovery. This enhanced system provides:

- **Complete Data Coverage**: All database tables and filesystem data
- **Data Integrity**: Checksum validation and comprehensive verification
- **Detailed Reporting**: Full statistics and validation reports
- **Filesystem Integration**: SSH keys, background images, and configurations
- **Transaction Safety**: Atomic restore operations with rollback support
- **Automated Cleanup**: Manage backup retention automatically

## Features

### 1. Comprehensive Data Backup

The system backs up ALL data including:

#### Database Tables:
- ✅ Appliances (with all service configurations AND remote desktop settings)
  - Remote Desktop Enabled flag
  - Remote Protocol (VNC/RDP)
  - Remote Host/Port
  - Remote Username
  - Encrypted Remote Password
- ✅ Categories (with proper ordering)
- ✅ User Settings
- ✅ Background Images (with Base64 encoded file data)
- ✅ SSH Keys (from database AND filesystem)
- ✅ SSH Hosts
- ✅ SSH Config
- ✅ Custom Commands
- ✅ Users (INCLUDING password hashes)
- ✅ Audit Logs (last 1000 entries)
- ✅ Role Permissions
- ✅ User Appliance Permissions
- ✅ Service Command Logs (last 5000 entries)
- ✅ Sessions (captured but not restored)
- ✅ Guacamole Connections (if Guacamole is available)

#### Filesystem Data:
- ✅ SSH private/public key files
- ✅ SSH config file
- ✅ Background image files
- ✅ Environment configuration (sanitized)
- ✅ System information

### 2. Data Validation

Every backup includes:
- SHA256 checksum for integrity verification
- Structural validation
- Cross-reference validation (e.g., SSH hosts to keys)
- Detailed validation reports

### 3. Restore Process

The restore process:
1. Validates backup integrity before restore
2. Uses database transactions for atomicity
3. Restores data in dependency order
4. Regenerates SSH configurations
5. Fixes file permissions automatically
6. Runs post-restore hooks

## API Endpoints

### Create Backup

```bash
POST /api/backup-enhanced/create

# Response:
{
  "success": true,
  "backup_id": "abc123...",
  "filename": "backup_2024-01-19T10-30-00_abc123.json",
  "report": {
    "size_mb": "5.2",
    "duration_ms": 1523,
    "statistics": { ... }
  },
  "download_url": "/api/backup-enhanced/download/backup_2024..."
}
```

### List Backups

```bash
GET /api/backup-enhanced/list

# Response:
{
  "success": true,
  "backups": [...],
  "total": 10
}
```

### Download Backup

```bash
GET /api/backup-enhanced/download/{filename}
```

### Validate Backup

```bash
POST /api/backup-enhanced/validate
Content-Type: multipart/form-data

# Form data: backup (file)

# Response:
{
  "success": true,
  "valid": true,
  "validation": {
    "errors": [],
    "warnings": []
  },
  "report": { ... }
}
```

### Restore Backup

```bash
POST /api/backup-enhanced/restore
Content-Type: multipart/form-data

# Form data: 
# - backup (file) OR
# - filename (string) - for existing backup
# - force (boolean) - restore even with validation warnings
# - backupCurrent (boolean) - backup current data first

# Response:
{
  "success": true,
  "message": "Backup restored successfully",
  "result": {
    "duration_ms": 3421,
    "results": {
      "appliances": { "restored": 25, "errors": 0 },
      "categories": { "restored": 5, "errors": 0 },
      ...
    }
  }
}
```

### Backup Status

```bash
GET /api/backup-enhanced/status

# Response:
{
  "success": true,
  "status": {
    "total_backups": 10,
    "latest_backup": { ... },
    "system_info": { ... }
  }
}
```

### Cleanup Old Backups

```bash
POST /api/backup-enhanced/cleanup

# Body:
{
  "keepCount": 10  // Keep last 10 backups
}

# Response:
{
  "success": true,
  "message": "Deleted 5 old backups, kept 10",
  "result": {
    "deleted": 5,
    "kept": 10
  }
}
```

## Usage Examples

### 1. Create a Full Backup

```javascript
const response = await fetch('/api/backup-enhanced/create', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});

const result = await response.json();
console.log('Backup created:', result.filename);
```

### 2. Restore from Backup

```javascript
// Option 1: Upload backup file
const formData = new FormData();
formData.append('backup', backupFile);
formData.append('force', 'false');

const response = await fetch('/api/backup-enhanced/restore', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});

// Option 2: Use existing backup
const response = await fetch('/api/backup-enhanced/restore', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    filename: 'backup_2024-01-19T10-30-00_abc123.json'
  })
});
```

### 3. Automated Backup Script

```bash
#!/bin/bash
# Automated backup script

API_URL="http://localhost:3001"
AUTH_TOKEN="your-token-here"
BACKUP_DIR="/path/to/backups"

# Create backup
RESPONSE=$(curl -s -X POST "$API_URL/api/backup-enhanced/create" \
  -H "Authorization: Bearer $AUTH_TOKEN")

FILENAME=$(echo "$RESPONSE" | jq -r '.filename')

if [ "$FILENAME" != "null" ]; then
  # Download backup
  curl -s "$API_URL/api/backup-enhanced/download/$FILENAME" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -o "$BACKUP_DIR/$FILENAME"
  
  echo "Backup saved: $BACKUP_DIR/$FILENAME"
  
  # Cleanup old backups (keep last 7)
  curl -s -X POST "$API_URL/api/backup-enhanced/cleanup" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"keepCount": 7}'
else
  echo "Backup failed!"
  exit 1
fi
```

## Backup File Structure

```json
{
  "id": "unique-backup-id",
  "version": "2.8.0",
  "created_at": "2024-01-19T10:30:00Z",
  "created_by": "admin",
  "checksum": "sha256-hash",
  "system_info": {
    "node_version": "v18.17.0",
    "platform": "linux",
    "docker": true
  },
  "data": {
    "appliances": [...],
    "categories": [...],
    "ssh_keys": [
      {
        "key_name": "dashboard",
        "private_key": "-----BEGIN RSA PRIVATE KEY-----...",
        "public_key": "ssh-rsa AAAA...",
        "filesystem_synced": true
      }
    ],
    "background_images": [
      {
        "filename": "bg-123.jpg",
        "file_data": "base64-encoded-image-data",
        "file_exists": true
      }
    ],
    "filesystem": {
      "ssh_config": {
        "content": "Host *\n  StrictHostKeyChecking no\n...",
        "exists": true
      }
    }
  },
  "metadata": {
    "appliances_count": 25,
    "categories_count": 5,
    "total_background_size_kb": 4521,
    "includes_ssh_keys": true,
    "includes_users": true
  }
}
```

## Best Practices

1. **Regular Backups**: Schedule automated backups daily or weekly
2. **Retention Policy**: Keep at least 7-14 days of backups
3. **Off-site Storage**: Copy backups to external storage
4. **Validation**: Always validate backups after creation
5. **Test Restores**: Regularly test the restore process
6. **Monitor Size**: Watch backup sizes for unexpected growth

## Troubleshooting

### Backup Validation Fails

If validation fails, check:
- Duplicate IDs in data
- Missing required fields
- Corrupted file data
- Checksum mismatch

### Restore Fails

Common issues:
- Foreign key constraints: Use `force: true` option
- Missing SSH keys: Will be auto-generated if needed
- Permission issues: Post-restore hook fixes most issues

### Large Backup Files

For very large installations:
- Increase API timeout settings
- Use compression when storing backups
- Consider incremental backups (future feature)

## Security Considerations

1. **Sensitive Data**: Backups contain password hashes and SSH keys
2. **File Permissions**: Store backups with restricted permissions (600)
3. **Encryption**: Consider encrypting backups at rest
4. **Access Control**: Limit backup/restore to admin users only
5. **Audit Trail**: All backup operations are logged

## Migration from Old Backup System

The enhanced system is backward compatible:
1. Old backups can still be restored
2. Missing data is handled gracefully
3. SSH system auto-initializes for legacy backups
4. Validation warnings don't block restore (with force option)

## Future Enhancements

Planned improvements:
- [ ] Incremental backups
- [ ] Backup encryption
- [ ] Cloud storage integration
- [ ] Scheduled backups UI
- [ ] Backup comparison tool
- [ ] Selective restore options

## Remote Desktop Support

The enhanced backup system now fully supports remote desktop configurations:

### What's Backed Up:
- **Remote Desktop Settings**: All appliance remote desktop configurations
  - `remote_desktop_enabled` - Whether remote desktop is enabled
  - `remote_protocol` - Protocol type (VNC or RDP)
  - `remote_host` - Remote host address
  - `remote_port` - Remote port number
  - `remote_username` - Username for remote connection
  - `remote_password_encrypted` - Encrypted password

- **Guacamole Connections**: If Guacamole is available
  - Connection configurations
  - Connection parameters
  - User permissions
  - Protocol-specific settings

### Testing Remote Desktop Backup

Use the provided test script to verify remote desktop backup/restore:

```bash
# Get auth token first
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"your-password"}' | jq -r .token)

# Run the test
AUTH_TOKEN=$TOKEN node scripts/test-remote-desktop-backup.js
```

The test will:
1. Create a test appliance with remote desktop settings
2. Create a backup
3. Delete all appliances
4. Restore from backup
5. Verify all remote desktop settings are restored correctly

### Manual Verification

After restore, check that:
- Remote desktop toggle state is preserved
- Protocol selection (VNC/RDP) is correct
- Host and port information is restored
- Username is present
- Encrypted password is restored (functionality should work)
- Guacamole connections are re-created (if applicable)