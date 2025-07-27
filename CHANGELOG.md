# Changelog

All notable changes to the Web Appliance Dashboard project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2025-07-27

### Added
- **Encryption Key Dialog** - Shows encryption key after backup creation
  - Dialog displays the key needed to decrypt remote passwords after restore
  - Copy-to-clipboard functionality
  - Security warnings and best practices
  - Explains the purpose of the key with clear warnings
  - Includes security recommendations for safe storage
- **Sidebar Tooltips** - Interactive tooltips for collapsed sidebar on desktop
  - React Portal-based implementation for proper rendering outside sidebar
  - Automatic tooltip generation from nav-text content
  - MutationObserver for dynamically added categories
  - Hover-activated with proper positioning
- **Toggle Functionality for Sidepanels** - Click to open/close panels
  - Settings, User Management, and Audit Log panels now toggle on click
  - Visual feedback with active state and blue indicator
  - Consistent behavior on mobile and desktop
- **Guacamole Cache Clear API** - New endpoint to clear auth token cache
  - POST /api/guacamole/clear-cache to manually clear cached tokens
  - Automatic token renewal on authentication failures
  - Helps resolve Remote Desktop connection issues after logout
- **Setup Script Improvements** - Interactive encryption key setup
  - Prompts user to enter custom encryption key or generate secure one
  - Shows generated key with instructions to save it
  - Synchronizes key to both .env files
  - Asks user for encryption key during setup with detailed explanation
  - Generates secure 32-character key if none provided
  - Shows generated key prominently with storage instructions
  - Added quick setup script for users with existing keys
- **Environment Variables**
  - Added GUACAMOLE_PROXY_URL to .env files to prevent Docker Compose warnings
  - Added ENCRYPTION_SECRET as alias for SSH_KEY_ENCRYPTION_SECRET
- **Translation Glossary** - Comprehensive German translation glossary
  - Over 200 standardized term translations
  - Categories for different documentation areas
  - Code comment translations
  - Usage guidelines and best practices

### Fixed
- **SSH File Upload** - Fixed file upload hanging at 10% due to SSH config mismatch
  - Added dual Host entries in SSH config generation (hostname and host_id)
  - Fixed password authentication detection logic in upload handler
  - Updated SSH config regeneration script for compatibility
- **SSH Host Update** - Fixed hostname duplicate check when updating
  - Only checks for duplicate hostnames when hostname actually changes
  - Better error messages indicating which hostname already exists
  - SSH setup endpoint now updates existing hosts instead of failing
  - Better error messages for duplicate key violations
- **Health Check Issues** - Fixed unhealthy container states
  - Webserver health check now uses IPv4 (127.0.0.1) instead of localhost
  - ttyd health check simplified to process check (pidof ttyd)
  - Added curl to ttyd image for future improvements
- **Console Log Cleanup** - Removed all debug console.log statements
  - Removed 109 console.log statements from 20 frontend files
  - Created backup before cleanup
  - Significantly cleaner browser console output
- **Terminal Warnings** - Suppressed harmless ttyd warnings
  - Added terminal-error-suppressor.js to filter known harmless messages
  - Removed "Appliance has SSH connection but no ssh_host_id" warning
  - Filtered ttyd fetch token and source-map errors
- **UserPanel Resize** - Fixed resize functionality
  - Corrected resize calculation logic
  - Panel now properly resizes when dragging the resize handle
- **Sidebar Horizontal Scrolling** - Prevented unwanted horizontal scroll
  - Added overflow controls to all sidebar containers
  - Text now truncates with ellipsis instead of causing scroll
  - Improved responsive behavior at narrow widths
- **Documentation Errors** - Fixed incorrect dates and passwords
  - Corrected all timestamps from January to July 2025
  - Fixed default password in README files (changeme123 → admin123)
  - Updated architecture diagrams with correct component names and ports

### Changed
- **Code Cleanup**
  - Removed unused CSS files (ApplianceCard_heimdall.css)
  - Removed unused RemoteDesktopButton component variants
  - Disabled Webpack performance warnings for cleaner build output
  - Moved ProxyService and cleaned up unused versions
  - Better code organization and reduced attack surface
- **German Documentation Translation** - Systematic translation improvements
  - All 11 German documentation files (-ger.md) consistently translated
  - Automated translation script for common terms
  - Code comments in examples translated to German
  - Consistent terminology according to glossary
- **README Files** - Improved translations and consistency
  - German README: Fixed mixed languages, consistent German terms
  - English README: Corrected image references
  - Both files now use consistent formatting
  - Architecture diagrams corrected (React Frontend, correct ports)
- **Image Files** - Renamed from German to English
  - 18 documentation images renamed for consistency
  - Updated all references in README files
  - Created backup of original files

### Removed
- **Security Improvements**
  - Removed temporary debug routes that didn't require authentication
  - Removed unused authDebug middleware
  - Cleaned up debug directory with potential security risks
  - Removed unused maintenance scripts in fixes/ and patches/ directories
- **Temporary Files** - Cleaned up documentation
  - Removed api-client-sdks-eng.tmp.bak backup file
  - Moved to translation-fixes directory

### Documentation
- **Updated Documentation** - All docs updated to version 1.1.1
  - Created comprehensive API Reference guide
  - Updated developer.html with current Mermaid diagrams
  - Created integration guide with examples
  - Enhanced remote desktop setup guide with client implementations
  - Updated performance tuning and security best practices guides
  - Added extensive API client SDK examples for 9 languages
  - Updated both German and English README files
  - Corrected Last Updated date to July 2025

### Security
- **Environment Variable Handling** - Improved encryption key management
  - Setup script now prominently displays generated encryption keys
  - Clear instructions for secure key storage
  - Better synchronization between main and backend .env files

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
