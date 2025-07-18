# Security Policy

## Supported Versions

Currently being supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Web Appliance Dashboard seriously. If you believe you have found a security vulnerability, please report it to us as described below.

**Please do not report security vulnerabilities through public GitHub issues.**

### How to Report

Please email security vulnerabilities to: `security@your-domain.com`

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

Please include the following information (as much as you can provide) to help us better understand the nature and scope of the possible issue:

- Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

### What to Expect

- We will acknowledge receipt of your vulnerability report
- We will confirm the vulnerability and determine its impact
- We will release a fix as soon as possible depending on complexity
- We will communicate the vulnerability publicly after the fix is released

### Security Best Practices for Users

1. **Change Default Credentials**: Always change the default admin password immediately after installation
2. **Use Strong Passwords**: Use complex passwords for all user accounts
3. **Enable HTTPS**: Use HTTPS in production environments
4. **Keep Updated**: Regularly update to the latest version
5. **Secure Environment Variables**: Never commit `.env` files with real credentials
6. **Network Security**: Use firewalls and VPNs to restrict access
7. **Regular Backups**: Maintain regular backups of your data
8. **Audit Logs**: Regularly review audit logs for suspicious activity

### Security Features

Web Appliance Dashboard includes several security features:

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting on API endpoints
- CORS protection
- SQL injection protection
- XSS protection via Helmet.js
- SSH key encryption
- Audit logging
- Role-based access control (RBAC)

## Dependencies

We regularly update our dependencies to include the latest security patches. You can check for vulnerabilities in dependencies by running:

```bash
# Backend
cd backend && npm audit

# Frontend
cd frontend && npm audit
```
