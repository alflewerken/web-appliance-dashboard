# Changelog

All notable changes to the Web Appliance Dashboard project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Unified Panel Resize System** - Consistent resize behavior across all panels
  - New `usePanelResize` hook replaces 5 different implementations
  - Full touch/iPad support with 20px touch areas
  - Delta-based calculations prevent jumps on resize start
  - Live updates to main view during resize operations
  - All 5 panels migrated: Settings, AuditLog, Service, User, and Host panels
  - ~500 lines of redundant resize code eliminated

- **Enhanced Touch/Mobile UX for Host Cards** - Professional mobile interactions
  - Only one host card shows action buttons at a time on touch devices
  - Click-outside detection hides all buttons when tapping elsewhere
  - 10-second auto-hide timer for inactive cards
  - State management elevated to HostsView component level
  - Smooth transitions between active cards

- **MUI Dropdown z-index Fix** - Dropdowns now appear above panels on tablets
  - New global CSS file `mui-dropdown-fix.css` for z-index hierarchy
  - All MUI components (Select, Menu, Autocomplete, DatePicker) fixed
  - z-index hierarchy: Panels (1300-2000) < Dropdowns (2100) < Modals (2200)
  - Works consistently across all panels without component changes

- **Mobile Panel Fullscreen Support** - Proper viewport coverage on smartphones
  - All panels enforced to 100vw/100vh on devices < 768px
  - Modern viewport units support (100dvh, -webkit-fill-available)
  - Safe area insets for iPhone notch and home indicator
  - Fixed ServicePanel partial display issue on iPhone
  - Position fixed without transformations for stability
- **Enhanced Audit Log Restore** - Comprehensive data preservation and recovery
  - Original data preservation in all audit log entries for reliable revert operations
  - Resource name tracking in audit logs for better identification
  - Support for both camelCase and snake_case field formats in restore operations
  - Automatic Guacamole connection synchronization for remote desktop restores
  - User restore with custom email when original address is already in use
  - Improved error handling with specific, actionable error messages
  - Email address can be changed when restoring deleted users
  - Intelligent error handling shows both name and email fields on any conflict

- **Real-time SSE Synchronization** - Live updates across browser sessions
  - Service panel status updates synchronized in real-time
  - Host changes immediately reflected across all connected clients
  - Appliance modifications synchronized between sessions
  - Audit log updates broadcast to all active users
  - Unlimited reconnection attempts with exponential backoff (1s, 2s, 4s, 8s, 16s, max 30s)
  - Heartbeat monitoring to detect dead connections
  - Reduced UI update debounce from 300ms to 100ms for faster responsiveness

- **Interactive Audit Log Statistics** - Clickable stat cards with smart filters
  - Tooltips display descriptions when hovering in compact mode
  - Click "All Log Entries" to show all logs
  - Click "Today's Activities" to filter today's logs
  - Toggle "Critical Actions" to show/hide important actions only
  - Visual feedback shows active filters with colored borders and tinted backgrounds
  - Filter section state preserved when clicking stat cards

- **Persistent Audit Log Settings** - Filter preferences saved across sessions
  - All filter settings stored in localStorage
  - Search term, selected dropdowns, and date range preserved
  - Filter collapsed/expanded state remembered
  - Critical actions filter state maintained
  - Settings automatically restored when panel reopens
  - Each user has their own local preferences

- **Secure File Transfers Documentation** - New user guide section
  - Comprehensive explanation of SSH/rsync encryption
  - Performance expectations with realistic speed tables
  - Troubleshooting guide for common transfer issues
  - Best practices for optimization and security

- **RustDesk Access Logging** - Audit trail for remote desktop connections
  - New endpoint for logging RustDesk access from host cards
  - Consistent audit logging for both appliances and hosts
  - Resource name properly included in audit entries

### Changed
- **Audit Log Detail Renderer** - Comprehensive field display improvements
  - Extended detail views with all relevant fields for each action type
  - Better handling of nested data structures
  - Improved display of changes with before/after comparisons
  - Responsive chip layouts for better mobile experience
  - Enhanced color coding for different action types
  - File transfer details now show hostname and correct timestamp
  - User activation/deactivation shows colored status pills instead of true/false
  - JSON strings replaced with formatted tables for user_restored entries
  - Before/After pills with clear "Vorher"/"Nachher" labels for user updates
  - **NEW:** Audit log detail chips now display with opaque colored backgrounds
  - **NEW:** Long text in chips displays completely without ellipsis truncation
  - **NEW:** Implemented word-break for very long strings (hashes, IDs)
  - **NEW:** Responsive layout with horizontal scrolling for wide content

