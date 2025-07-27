# Remote Desktop Password Restore - Important Information

## Problem
After a restore, Remote Desktop passwords must be re-entered if the encryption key does not match.

## Cause
Remote Desktop passwords are encrypted with AES-256-GCM. The encryption key is generated from the environment variable `SSH_KEY_ENCRYPTION_SECRET` or `ENCRYPTION_SECRET`.

## Solution

### 1. Backup the Encryption Key
Always backup your `.env` file along with the database backup:

```bash
# Create backup
cp .env .env.backup

# Or note the key
echo $SSH_KEY_ENCRYPTION_SECRET
```

### 2. Restore with Same Key
Ensure that the same encryption key is used during restore:

```bash
# In the .env file
SSH_KEY_ENCRYPTION_SECRET=your-secret-key-here
```

### 3. Docker Compose Configuration
If using Docker, set the key in `docker-compose.yml`:

```yaml
services:
  backend:
    environment:
      - SSH_KEY_ENCRYPTION_SECRET=${SSH_KEY_ENCRYPTION_SECRET}
```

## Security Notes

1. **Never** use the default key in production
2. Use a strong, random key (at least 32 characters)
3. Store the key securely (e.g., in a password manager)
4. Rotate the key regularly (requires re-entering all passwords)

## Generate Key

```bash
# Generate secure key
openssl rand -base64 32

# Or with Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## After a Restore

If passwords don't work:

1. Check if the correct encryption key is set
2. Restart the backend container
3. If the key is lost, all Remote Desktop passwords must be re-entered

## Automation (Optional)

You can create a script that backs up both database and key:

```bash
#!/bin/bash
# backup-with-key.sh

BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Download database backup
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/admin/backup \
  -o "$BACKUP_DIR/backup.json"

# Save key
echo "SSH_KEY_ENCRYPTION_SECRET=$SSH_KEY_ENCRYPTION_SECRET" > "$BACKUP_DIR/.env.key"

echo "Backup created in: $BACKUP_DIR"
```