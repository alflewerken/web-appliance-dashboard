# 🎉 Web Appliance Dashboard v1.1.2 - Production Ready

## From a homelab enthusiast for homelab enthusiasts!

After months of development and refinement, I'm excited to share version 1.1.2 of the Web Appliance Dashboard with the community. This release represents a major milestone with comprehensive documentation, a cleaned codebase, and full bilingual support.

## ✨ Highlights

### 📖 Complete Documentation Overhaul
- **600+ lines** comprehensive user guide with personal narrative
- **Host-First Concept** - Clear onboarding process
- **Clean UI Philosophy** - "Hover-to-Reveal" (Desktop), "Touch-to-Show" (Mobile)
- **Mobile Experience Guide** with real iPhone screenshots
- **Practical workflows** showing actual time savings

### 🌍 Full Bilingual Support
- English README as default for international accessibility
- Complete German documentation maintained
- All guides translated and synchronized
- Screenshots and references updated

### 🧹 Massive Codebase Cleanup
- **70,000+ lines** of debug and test code removed
- Production-ready, clean repository
- All temporary files and unused scripts deleted
- Optimized Docker configurations

### 🔒 Security Improvements
- Example secrets properly neutralized
- Security reporting via GitHub Security Advisories
- Encryption key management improved
- No sensitive data in repository

## 📸 Key Features

- **Central Dashboard** - Manage VMs, Docker containers, and services
- **SSH Integration** - One-click terminal access
- **Remote Desktop** - VNC/RDP via Apache Guacamole
- **Service Control** - Start/stop/restart services remotely
- **Audit Logging** - Full compliance support with undo
- **Mobile First** - PWA-capable, works perfectly on smartphones
- **Backup & Restore** - Complete system backup with encryption
- **Multi-User Support** - Role-based access (in development)

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/alflewerken/web-appliance-dashboard.git
cd web-appliance-dashboard

# Setup environment (generates secure keys automatically)
./scripts/setup-env.sh

# Build and start
./scripts/build.sh

# Access dashboard
http://localhost:9080
```

Default credentials: `admin` / `admin123` (change immediately!)

## 📚 Documentation

- [User Guide](docs/user-guide-v2/USER-GUIDE.en.md) - Complete walkthrough
- [German Guide](docs/user-guide-v2/USER-GUIDE.md) - Deutsche Anleitung
- [CHANGELOG](CHANGELOG.md) - Detailed changes

## 🐛 Bug Fixes in v1.1.2

- User status display corrected
- Nginx configuration errors resolved
- QueryBuilder double mapping fixed
- SSH file upload issues resolved
- Remote Desktop after logout works again

## 💬 Personal Note

> After 30 years in IT and countless tools, I just wanted a dashboard that works. No frills, no cloud dependency, no monthly fees. Just a solid, beautiful tool for my homelab. If it helps you manage your homelab better - mission accomplished!

## 🙏 Acknowledgments

Thanks to the open source community and all the projects that made this possible. Special thanks to everyone who will test and provide feedback!

## 📦 Docker Images

The nginx image is available on GitHub Container Registry:
```bash
docker pull ghcr.io/alflewerken/web-appliance-dashboard-nginx:latest
```

## 🗺️ What's Next

- Multi-user functionality improvements
- Metrics dashboard
- Auto-discovery of services
- AI assistant for bulk operations
- Kubernetes support

---

**Happy Homelabbing!** 🚀

*From Alf, 56, IT enthusiast since the C64*