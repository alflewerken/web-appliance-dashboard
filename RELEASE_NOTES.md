# 🎉 Web Appliance Dashboard v1.1.3 - Critical Fixes Release

## Emergency fixes for Docker rebuild issues

This release addresses critical compatibility issues that prevented the application from running after a clean Docker rebuild. All major functionality has been restored.

## 🔧 Critical Fixes

### 🐛 Express 5 Compatibility Issues - FIXED
- **Problem**: Container restart loops after clean rebuild
- **Solution**: Downgraded Express from 5.1.0 to 4.21.2
- **Impact**: Backend and webserver containers now start successfully

### ⚛️ React 19 Compatibility - RESOLVED
- **Problem**: Drag-and-drop backup restore completely broken
- **Solution**: Migrated to React 18+ createRoot API
- **Impact**: Full backup/restore functionality restored

### 🗄️ Guacamole Database Authentication - FIXED
- **Problem**: Remote Desktop connections failing with HTTP 500
- **Solution**: Reset PostgreSQL database with correct credentials
- **Impact**: Remote Desktop fully operational

### 🛠️ Build Script Compatibility - FIXED
- **Problem**: sync-compose.sh failing with GNU sed
- **Solution**: Updated sed commands for cross-platform compatibility
- **Impact**: Production builds now working

## 📦 Dependencies

### Changed
- Express: `5.1.0` → `4.21.2` (downgrade for stability)
- React: `19.1.1` (compatibility issues fixed)
- Node.js: `18+` minimum requirement

## 🧹 Repository Cleanup
- Removed all temporary debug files
- Cleaned up `temp-fix/` directory
- Removed `backend/debug-routes.js`
- Repository is now production-ready

## 📊 Version Information
- **Project Version**: 1.1.3
- **Express**: 4.21.2
- **React**: 19.1.1
- **Node.js**: 18+ (minimum)
- **Docker**: Ready

## 🚀 Quick Start

For new installations:
```bash
curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/install.sh | bash
```

For existing installations experiencing issues:
```bash
# Pull latest changes
git pull

# Rebuild with no cache
./scripts/build.sh --nocache

# Or use quick refresh
./scripts/build.sh --refresh
```

## 💡 Notes

This release focuses entirely on stability and compatibility. No new features were added. If you experienced container restart loops or drag-and-drop issues after rebuilding, this update will resolve those problems.

## 🙏 Acknowledgments

Thanks to the community for patience while these critical issues were resolved. The project is now more stable and maintainable with Express 4.x.

---

**Full Changelog**: [v1.1.2...v1.1.3](https://github.com/alflewerken/web-appliance-dashboard/compare/v1.1.2...v1.1.3)
