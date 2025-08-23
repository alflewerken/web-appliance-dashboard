// Simplified AuditLogPanel Component with fixed resize and mobile auto-update
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  useTheme,
  Button,
  Card,
  CardContent,
  Stack,
  Collapse,
  IconButton,
  Tooltip,
} from '@mui/material';
import { FileDown, FileText, File, Activity, FileCode, ChevronUp, ChevronDown, FileJson, RefreshCw } from 'lucide-react';
import UnifiedPanelHeader from '../UnifiedPanelHeader';
import axios from '../../utils/axiosConfig';
import AuditLogTableMUI from './AuditLogTableMUI';
import AuditLogFilters from './AuditLogFilters';
import AuditLogStats from './AuditLogStats';
import { useSSE } from '../../hooks/useSSE';
import { 
  exportAuditLogs, 
  deleteOldAuditLogs,
  deleteFilteredAuditLogs,
  exportForPrint 
} from './AuditLogExport';
import { criticalActions, getActionColor, formatActionName } from './AuditLogActions';
import './AuditLogPanel.css';
import './AuditLogTableCardFix.css';

const AuditLogPanel = ({ onClose, onWidthChange }) => {
  const theme = useTheme();
  
  // Panel width state - simple approach
  const [panelWidth, setPanelWidth] = useState(() => {
    const savedWidth = localStorage.getItem('auditLogPanelWidth');
    return savedWidth ? parseInt(savedWidth) : 800;
  });

  // Refs for resize handling
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const panelRef = useRef(null);

  // Simple resize handler
  const handleMouseDown = (e) => {
    e.preventDefault();
    isResizingRef.current = true;
    startXRef.current = e.pageX;
    startWidthRef.current = panelWidth;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingRef.current) return;
      
      const currentX = e.pageX;
      const deltaX = startXRef.current - currentX;
      const newWidth = Math.max(400, Math.min(1200, startWidthRef.current + deltaX));
      
      setPanelWidth(newWidth);
      
      if (onWidthChange) {
        onWidthChange(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        localStorage.setItem('auditLogPanelWidth', panelWidth);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [panelWidth, onWidthChange]);

  // Load saved filter settings from localStorage
  const loadFilterSettings = () => {
    try {
      const savedSettings = localStorage.getItem('auditLogFilterSettings');
      if (savedSettings) {
        return JSON.parse(savedSettings);
      }
    } catch (error) {
      console.error('Error loading filter settings:', error);
    }
    return {
      searchTerm: '',
      selectedAction: 'all',
      selectedUser: 'all',
      selectedResourceType: 'all',
      dateRange: 'all',
      showCriticalOnly: false,
      filtersCollapsed: false,
    };
  };

  const savedFilterSettings = loadFilterSettings();
  
  // State for logs and filters
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState(savedFilterSettings.searchTerm);
  const [selectedAction, setSelectedAction] = useState(savedFilterSettings.selectedAction);
  const [selectedUser, setSelectedUser] = useState(savedFilterSettings.selectedUser);
  const [selectedResourceType, setSelectedResourceType] = useState(savedFilterSettings.selectedResourceType);
  const [dateRange, setDateRange] = useState(savedFilterSettings.dateRange);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [showCriticalOnly, setShowCriticalOnly] = useState(savedFilterSettings.showCriticalOnly);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [stats, setStats] = useState({
    totalLogs: 0,
    todayLogs: 0,
    uniqueUsers: 0,
    criticalActions: 0,
  });
  const [filtersCollapsed, setFiltersCollapsed] = useState(savedFilterSettings.filtersCollapsed);
  
  const isAdmin = true;
  const { addEventListener, removeEventListener, isConnected } = useSSE();
  
  // Track last update timestamp and initial load state
  const lastUpdateRef = useRef(null);
  const hasInitialLoadRef = useRef(false);
  const isMobileRef = useRef(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth <= 768);

  // Fetch Audit Logs (full load - only used for initial load and manual refresh)
  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get('/api/audit-logs');
      const logsData = response.data.logs || response.data || [];
      const logsArray = Array.isArray(logsData) ? logsData : [];
      
      setLogs(logsArray);
      setFilteredLogs(logsArray);
      
      // Track the timestamp of the newest log
      if (logsArray.length > 0) {
        lastUpdateRef.current = logsArray[0].createdAt;
      }
      
      // Mark initial load as complete
      hasInitialLoadRef.current = true;
      
      const today = new Date().toISOString().split('T')[0];
      const todayLogs = logsArray.filter(log => 
        log.createdAt && log.createdAt.startsWith(today)
      );
      
      const uniqueUsers = new Set(logsArray.map(log => log.username || 'System'));
      const criticalLogs = logsArray.filter(log => 
        criticalActions.includes(log.action)
      );
      
      setStats({
        totalLogs: logsArray.length,
        todayLogs: todayLogs.length,
        uniqueUsers: uniqueUsers.size,
        criticalActions: criticalLogs.length,
      });
      
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError('Fehler beim Laden der Audit-Logs');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch only new logs (incremental update for mobile)
  const fetchNewLogs = useCallback(async () => {
    // Skip if initial load hasn't happened yet or no lastUpdate
    if (!hasInitialLoadRef.current || !lastUpdateRef.current) {
      return;
    }

    try {
      // Fetch logs newer than the last update
      const response = await axios.get('/api/audit-logs', {
        params: {
          since: lastUpdateRef.current
        }
      });
      
      const newLogsData = response.data.logs || response.data || [];
      const newLogsArray = Array.isArray(newLogsData) ? newLogsData : [];
      
      if (newLogsArray.length > 0) {
        console.log(`[AuditLog] Adding ${newLogsArray.length} new logs`);
        
        // Merge new logs with existing ones
        setLogs(prevLogs => {
          // Remove duplicates and sort by date
          const mergedLogs = [...newLogsArray, ...prevLogs];
          const uniqueLogs = Array.from(
            new Map(mergedLogs.map(log => [log.id, log])).values()
          );
          return uniqueLogs.sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
          );
        });
        
        // Update the last update timestamp
        lastUpdateRef.current = newLogsArray[0].createdAt;
        
        // Update stats incrementally
        const today = new Date().toISOString().split('T')[0];
        const newTodayLogs = newLogsArray.filter(log => 
          log.createdAt && log.createdAt.startsWith(today)
        );
        
        setStats(prevStats => ({
          totalLogs: prevStats.totalLogs + newLogsArray.length,
          todayLogs: prevStats.todayLogs + newTodayLogs.length,
          uniqueUsers: prevStats.uniqueUsers, // This would need recalculation
          criticalActions: prevStats.criticalActions + 
            newLogsArray.filter(log => criticalActions.includes(log.action)).length,
        }));
      }
    } catch (err) {
      console.error('Error fetching new audit logs:', err);
      // On error, don't show error message for incremental updates
    }
  }, []);

  // Filter logs effect
  useEffect(() => {
    let filtered = [...logs];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(log =>
        (log.username?.toLowerCase().includes(search)) ||
        (log.action?.toLowerCase().includes(search)) ||
        (log.resourceName?.toLowerCase().includes(search)) ||
        (log.ipAddress?.toLowerCase().includes(search))
      );
    }

    if (selectedAction !== 'all') {
      filtered = filtered.filter(log => log.action === selectedAction);
    }

    if (selectedUser !== 'all') {
      filtered = filtered.filter(log => log.username === selectedUser);
    }

    if (selectedResourceType !== 'all') {
      filtered = filtered.filter(log => log.resourceType === selectedResourceType);
    }

    if (dateRange !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (dateRange) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'yesterday':
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          startDate = new Date(yesterday.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case 'custom':
          if (customStartDate && customEndDate) {
            startDate = new Date(customStartDate);
            const endDate = new Date(customEndDate);
            filtered = filtered.filter(log => {
              const logDate = new Date(log.createdAt);
              return logDate >= startDate && logDate <= endDate;
            });
          }
          break;
        default:
          break;
      }
      
      if (startDate && dateRange !== 'custom') {
        filtered = filtered.filter(log => 
          new Date(log.createdAt) >= startDate
        );
      }
    }

    if (showCriticalOnly) {
      filtered = filtered.filter(log => 
        criticalActions.includes(log.action)
      );
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm, selectedAction, selectedUser, selectedResourceType, 
      dateRange, customStartDate, customEndDate, showCriticalOnly]);

  // Initial load
  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Mobile polling for incremental updates
  useEffect(() => {
    if (!isMobileRef.current) return;
    
    // Set up polling interval for mobile (every 5 seconds)
    const intervalId = setInterval(() => {
      // Only fetch new logs if document is visible
      if (!document.hidden) {
        fetchNewLogs();
      }
    }, 5000);

    // Cleanup
    return () => {
      clearInterval(intervalId);
    };
  }, [fetchNewLogs]);

  // Manual refresh function for mobile
  const manualRefresh = useCallback(() => {
    // For manual refresh, do a full reload
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Save filter settings when they change
  useEffect(() => {
    const filterSettings = {
      searchTerm,
      selectedAction,
      selectedUser,
      selectedResourceType,
      dateRange,
      showCriticalOnly,
      filtersCollapsed
    };
    
    try {
      localStorage.setItem('auditLogFilterSettings', JSON.stringify(filterSettings));
    } catch (error) {
      console.error('Error saving filter settings:', error);
    }
  }, [searchTerm, selectedAction, selectedUser, selectedResourceType, 
      dateRange, showCriticalOnly, filtersCollapsed]);

  // SSE Event Listeners - disabled on mobile for better performance
  useEffect(() => {
    // Skip SSE on mobile devices - use polling instead
    if (isMobileRef.current) {
      return;
    }
    
    if (!addEventListener || !isConnected) {
      return;
    }

    const auditEvents = [
      'audit_log_created',
      'host_created',
      'host_updated',
      'host_deleted',
      'appliance_created',
      'appliance_updated',
      'appliance_deleted',
      'service_created',
      'service_updated',
      'service_deleted',
      'category_created',
      'category_updated',
      'category_deleted',
      'user_created',
      'user_updated',
      'user_deleted',
      'ssh_key_registered',
      'backup_created',
      'backup_restored',
    ];

    const unsubscribers = auditEvents
      .map(eventName => {
        try {
          const unsubscribe = addEventListener(eventName, () => {
            setTimeout(() => {
              fetchAuditLogs();
            }, 1000);
          });
          
          if (typeof unsubscribe !== 'function') {
            console.warn(`Failed to subscribe to ${eventName}`);
            return null;
          }
          
          return unsubscribe;
        } catch (error) {
          console.error(`Error subscribing to ${eventName}:`, error);
          return null;
        }
      })
      .filter(Boolean);

    return () => {
      unsubscribers.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch (error) {
          console.error('Error unsubscribing:', error);
        }
      });
    };
  }, [addEventListener, removeEventListener, isConnected, fetchAuditLogs]);

  const handleExport = () => {
    setShowExportOptions(!showExportOptions);
  };

  // CSV Export handler
  const handleCsvExport = async () => {
    try {
      await exportAuditLogs({
        selectedAction,
        selectedUser,
        selectedResourceType,
        dateRange,
        customStartDate,
        customEndDate,
        showCriticalOnly,
        logs: filteredLogs
      });
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // JSON Export handler
  const handleJsonExport = async () => {
    try {
      const dataStr = JSON.stringify(filteredLogs, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const exportFileDefaultName = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error('JSON Export failed:', error);
    }
  };

  // Print handler
  const handlePrint = async () => {
    try {
      await exportForPrint(filteredLogs);
    } catch (error) {
      console.error('Print failed:', error);
    }
  };

  const handleDelete = async () => {
    const hasFilters = searchTerm || selectedAction !== 'all' || 
                      selectedUser !== 'all' || selectedResourceType !== 'all' || 
                      dateRange !== 'all' || showCriticalOnly;

    if (hasFilters) {
      const confirmDelete = window.confirm(
        `Möchten Sie wirklich ${filteredLogs.length} gefilterte Audit-Logs löschen?`
      );

      if (confirmDelete) {
        try {
          await deleteFilteredAuditLogs({
            selectedAction,
            selectedUser,
            selectedResourceType,
            dateRange,
            customStartDate,
            customEndDate,
            showCriticalOnly,
            searchTerm
          });
          
          // Refresh logs after deletion
          await fetchAuditLogs();
        } catch (error) {
          console.error('Delete failed:', error);
        }
      }
    } else {
      await deleteOldAuditLogs(fetchAuditLogs);
    }
  };

  const handleRowExpand = (logId) => {
    // Convert to string to ensure consistency
    const logIdStr = String(logId);
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logIdStr)) {
        newSet.delete(logIdStr);
      } else {
        newSet.add(logIdStr);
      }
      return newSet;
    });
  };

  const handleStatClick = (action, type) => {
    if (type === 'dateRange') {
      switch (action) {
        case 'all':
          setDateRange('all');
          break;
        case 'today':
          setDateRange('today');
          break;
        default:
          break;
      }
    } else if (type === 'criticalOnly') {
      setShowCriticalOnly(!showCriticalOnly);
    }
  };

  const uniqueUsers = [...new Set(logs.map(log => log.username || 'System'))];
  const uniqueActions = [...new Set(logs.map(log => log.action))].sort((a, b) => {
    // Sort by formatted (German) names for better user experience
    const nameA = formatActionName(a);
    const nameB = formatActionName(b);
    return nameA.localeCompare(nameB, 'de');
  });
  const uniqueResourceTypes = [...new Set(logs.map(log => log.resourceType))].filter(Boolean);

  const cardStyles = {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    mb: 3,
    '.theme-light &': {
      backgroundColor: 'rgba(0, 0, 0, 0.05)',
      border: '1px solid rgba(0, 0, 0, 0.08)',
    },
  };

  return (
    <Box
      ref={panelRef}
      sx={{
        position: 'relative',
        width: `${panelWidth}px`,
        height: '100%',
        backgroundColor: 'rgba(118, 118, 128, 0.12)',
        backdropFilter: 'blur(30px) saturate(150%)',
        WebkitBackdropFilter: 'blur(30px) saturate(150%)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-20px 0 50px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Resize handle - simplified */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          position: 'absolute',
          left: -5,
          top: 0,
          bottom: 0,
          width: '10px',
          cursor: 'ew-resize',
          backgroundColor: 'transparent',
          '&:hover': {
            backgroundColor: 'var(--primary-color, #007AFF)',
            opacity: 0.3,
          },
          zIndex: 1000,
        }}
      />

      <UnifiedPanelHeader 
        title="Audit Log"
        onClose={onClose}
        icon={Activity}
        actions={
          isMobileRef.current ? (
            <Tooltip title="Aktualisieren">
              <IconButton
                size="small"
                onClick={manualRefresh}
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&:hover': { 
                    color: 'rgba(255, 255, 255, 0.9)',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)' 
                  }
                }}
              >
                <RefreshCw size={18} />
              </IconButton>
            </Tooltip>
          ) : null
        }
      />

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ p: 2 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Fixed Stats Section */}
            <Box sx={{ flexShrink: 0 }}>
              <AuditLogStats 
                stats={stats} 
                cardStyles={cardStyles} 
                panelWidth={panelWidth}
                onStatClick={handleStatClick}
                showCriticalOnly={showCriticalOnly}
                dateRange={dateRange}
              />
            </Box>
            
            {/* Fixed Filter Toggle Button */}
            <Box sx={{ px: 1, py: 0.5, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
              <Tooltip title={filtersCollapsed ? "Filter anzeigen" : "Filter ausblenden"}>
                <Button
                  size="small"
                  onClick={() => setFiltersCollapsed(!filtersCollapsed)}
                  startIcon={filtersCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  sx={{
                    minWidth: 'auto',
                    px: 2,
                    py: 0.5,
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(0, 0, 0, 0.03)',
                    color: theme.palette.text.secondary,
                    borderRadius: '20px',
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    '&:hover': {
                      backgroundColor: theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.05)',
                    },
                  }}
                >
                  {filtersCollapsed ? 'Filter einblenden' : 'Filter ausblenden'}
                </Button>
              </Tooltip>
            </Box>
            
            {/* Fixed Filters Section */}
            <Collapse in={!filtersCollapsed} sx={{ flexShrink: 0 }}>
              <AuditLogFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                selectedAction={selectedAction}
                onActionChange={setSelectedAction}
                selectedUser={selectedUser}
                onUserChange={setSelectedUser}
                selectedResourceType={selectedResourceType}
                onResourceTypeChange={setSelectedResourceType}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                customStartDate={customStartDate}
                onCustomStartDateChange={setCustomStartDate}
                customEndDate={customEndDate}
                onCustomEndDateChange={setCustomEndDate}
                showCriticalOnly={showCriticalOnly}
                onShowCriticalOnlyChange={setShowCriticalOnly}
                onRefresh={fetchAuditLogs}
                onExport={handleExport}
                onDelete={handleDelete}
                uniqueUsers={uniqueUsers}
                uniqueActions={uniqueActions}
                uniqueResourceTypes={uniqueResourceTypes}
                cardStyles={cardStyles}
              />
            </Collapse>

            {/* Fixed Export Options Card */}
            <Collapse in={showExportOptions} sx={{ flexShrink: 0 }}>
              <Box sx={{ px: 2, pb: 1 }}>
                <Card sx={{ 
                  ...cardStyles, 
                  backgroundColor: theme.palette.mode === 'dark' 
                    ? 'rgba(59, 130, 246, 0.1)' 
                    : 'rgba(59, 130, 246, 0.05)',
                  border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
                }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, textAlign: 'center' }}>
                      Export-Format wählen
                    </Typography>
                    <Stack direction="row" spacing={2} sx={{ justifyContent: 'center', flexWrap: 'wrap', gap: 1 }}>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={handleJsonExport}
                        startIcon={<FileJson size={16} />}
                        sx={{
                          backgroundColor: theme.palette.mode === 'dark'
                            ? 'rgba(100, 200, 255, 0.2)'
                            : 'rgba(0, 150, 255, 0.1)',
                          color: theme.palette.mode === 'dark' ? '#64b5f6' : '#1976d2',
                          '&:hover': {
                            backgroundColor: theme.palette.mode === 'dark'
                              ? 'rgba(100, 200, 255, 0.3)'
                              : 'rgba(0, 150, 255, 0.2)',
                          },
                        }}
                      >
                        JSON
                      </Button>
                      
                      <Button
                        variant="contained"
                        size="small"
                        onClick={handleCsvExport}
                        startIcon={<FileDown size={16} />}
                        sx={{
                          backgroundColor: theme.palette.mode === 'dark'
                            ? 'rgba(76, 175, 80, 0.2)'
                            : 'rgba(76, 175, 80, 0.1)',
                          color: theme.palette.mode === 'dark' ? '#81c784' : '#4caf50',
                          '&:hover': {
                            backgroundColor: theme.palette.mode === 'dark'
                              ? 'rgba(76, 175, 80, 0.3)'
                              : 'rgba(76, 175, 80, 0.2)',
                          },
                        }}
                      >
                        CSV
                      </Button>
                      
                      <Button
                        variant="contained"
                        size="small"
                        onClick={handlePrint}
                        startIcon={<FileText size={16} />}
                        sx={{
                          backgroundColor: theme.palette.mode === 'dark'
                            ? 'rgba(255, 152, 0, 0.2)'
                            : 'rgba(255, 152, 0, 0.1)',
                          color: theme.palette.mode === 'dark' ? '#ffb74d' : '#ff9800',
                          '&:hover': {
                            backgroundColor: theme.palette.mode === 'dark'
                              ? 'rgba(255, 152, 0, 0.3)'
                              : 'rgba(255, 152, 0, 0.2)',
                          },
                        }}
                      >
                        Drucken
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Box>
            </Collapse>

            {/* Scrollable Table Section */}
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              <AuditLogTableMUI
                logs={filteredLogs}
                expandedRows={expandedRows}
                onToggleExpand={handleRowExpand}
                isAdmin={isAdmin}
                panelWidth={panelWidth}
                cardStyles={cardStyles}
              />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default AuditLogPanel;
