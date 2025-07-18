# Backup & Restore Documentation

## Overview

The Web Appliance Dashboard provides comprehensive backup and restore functionality to ensure all your configuration, settings, and data can be safely exported and imported.

## What's Included in Backups

### Complete Data Coverage (v1.0.2)

1. **Appliances** - All appliance configurations including:
   - Basic information (name, URL, icon, color, description, category)
   - Service control commands (start, stop, status)
   - SSH connection settings
   - Visual settings (transparency, blur)
   - Open mode preferences
   - Favorites and usage statistics

2. **Categories** - All custom and system categories with proper ordering

3. **User Settings** - All application settings and preferences

4. **Background Images** - Both metadata and actual image files (Base64 encoded)

5. **SSH Configuration**:
   - SSH hosts with connection details
   - SSH keys (private and public) with filesystem synchronization

6. **Custom Commands** - All appliance-specific custom commands with SSH host mapping

7. **Users** - User accounts including password hashes for complete restoration

8. **Audit Logs** - Last 1000 audit log entries for compliance

9. **Role Permissions** - All role-based access control settings

10. **User Appliance Permissions** - Individual user permissions per appliance

11. **Service Command Logs** - Last 5000 service command execution logs

### Security Considerations

- **Password hashes ARE included** in backups for complete system restoration
- Backup files contain sensitive authentication data and must be stored securely
- Users are restored with their original passwords
- SSH keys are properly secured with correct file permissions

### Temporary Data Not Backed Up

- Active login sessions
- Password reset tokens
- Real-time status information

## How to Create a Backup

1. Navigate to **Settings → Backup & Restore**
2. Click the **"Create Backup"** button
3. The backup will download as a JSON file with timestamp

## How to Restore from Backup

1. Navigate to **Settings → Backup & Restore**
2. Click **"Restore from Backup"**
3. Select your backup JSON file
4. Confirm the restore operation

**Warning**: Restore will replace ALL current data with the backup contents.

## Backup File Format

Backups are stored as JSON files with the following structure:

```json
{
  "version": "2.7.0",
  "created_at": "2025-07-09T15:00:00Z",
  "created_by": "Web Appliance Dashboard API",
  "data": {
    "appliances": [...],
    "categories": [...],
    "settings": [...],
    // ... all other data types
  },
  "metadata": {
    "appliances_count": 42,
    "backup_type": "full_with_passwords_and_all_data",
    // ... statistics
  }
}
```

## Version Compatibility

- Current backup version: **2.7.0**
- Backwards compatible with older backup versions
- Automatic migration for legacy backups
- SSH system auto-initialization for pre-SSH backups
- Users without password hashes receive default password

## Best Practices

1. **Regular Backups**: Schedule regular backups, especially before major changes
2. **Test Restores**: Periodically test restore functionality in a non-production environment
3. **Secure Storage**: Store backup files securely as they contain sensitive configuration and authentication data
4. **Version Control**: Keep multiple backup versions for rollback capability
5. **Documentation**: Document what changes were made between backups

## Troubleshooting

### Common Issues

1. **"Invalid backup format" error**
   - Ensure the file is a valid JSON backup file
   - Check that the file hasn't been corrupted

2. **Missing SSH keys after restore**
   - SSH keys require filesystem access
   - Check `/root/.ssh/` directory permissions

3. **Background images not displaying**
   - Large images may take time to restore
   - Check `/backend/uploads/backgrounds/` directory

### Post-Restore Tasks

After a successful restore:

1. Verify all appliances are functioning
2. Test SSH connections
3. Check user access (users restored with original passwords)
4. Review audit logs for the restore operation

## Technical Details

- Maximum backup size: Limited by browser/server memory
- Background images: Base64 encoded in backup
- SSH keys: Synchronized with filesystem
- Audit trail: Maintains restore history

For developers, see `/backend/routes/backup.js` for implementation details.
