# 🔒 Guacamole Security Guide

## ⚠️ CRITICAL SECURITY ISSUE

The current setup exposes Guacamole on port 9070 with default credentials (guacadmin/guacadmin), which is a **severe security risk**.

## 🚨 Immediate Action Required

Run this command to fix the security issue immediately:

```bash
./scripts/immediate-security-fix.sh
```

This will:
1. Stop exposing Guacamole on port 9070
2. Change the default password
3. Route all Guacamole access through the authenticated dashboard

## 🛡️ Security Improvements

### 1. **No Direct Access** 
- Guacamole is no longer accessible on port 9070
- All access must go through the dashboard with authentication

### 2. **Changed Default Credentials**
- The default guacadmin password is changed to a secure random password
- Password is shown once during setup - save it securely!

### 3. **Authentication Required**
- All Guacamole access requires dashboard authentication
- Time-limited tokens (10 minutes) for remote desktop sessions
- nginx validates every request

### 4. **Network Isolation**
- Guacamole only accessible within Docker network
- External access blocked at container level

## 📋 Security Checklist

- [ ] Run `./scripts/immediate-security-fix.sh`
- [ ] Save the new Guacamole admin password securely
- [ ] Update firewall rules to block port 9070 (if previously opened)
- [ ] Test remote desktop through dashboard (should still work)
- [ ] Consider implementing additional security:
  - [ ] VPN access only
  - [ ] IP whitelisting
  - [ ] 2FA for dashboard login
  - [ ] Regular password rotation

## 🔧 Technical Details

### Architecture Changes

**Before (Insecure):**
```
Internet -> Port 9070 -> Guacamole (default password)
```

**After (Secure):**
```
Internet -> Dashboard (authenticated) -> Internal Proxy -> Guacamole
```

### Authentication Flow

1. User logs into dashboard
2. User clicks remote desktop button
3. Dashboard generates time-limited token
4. Token validated by nginx for each request
5. Access granted only with valid token

### Port Configuration

| Service | Before | After |
|---------|--------|-------|
| Dashboard | 9080 | 9080 |
| Guacamole | 9070 (exposed) | Internal only |
| Database | 3306 | 3306 |
| SSH | 2222 | 2222 |

## 🚀 Advanced Security Options

For even more security, consider:

### 1. Complete Network Isolation

```yaml
# docker-compose.production.yml
services:
  guacamole:
    networks:
      - internal_only
  nginx:
    networks:
      - internal_only
      - external
```

### 2. Mutual TLS Authentication

Add client certificate requirements for Guacamole access.

### 3. Audit Logging

All Guacamole access is already logged in the audit_logs table.

### 4. Session Recording

Enable Guacamole session recording for compliance.

## ❓ FAQ

**Q: Will this break my remote desktop connections?**
A: No, remote desktop will work the same through the dashboard. Direct access is blocked.

**Q: What if I need the Guacamole admin interface?**
A: Access it through: http://localhost:9080/guacamole/ (after authentication)

**Q: Can I still use the Guacamole API?**
A: Yes, but only through the authenticated proxy.

**Q: What happens to existing connections?**
A: They continue to work but must re-authenticate after the security fix.

## 🆘 Troubleshooting

If remote desktop stops working after the security fix:

1. Clear browser cache
2. Log out and back into the dashboard
3. Run: `docker-compose exec backend node scripts/fix-remote-desktop.js`
4. Check logs: `docker-compose logs guacamole nginx backend`

## 📞 Support

If you need help with the security implementation, please:
1. Check the logs first
2. Ensure all containers are running
3. Verify the dashboard login works
4. Test with a new incognito window