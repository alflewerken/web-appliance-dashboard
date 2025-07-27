nodejs . .

# Security scanning
RUN npm audit fix

# Final stage
FROM node:18-alpine

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy from builder
COPY --from=builder --chown=nodejs:nodejs /app /app

# Security hardening
RUN chmod -R 550 /app && \
    chmod -R 770 /app/uploads

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node healthcheck.js

# Use dumb-init to handle signals
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
```

### Docker Compose Security

```yaml
version: '3.8'

services:
  backend:
    image: appliance_backend:latest
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETUID
      - SETGID
    read_only: true
    tmpfs:
      - /tmp
      - /app/temp
    volumes:
      - ./uploads:/app/uploads:rw
      - ./logs:/app/logs:rw
    environment:
      NODE_ENV: production
    networks:
      - backend_network
    restart: unless-stopped

  database:
    image: mariadb:11
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETUID
      - SETGID
      - DAC_OVERRIDE
    volumes:
      - db_data:/var/lib/mysql:rw
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    environment:
      MYSQL_ROOT_PASSWORD_FILE: /run/secrets/db_root_password
      MYSQL_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_root_password
      - db_password
    networks:
      - backend_network
    restart: unless-stopped

networks:
  backend_network:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.name: br-appliance
    ipam:
      config:
        - subnet: 172.20.0.0/16

secrets:
  db_root_password:
    file: ./secrets/db_root_password.txt
  db_password:
    file: ./secrets/db_password.txt
```

### Container Scanning

```bash
# Trivy für Vulnerability Scanning
trivy image appliance_backend:latest
trivy image appliance_frontend:latest

# Docker Bench Security
docker run --rm -it \
  --net host \
  --pid host \
  --userns host \
  --cap-add audit_control \
  -e DOCKER_CONTENT_TRUST=$DOCKER_CONTENT_TRUST \
  -v /etc:/etc:ro \
  -v /usr/bin/containerd:/usr/bin/containerd:ro \
  -v /usr/bin/docker:/usr/bin/docker:ro \
  -v /usr/lib/systemd:/usr/lib/systemd:ro \
  -v /var/lib:/var/lib:ro \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  docker/docker-bench-security
```

## 🗄️ Datenbanksicherheit

### MariaDB Security

```sql
-- Grundlegende Sicherheitsmaßnahmen
DELETE FROM mysql.user WHERE User='';
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';
FLUSH PRIVILEGES;

-- Benutzer mit minimalen Rechten
CREATE USER 'app_user'@'%' IDENTIFIED BY 'strong_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON appliance_dashboard.* TO 'app_user'@'%';

-- Read-only User für Backups
CREATE USER 'backup_user'@'localhost' IDENTIFIED BY 'backup_password';
GRANT SELECT, LOCK TABLES ON appliance_dashboard.* TO 'backup_user'@'localhost';

-- Audit User
CREATE USER 'audit_user'@'%' IDENTIFIED BY 'audit_password';
GRANT SELECT ON appliance_dashboard.audit_logs TO 'audit_user'@'%';

-- SSL/TLS erzwingen
ALTER USER 'app_user'@'%' REQUIRE SSL;
```

### Datenbank-Verschlüsselung

```ini
# /etc/mysql/mariadb.conf.d/encryption.cnf
[mariadb]
# File Key Management
plugin_load_add = file_key_management
file_key_management_filename = /etc/mysql/keys.txt
file_key_management_filekey = FILE:/etc/mysql/filekey.key
file_key_management_encryption_algorithm = AES_CTR

# Encrypt tables
innodb_encrypt_tables = ON
innodb_encrypt_log = ON
innodb_encryption_threads = 4
innodb_encryption_rotate_key_age = 1

# Encrypt temp files
encrypt_tmp_files = ON

# Encrypt binlog
encrypt_binlog = ON
```

### SQL Injection Prevention

```javascript
// Parameterized Queries
const mysql = require('mysql2/promise');

