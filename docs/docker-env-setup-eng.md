# Docker Compose Environment Variables Setup

This document explains the use of environment variables in the Docker Compose configuration.

## Quick Start

1. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Adjust important variables:**
   - Change all passwords and secret keys
   - Adjust ports if necessary
   - Configure CORS for your domain

3. **Start Docker Compose:**
   ```bash
   docker-compose up -d
   ```

## Available Environment Variables

### 🔐 Security (IMPORTANT - Change these!)

| Variable | Description | Default |
|----------|-------------|---------|
| `MYSQL_ROOT_PASSWORD` | MariaDB root password | `rootpassword123` |
| `MYSQL_PASSWORD` | Database user password | `dashboard_pass123` |
| `JWT_SECRET` | JWT token signature key | (long random string) |
| `SSH_KEY_ENCRYPTION_SECRET` | SSH key encryption | (32-character key) |

### 🗄️ Database

| Variable | Description | Default |
|----------|-------------|---------|
| `MYSQL_DATABASE` | Database name | `appliance_dashboard` |
| `MYSQL_USER` | Database user | `dashboard_user` |
| `DB_HOST` | Database host (internal) | `database` |
| `DB_PORT` | Database port (internal) | `3306` |
| `DB_EXTERNAL_PORT` | External DB port | `3306` |

### 🌐 Ports

| Variable | Description | Default |
|----------|-------------|---------|
| `BACKEND_PORT` | Backend API port | `3001` |
| `NGINX_HTTP_PORT` | Nginx HTTP port | `9080` |
| `NGINX_HTTPS_PORT` | Nginx HTTPS port | `9443` |
| `TTYD_PORT` | Web terminal port | `7681` |
### 🏷️ Container & Volumes

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_CONTAINER_NAME` | Database container name | `appliance_db` |
| `BACKEND_CONTAINER_NAME` | Backend container name | `appliance_backend` |
| `WEBSERVER_CONTAINER_NAME` | Nginx container name | `appliance_webserver` |
| `TTYD_CONTAINER_NAME` | Terminal container name | `appliance_ttyd` |
| `DB_VOLUME_NAME` | Database volume name | `appliance_db_data` |
| `SSH_KEYS_VOLUME_NAME` | SSH keys volume name | `appliance_ssh_keys` |
| `NETWORK_NAME` | Docker network name | `appliance_network` |

### ⚙️ Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Node.js environment | `production` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost,...` |
| `LOG_LEVEL` | Log level | `info` |
| `LOG_FORMAT` | Log format | `combined` |

### 🚀 Features

| Variable | Description | Default |
|----------|-------------|---------|
| `FEATURE_AUDIT_LOG` | Enable audit logging | `true` |
| `FEATURE_BACKUP_RESTORE` | Enable backup/restore | `true` |
| `FEATURE_SSH_TERMINAL` | Enable SSH terminal | `true` |
| `FEATURE_SERVICE_CONTROL` | Enable service control | `true` |
| `FEATURE_USER_MANAGEMENT` | Enable user management | `true` |

### 🏥 Health Checks

| Variable | Description | Default |
|----------|-------------|---------|
| `HEALTH_CHECK_INTERVAL` | Check interval | `30s` |
| `HEALTH_CHECK_TIMEOUT` | Check timeout | `10s` |
| `HEALTH_CHECK_RETRIES` | Max retries | `3` |

## Environment-specific Configuration

### Production (.env)
```bash
NODE_ENV=production
LOG_LEVEL=info
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

### Development (.env.development)```bash
NODE_ENV=development
LOG_LEVEL=debug
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:9080
```

### Staging (.env.staging)
```bash
NODE_ENV=staging
LOG_LEVEL=debug
ALLOWED_ORIGINS=https://staging.your-domain.com
```

## Docker Compose Override

For development, you can create a `docker-compose.override.yml`:

```bash
cp docker-compose.override.yml.example docker-compose.override.yml
```

This will be automatically loaded and override/extend the main configuration.

## Secrets Management

### Option 1: Docker Secrets (Swarm Mode)
```yaml
secrets:
  jwt_secret:
    external: true
  ssh_encryption_key:
    external: true
```

### Option 2: Environment File Encryption
```bash
# Encrypt
openssl enc -aes-256-cbc -salt -in .env -out .env.enc

# Decrypt
openssl enc -aes-256-cbc -d -in .env.enc -out .env
```

### Option 3: External Secret Managers
- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault

## Best Practices
1. **Never commit .env to Git:**
   ```bash
   echo ".env" >> .gitignore
   ```

2. **Generate strong passwords:**
   ```bash
   # JWT Secret
   openssl rand -base64 64

   # SSH Encryption Key (32 chars)
   openssl rand -base64 32 | head -c 32
   ```

3. **Separate Environments:**
   - Use different .env files per environment
   - Use CI/CD for automatic deployment

4. **Regular Key Rotation:**
   - Change secrets regularly
   - Implement key rotation for JWT

## Troubleshooting

### Check environment variables:
```bash
# In container
docker-compose exec backend env | grep DB_

# Validate Docker Compose config
docker-compose config
```

### Check logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
```

### Reset volumes:
```bash
# Warning: Deletes all data!
docker-compose down -v
```

## Migration from old docker-compose.yml

If migrating from the old version without .env:

1. Stop all containers:
   ```bash
   docker-compose down
   ```

2. Create .env:
   ```bash
   cp .env.example .env
   # Adjust values
   ```

3. Start with new config:
   ```bash
   docker-compose up -d
   ```

Volumes will be retained as the names remain the same.