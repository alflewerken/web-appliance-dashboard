# Changelog

All notable changes to the Web Appliance Dashboard project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-07-24

### Added
- 🖥️ **Remote Desktop Support** - Full VNC and RDP integration via Apache Guacamole
  - VNC support for Linux/Unix systems
  - RDP support for Windows systems  
  - Encrypted credential storage
  - PWA separate windows for remote connections
  - Token-based authentication (5-minute validity)
  - Per-appliance remote desktop configuration
  
- **New UI Components**
  - Remote Desktop buttons in appliance cards
  - Remote Desktop settings in Service Panel
  - Protocol selection (VNC/RDP)
  - Port and credential configuration
  
- **Infrastructure**
  - Guacamole services in Docker Compose
  - Database migration for remote desktop fields
  - CORS configuration for iFrame support
  - Automatic initialization in build script

- **Scripts**
  - `start-with-guacamole.sh` - Quick start with Remote Desktop
  - `update-remote-desktop.sh` - Update existing installations
  - `verify-database.sh` - Database schema verification
  - `troubleshoot-remote-desktop.sh` - Diagnostic helper

### Changed
- Build script now installs Remote Desktop by default
- Use `--no-remote-desktop` flag to disable
- Updated `init.sql` with Remote Desktop schema
- Enhanced status script to show Remote Desktop info
- Version bumped to 1.1.0 in all package.json files

### Security
- Remote Desktop passwords are encrypted using AES-256
- Temporary single-use tokens for Guacamole access
- Tokens expire after 5 minutes
- No permanent Guacamole credentials stored

### Documentation
- Added Remote Desktop Integration Guide
- Updated README with new features
- Added troubleshooting documentation
- API documentation for remote endpoints
- Updated version badges

## [1.0.4] - 2025-01-15

### Added
- SSH Terminal integration
- Custom command execution
- Audit logging
- Backup and restore functionality
- User role management

### Changed
- Improved service status monitoring
- Enhanced UI responsiveness
- Better error handling

### Fixed
- SSH key permission issues
- Terminal WebSocket stability
- Service status update delays