// RICHTIG - Parameterized Query
async function getAppliance(id) {
  const [rows] = await db.execute(
    'SELECT * FROM appliances WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
  return rows[0];
}

// FALSCH - SQL Injection anfällig
async function getApplianceUnsafe(id) {
  const [rows] = await db.execute(
    `SELECT * FROM appliances WHERE id = ${id} AND deleted_at IS NULL`
  );
  return rows[0];
}

// Input Validation
const validator = require('validator');

function validateApplianceInput(input) {
  const errors = [];
  
  if (!validator.isLength(input.name, { min: 1, max: 255 })) {
    errors.push('Name must be between 1 and 255 characters');
  }
  
  if (!validator.isURL(input.url, { require_protocol: true })) {
    errors.push('Invalid URL format');
  }
  
  if (input.ssh_port && !validator.isInt(input.ssh_port, { min: 1, max: 65535 })) {
    errors.push('SSH port must be between 1 and 65535');
  }
  
  return errors;
}
```

## 🔑 SSH-Sicherheit

### SSH Key Management

```javascript
// Sichere SSH-Key Generierung
const { generateKeyPair } = require('crypto');
const sshpk = require('sshpk');

async function generateSSHKeyPair(comment = 'web-appliance-dashboard') {
  return new Promise((resolve, reject) => {
    generateKeyPair('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
        cipher: 'aes-256-cbc',
        passphrase: process.env.SSH_KEY_PASSPHRASE
      }
    }, (err, publicKey, privateKey) => {
      if (err) return reject(err);
      
      // Convert to SSH format
      const sshPublicKey = sshpk.parseKey(publicKey, 'pem');
      const sshFormattedKey = sshPublicKey.toString('ssh') + ' ' + comment;
      
      resolve({
        publicKey: sshFormattedKey,
        privateKey: privateKey
      });
    });
  });
}

// SSH-Key Rotation
async function rotateSSHKeys() {
  // Get all active SSH keys older than 90 days
  const oldKeys = await db.query(
    'SELECT * FROM ssh_keys WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY) AND status = "active"'
  );
  
  for (const key of oldKeys) {
    // Generate new key
    const newKey = await generateSSHKeyPair();
    
    // Store new key
    await storeSSHKey(key.user_id, newKey);
    
    // Mark old key for deletion (grace period)
    await db.query(
      'UPDATE ssh_keys SET status = "deprecated", deprecated_at = NOW() WHERE id = ?',
      [key.id]
    );
    
    // Notify user
    await notifyKeyRotation(key.user_id, key.id);
  }
}
```

### SSH Connection Security

```javascript
const { Client } = require('ssh2');

function createSecureSSHConnection(config) {
  const conn = new Client();
  
  const secureConfig = {
    host: config.host,
    port: config.port || 22,
    username: config.username,
    privateKey: config.privateKey,
    passphrase: config.passphrase,
    
    // Security options
    algorithms: {
      kex: ['ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521'],
      cipher: ['aes128-gcm@openssh.com', 'aes256-gcm@openssh.com'],
      serverHostKey: ['ssh-rsa', 'ecdsa-sha2-nistp256', 'ssh-ed25519'],
      hmac: ['hmac-sha2-256', 'hmac-sha2-512']
    },
    
    // Timeout settings
    readyTimeout: 30000,
    keepaliveInterval: 10000,
    keepaliveCountMax: 3,
    
    // Host verification
    hostVerifier: (hashedKey) => {
      return verifyKnownHost(config.host, hashedKey);
    }
  };
  
  return conn.connect(secureConfig);
}

// Known Hosts Management
async function verifyKnownHost(hostname, hashedKey) {
  const knownHost = await db.query(
    'SELECT * FROM known_hosts WHERE hostname = ?',
    [hostname]
  );
  
  if (!knownHost) {
    // First connection - store the key
    await db.query(
      'INSERT INTO known_hosts (hostname, key_hash, first_seen) VALUES (?, ?, NOW())',
      [hostname, hashedKey]
    );
    return true;
  }
  
  // Verify the key matches
  if (knownHost.key_hash !== hashedKey) {
    // Potential MITM attack
    await logSecurityEvent('SSH_HOST_KEY_MISMATCH', {
      hostname,
      expected: knownHost.key_hash,
      received: hashedKey
    });
    return false;
  }
  
  return true;
}
```

## 🖥️ Remote Desktop Sicherheit

### Guacamole Security

```javascript
// Token-basierte Authentifizierung für Guacamole
function generateGuacamoleToken(userId, connectionId) {
  const payload = {
    guac_username: `user_${userId}`,
    guac_connection_id: connectionId,
    guac_valid_until: Date.now() + (5 * 60 * 1000), // 5 Minuten
    guac_client_ip: req.ip,
    jti: uuidv4() // Unique token ID
  };
  
  return jwt.sign(payload, process.env.GUACAMOLE_JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '5m'
  });
}

