# Release Notes - Version 1.1.5

**Release Date:** August 20, 2025  
**Type:** Minor Release - Major Frontend Refactoring

## 🎉 Highlights

This release represents a massive improvement in code quality, maintainability, and user experience. We've reduced the codebase by over 7,600 lines while improving functionality and fixing critical bugs.

### Key Achievements
- **83% code reduction** in AuditLog components through modularization
- **~2,000 lines of dead code** eliminated
- **16 unused components** removed
- **Better organized** component structure with logical folders

## 🚀 What's New

### Complete AuditLog Modularization
The monolithic AuditLog component (2,800+ lines) has been split into 8 focused, maintainable modules:
- `AuditLogActions.js` - Action icons and formatting utilities
- `AuditLogFilters.js` - Advanced filtering interface
- `AuditLogRestore.js` - Restore functionality logic
- `AuditLogDetailRenderer.js` - Detail view rendering
- `AuditLogStats.js` - Statistics display cards
- `AuditLogExport.js` - Export functionality
- `AuditLogPanel.js` - Main orchestrator (reduced by 64%)
- `AuditLogTableMUI.js` - Table component (reduced by 83%)

### Frontend Component Organization
All components are now organized into logical folders with proper separation of concerns:
- `components/Appliances/` - 19 appliance-related components
- `components/SettingsPanel/` - 11 settings-related components
- `components/Hosts/` - Host management components
- Named exports via index.js for cleaner imports

## 🐛 Bug Fixes

### Critical Fixes
- **Panel Resize Bug** - Fixed issue where AuditLog panel could only be moved 2-3 pixels
- **Dark Mode Tables** - Text now properly visible in modal/dialog contexts
- **Restore Buttons** - Now appear correctly for all restorable actions
- **Docker Volume** - Changed from read-only to writable for proper frontend updates

### UI/UX Improvements
- Smooth panel resizing between 400-1200px width
- LocalStorage persistence for panel positions
- Consistent camelCase naming throughout frontend
- Better dark mode support with increased CSS specificity

## 🧹 Code Cleanup

### Removed Components
- Eliminated 16 unused components and CSS files
- Removed obsolete backend routes (backupEnhanced, browser, roles, statusCheck)
- Cleaned up never-used dialog code from AuditLogTableMUI
- Deleted redundant CSS files and duplicate styles

### Structure Improvements
- Components now colocated with their CSS files
- Clear separation of concerns with single responsibility
- Better maintainability with ~200 line focused modules (down from 1400+)
- Improved testing possibilities with isolated modules

## 📊 Statistics

- **Total files changed:** 120
- **Lines added:** 5,079
- **Lines removed:** 12,730
- **Net reduction:** 7,651 lines
- **Code quality:** Significantly improved
- **Maintainability:** Drastically enhanced

## 📚 Documentation Updates

- Updated README with version 1.1.5 features
- Removed outdated Configuration and Performance sections
- Added RustDesk to acknowledgments
- Updated CHANGELOG with complete release details
- Cleaned up documentation for better clarity

## 🔧 Technical Improvements

- Better code-splitting possibilities with modular structure
- Improved build configuration
- Added utility scripts for code analysis
- Enhanced development workflow with writable Docker volumes

## 💡 Migration Notes

This release contains significant structural changes but maintains full backward compatibility. No migration steps are required. Simply pull the latest version and restart your containers:

```bash
git pull
docker compose down
docker compose up -d
```

## 🙏 Acknowledgments

Special thanks to all the open-source projects that make this possible:
- React.js for the UI framework
- Express.js for the backend
- Apache Guacamole for remote desktop functionality
- RustDesk for remote access capabilities
- ttyd for web terminal support

## 📝 Commit History

- `4f92147` - refactor: Complete AuditLog modularization and panel resize fix
- `410734d` - refactor: Major frontend reorganization and dead code removal
- `4f55dc7` - fix: Dark mode text visibility and CSS improvements
- `2948e78` - docs: Update documentation for v1.1.5
- `0153d14` - chore: Update build configurations and scripts
- `c4de5f0` - cleanup: Remove relocated component files

## 🚀 What's Next

- Further performance optimizations
- Additional component modularization
- Enhanced testing coverage
- Improved documentation

---

**Full Changelog:** https://github.com/alflewerken/web-appliance-dashboard/compare/v1.1.4...v1.1.5

**Download:** https://github.com/alflewerken/web-appliance-dashboard/releases/tag/v1.1.5
