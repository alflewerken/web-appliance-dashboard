# Changelog

All notable changes to the Web Appliance Dashboard project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2025-01-27

### Added
- **Encryption Key Dialog** - Shows encryption key after backup creation
  - Displays the encryption key needed for decrypting remote host passwords
  - Explains the purpose of the key with clear warnings
  - Provides copy-to-clipboard functionality
  - Includes security recommendations for safe storage
- **Environment Variables**
  - Added GUACAMOLE_PROXY_URL to .env files to prevent Docker Compose warnings
- **Setup Script Enhancement** - Interactive encryption key configuration
  - Asks user for encryption key during setup with detailed explanation
  - Generates secure 32-character key if none provided
  - Shows generated key prominently with storage instructions
  - Added quick setup script for users with existing keys

### Fixed
- **SSH File Upload** - Fixed file upload hanging at 10% due to SSH config mismatch
  - Added dual Host entries in SSH config generation (hostname and host_id)
  - Fixed password authentication detection logic in upload handler
  - Updated SSH config regeneration script for compatibility
- **SSH Host Update** - Fixed hostname duplicate check when updating hosts
  - Only checks for duplicate hostnames when hostname actually changes
  - Setup endpoint now updates existing hosts instead of failing
  - Better error messages for duplicate key violations

### Removed
- **Security Improvements**
  - Removed temporary debug routes that didn't require authentication
  - Removed unused authDebug middleware
  - Cleaned up debug directory with potential security risks
  
### Changed
- **Code Cleanup**
  - Removed unused CSS files (ApplianceCard_heimdall.css)
  - Removed unused RemoteDesktopButton component variants
  - Removed unused maintenance scripts in fixes/ and patches/ directories
  - Disabled Webpack performance warnings for cleaner build output

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