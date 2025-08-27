# Web Appliance Dashboard 🚀

🇬🇧 English | [🇩🇪 Deutsch](README.de.md) | [📖 User Guide](docs/user-guide-v2/USER-GUIDE.en.md)

[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.1-61dafb.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.1.5-brightgreen.svg)](package.json)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](SECURITY.md)

## ⭐ Support the Project

If you find this project useful, please consider giving it a star! It helps others discover the project and motivates continued development.

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/alflewerken/web-appliance-dashboard?style=social)](https://github.com/alflewerken/web-appliance-dashboard/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/alflewerken/web-appliance-dashboard?style=social)](https://github.com/alflewerken/web-appliance-dashboard/network)
[![GitHub watchers](https://img.shields.io/github/watchers/alflewerken/web-appliance-dashboard?style=social)](https://github.com/alflewerken/web-appliance-dashboard/watchers)

</div>

> **"From a homelab enthusiast for homelab enthusiasts"**

An elegant, self-hosted dashboard for centralized management of VMs, Docker containers, and services. No cloud dependencies, no subscriptions - just a solid tool for your homelab.

![Web Appliance Dashboard](docs/user-guide-v2/images/dashboard-overview.png)

### 🎨 Light & Dark Mode

<div align="center">
<table>
<tr>
<td align="center"><b>Light Mode</b></td>
<td align="center"><b>Dark Mode</b></td>
</tr>
<tr>
<td><img src="docs/user-guide-v2/images/light-mode.png" alt="Light Mode" width="400"/></td>
<td><img src="docs/user-guide-v2/images/dark-mode.png" alt="Dark Mode" width="400"/></td>
</tr>
</table>
</div>

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

## 🤔 Why Another Dashboard?

<details>
<summary><b>Let me be honest - there are many dashboard solutions out there. So why did I build another one?</b></summary>

### The Problem I Faced

After trying Portainer, Heimdall, Homer, and countless others, I always ended up with the same frustrations:

- **🔌 Too many browser tabs** - Each service had its own UI, leading to tab chaos
- **🔑 Password fatigue** - Different credentials for every single service
- **📱 Poor mobile experience** - Most dashboards are desktop-only afterthoughts
- **☁️ Cloud dependencies** - Many require external services or phone-home features
- **🎨 Ugly or outdated UIs** - Let's face it, most look like they're from 2010
- **🔧 Over-engineered** - Simple tasks require complex configurations

### My Solution

I built Web Appliance Dashboard to solve **MY** problems, and maybe they're yours too:

✅ **One Dashboard to Rule Them All** - Terminal, remote desktop, Docker, services - all in one place  
✅ **Mobile-First Design** - Built for iPhone first, scales up to desktop beautifully  
✅ **Zero Cloud Dependencies** - Your data stays on YOUR hardware  
✅ **Modern, Clean UI** - Hover-to-reveal philosophy keeps things tidy  
✅ **One-Line Installation** - Because life's too short for complex setups  
✅ **Actually Useful** - Every feature exists because I needed it, not because it was cool to build

**This isn't just another dashboard - it's the dashboard I wish existed.**

</details>

## 🛡️ Why Trust This Dashboard?

<details>
<summary><b>Built by someone who programmed CNC machine interfaces - where software reliability isn't just about uptime, it's about human safety.</b></summary>

In the CNC world, a software bug doesn't just mean a crashed application - it means:

### 🚨 **Safety First**
- **Emergency Stop Chains** - When an operator hits that red button, the software MUST respond in milliseconds. No exceptions. No "please wait" dialogs.
- **Tool Breakage Detection** - A broken tool at 20,000 RPM becomes shrapnel. The interface must detect and react instantly.
- **Real-time Parameter Monitoring** - Spindle power, servo drive loads, vibration levels - all monitored continuously with zero tolerance for lag or data loss.

### 💥 **The Cost of Failure**
When CNC software fails during rapid traverse (G00):
- **Best case**: A workpiece worth thousands is destroyed
- **Typical case**: Spindle collision, €50,000+ in damages
- **Worst case**: Complete machine write-off (€500,000+) or operator injury

### 🛡️ **This Experience Shaped Every Design Decision**

In industrial automation, you learn:
- **Redundancy is not optional** - Every critical path needs a fallback
- **User mistakes must be anticipated** - If it can be clicked wrong, it will be
- **"It works on my machine" is not acceptable** - It must work on EVERY machine, EVERY time
- **Graceful degradation** - When something fails, fail safely, not catastrophically

**This same reliability-first, safety-obsessed mindset went into every line of this dashboard's code.**

When I handle your SSH keys, manage your service passwords, or control your infrastructure - I'm applying the same principles that kept machine operators safe and million-euro machines running.

*Because in both worlds, there's no room for "oops".*

</details>

## 🏆 Compare With Others

| Feature | Web Appliance Dashboard | Portainer | Heimdall | Homer |
|---------|------------------------|-----------|----------|--------|
| One-Line Install | ✅ | ❌ | ❌ | ❌ |
| Web Terminal | ✅ Built-in | ❌ | ❌ | ❌ |
| Remote Desktop | ✅ Integrated | ❌ | ❌ | ❌ |
| Mobile Optimized | ✅ Mobile-First | ⚠️ | ❌ | ❌ |
| Dark Mode | ✅ | ✅ | ✅ | ✅ |
| SSH Management | ✅ Full | ❌ | ❌ | ❌ |
| Service Control | ✅ | ⚠️ | ❌ | ❌ |
| Cloud-Free | ✅ | ✅ | ✅ | ✅ |
| Modern UI | ✅ React 19 | ⚠️ | ❌ | ⚠️ |
| Backup/Restore | ✅ Encrypted | ❌ | ❌ | ❌ |


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

## 🔄 Update

> ⚠️ **IMPORTANT: Before updating, always create a backup through the Web UI!**
> 
> Navigate to **Settings → Backup** in the dashboard and create a full backup.
> This ensures you can restore your configuration and data if needed.

```bash
# Navigate to installation directory
cd ~/web-appliance-dashboard

# Pull latest Docker images and restart
docker compose pull
docker compose up -d
```

That's it! The dashboard will automatically update to the latest version.

### Update Notes
- Database migrations run automatically on startup
- Your data and configuration are preserved
- Check [CHANGELOG.md](https://github.com/alflewerken/web-appliance-dashboard/blob/main/CHANGELOG.md) for version changes

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

### Technical Documentation
- [Backend Proxy Implementation](docs/BACKEND_PROXY_IMPLEMENTATION-ger.md) - Proxy architecture
- [OpenAPI Specification](docs/openapi.yaml) - API specification

## 🆕 Latest Updates

### 🚀 Version 1.1.6 (August 27, 2025) - Host Monitoring & Audit Log Enhancements

#### Real-time Host Monitoring
- ✅ **Host Ping Monitoring System** - Live availability tracking for all hosts
  - Automatic ping checks at user-configurable intervals
  - Color-coded status bars showing connection quality (Green/Yellow/Orange/Red)
  - Real-time updates via Server-Sent Events to all connected clients
  - Cross-platform support (Windows, macOS, Linux)
  - Parallel execution with smart concurrency limiting
  - Synchronized with service status check intervals from settings

#### Audit Log Improvements
- ✅ **Interactive Statistics with Visual Feedback** - Enhanced filter cards
  - Active filters show prominent glow effects with pulsing animation
  - "Active Users" card now clickable to filter user-related actions
  - Dynamic statistics update based on active filter combinations
  - Improved visual hierarchy with multi-layered shadows

- ✅ **Enhanced Date Filtering** - Fixed single-day and custom ranges
  - Custom date ranges now include full selected days (00:00:00 to 23:59:59)
  - Yesterday filter correctly covers 24-hour period
  - Extended user action detection for comprehensive filtering

- ✅ **Host Restoration Details** - User-friendly data display
  - Replaced JSON strings with organized chip/pill layouts
  - Grouped information by category (Basic, Connection, Visual, Remote)
  - Color-coded status indicators and visual property previews

#### Bug Fixes
- ✅ Fixed "No fields to revert" error when reverting host changes via audit log
- ✅ Corrected audit log statistics not updating dynamically with filters
- ✅ Resolved missing logs when selecting same start/end date
- ✅ Fixed SQL error in host ping monitoring queries

### 🎨 Version 1.1.5 (August 20, 2025) - Major Frontend Refactoring

#### Complete Component Modularization
- ✅ **AuditLog Refactoring** - Split monolithic 2800+ line files into 8 focused modules
  - 83% code reduction in main components (from 1465 to 254 lines)
  - Clear separation of concerns with single responsibility principle
  - Better performance through improved code-splitting possibilities
  - Modules: Actions, Filters, Restore, Details, Stats, Export functionality
  
- ✅ **Component Organization** - Restructured into logical folders
  - `components/SettingsPanel/` - 11 settings-related components
  - `components/Appliances/` - 19 appliance-related components  
  - Named exports via index.js for cleaner imports
  - Components and their CSS files now colocated

#### UI/UX Improvements
- ✅ **AuditLog Panel Resize** - Complete reimplementation
  - Fixed "jumping panel" bug (could only move 2-3 pixels)
  - Smooth resizing between 400-1200px width
  - LocalStorage persistence of panel width
  - Simple useRef solution replacing complex state management

#### Bug Fixes
- ✅ **Dark Mode Tables** - Fixed text visibility in modal/dialog contexts
- ✅ **AuditLog Restore** - Restore buttons now appear correctly for all actions
- ✅ **Frontend Updates** - Docker volume changed from read-only to writable
- ✅ **Naming Conventions** - Enforced consistent camelCase throughout frontend

#### Code Quality
- ✅ **Dead Code Elimination** - Removed 16 unused components and CSS files
- ✅ **Code Reduction** - ~2000 lines removed through modularization
- ✅ **Maintainability** - From 1400+ line files to ~200 line focused modules
- ✅ **Testing** - Modules can now be tested in isolation

### 🔒 Version 1.1.4 (August 18, 2025) - Security & Infrastructure Overhaul

#### Major Infrastructure Improvements
- ✅ **SSH Infrastructure Modernized** - Migration from filesystem to database-based key management
- ✅ **Unified Encryption Architecture** - Consistent AES-256-GCM everywhere (replaced mixed GCM/CBC)
- ✅ **Backup/Restore Completely Overhauled** - Automatic re-encryption, survives all restore cycles
- ✅ **Guacamole Integration Perfected** - Token authentication works reliably, no login dialogs
- ✅ **Build Process Enhanced** - Intelligent credential recovery when .env is missing
- ✅ **Critical Security Fixes** - Removed all hardcoded passwords, proper encryption for service passwords

#### Technical Improvements
- ✅ **Database-Based SSH Keys** - StatusChecker and Commands use DB keys directly
- ✅ **Temporary Key Files** - Auto-cleanup after SSH operations
- ✅ **Service Password Fix** - Changed from bcrypt (one-way) to reversible encryption
- ✅ **Consistent Re-Encryption** - Backup export/import with proper key management
- ✅ **AuthTag Validation** - Full 32-character authTag preservation
- ✅ **Container Recovery** - Detect existing databases without losing data

#### Bug Fixes
- ✅ Fixed Tomcat underscore issue in service names
- ✅ Resolved Header-Auth blocking Token-Auth
- ✅ Fixed password corruption during backup (6-byte authTag bug)
- ✅ Corrected integer comparison errors in build scripts
- ✅ Fixed SSH connection from containers to host systems

#### Installer Improvements
- ✅ **Platform-Specific Fixes** - Resolved sed/awk compatibility between macOS and Linux
- ✅ **Python-Based YAML Handling** - Reliable docker-compose.yml modifications
- ✅ **Automatic Configuration Repair** - Fixes common issues during installation
- ✅ **Better Error Handling** - Clear error messages with solutions

#### Technical Improvements
- ✅ **Non-Interactive Mode** - No TTY errors during SSH installations
- ✅ **Docker Detection Enhanced** - Finds Docker in /usr/local/bin (Docker Desktop)
- ✅ **Hostname Detection** - Automatic .local hostname support for macOS (Bonjour/mDNS)
- ✅ **Container Naming Consistency** - All containers use appliance_ prefix

### 🚀 Version 1.1.3 (August 2025)
- ✅ **React 19 Compatibility** - Full support for React 19.1.1
- ✅ **Express 4 Stability** - Resolved routing issues, stable backend
- ✅ **Improved Backup/Restore** - Fixed drag-and-drop functionality
- ✅ **Remote Desktop Fixed** - Guacamole authentication working
- ✅ **Enhanced Documentation** - Added prominent backup warnings before updates

### 📖 New User Guide
- ✅ Comprehensive documentation with 600+ lines
- ✅ Personal story behind the project
- ✅ Mobile-first documentation with iPhone screenshots
- ✅ Practical workflows instead of feature lists
- ✅ Clean UI Philosophy documented

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
                        │    RustDesk     │◀──────────────┤
                        │  (Remote Desk)  │               │
                        └─────────────────┘               │
                                                          │
                        ┌─────────────────┐               │
                        │    MySQL DB     │◀──────────────┘
                        │   (Port 3306)   │
                        └─────────────────┘
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

I welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

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
- [RustDesk](https://rustdesk.com/) - Open Source Remote Desktop Software
- [ttyd](https://github.com/tsl0922/ttyd) - Web Terminal
- All other [Open Source Projects](package.json) that make this project possible

## 💬 About the Project

> "After 30 years in IT and countless tools later, I just wanted a dashboard that works. No frills, no cloud dependency, no Telemetry, no monthly fees. Just a solid, beautiful tool for my homelab. If it helps you manage your homelab better - mission accomplished!"
>
> *- Alf, 56, IT enthusiast since the Sinclair ZX80*
>
> enjoy!


---

<p align="center">
  Made with ❤️ by <a href="https://github.com/alflewerken">Alf Lewerken</a><br>
  <i>From a homelab enthusiast for homelab enthusiasts</i>
</p>
