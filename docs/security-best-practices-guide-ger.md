# Sicherheits-Best-Practices-Leitfaden

## Web Appliance Dashboard v1.1.1

Dieser Leitfaden beschreibt erweiterte Sicherheitsrichtlinien und Best Practices für den sicheren Betrieb des Web Appliance Dashboards.

## 📋 Inhaltsverzeichnis

- [Übersicht](#übersicht)
- [Authentifizierung & Autorisierung](#authentifizierung--autorisierung)
- [Netzwerksicherheit](#netzwerksicherheit)
- [Datenverschlüsselung](#datenverschlüsselung)
- [Container-Sicherheit](#container-sicherheit)
- [SSH-Sicherheit](#ssh-sicherheit)
- [Remote-Desktop-Sicherheit](#remote-desktop-sicherheit)
- [Audit & Überwachung](#audit--überwachung)
- [Incident Response](#incident-response)
- [Compliance](#compliance)

## 🎯 Übersicht

Die Sicherheit des Web Appliance Dashboards basiert auf mehreren Schichten:

1. **Perimeter-Sicherheit**: Firewall, Reverse Proxy
2. **Anwendungssicherheit**: JWT, RBAC, Eingabevalidierung
3. **Datensicherheit**: Verschlüsselung im Ruhezustand & bei Übertragung
4. **Infrastruktur-Sicherheit**: Container-Härtung, Netzwerkisolierung
5. **Betriebssicherheit**: Überwachung, Protokollierung, Aktualisierungen

## 🔐 Authentifizierung & Autorisierung

### JWT-Konfiguration

```javascript
// Sichere JWT-Konfiguration
const jwtConfig = {
  secret: process.env.JWT_SECRET, // Mindestens 256-bit
  expiresIn: '2h', // Kurze Lebensdauer
  algorithm: 'HS256',
  issuer: 'appliance-dashboard',
  audience: 'appliance-users'
};

// Token-Validierung mit zusätzlichen Prüfungen
const validateToken = (token) => {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret, {
      algorithms: [jwtConfig.algorithm],
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience
    });
    
    // Zusätzliche Validierung
    if (!decoded.userId || !decoded.role) {
      throw new Error('Ungültige Token-Struktur');
    }
    
    return decoded;
  } catch (error) {
    throw new Error('Token-Validierung fehlgeschlagen');
  }
};
```

### Passwort-Richtlinie

```javascript
// Starke Passwort-Richtlinie
const passwordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommon: true,
  preventUserInfo: true
};

// Passwort-Validierung
const validatePassword = (password, username) => {
  const errors = [];
  
  if (password.length < passwordPolicy.minLength) {
    errors.push(`Mindestens ${passwordPolicy.minLength} Zeichen`);
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Mindestens ein Großbuchstabe');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Mindestens ein Kleinbuchstabe');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Mindestens eine Zahl');
  }
  
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('Mindestens ein Sonderzeichen');
  }
  
  if (password.toLowerCase().includes(username.toLowerCase())) {
    errors.push('Passwort darf nicht den Benutzernamen enthalten');
  }
  
  return errors;
};
```

### Multi-Faktor-Authentifizierung (MFA)

```javascript
// TOTP-basierte 2FA-Implementierung
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

// Geheimschlüssel generieren
const generateMFASecret = (username) => {
  const secret = speakeasy.generateSecret({
    length: 32,
    name: `Appliance Dashboard (${username})`,
    issuer: 'Appliance Dashboard'
  });
  
  return {
    secret: secret.base32,
    qr_code: qrcode.toDataURL(secret.otpauth_url)
  };
};

// Token verifizieren
const verifyMFAToken = (token, secret) => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2 // Zeitfenster für Uhrendifferenzen
  });
};
```

## 🌐 Netzwerksicherheit

### Nginx-Sicherheitsheader

```nginx
# /etc/nginx/conf.d/security-headers.conf
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

# Content Security Policy
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https:;
  connect-src 'self' wss: https:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
" always;

# HSTS
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

### Rate Limiting

```javascript
// Advanced Rate Limiting
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

// Login Rate Limiter
const loginLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:login:'
  }),
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 5, // 5 Versuche
  message: 'Zu viele Login-Versuche',
  standardHeaders: true,
  legacyHeaders: false,
  // Exponential backoff
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.ip + ':' + req.body.username
});

// API Rate Limiter mit unterschiedlichen Limits
const createApiLimiter = (maxRequests) => {
  return rateLimit({
    store: new RedisStore({
      client: redisClient,
      prefix: 'rl:api:'
    }),
    windowMs: 15 * 60 * 1000,
    max: maxRequests,
    keyGenerator: (req) => req.user.id
  });
};

// Anwendung
app.use('/api/auth/login', loginLimiter);
app.use('/api/appliances', createApiLimiter(100));
app.use('/api/ssh/execute', createApiLimiter(30));
```

### Firewall Rules

```bash
#!/bin/bash
# UFW Firewall Konfiguration

# Reset
ufw --force reset

# Default Policies
ufw default deny incoming
ufw default allow outgoing

# SSH (nur von Management-Netz)
ufw allow from 10.0.1.0/24 to any port 22

# HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# MySQL (nur intern)
ufw allow from 172.18.0.0/16 to any port 3306

# Guacamole (nur intern)
ufw allow from 172.18.0.0/16 to any port 4822

# Rate limiting für SSH
ufw limit ssh

# Aktivieren
ufw --force enable
```

## 🔒 Datenverschlüsselung

### Verschlüsselung sensibler Daten

```javascript
const crypto = require('crypto');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
    this.saltLength = 64;
    this.iterations = 100000;
  }

  deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, this.iterations, this.keyLength, 'sha256');
  }

  encrypt(text, password) {
    const salt = crypto.randomBytes(this.saltLength);
    const key = this.deriveKey(password, salt);
    const iv = crypto.randomBytes(this.ivLength);
    
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encryptedData, password) {
    const salt = Buffer.from(encryptedData.salt, 'hex');
    const key = this.deriveKey(password, salt);
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

### Database Encryption

```sql
-- MySQL Transparent Data Encryption (TDE)
-- my.cnf
[mysqld]
early-plugin-load=keyring_file.so
keyring_file_data=/var/lib/mysql-keyring/keyring

-- Verschlüsselte Tabellen erstellen
CREATE TABLE sensitive_data (
  id INT PRIMARY KEY,
  data VARBINARY(255)
) ENCRYPTION='Y';

-- Verschlüsselung für bestehende Tabellen
ALTER TABLE ssh_hosts ENCRYPTION='Y';
ALTER TABLE user_sessions ENCRYPTION='Y';
```

## 🐳 Container-Sicherheit

### Dockerfile Security

```dockerfile
# Multi-stage build für minimale Attack Surface
FROM node:18-alpine AS builder

# Security updates
RUN apk update && apk upgrade && \
    apk add --no-cache python3 make g++ && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# Dependencies separat für besseres Caching
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Source code
COPY . .

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
      - NET_BIND_SERVICE
    read_only: true
    tmpfs:
      - /tmp
      - /app/uploads
    environment:
      NODE_ENV: production
    secrets:
      - jwt_secret
      - db_password
    networks:
      - backend
    restart: unless-stopped

  database:
    image: mysql:8.0
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
    environment:
      MYSQL_ROOT_PASSWORD_FILE: /run/secrets/db_root_password
      MYSQL_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_root_password
      - db_password
    volumes:
      - mysql_data:/var/lib/mysql:Z
    networks:
      - backend
    restart: unless-stopped

secrets:
  jwt_secret:
    external: true
  db_password:
    external: true
  db_root_password:
    external: true

networks:
  backend:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.name: br-backend
    ipam:
      config:
        - subnet: 172.20.0.0/24

volumes:
  mysql_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/appliance-dashboard/mysql
```

## 🔑 SSH-Sicherheit

### SSH Key Management

```javascript
// Sichere SSH-Key Generierung
const generateSSHKeyPair = async (keyName, passphrase) => {
  const keyPair = await generateKeyPair('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
      cipher: 'aes-256-cbc',
      passphrase: passphrase
    }
  });
  
  // Sichere Speicherung
  const keyPath = path.join(SSH_KEYS_DIR, keyName);
  await fs.writeFile(`${keyPath}.pub`, keyPair.publicKey, { mode: 0o644 });
  await fs.writeFile(keyPath, keyPair.privateKey, { mode: 0o600 });
  
  return keyPair;
};
```

### SSH Config Hardening

```bash
# /app/.ssh/config
Host *
    # Verschlüsselung
    Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com
    MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com
    KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org
    
    # Sicherheit
    StrictHostKeyChecking ask
    VerifyHostKeyDNS yes
    ForwardAgent no
    ForwardX11 no
    PermitLocalCommand no
    
    # Timeouts
    ServerAliveInterval 30
    ServerAliveCountMax 3
    ConnectTimeout 10
    
    # Logging
    LogLevel INFO
```

## 🖥️ Remote-Desktop-Sicherheit

### Guacamole Hardening

```xml
<!-- guacamole.properties -->
# Verschlüsselung erzwingen
require-ssl: true

# Session Timeout
api-session-timeout: 30

# Brute Force Protection
max-failed-login-attempts: 3
login-attempt-lockout-minutes: 15

# Disable File Transfer by Default
disable-file-transfer: true

# Logging
enable-environment-logging: true
```

### VNC Security

```javascript
// VNC Verbindung mit Verschlüsselung
const createSecureVNCConnection = async (params) => {
  return {
    protocol: 'vnc',
    parameters: {
      hostname: params.hostname,
      port: params.port,
      password: await encryptPassword(params.password),
      
      // Security settings
      'enable-sftp': false,
      'enable-audio': false,
      'read-only': params.readOnly || false,
      
      // Encryption
      'security': 'tls',
      'ignore-cert': false,
      'cert-fingerprint': params.certFingerprint,
      
      // Verbindenion limits
      'connection-timeout': '30000',
      'clipboard-encoding': 'UTF-8'
    }
  };
};
```

## 📊 Audit Audit & Monitoring Überwachung

### Security Event Logging

```javascript
// Erweiterte Audit-Funktionalität
class SecurityAudit {
  constructor(pool) {
    this.pool = pool;
  }
  
  async logSecurityEvent(event) {
    const query = `
      INSERT INTO security_audit_log 
      (timestamp, event_type, severity, user_id, ip_address, 
       user_agent, resource, action, result, details)
      VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.pool.execute(query, [
      event.type,
      event.severity,
      event.userId,
      event.ipAddress,
      event.userAgent,
      event.resource,
      event.action,
      event.result,
      JSON.stringify(event.details)
    ]);
    
    // Alert bei kritischen Events
    if (event.severity === 'CRITICAL') {
      await this.sendSecurityAlert(event);
    }
  }
  
  async detectAnomalies(userId) {
    // Ungewöhnliche Login-Zeiten
    const loginPattern = await this.analyzeLoginPattern(userId);
    
    // Geografische Anomalien
    const geoAnomalies = await this.detectGeoAnomalies(userId);
    
    // Verhaltensanomalien
    const behaviorAnomalies = await this.detectBehaviorAnomalies(userId);
    
    return {
      riskScore: this.calculateRiskScore(loginPattern, geoAnomalies, behaviorAnomalies),
      anomalies: [...loginPattern, ...geoAnomalies, ...behaviorAnomalies]
    };
  }
}
```

### Monitoring Setup

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'appliance-dashboard'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: '/metrics'
    
  - job_name: 'mysql'
    static_configs:
      - targets: ['mysql-exporter:9104']
      
  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx-exporter:9113']

# Alert rules
rule_files:
  - 'security_rules.yml'
```

### Security Alerts

```yaml
# security_rules.yml
groups:
  - name: security
    interval: 30s
    rules:
      - alert: HighFailedLoginRate
        expr: rate(login_failures_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High failed login rate"
          description: "Failed login rate is {{ $value }} per second"
          
      - alert: SuspiciousAPIUsage
        expr: rate(api_requests_total{status=~"4.."}[5m]) > 0.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Suspicious API usage pattern"
          
      - alert: UnauthorizedAccessAttempt
        expr: increase(unauthorized_access_total[1h]) > 10
        labels:
          severity: critical
        annotations:
          summary: "Multiple unauthorized access attempts"
```

## 🚨 Incident Response

### Incident Response Plan

```javascript
// Automatisierte Incident Response
class IncidentResponse {
  async handleSecurityIncident(incident) {
    const response = {
      incidentId: uuidv4(),
      timestamp: new Date(),
      type: incident.type,
      severity: incident.severity,
      actions: []
    };
    
    switch (incident.type) {
      case 'BRUTE_FORCE':
        response.actions.push(await this.blockIP(incident.sourceIP));
        response.actions.push(await this.lockAccount(incident.targetUser));
        response.actions.push(await this.notifyAdmins(incident));
        break;
        
      case 'DATA_BREACH':
        response.actions.push(await this.isolateSystem());
        response.actions.push(await this.revokeAllTokens());
        response.actions.push(await this.enableMaintenanceMode());
        response.actions.push(await this.notifyDataProtectionOfficer(incident));
        break;
        
      case 'PRIVILEGE_ESCALATION':
        response.actions.push(await this.revokeUserPermissions(incident.userId));
        response.actions.push(await this.auditUserActions(incident.userId));
        response.actions.push(await this.notifySecurityTeam(incident));
        break;
    }
    
    await this.logIncidentResponse(response);
    return response;
  }
}
```

## 📋 Compliance

### GDPR Compliance

```javascript
// Datenschutz-Funktionen
class GDPRCompliance {
  // Recht auf Auskunft
  async exportUserData(userId) {
    const userData = {
      profile: await this.getUserProfile(userId),
      activities: await this.getUserActivities(userId),
      connections: await this.getUserConnections(userId),
      auditLog: await this.getUserAuditLog(userId)
    };
    
    return this.generateDataExport(userData);
  }
  
  // Recht auf Löschung
  async deleteUserData(userId) {
    // Anonymisierung statt Löschung für Audit-Trail
    await this.anonymizeUser(userId);
    await this.deletePersonalData(userId);
    await this.deleteUserSessions(userId);
    await this.deleteUserKeys(userId);
    
    return {
      deleted: true,
      timestamp: new Date(),
      retainedData: ['anonymized_audit_logs']
    };
  }
  
  // Datenschutz durch Technikgestaltung
  async pseudonymizeData(data) {
    const key = await this.getPseudonymizationKey();
    return {
      id: this.generatePseudonym(data.id, key),
      data: this.encryptSensitiveFields(data)
    };
  }
}
```

### Security Checklist

```markdown
## Deployment Security Checklist

### Vor dem Deployment
- [ ] Alle Abhängigkeiten auf Sicherheitslücken geprüft (npm audit)
- [ ] Docker Images gescannt (Trivy, Clair)
- [ ] Secrets rotiert und sicher gespeichert
- [ ] Firewall-Regeln konfiguriert
- [ ] SSL-Zertifikate installiert und gültig

### Konfiguration
- [ ] Produktions-Environment-Variablen gesetzt
- [ ] Debug-Modus deaktiviert
- [ ] Logging konfiguriert (ohne sensitive Daten)
- [ ] Rate Limiting aktiviert
- [ ] CORS korrekt konfiguriert

### Zugriffskontrolle
- [ ] Standard-Passwörter geändert
- [ ] Admin-Accounts überprüft
- [ ] MFA für Admin-Accounts aktiviert
- [ ] Service-Accounts mit minimalen Rechten

### Monitoring
- [ ] Security-Monitoring aktiviert
- [ ] Alerting konfiguriert
- [ ] Backup-Strategie implementiert
- [ ] Incident-Response-Plan dokumentiert
```

## 📚 Weiterführende Ressourcen

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [BSI IT-Grundschutz](https://www.bsi.bund.de/DE/Themen/Unternehmen-und-Organisationen/Standards-und-Zertifizierung/IT-Grundschutz/it-grundschutz_node.html)

---

**Version:** 1.1.1 | **Letzte Aktualisierung:** 27. Januar 2025