// Single-Use Token Enforcement
const usedTokens = new Set();

async function validateGuacamoleToken(token) {
  if (usedTokens.has(token)) {
    throw new Error('Token already used');
  }
  
  try {
    const decoded = jwt.verify(token, process.env.GUACAMOLE_JWT_SECRET);
    
    // Check if token is still valid
    if (Date.now() > decoded.guac_valid_until) {
      throw new Error('Token expired');
    }
    
    // Mark token as used
    usedTokens.add(token);
    
    // Clean up old tokens periodically
    setTimeout(() => usedTokens.delete(token), 10 * 60 * 1000);
    
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}
```

### VNC/RDP Security

```javascript
// Sichere Remote Desktop Konfiguration
const remoteDesktopConfig = {
  vnc: {
    // Verschlüsselung erzwingen
    security: 'tls',
    
    // Starke Authentifizierung
    authentication: 'vnc+tls',
    
    // Verbindungsparameter
    'color-depth': 16,
    'swap-red-blue': false,
    'cursor': true,
    'clipboard-encoding': 'UTF-8',
    
    // Security features
    'disable-audio': true,
    'disable-clipboard-write': false,
    'disable-clipboard-read': false,
    
    // Performance vs Security
    'enable-compression': true,
    'quality': 8
  },
  
  rdp: {
    // Security mode
    security: 'nla',
    
    // Encryption
    'server-layout': 'en-us-qwerty',
    'ignore-cert': false,
    
    // Features
    'disable-audio': true,
    'disable-printing': true,
    'disable-drive': true,
    
    // Performance
    'enable-compression': true,
    'color-depth': 16,
    'force-lossless': false
  }
};
```

## 📊 Monitoring & Auditing

### Audit Logging

```javascript
// Comprehensive Audit Logging
class AuditLogger {
  constructor(db) {
    this.db = db;
  }
  
  async log(event) {
    const auditEntry = {
      timestamp: new Date(),
      user_id: event.userId,
      username: event.username,
      action: event.action,
      resource_type: event.resourceType,
      resource_id: event.resourceId,
      resource_name: event.resourceName,
      ip_address: event.ipAddress,
      user_agent: event.userAgent,
      success: event.success,
      error_message: event.errorMessage,
      details: JSON.stringify(event.details),
      session_id: event.sessionId,
      correlation_id: event.correlationId
    };
    
    await this.db.query(
      `INSERT INTO audit_logs 
       (timestamp, user_id, username, action, resource_type, resource_id, 
        resource_name, ip_address, user_agent, success, error_message, 
        details, session_id, correlation_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      Object.values(auditEntry)
    );
    
    // Real-time alerting for critical events
    if (this.isCriticalEvent(event)) {
      await this.alertSecurityTeam(event);
    }
  }
  
  isCriticalEvent(event) {
    const criticalActions = [
      'USER_PRIVILEGE_ESCALATION',
      'MULTIPLE_FAILED_LOGINS',
      'SSH_KEY_DOWNLOAD',
      'BACKUP_RESTORE',
      'USER_DELETED',
      'SECURITY_SETTING_CHANGED'
    ];
    
    return criticalActions.includes(event.action) || !event.success;
  }
  
  async alertSecurityTeam(event) {
    // Send to SIEM
    await sendToSIEM(event);
    
    // Email notification
    if (event.severity === 'CRITICAL') {
      await sendSecurityAlert(event);
    }
  }
}

// Verwendung
const auditLogger = new AuditLogger(db);

// Middleware für automatisches Audit Logging
app.use(async (req, res, next) => {
  const correlationId = uuidv4();
  req.correlationId = correlationId;
  
  // Log request
  const startTime = Date.now();
  
  // Override res.json to capture responses
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    
    auditLogger.log({
      userId: req.user?.id,
      username: req.user?.username,
      action: `${req.method} ${req.path}`,
      resourceType: 'API_ENDPOINT',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      success: res.statusCode < 400,
      details: {
        method: req.method,
        path: req.path,
        query: req.query,
        statusCode: res.statusCode,
        duration: duration
      },
      sessionId: req.sessionID,
      correlationId: correlationId
    });
    
    return originalJson.call(this, data);
  };
  
  next();
});
```

### Security Monitoring

```javascript
// Anomalie-Erkennung
class SecurityMonitor {
  constructor() {
    this.failedLogins = new Map();
    this.suspiciousPatterns = new Map();
  }
  
  async checkLoginAnomaly(username, ipAddress) {
    const key = `${username}:${ipAddress}`;
    const attempts = this.failedLogins.get(key) || 0;
    
    if (attempts >= 5) {
      await this.blockUser(username, ipAddress);
      return false;
    }
    
    this.failedLogins.set(key, attempts + 1);
    
    // Reset nach 15 Minuten
    setTimeout(() => {
      this.failedLogins.delete(key);
    }, 15 * 60 * 1000);
    
    return true;
  }
  
  async detectSuspiciousActivity(userId, action, metadata) {
    const patterns = [
      {
        name: 'RAPID_API_CALLS',
        check: () => this.checkRapidAPICalls(userId),
        threshold: 100,
        window: 60000 // 1 Minute
      },
      {
        name: 'UNUSUAL_ACCESS_TIME',
        check: () => this.checkUnusualAccessTime(userId, metadata.timestamp),
        threshold: 1
      },
      {
        name: 'SUSPICIOUS_SSH_PATTERN',
        check: () => this.checkSSHPattern(userId, action),
        threshold: 10,
        window: 300000 // 5 Minuten
      }
    ];
    
    for (const pattern of patterns) {
      if (await pattern.check()) {
        await this.alertSuspiciousActivity(userId, pattern.name, metadata);
      }
    }
  }
}
```

## 🚨 Incident Response

### Incident Response Plan

```javascript
// Incident Response Automation
class IncidentResponse {
  constructor() {
    this.incidents = new Map();
  }
  
  async handleSecurityIncident(type, severity, details) {
    const incident = {
      id: uuidv4(),
      type,
      severity,
      details,
      timestamp: new Date(),
      status: 'OPEN',
      actions: []
    };
    
    this.incidents.set(incident.id, incident);
    
    // Immediate actions based on type
    switch (type) {
      case 'BRUTE_FORCE_ATTACK':
        await this.handleBruteForce(incident);
        break;
      
      case 'SQL_INJECTION_ATTEMPT':
        await this.handleSQLInjection(incident);
        break;
      
      case 'UNAUTHORIZED_ACCESS':
        await this.handleUnauthorizedAccess(incident);
        break;
      
      case 'DATA_BREACH':
        await this.handleDataBreach(incident);
        break;
    }
    
    // Notify security team
    await this.notifySecurityTeam(incident);
    
    return incident.id;
  }
  
  async handleBruteForce(incident) {
    const { ipAddress, username } = incident.details;
    
    // Block IP immediately
    await this.blockIP(ipAddress);
    incident.actions.push('IP_BLOCKED');
    
    // Lock user account
    if (username) {
      await this.lockUserAccount(username);
      incident.actions.push('ACCOUNT_LOCKED');
    }
    
    // Add to blacklist
    await this.addToBlacklist(ipAddress);
    incident.actions.push('ADDED_TO_BLACKLIST');
  }
  
  async handleDataBreach(incident) {
    // Immediate containment
    await this.enableReadOnlyMode();
    incident.actions.push('ENABLED_READONLY_MODE');
    
    // Revoke all tokens
    await this.revokeAllTokens();
    incident.actions.push('REVOKED_ALL_TOKENS');
    
    // Force password reset
    await this.forceGlobalPasswordReset();
    incident.actions.push('FORCED_PASSWORD_RESET');
    
    // Backup current state
    await this.createForensicBackup();
    incident.actions.push('FORENSIC_BACKUP_CREATED');
  }
}
```

### Security Backup & Recovery

```bash
#!/bin/bash
# security-backup.sh

# Erstelle verschlüsseltes Backup
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/secure/backups"
BACKUP_FILE="$BACKUP_DIR/security_backup_$DATE.tar.gz.enc"

# Backup erstellen
tar -czf - \
  /app/config \
  /app/logs \
  /app/ssl \
  /app/ssh_keys \
  | openssl enc -aes-256-cbc -salt -k "$BACKUP_PASSWORD" > "$BACKUP_FILE"

# Hash für Integrität
sha256sum "$BACKUP_FILE" > "$BACKUP_FILE.sha256"

# Zu Remote Storage kopieren
aws s3 cp "$BACKUP_FILE" "s3://backup-bucket/security/" --sse
aws s3 cp "$BACKUP_FILE.sha256" "s3://backup-bucket/security/" --sse

# Alte Backups löschen (30 Tage Retention)
find "$BACKUP_DIR" -name "security_backup_*.tar.gz.enc" -mtime +30 -delete
```

## 📋 Compliance

### GDPR Compliance

```javascript
// GDPR Data Management
class GDPRCompliance {
  // Recht auf Auskunft
  async exportUserData(userId) {
    const userData = {
      profile: await this.getUserProfile(userId),
      appliances: await this.getUserAppliances(userId),
      auditLogs: await this.getUserAuditLogs(userId),
      sshKeys: await this.getUserSSHKeys(userId),
      sessions: await this.getUserSessions(userId)
    };
    
    return this.sanitizeForExport(userData);
  }
  
  // Recht auf Löschung
  async deleteUserData(userId) {
    // Soft delete first
    await db.query('UPDATE users SET deleted_at = NOW() WHERE id = ?', [userId]);
    
    // Anonymize personal data
    await db.query(`
      UPDATE users 
      SET email = CONCAT('deleted_', id, '@example.com'),
          username = CONCAT('deleted_user_', id),
          password_hash = '',
          last_login = NULL
      WHERE id = ?
    `, [userId]);
    
    // Delete SSH keys
    await db.query('DELETE FROM ssh_keys WHERE user_id = ?', [userId]);
    
    // Anonymize audit logs
    await db.query(`
      UPDATE audit_logs 
      SET username = 'deleted_user',
          ip_address = '0.0.0.0'
      WHERE user_id = ?
    `, [userId]);
    
    return true;
  }
  
  // Cookie Consent
  configureCookieConsent() {
    return {
      necessary: {
        sessionid: {
          description: 'Session Management',
          retention: 'session'
        }
      },
      functional: {
        theme: {
          description: 'UI Theme Preference',
          retention: '1 year'
        },
        language: {
          description: 'Language Preference',
          retention: '1 year'
        }
      },
      analytics: {
        enabled: false // Disabled by default
      }
    };
  }
}
```

## ✅ Sicherheits-Checkliste

### Initial Setup
- [ ] Alle Standard-Passwörter geändert
- [ ] Starke Secrets generiert (min. 32 Zeichen)
- [ ] SSL/TLS Zertifikate installiert
- [ ] Firewall konfiguriert
- [ ] SELinux/AppArmor aktiviert

### Authentifizierung
- [ ] JWT Secret rotiert
- [ ] Session Timeout konfiguriert
- [ ] Passwort-Policy aktiviert
- [ ] 2FA/MFA verfügbar
- [ ] Account Lockout Policy

### Netzwerk
- [ ] HTTPS erzwungen
- [ ] HSTS aktiviert
- [ ] Rate Limiting konfiguriert
- [ ] CORS richtig konfiguriert
- [ ] Security Headers gesetzt

### Container
- [ ] Non-root User
- [ ] Read-only Filesystem
- [ ] Capabilities minimiert
- [ ] Security Scanning
- [ ] Resource Limits

### Datenbank
- [ ] Root-Zugang deaktiviert
- [ ] SSL/TLS erzwungen
- [ ] Minimale Berechtigungen
- [ ] Verschlüsselung aktiviert
- [ ] Regelmäßige Backups

### Monitoring
- [ ] Audit Logging aktiviert
- [ ] Security Monitoring
- [ ] Anomalie-Erkennung
- [ ] Incident Response Plan
- [ ] Log Retention Policy

### Compliance
- [ ] GDPR konform
- [ ] Datenschutzerklärung
- [ ] Cookie Consent
- [ ] Datenaufbewahrung
- [ ] Verschlüsselung

---

**Version:** 1.1.0 | **Letzte Aktualisierung:** 24. Juli 2025