- **User Restoration Process** - More flexible recovery options
  - Users can be restored with new usernames
  - Email address conflicts handled gracefully with input prompt
  - Support for restoring users with both new name and new email
  - Clear feedback when restoration requires additional information
  - Button text changed to "Mit neuen Daten" for user restoration

- **Visual Improvements** - Enhanced UI/UX elements
  - Remote Desktop access badge changed from light red to bright orange (#ff8c00)
  - Better visual distinction between different action types
  - Improved visibility and friendlier appearance of status badges
  - Appliance and host cards now have properly rounded bottom corners
  - Card info sections respect border-radius with overflow:hidden
  - **NEW:** Audit log chips use consistent opaque color scheme (red/green/orange/blue/gray)
  - **NEW:** All chips display with white text for optimal contrast

- **Documentation Structure** - User guides reorganized
  - Advanced Configuration section removed from user guides
  - Main sections now use collapsible details/summary tags
  - Cleaner navigation with expandable content blocks
  - Separate technical documentation from user-facing guides

- **Panel Resize Implementation** - Migrated to unified system
  - HostPanel now uses `usePanelResize` hook
  - ServicePanel migrated from custom resize to unified hook
  - UserPanel simplified with new resize system
  - All panels now have consistent resize behavior
  - Safari/iPad compatibility with direct style attributes
  - Width updates use direct style attribute for better performance

- **Host Cards Touch Behavior** - Improved mobile interactions
  - Touch state management centralized in parent component
  - Removed individual card state tracking
  - Props-based activation instead of local state
  - Consistent behavior across all touch devices

- **Mobile CSS Organization** - Enhanced mobile styles structure
  - Extended mobile-consolidated.css for fullscreen panels
  - Added specific overrides for each panel container
  - Improved safe area handling for modern devices
  - Better viewport unit support across browsers

### Fixed
- **Audit Log Export** - Restored complete export functionality
  - Fixed missing delete button in audit log panel
  - Restored all 4 export formats (JSON, CSV, PDF, Markdown)
  - JSON export now includes metadata and filter settings
  - Markdown export with intelligent formatting (no raw JSON blocks)
  - PDF export opens print preview for easy saving
  - Color-coded export buttons with dark/light mode support

- **Host Revert Functionality** - Fixed 404 error when reverting host changes
  - Corrected incomplete route definition in backend
  - Route now accepts multiple action name formats (camelCase and snake_case)
  
- **Guacamole Remote Desktop Authentication** - Direct connections without login prompts
  - Fixed incorrect token placement in URL (moved before hash fragment)
  - Corrected VNC/RDP password decryption and storage
  - Fixed SSH vs VNC password confusion in connection parameters
  - Token URL format changed from `#/client/XXX?token=YYY` to `?token=YYY#/client/XXX`
  - Remote desktop connections now open directly without password prompts
  - Both host and service connections work seamlessly
  - Endpoint path corrected from /users/ to /user/ for consistency

- **SSH File Upload** - Fixed missing resource name in audit logs
  - Added resourceName parameter to createAuditLog call
  - Hostname now correctly appears in Resource column of audit log table
  - Improved traceability of file transfer operations

- **Audit Log Timestamps** - Fixed missing timestamps in detail views
  - File transfer details now show actual timestamp instead of "-"
  - User activation/deactivation details display correct timestamps
  - Changed from non-existent fields to log.createdAt

- **Stat Cards Interactivity** - Fixed non-functional click handlers
  - Removed duplicate export statement in AuditLogStats.js
  - Fixed tooltip implementation with dynamic wrapper approach
  - Added userSelect: 'none' to prevent text cursor on hover
  - Cards now properly respond to clicks with correct cursor display

- **Installation Script** - Improved Docker Compose dependency handling
  - Added recovery mechanism for "dependency failed to start" errors
  - Implemented staged container startup sequence
  - Extended wait times for database initialization
  - Services now start in correct dependency order

- **Guacamole Password Sync** - Fixed password transmission for hosts
  - syncGuacamoleConnection now receives correct data structure
  - Encrypted passwords properly passed from database
  - SSH credentials included for SFTP functionality
  - Consistent handling across create, update, and patch operations

- **Terminal Error Suppression** - Enhanced browser console cleanup
  - Extended patterns for xterm.js warnings
  - Added ttyd specific message suppression
  - WebSocket error filtering improved
  - ResizeObserver and source map warnings suppressed

- **Audit Log Translations** - Fixed duplicate and missing translations
  - "Host wiederhergestellt" vs "Host zurückgesetzt" properly differentiated
  - ssh_file_upload/download translated to "Dateiübertragung"
  - Removed duplicate entries in action dropdowns
  - Consistent terminology across the application

- **Visual Card Rendering** - Fixed missing rounded corners
  - Bottom corners of appliance cards now properly rounded
  - Host card gradient respects border-radius
  - Card info sections use overflow:hidden to contain content
  - Consistent 16px border-radius on all corners

- **Category Navigation** - Fixed hosts view blocking category selection
  - Category clicks now properly deactivate hosts view
  - Seamless switching between hosts and appliances view
  - Prevents confusing overlay where hosts view blocks category filtering
  - Applies to all categories: All, Favorites, Recent, and custom categories

- **iPad/Tablet Panel Resize** - Fixed non-functional resize on touch devices
  - Safari width update issues resolved with direct style attributes
  - Touch events properly handled with all three event types (mouse/touch/pointer)
  - Force DOM updates for Safari compatibility
  - Main view no longer blocked when panels are open on tablets
  - 20px touch areas for easier grip on resize handles

- **Mobile Panel Display** - Fixed panels not showing fullscreen on phones
  - ServicePanel and all other panels now properly fill viewport
  - Multiple viewport units for maximum compatibility
  - Safe area insets properly handled for modern iPhones
  - Fixed partial panel display with visible background

- **Dropdown z-index on Tablets** - Fixed dropdowns appearing behind panels
  - MUI Select/Menu components now have z-index 2100 (above panels)
  - Global solution applied via mui-dropdown-fix.css
  - Affects all dropdowns consistently without component changes
  - Proper z-index hierarchy established for all UI layers

### Removed
- **Deprecated Documentation** - Cleaned up obsolete files
  - Deleted `PANEL_MIGRATION_GUIDE.md` as all panels are now migrated
  - Migration to unified resize system is complete

### Improved
- **Audit Log Action Badges** - Enhanced visual consistency
  - Action badges now use full column width for better readability
  - All badges have uniform width regardless of text length
  - Centered alignment for improved visual appeal
  - Minimum width of 200px ensures consistent presentation

- **Backup Restore Details** - Better visualization in audit logs
  - Restored items now display as structured list instead of raw JSON
  - Each restore type shown with formatted name and count badge
  - Only non-zero items are displayed for clarity
  - Dark/Light mode compatible styling with hover effects

- **Audit Log Filters** - German translations for dropdowns
  - Action dropdown now shows German action names (e.g., "Host aktualisiert" instead of "host_updated")
  - Resource dropdown displays German resource types (e.g., "Benutzer" instead of "user")
  - Consistent with German labels already used in the audit log table
  - Technical values remain unchanged internally for filtering
  - Actions sorted alphabetically in dropdown for better usability

- **Appliance/Service Restoration** - Fixed multiple restore issues
  - Corrected route naming (singular vs plural) for appliance restore endpoint
  - Fixed data structure handling for both old and new audit log formats
  - Proper field mapping between camelCase and snake_case
  - Background images correctly restored from audit logs
  - Remote desktop configurations properly preserved

- **Guacamole Integration** - Fixed remote desktop password handling
  - Passwords correctly decrypted during host restoration
  - Guacamole connections automatically created after restore
  - Remote desktop configurations preserved in audit logs
  - Connection sync improved for all resource types

- **UI Stability** - Fixed audit log detail panel behavior
  - Detail panel no longer closes unexpectedly during interactions
  - "Restore with new name" button works without closing panel
  - Improved click handling for nested interactive elements
  - Better state management for expanded rows

- **Build Errors** - Fixed critical syntax error in AuditLogRestore.js
  - Removed duplicate code and malformed ternary operator
  - Fixed webpack build failure in GitHub Actions
  - Cleaned up merge conflict artifacts

### Updated
- **Dependencies** - Security and feature updates
  - docker/build-push-action upgraded from v5 to v6
  - lucide-react updated from 0.539.0 to 0.540.0
  - **IMPORTANT:** Express kept at 4.21.2 (reverted from 5.1.0 due to breaking changes)

## [1.1.5] - 2025-08-20

### Changed
- **Major Frontend Refactoring** - Complete modularization of components
  - **AuditLog Modularization**: Split monolithic 2800+ line files into 8 focused modules
    - `AuditLogActions.js` - Action icons, names, and formatting utilities (192 lines)
    - `AuditLogFilters.js` - Filter UI with search, action, user, and date filters (210 lines)
    - `AuditLogRestore.js` - Restore logic and endpoint mapping (130 lines)
    - `AuditLogDetailRenderer.js` - Detail views for expanded rows (216 lines)
    - `AuditLogStats.js` - Statistics cards display (94 lines)
    - `AuditLogExport.js` - CSV export and print functionality (153 lines)
    - Reduced `AuditLogPanel.js` by 64% (from 1333 to 482 lines)
    - Reduced `AuditLogTableMUI.js` by 83% (from 1465 to 254 lines)
  
  - **Component Organization**: Restructured into logical folders
    - `components/SettingsPanel/` - 11 settings-related components with index exports
    - `components/Appliances/` - 19 appliance-related components with index exports
    - Improved code locality with components and their CSS files together
    - Named exports via index.js for cleaner imports
    - Better separation of concerns and single responsibility principle

- **AuditLog Panel Resize** - Complete reimplementation of resize mechanism
  - Replaced complex state-based approach with simple useRef solution
  - Fixed "jumping panel" bug where panel could only move 2-3 pixels
  - Smooth resizing between 400-1200px width
  - LocalStorage persistence of panel width
  - Visual feedback during resize operation
  - Four iterations to achieve optimal KISS-principle solution

- **Frontend Naming Conventions** - Enforced consistent camelCase
  - Removed all snake_case from frontend code
  - Unified camelCase usage across all components
  - Fixed field name mapping inconsistencies
  - Better alignment with JavaScript conventions

### Fixed
- **Dark Mode Text Visibility** - Fixed table text colors in dark mode
  - Increased CSS specificity for Modal/Dialog contexts
  - Added multiple fallback selectors for reliability
  - Text now properly shows white on dark backgrounds
  - Fixed MuiTableCell color overrides

- **AuditLog Restore Functionality** - Multiple fixes for restore buttons
  - Fixed missing restore buttons on host updates and deletions
  - Corrected action name mapping (host_update vs hostUpdate)
  - Fixed data structure for changes/oldValues format
  - Restore buttons now appear correctly for all restorable actions
  - Proper handling of both snake_case and camelCase action names

- **Frontend Volume Mounting** - Fixed development workflow
  - Changed Docker volume from read-only to writable
  - Frontend updates now properly sync to container
  - Improved development iteration speed

### Removed
- **Dead Code Elimination** - Removed 16 unused files
  - Deleted unused components: `RustDeskButton.jsx`, `SSHKeysView.js`, `AppliancePermissions.js`
  - Removed unused RemoteDesktop components: `WebRTCRemoteDesktop.jsx`, `GuacamolePerformanceSelector.jsx`
  - Cleaned up unused `ServiceCard.js`, `NetworkBrowser.js`, `AuditLogHeader.js`
  - Removed orphaned CSS files: `FileTransferButton.css`, `UserManagement.light.css`, `ServiceCopyModal.css`
  - Eliminated never-used dialog code from `AuditLogTableMUI.js`
  - Total code reduction: ~2000 lines

### Improved
- **Code Quality Metrics**
  - Maintainability: From monolithic 1400+ line files to ~200 line focused modules
  - Performance: Better code-splitting possibilities with modular structure
  - Readability: Clear separation of concerns and single responsibility
  - Development Speed: Easier to locate and modify specific functionality
  - Testing: Modules can now be tested in isolation

## [1.1.4] - 2025-08-18

### Added
- **SSH Infrastructure Modernization** - Complete overhaul of SSH key management
  - Migrated from filesystem-based to database-based key storage
  - StatusChecker now retrieves SSH keys directly from database
  - Command execution uses database keys with temporary files
  - Automatic cleanup of temporary key files after use
  - Backward compatibility maintained for existing filesystem keys
  - Support for both `hosts.private_key` and `ssh_keys` table

- **Unified Encryption Architecture** - Consistent GCM encryption throughout system
  - Replaced mixed GCM/CBC encryption with unified AES-256-GCM
  - All password fields now use consistent `iv:authTag:encrypted` format
  - Fixed encryption format inconsistencies between modules
  - Eliminated encryption type confusion bugs
  - Full 32-character authTag validation and preservation

- **Backup/Restore System Overhaul** - Complete re-engineering of backup process
  - Implemented consistent re-encryption during backup export
  - Fixed appliance password corruption during backup/restore
  - Automatic re-encryption from backup key to system key on restore
  - Support for both host and appliance password re-encryption
  - Automatic Guacamole connection recreation after restore
  - Validation of authTag length to prevent data corruption

- **Guacamole Integration Perfected** - Reliable token authentication
  - Fixed Header-Authentication blocking Token-Authentication
  - Removed conflicting authentication extensions permanently
  - Service name resolution fixed (underscore in hostname issue)
  - Automatic password propagation to Guacamole connections
  - Token generation now works consistently
  - No login dialogs after proper configuration

- **Build Process Improvements** - Better credential recovery
  - Enhanced detection of existing database without .env file
  - Interactive credential prompts for database recovery
  - Proper handling of both DB_PASSWORD and SSH_KEY_ENCRYPTION_SECRET
  - Fixed integer comparison errors in database status checks
  - Improved error messages and recovery options

### Fixed
- **Critical Security Issues** - Removed hardcoded passwords
  - Eliminated hardcoded fallback passwords in Guacamole connections
  - Fixed bcrypt usage for service passwords (now using reversible encryption)
  - Proper error handling when passwords cannot be decrypted
  - User must manually enter passwords if decryption fails
  - No default passwords used anywhere in the system

- **Password Encryption Bugs** - Fixed critical encryption issues
  - Host passwords changed from bcrypt (one-way) to encrypt (reversible)
  - Service passwords now properly recoverable after backup/restore
  - Fixed double encryption bug causing data corruption
  - Corrected GCM format handling with proper authTag validation
  - Resolved CBC/GCM format confusion in backup operations

- **SSH Authentication** - Fixed container-to-host SSH connections
  - Proper SSH key authorization in host's authorized_keys
  - Fixed StatusChecker SSH connection failures
  - Corrected host hostname resolution (removed host.docker.internal workaround)
  - SSH keys now properly synchronized between database and filesystem

- **Background Settings Persistence** - Fixed issues with background image settings
  - Background settings now persist across page reloads
  - Added localStorage caching for immediate background display on page load
  - Fixed synchronization between frontend and backend settings
  - Corrected updateBackgroundStyles function parameter passing
  - Background enabled state now survives browser refresh

- **ServicePanel Card Visibility** - Fixed card design issues in Service Panel
  - Adjusted transparency from rgba(20,20,20,0.95) to rgba(0,0,0,0.2) for better visibility
  - Aligned card design with HostPanel for consistency
  - Fixed background image being blocked by opaque cards
  - Removed excessive box-shadow for cleaner appearance

- **Appliance Card Icon Positioning** - Fixed icon centering issues
  - Icon was positioned too high (at 60% instead of 50%)
  - Cleaned up 20+ conflicting CSS rules that caused positioning problems
  - Icon now properly centered at 40% from top with 50% card size
  - Removed redundant CSS definitions for cleaner, maintainable code

### Changed
- **Database Key Management** - Centralized SSH key handling
  - StatusChecker refactored to use database keys directly
  - Command execution migrated to database key retrieval
  - Temporary key files created on-demand with proper permissions
  - Automatic cleanup after SSH operations complete
  - Reduced filesystem dependency for better container portability

- **Encryption System Standardization** - Unified cryptographic approach
  - All modules now use crypto.js for GCM encryption
  - Removed legacy EncryptionManager CBC implementations
  - Consistent key derivation using SHA-256 hashing
  - Standardized format: `iv:authTag:encrypted` everywhere
  - Better error handling with fallback mechanisms

- **Major CSS Consolidation** - Complete restructuring of panel CSS architecture
  - **ServicePanel**: Consolidated 2 CSS files into components/ServicePanel.css (245 lines)
  - **UserPanel**: Consolidated 6 CSS files into components/UserPanel.css (510 lines)
  - **SettingsPanel**: Consolidated 2 CSS files into components/SettingsPanel.css (135 lines)
  - Achieved 44% reduction in CSS code through redundancy elimination
  - Reduced number of CSS files by 70% (from 10 to 3 files)
  - Removed entire `unified/` directory (no longer needed)
  - All panel CSS files now located with their components for better locality

- **Info Section Height** - Increased from 25% to 35% of card height
  - Better visibility for appliance names and descriptions
  - More space for text in small cards
  - Button positions adjusted accordingly (65% content area)

- **CSS Architecture** - Replaced pseudo-elements with DOM elements
  - Removed CSS ::before and ::after pseudo-elements for bars
  - Implemented real DOM elements for better interactivity
  - Improved click event handling with proper preventDefault/stopPropagation
  - Better pointer-events management for reliable clicking

### Added
- **Compact Mode for Small Cards** - Interactive bar indicators for cards < 90px
  - Colored bars replace buttons on small cards for space efficiency
  - Bars positioned identically to normal buttons for consistency
  - Left side: Edit (white), Start (green), Stop (red) service controls
  - Right side: Favorite (gold), Terminal (gray), Remote Desktop (blue), File Transfer (purple)
  - Bars appear on hover (desktop) or after tap (mobile/touch devices)
  - Bars expand from 4px to 8px on hover for better visibility
  
- **Tooltips for Compact Mode** - Material-UI tooltips on all compact bars
  - Shows function description when hovering over bars
  - Immediate display (enterDelay=0) for better responsiveness
  - Arrow indicators for clear association with bars
  - Works on both desktop and touch devices

### Improved
- **Mobile/Touch Support** - Enhanced interaction for touch devices
  - Single tap reveals compact bars on mobile/iPad
  - Consistent behavior between desktop hover and mobile touch
  - hasBeenTouched state properly manages visibility
  
- **Code Organization** - Cleaner CSS structure
  - Consolidated icon styles into single definition
  - Removed duplicate and conflicting rules
  - Better maintainability with organized style hierarchy
  - All panel CSS files now use consistent scoping patterns

### Removed
- **Unified Directory** - Removed obsolete CSS directory
  - Deleted 11 fragmented CSS files from `components/unified/`
  - Removed 3 additional CSS files from `styles/` directory
  - All functionality preserved in consolidated files

## [1.1.3] - 2025-08-12

### Fixed
- **Express 5 Compatibility** - Downgraded to Express 4.21.2
  - Fixed container restart loops caused by path-to-regexp incompatibility
  - Backend and webserver containers now start successfully
  - All routing functionality restored
- **React 19 Compatibility** - Updated drag-and-drop implementation
  - Migrated from deprecated ReactDOM.render to createRoot API
  - Fixed "PT.render is not a function" error
  - Backup restore drag-and-drop now fully functional
- **DOM Cleanup Issues** - Improved React dialog lifecycle
  - Fixed "Node.removeChild" errors in backup restore dialog
  - Added proper null checks before DOM manipulation
  - Prevented duplicate removal attempts
- **Guacamole Authentication** - Reset PostgreSQL database
  - Fixed password mismatch between .env and database initialization
  - Remote Desktop connections now working properly
  - HTTP 500 errors resolved
- **Build Script Compatibility** - Fixed sed commands for GNU sed
  - Updated sync-compose.sh to work with both GNU and BSD sed
  - Production docker-compose generation now working

### Changed
- **Dependencies**
  - Express: 5.1.0 → 4.21.2 (downgrade for stability)
  - React: Already at 19.1.1 (fixed compatibility issues)
  
### Removed
- **Temporary Files** - Cleaned up development artifacts
  - Removed temp-fix/ directory with old patch scripts
  - Removed backend/debug-routes.js debugging script
  - Repository cleaned of all temporary development files

### Documentation
- **Version Badges** - Updated to reflect actual versions
  - React badge: 18.2 → 19.1
  - Node.js badge: 20+ → 18+ (minimum requirement)
  - Backend README version: 1.1.0 → 1.1.2

## [1.1.2] - 2025-08-10

### Added
- **Custom Nginx Docker Image** - Containerized nginx configuration
  - Created custom nginx:alpine-based Docker image with all configurations
  - Integrated health check endpoint at /health
  - Removed dependency on local nginx config mounting
  - Improved deployment consistency across environments
- **Comprehensive User Documentation** - 600+ lines user guide
  - Personal story and motivation behind the project
  - Host-First concept explained in detail
  - Mobile Experience guide with iPhone screenshots
  - Practical workflows instead of feature lists
  - Clean UI Philosophy documented ("Hover-to-Reveal", "Touch-to-Show")
  - Tips from the developer section
  - Complete English translation of all documentation
- **Host Management Documentation** - Clear onboarding process
  - Hosts as foundation for all services
  - Step-by-step host creation guide
  - Visual guide with annotated screenshots
  - Host card button explanations
- **Bilingual Documentation** - Full English and German support
  - English README as default (README.md)
  - German README available (README.de.md)
  - Complete English translation of User Guide (USER-GUIDE.en.md)
  - All screenshots and references synchronized

### Fixed
- **User Status Display** - Fixed incorrect "Account locked" display in User Panel
  - Added proper snake_case to camelCase mapping for raw SQL queries
  - Fixed `isActive` field mapping in GET /users endpoint
  - Corrected toggle-active response to use camelCase
  - All user accounts now show correct active/locked status
- **Nginx Configuration Errors** - Resolved multiple nginx startup issues
  - Fixed location directives outside server blocks
  - Removed duplicate client_max_body_size and proxy_http_version directives
  - Renamed .conf files to .inc for include-only configurations
  - Restructured configuration hierarchy for proper nginx loading
- **QueryBuilder Mapping** - Resolved double mapping issues in appliances routes
  - Removed redundant mapDbToJs/mapJsToDb calls when using QueryBuilder
  - QueryBuilder now handles all snake_case to camelCase conversions automatically
  - Fixed undefined fields issue caused by double mapping (e.g., isFavorite)
  - Cleaned up unused mapping function imports

### Changed
- **Frontend Performance** - Removed all debug console.log statements
  - Cleaned up debug logs from App.js, AppContent.js, ApplianceCard.js
  - Removed logging from applianceUtils.js, applianceService.js, useAppliances.js
  - Reduced bundle size and improved browser console clarity
  - Better performance with fewer console API calls
- **Code Architecture** - Simplified data flow between database and frontend
  - Established QueryBuilder as the single source of truth for field mapping
  - Routes now consistently use camelCase for all data handling
  - Improved performance by eliminating unnecessary mapping operations

### Technical
- **QueryBuilder Clarification** - Documented raw query mapping requirements
  - Raw SQL queries (db.raw) require manual snake_case to camelCase mapping
  - QueryBuilder methods (select, findOne, update) handle mapping automatically
  - Added explicit mapping for all raw query results to maintain consistency

### Removed
- **Unused Code** - Cleaned up obsolete mapping functions
  - Removed unused mapDbToJs, mapJsToDb, mapDbToJsWithPasswords imports
  - Removed create-customer-package-v2.sh from repository tracking
- **Legacy Documentation** - Replaced with new comprehensive guide
  - Removed entire docs/user-manual directory
  - Deleted outdated screenshots and HTML documentation
  - Replaced with modern Markdown-based documentation
- **Debug and Test Files** - Major cleanup for production readiness
  - Removed 70,000+ lines of debug and test code
  - Deleted all temporary scripts and development helpers
  - Cleaned up unused nginx configurations
  - Removed all test databases and backup files

### Security
- **Example Secrets Neutralized** - Secure defaults in .env.example
  - JWT_SECRET and SSH_KEY_ENCRYPTION_SECRET marked as insecure examples
  - Setup script automatically generates secure replacements
  - Clear warnings about not using example values in production
- **Security Contact Updated** - GitHub Security Advisories
  - Removed placeholder email from SECURITY.md
  - Configured to use GitHub's built-in security reporting
  - Clear instructions for vulnerability reporting

### Documentation
- **README Overhaul** - Complete restructuring
  - English README now default for international accessibility
  - Updated screenshots from new user guide
  - Personal touch with developer story
  - Host-First concept prominently explained
  - Clean UI Philosophy highlighted
- **User Guide v2** - Comprehensive rewrite
  - 600+ lines of detailed documentation
  - Personal narrative style
  - Mobile-first approach with real iPhone screenshots
  - Practical workflows with time savings
  - Troubleshooting section
  - Roadmap and future plans
- **Launch Preparation** - Ready for open source release
  - LAUNCH-CHECKLIST.md created with pre-flight checks
  - All sensitive information removed
  - Repository cleaned and organized
  - Version badges updated to 1.1.2

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
