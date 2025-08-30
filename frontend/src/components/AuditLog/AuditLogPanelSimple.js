// Simplified AuditLogPanel Component with fixed resize
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
import { FileDown, FileText, File, Activity, FileCode, ChevronUp, ChevronDown } from 'lucide-react';
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
import { criticalActions, formatActionName } from './AuditLogActions';
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

  // Rest of your component state
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedResourceType, setSelectedResourceType] = useState('all');
  const [dateRange, setDateRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [stats, setStats] = useState({
    totalLogs: 0,
    todayLogs: 0,
    uniqueUsers: 0,
    criticalActions: 0,
  });
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  
  const isAdmin = true;
  const { addEventListener, removeEventListener, isConnected } = useSSE();

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get('/api/audit-logs');
      const logsData = response.data.logs || response.data || [];
      const logsArray = Array.isArray(logsData) ? logsData : [];
      
      setLogs(logsArray);
      setFilteredLogs(logsArray);
      
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

  // SSE Event Listeners
  useEffect(() => {
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

  // Handle stat card clicks
  const handleStatClick = (value, type) => {
    console.log('Stat card clicked:', value, type); // Debug log
    if (type === 'dateRange') {
      // Für "Alle Log-Einträge" oder "Heutige Aktivitäten"
      setDateRange(value);
      setFiltersCollapsed(false); // Filter ausklappen
    } else if (type === 'criticalOnly') {
      // Für "Wichtige Aktionen" - Toggle-Funktion
      if (value === 'toggle') {
        setShowCriticalOnly(prev => !prev);
      } else {
        setShowCriticalOnly(value);
      }
      setFiltersCollapsed(false); // Filter ausklappen
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
      />

      <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ p: 2 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        ) : (
          <>
            <AuditLogStats 
              stats={stats} 
              cardStyles={cardStyles} 
              panelWidth={panelWidth}
              onStatClick={handleStatClick}
              showCriticalOnly={showCriticalOnly}
              dateRange={dateRange}
            />
            
            <Box sx={{ px: 1, py: 0.5, display: 'flex', justifyContent: 'center' }}>
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
            
            <Collapse in={!filtersCollapsed}>
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
                onDelete={null}
                uniqueUsers={uniqueUsers}
                uniqueActions={uniqueActions}
                uniqueResourceTypes={uniqueResourceTypes}
                cardStyles={cardStyles}
              />
            </Collapse>

            <Box sx={{ flex: 1, overflow: 'auto', p: 2, pt: 0 }}>
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ flex: 1, overflow: 'auto' }}>
                  {filteredLogs.length === 0 ? (
                    <Alert severity="info">Keine Audit-Logs gefunden</Alert>
                  ) : (
                    <AuditLogTableMUI
                      logs={filteredLogs}
                      expandedRows={expandedRows}
                      onToggleExpand={(id) => {
                        setExpandedRows(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(id)) {
                            newSet.delete(id);
                          } else {
                            newSet.add(id);
                          }
                          return newSet;
                        });
                      }}
                      onRefresh={fetchAuditLogs}
                      onDeleteLog={null}
                      cardStyles={cardStyles}
                    />
                  )}
                </Box>
              </Box>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

export default AuditLogPanel;
