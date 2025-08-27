# Release Notes - Version 1.1.6

**Release Date:** August 27, 2025  
**Type:** Minor Release - Host Monitoring & Audit Log Enhancements

## 🎉 Highlights

This release introduces real-time host monitoring capabilities and significant improvements to the audit log system. The new ping monitoring feature provides instant visibility into host availability, while the enhanced audit log offers better filtering and visual feedback for improved user experience.

### Key Achievements
- **Real-time host monitoring** with color-coded status indicators
- **Interactive audit log statistics** with visual glow effects
- **Improved date filtering** for precise log analysis
- **Enhanced data visualization** with organized chip layouts

## 🚀 What's New

### Real-time Host Ping Monitoring
A comprehensive host availability tracking system that provides instant feedback on connection quality:
- **Automatic ping checks** at user-configurable intervals (synchronized with service status checks)
- **Color-coded status bars** on host cards:
  - 🟢 Green (<50ms) - Excellent connection
  - 🟡 Yellow (50-150ms) - Good connection
  - 🟠 Orange (150-500ms) - Fair connection
  - 🔴 Red (>500ms or offline) - Poor/No connection
- **Cross-platform support** - Works on Windows, macOS, and Linux
- **Parallel execution** with intelligent concurrency limiting (max 10 simultaneous pings)
- **Real-time updates** via Server-Sent Events to all connected clients
- **Database persistence** of ping status and response times
- **Hover tooltips** showing exact response time in milliseconds

### Enhanced Audit Log Statistics
Interactive filter cards with professional visual feedback:
- **Active filter glow effects** - Prominent visual indicators with pulsing animation
- **Multi-layered shadows** (30px, 60px, 90px) for depth perception
- **Clickable "Active Users" card** - Instantly filter all user-related actions
- **Dynamic statistics** - Numbers update based on active filter combinations
- **Smart counting** - Total/Today cards show unfiltered counts, User/Critical show filtered
- **Scale effect** - Active cards slightly enlarge (1.02x) for better feedback
- **Faster animations** - 1.5s pulse cycle for improved responsiveness

### Improved Audit Log Filtering
Enhanced date range and user action detection:
- **Full-day coverage** - Custom date ranges now include complete days (00:00:00 to 23:59:59)
- **Yesterday filter fixed** - Correctly covers the entire 24-hour period
- **Extended user actions** - Better detection including login/logout/session events
- **Multiple detection patterns** - Comprehensive filtering for user-related activities
- **Base statistics preservation** - Total counts remain constant while filtered stats update

### Host Restoration Detail View
User-friendly display of restored host data:
- **Organized chip layouts** - Replaced JSON strings with intuitive pill displays
- **Grouped information** by category:
  - Basic Information (ID, Name, Description, Status)
  - Connection Details (Hostname, Port, Username, SSH Keys)
  - Visual Settings (Icon, Color, Transparency)
  - Remote Desktop Configuration (Type, Protocol, Performance Mode)
- **Color-coded indicators** - Visual status representation
- **Property previews** - Actual colors displayed in chips
- **Meta information** - Shows restoration source and user

## 🐛 Bug Fixes

### Critical Fixes
- **Host Revert Error** - Fixed "No fields to revert" when reverting host changes via audit log
  - Corrected action name mismatch (host_update vs host_updated)
  - Added support for both variants for backwards compatibility
  - Fixed camelCase field handling from QueryBuilder

- **Date Filter Issues** - Resolved missing logs for single-day selections
  - End date now correctly set to 23:59:59.999
  - Single date selection (e.g., August 26, 2025) shows all logs from that day
  - Date range filtering now inclusive of entire selected period

- **SQL Query Error** - Fixed host ping monitoring database queries
  - Removed non-existent 'status' column reference
  - All hosts now properly checked for ping status
  - SSE event handling corrected in HostCard component

- **Statistics Display** - Fixed dynamic update issues
  - Statistics correctly update based on active filters
  - User action count properly calculated from filtered results
  - Critical action count reflects current filter state

## 📊 Technical Improvements

### Performance Optimizations
- Parallel ping execution with concurrency limiting prevents system overload
- SSE events efficiently broadcast status updates to all clients
- Optimized database queries for ping status persistence

### Code Quality
- Consistent error handling across ping monitoring system
- Improved separation of concerns in audit log components
- Better TypeScript-like patterns in JavaScript code

## 🔧 Configuration

### New Settings
- Host ping intervals now synchronized with service status check intervals
- Configurable via Settings → System → Service Status Refresh Interval
- Live reload of intervals without server restart

## 📈 Statistics

- **4 major features** added
- **4 critical bugs** fixed
- **1,516 lines** of changes documented
- **Cross-platform** compatibility maintained

## 🙏 Acknowledgments

Thanks to all users who reported issues and provided feedback for this release. Your input helps make Web Appliance Dashboard better with each update.

## 📝 Notes

- The CI/CD pipeline will automatically build and deploy Docker images
- Existing installations can be updated using the standard update procedure
- No database migrations required for existing 1.1.5 installations

---

For complete details, see the [CHANGELOG](CHANGELOG.md) and [documentation](docs/).
