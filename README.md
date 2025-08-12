# Web Appliance Dashboard 🚀

🇬🇧 English | [🇩🇪 Deutsch](README.de.md) | [📖 User Guide](docs/user-guide-v2/USER-GUIDE.en.md)

[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.1.2-brightgreen.svg)](package.json)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](SECURITY.md)

> **"From a homelab enthusiast for homelab enthusiasts"**

An elegant, self-hosted dashboard for centralized management of VMs, Docker containers, and services. No cloud dependencies, no subscriptions - just a solid tool for your homelab.

![Web Appliance Dashboard](docs/user-guide-v2/images/dashboard-overview.png)

## 🚀 Quick Start - One-Line Installation

Install the complete dashboard with a single command:

```bash
curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/install.sh | bash
```

That's it! The installer will:
- ✅ Check Docker prerequisites
- ✅ Download all configuration files
- ✅ Generate secure passwords automatically
- ✅ Create SSL certificates
- ✅ Pull and start all containers
- ✅ Set up the database

After installation, access your dashboard at:
- 🌐 **http://localhost:9080**
- 🔒 **https://localhost:9443** (self-signed certificate)

## 🗑️ Complete Uninstall

To completely remove the Web Appliance Dashboard:

```bash
# Navigate to installation directory
cd ~/web-appliance-dashboard

# Stop and remove all containers, volumes, and networks
docker compose down -v

# Remove the installation directory
cd ~ && rm -rf web-appliance-dashboard

# Optional: Remove Docker images
docker images | grep ghcr.io/alflewerken | awk '{print $3}' | xargs docker rmi -f
```

This will remove:
- All containers
- All volumes (including data)
- All networks
- All configuration files
- All Docker images (optional)

## 🌟 Features

### Core Features
- **📊 Central Dashboard** - Clear management of all services and hosts
- **🔐 Authentication** - JWT-based user management with roles (Admin/User)
- **🖥️ Web Terminal** - Integrated terminal via ttyd with SSH key support
- **🔑 SSH Integration** - Complete SSH key management with automatic authentication
- **🖥️ Remote Desktop** - VNC & RDP support via Apache Guacamole
- **📦 Service Control** - Start/Stop/Status of services via SSH
- **🎨 Clean UI Philosophy** - "Hover-to-Reveal" (Desktop), "Touch-to-Show" (Mobile)
- **📱 Mobile First** - PWA-capable, optimized for iPhone and tablets

### Enterprise Features
- **💾 Backup & Restore** - Complete system backup with encryption
- **📝 Audit Logging** - Compliance-ready with undo function
- **⚡ Real-time Updates** - Server-Sent Events (SSE) for live status
- **🛡️ Security** - Rate limiting, CORS, Helmet.js, CSP
- **🌐 Multi-User** - User management with granular permission system (in development)
- **🔍 Full-text Search** - Quick search across all services
- **💡 Smart Categories** - Automatic grouping with service counter

## 🆕 Latest Updates (v1.1.2)

### 📖 New User Guide
- ✅ Comprehensive documentation with 600+ lines
- ✅ Personal story behind the project
- ✅ Mobile-first documentation with iPhone screenshots
- ✅ Practical workflows instead of feature lists
- ✅ Clean UI Philosophy documented

### Host-First Concept
- ✅ Hosts as foundation for all services
- ✅ Improved host management
- ✅ Detailed host configuration
- ✅ SSH key management per host

### UI/UX Improvements
- ✅ Interactive tooltips for collapsed sidebar
- ✅ Toggle functionality for side panels
- ✅ Improved resize functionality for panels
- ✅ No horizontal scrolling in sidebar

### New Features
- ✅ Encryption key dialog after backup
- ✅ Guacamole cache-clear API endpoint
- ✅ Improved SSH host update functionality
- ✅ Terminal error suppressor for clean console

### Bug Fixes
- ✅ Health check issues resolved (ttyd, webserver)
- ✅ SSH file upload hanging at 10% fixed
- ✅ Hostname duplicate check on update corrected
- ✅ Remote desktop after logout works again

