# Docker Compose Umgebungsvariablen Setup

Dieses Dokument erklärt die Verwendung von Umgebungsvariablen in der Docker Compose Konfiguration.

## Schnellstart

1. **Umgebungsdatei erstellen:**
   ```bash
   cp .env.example .env
   ```

2. **Wichtige Variablen anpassen:**
   - Ändern Sie alle Passwörter und Secret Keys
   - Passen Sie Ports an, falls nötig
   - Konfigurieren Sie CORS für Ihre Domain

3. **Docker Compose starten:**
   ```bash
   docker-compose up -d
   ```

## Verfügbare Umgebungsvariablen

### 🔐 Sicherheit (WICHTIG - Ändern Sie diese!)

| Variable | Beschreibung | Standard |
|----------|--------------|---------|
| `MYSQL_ROOT_PASSWORD` | MariaDB Root Passwort | `rootpassword123` |
| `MYSQL_PASSWORD` | Datenbank Benutzer Passwort | `dashboard_pass123` |
| `JWT_SECRET` | JWT Token Signatur Key | (langer zufälliger String) |
| `SSH_KEY_ENCRYPTION_SECRET` | SSH Key Verschlüsselung | (32-Zeichen Key) |

### 🗄️ Datenbank

| Variable | Beschreibung | Standard |
|----------|--------------|---------|
| `MYSQL_DATABASE` | Datenbank Name | `appliance_dashboard` |
| `MYSQL_USER` | Datenbank Benutzer | `dashboard_user` |
| `DB_HOST` | Datenbank Host (intern) | `database` |
| `DB_PORT` | Datenbank Port (intern) | `3306` |
| `DB_EXTERNAL_PORT` | Externer DB Port | `3306` |

### 🌐 Ports

| Variable | Beschreibung | Standard |
|----------|--------------|---------|
| `BACKEND_PORT` | Backend API Port | `3001` |
| `NGINX_HTTP_PORT` | Nginx HTTP Port | `9080` |
| `NGINX_HTTPS_PORT` | Nginx HTTPS Port | `9443` |
| `TTYD_PORT` | Web Terminal Port | `7681` |

### 🏷️ Container & Volumes

| Variable | Beschreibung | Standard |
|----------|--------------|---------|
| `DB_CONTAINER_NAME` | Database Container Name | `appliance_db` |
| `BACKEND_CONTAINER_NAME` | Backend Container Name | `appliance_backend` |
| `WEBSERVER_CONTAINER_NAME` | Nginx Container Name | `appliance_webserver` |
| `TTYD_CONTAINER_NAME` | Terminal Container Name | `appliance_ttyd` |
| `DB_VOLUME_NAME` | Database Volume Name | `appliance_db_data` |
| `SSH_KEYS_VOLUME_NAME` | SSH Keys Volume Name | `appliance_ssh_keys` |
| `NETWORK_NAME` | Docker Network Name | `appliance_network` |

### ⚙️ Konfiguration

| Variable | Beschreibung | Standard |
|----------|--------------|---------|
| `NODE_ENV` | Node.js Environment | `production` |
| `ALLOWED_ORIGINS` | CORS erlaubte Origins | `http://localhost,...` |
| `LOG_LEVEL` | Log Level | `info` |
| `LOG_FORMAT` | Log Format | `combined` |

### 🚀 Features

| Variable | Beschreibung | Standard |
|----------|--------------|---------|
| `FEATURE_AUDIT_LOG` | Audit Logging aktivieren | `true` |
| `FEATURE_BACKUP_RESTORE` | Backup/Restore aktivieren | `true` |
| `FEATURE_SSH_TERMINAL` | SSH Terminal aktivieren | `true` |
| `FEATURE_SERVICE_CONTROL` | Service Control aktivieren | `true` |
| `FEATURE_USER_MANAGEMENT` | User Management aktivieren | `true` |

### 🏥 Health Checks

| Variable | Beschreibung | Standard |
|----------|--------------|---------|
| `HEALTH_CHECK_INTERVAL` | Check Interval | `30s` |
| `HEALTH_CHECK_TIMEOUT` | Check Timeout | `10s` |
| `HEALTH_CHECK_RETRIES` | Max Retries | `3` |

## Environment-spezifische Konfiguration

### Production (.env)
```bash
NODE_ENV=production
LOG_LEVEL=info
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

### Development (.env.development)
```bash
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

Für Development können Sie eine `docker-compose.override.yml` erstellen:

```bash
cp docker-compose.override.yml.example docker-compose.override.yml
```

Diese wird automatisch geladen und überschreibt/erweitert die Hauptkonfiguration.

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
# Verschlüsseln
openssl enc -aes-256-cbc -salt -in .env -out .env.enc

# Entschlüsseln
openssl enc -aes-256-cbc -d -in .env.enc -out .env
```

### Option 3: Externe Secret Manager
- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault

## Best Practices

1. **Niemals .env in Git committen:**
   ```bash
   echo ".env" >> .gitignore
   ```

2. **Starke Passwörter generieren:**
   ```bash
   # JWT Secret
   openssl rand -base64 64

   # SSH Encryption Key (32 chars)
   openssl rand -base64 32 | head -c 32
   ```

3. **Separate Environments:**
   - Verwenden Sie unterschiedliche .env Dateien pro Environment
   - Nutzen Sie CI/CD für automatisches Deployment

4. **Regelmäßige Key-Rotation:**
   - Ändern Sie Secrets regelmäßig
   - Implementieren Sie Key-Rotation für JWT

## Fehlerbehebung

### Environment-Variablen prüfen:
```bash
# In Container
docker-compose exec backend env | grep DB_

# Docker Compose Config validieren
docker-compose config
```

### Logs prüfen:
```bash
# Alle Services
docker-compose logs -f

# Spezifischer Service
docker-compose logs -f backend
```

### Volumes zurücksetzen:
```bash
# Vorsicht: Löscht alle Daten!
docker-compose down -v
```

## Migration von alter docker-compose.yml

Wenn Sie von der alten Version ohne .env migrieren:

1. Stoppen Sie alle Container:
   ```bash
   docker-compose down
   ```

2. Erstellen Sie .env:
   ```bash
   cp .env.example .env
   # Passen Sie Werte an
   ```

3. Starten Sie mit neuer Config:
   ```bash
   docker-compose up -d
   ```

Die Volumes bleiben erhalten, da die Namen gleich sind.