## 📸 Screenshots

<details>
<summary><b>Show all screenshots</b></summary>

### Dashboard Overview
![Dashboard Overview](docs/user-guide-v2/images/dashboard-overview.png)
*Desktop dashboard with Clean UI*

### Host Management
![Host Overview](docs/user-guide-v2/images/host-overview.png)
*Host overview with all configured machines*

![Host Card](docs/user-guide-v2/images/host-card.png)
*Host card with hover-to-reveal buttons*

![Host Settings](docs/user-guide-v2/images/host-settings.png)
*Detailed host configuration*

### Mobile Experience
![Mobile Overview](docs/user-guide-v2/images/mobile-overview.jpeg)
*iPhone dashboard view*

![Mobile Terminal](docs/user-guide-v2/images/mobile-terminal.jpeg)
*SSH terminal on iPhone*

![Mobile Audit](docs/user-guide-v2/images/mobile-audit.jpeg)
*Mobile audit log - compliance-ready*

![Mobile Sidebar](docs/user-guide-v2/images/mobile-sidebar.jpeg)
*Categories with service counter*

</details>

## 📋 Prerequisites

- Docker & Docker Compose (v2.0+)
- Linux/macOS/Windows with WSL2
- 2GB RAM (4GB recommended)
- 10GB free disk space

## 🛠️ Installation Methods

### Method 1: One-Line Installation (Recommended)
The easiest way - see [Quick Start](#-quick-start---one-line-installation) above.

### Method 2: Manual Installation (for Development)

#### 1. Clone repository
```bash
git clone https://github.com/alflewerken/web-appliance-dashboard.git
cd web-appliance-dashboard
```

#### 2. Build and start
```bash
./scripts/build.sh --nocache
```

This command:
- ✅ Automatically creates all .env files with secure passwords
- ✅ Builds the frontend application
- ✅ Creates and starts all Docker containers
- ✅ Sets up the database schema
- ✅ Configures all services

### 3. Open dashboard
```
http://localhost:9080
```

Default login:
- **User**: admin
- **Password**: admin123

⚠️ **Important**: Change the default password immediately!

### 4. Create first host
1. Click "Hosts" in the sidebar
2. Click "Add host"
3. Enter host data (IP, SSH credentials)
4. Save - done!

Detailed instructions: [📖 User Guide](docs/user-guide-v2/USER-GUIDE.en.md)

## 📚 Documentation

### 📖 For Users
- **[User Guide](docs/user-guide-v2/USER-GUIDE.en.md)** - Comprehensive guide with personal touch
  - Origin story & motivation
  - 5-minute quick start (Host-First!)
  - Mobile Experience Guide
  - Practical workflows
  - Clean UI Philosophy

### Developer Documentation
- [Developer Guide](docs/developer.html) - Architecture with diagrams
- [API Reference](docs/api-reference-ger.md) - API documentation
- [API Client SDKs](docs/api-client-sdks-ger.md) - Client examples
- [Integration Guide](docs/integration-guide-ger.md) - Integration into existing systems
- [Development Environment](docs/DEVELOPMENT_SETUP-ger.md) - Setting up development environment

### Setup & Configuration
- [Remote Desktop Setup](docs/remote-desktop-setup-guide-ger.md) - Guacamole setup
- [Security Guide](docs/security-best-practices-guide-ger.md) - Security guidelines
- [Performance Tuning](docs/performance-tuning-guide-ger.md) - Optimization
- [Docker Environment](docs/docker-env-setup-ger.md) - Docker configuration

### Technical Documentation
- [Backend Proxy Implementation](docs/BACKEND_PROXY_IMPLEMENTATION-ger.md) - Proxy architecture
- [OpenAPI Specification](docs/openapi.yaml) - API specification

## 🔒 Security

### Integrated Security Features
- **JWT Authentication** - Secure token-based authentication
- **Encrypted Passwords** - AES-256 for remote host passwords
- **Rate Limiting** - Protection against brute force attacks
- **CORS Protection** - Configurable policies
- **SQL Injection Protection** - Prepared statements
- **XSS Prevention** - Input sanitization

### Important Security Notes

⚠️ **Encryption Key**: 
- Generated during setup or entered manually
- Store securely (e.g., password manager)
- Required for password decryption after restore

⚠️ **Best Practices**:
- Change all default passwords
- Use HTTPS with valid certificate
- Create regular backups
- Configure firewall rules

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ React Frontend  │────▶│  Nginx Proxy    │────▶│  Node.js API    │
│                 │     │   (Port 9080)   │     │   (Port 3001)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
                        ┌─────────────────┐               │
                        │   Web Terminal  │◀──────────────┤
                        │     (ttyd)      │               │
                        └─────────────────┘               │
                                                          │
                        ┌─────────────────┐               │
                        │    Guacamole    │◀──────────────┤
                        │   (VNC/RDP)     │               │
                        └─────────────────┘               │
                                                          │
                        ┌─────────────────┐               │
                        │    MySQL DB     │◀──────────────┘
                        │   (Port 3306)   │
                        └─────────────────┘
```

## 🛠️ Configuration

### Environment Variables

The most important settings in the `.env` file:

```env
# Ports
PUBLIC_PORT=9080
BACKEND_PORT=3000
FRONTEND_PORT=3001

# Security
JWT_SECRET=<auto-generated>
SSH_KEY_ENCRYPTION_SECRET=<your-encryption-key>

# Database
MYSQL_ROOT_PASSWORD=<auto-generated>
MYSQL_PASSWORD=<auto-generated>

# Features
ENABLE_REMOTE_DESKTOP=true
ENABLE_AUDIT_LOG=true
```

### Docker Compose Override

For specific customizations, create a `docker-compose.override.yml`:

```yaml
version: '3.8'
services:
  webserver:
    ports:
      - "443:443"
    volumes:
      - ./ssl:/etc/nginx/ssl:ro
```

## 🔧 Maintenance

### Create backup
```bash
# Via UI: Settings → Backup → Create backup
# Or via script:
docker exec appliance_backend npm run backup
```

### View logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
```

### Restart containers
```bash
# All services
docker compose restart

# Single service
docker compose restart backend
```

### Updates
```bash
git pull
docker compose down
docker compose build
docker compose up -d
```

## 📊 Performance

### System Requirements
- **CPU**: 2 cores (4 recommended)
- **RAM**: 2GB minimum (4GB recommended)
- **Disk**: 10GB (20GB recommended)

### Optimizations
- Redis cache (optional)
- CDN for static resources
- Database query optimization
- Connection pooling

## 🐛 Troubleshooting

### Common Issues

**Container won't start:**
```bash
docker compose down -v
docker compose up -d
```

**Forgot password:**
```bash
docker exec appliance_backend npm run reset-admin-password
```

**SSL certificate error:**
- Check Nginx configuration
- Ensure port 443 is available

### Debug Mode

For detailed logs:
```bash
# Adjust .env
NODE_ENV=development
LOG_LEVEL=debug

# Restart containers
docker compose restart backend
```

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Frontend Development
cd frontend
npm install
npm run dev

# Backend Development
cd backend
npm install
npm run dev
```

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [React](https://reactjs.org/) - UI Framework
- [Express.js](https://expressjs.com/) - Backend Framework
- [Apache Guacamole](https://guacamole.apache.org/) - Remote Desktop
- [ttyd](https://github.com/tsl0922/ttyd) - Web Terminal
- All other [Open Source Projects](package.json) that make this project possible

## 💬 About the Project

> "After 30 years in IT and countless tools later, I just wanted a dashboard that works. No frills, no cloud dependency, no monthly fees. Just a solid, beautiful tool for my homelab. If it helps you manage your homelab better - mission accomplished!"
>
> *- Alf, 56, IT enthusiast since the Sinclair ZX80*
>
> enyoy!

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/alflewerken">Alf Lewerken</a><br>
  <i>From a homelab enthusiast for homelab enthusiasts</i>
</p>
