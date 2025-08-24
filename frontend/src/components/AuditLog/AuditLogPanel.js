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
import { FileDown, FileText, File, Activity, FileCode, ChevronUp, ChevronDown, FileJson } from 'lucide-react';
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
    // Default values if nothing saved
    return {
      searchTerm: '',
      selectedAction: 'all',
      selectedUser: 'all',
      selectedResourceType: 'all',
      dateRange: 'today',
      showCriticalOnly: false,
      filtersCollapsed: false
    };
  };

  const savedFilterSettings = loadFilterSettings();

  // Rest of your component state
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
      });
      setShowExportOptions(false);
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      setError('Fehler beim CSV-Export der Logs');
    }
  };

  // JSON Export handler
  const handleJsonExport = async () => {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        filters: {
          action: selectedAction,
          user: selectedUser,
          resourceType: selectedResourceType,
          dateRange: dateRange,
          customStartDate: customStartDate,
          customEndDate: customEndDate,
          criticalOnly: showCriticalOnly
        },
        stats: stats,
        logs: filteredLogs
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setShowExportOptions(false);
    } catch (error) {
      console.error('Error exporting logs as JSON:', error);
      setError('Fehler beim JSON-Export der Logs');
    }
  };

  // Handle stat card clicks
  const handleStatClick = (value, type) => {
    console.log('Stat card clicked:', value, type); // Debug log
    if (type === 'dateRange') {
      // Für "Alle Log-Einträge" oder "Heutige Aktivitäten"
      setDateRange(value);
      // Filter-Status bleibt unverändert (nicht mehr automatisch ausklappen)
    } else if (type === 'criticalOnly') {
      // Für "Wichtige Aktionen" - Toggle-Funktion
      if (value === 'toggle') {
        setShowCriticalOnly(prev => !prev);
      } else {
        setShowCriticalOnly(value);
      }
      // Filter-Status bleibt unverändert (nicht mehr automatisch ausklappen)
    }
  };

  // Helper function to format values for Markdown
  const formatValueForMarkdown = (value) => {
    if (typeof value === 'boolean') {
      return value ? '✓ Ja' : '✗ Nein';
    } else if (Array.isArray(value)) {
      // Spezielle Behandlung für File-Arrays
      if (value[0]?.name && value[0]?.bytes) {
        return value.map(file => 
          `\n  - **${file.name}** (${(file.bytes / 1048576).toFixed(2)} MB)`
        ).join('');
      }
      // Normale Arrays
      return value.map(item => `\n  - ${item}`).join('');
    } else if (typeof value === 'object' && value !== null) {
      // Spezielle Behandlung für restored_items
      if (value.appliances !== undefined || value.hosts !== undefined) {
        return Object.entries(value)
          .filter(([_, count]) => count > 0)
          .map(([key, count]) => `\n  - **${key}**: ${count}`)
          .join('');
      }
      // Andere Objekte als Tabelle
      return '\n' + Object.entries(value)
        .map(([k, v]) => `  - **${k}**: ${v}`)
        .join('\n');
    } else if (value === null || value === undefined) {
      return '-';
    }
    return String(value);
  };

  // Markdown Export handler
  const handleMarkdownExport = async () => {
    try {
      let markdown = '# Audit Log Report\n\n';
      markdown += `**Erstellt am:** ${new Date().toLocaleString('de-DE')}\n\n`;
      markdown += `**Anzahl Einträge:** ${filteredLogs.length}\n\n`;
      
      // Filter-Info
      markdown += '## Aktive Filter\n\n';
      if (selectedAction !== 'all') markdown += `- **Aktion:** ${selectedAction}\n`;
      if (selectedUser !== 'all') markdown += `- **Benutzer:** ${selectedUser}\n`;
      if (selectedResourceType !== 'all') markdown += `- **Ressource:** ${selectedResourceType}\n`;
      if (dateRange !== 'all') markdown += `- **Zeitraum:** ${dateRange}\n`;
      if (showCriticalOnly) markdown += `- **Nur kritische Einträge**\n`;
      markdown += '\n---\n\n';
      
      // Log-Einträge
      markdown += '## Log-Einträge\n\n';
      
      filteredLogs.forEach((log, index) => {
        markdown += `### ${index + 1}. ${log.action} - ${log.resourceName || log.resourceType || '-'}\n\n`;
        markdown += `**Zeit:** ${new Date(log.createdAt).toLocaleString('de-DE')}\n`;
        markdown += `**Benutzer:** ${log.username || 'System'}\n`;
        markdown += `**IP-Adresse:** ${log.ipAddress || '-'}\n`;
        
        if (log.details) {
          markdown += '\n**Details:**\n';
          const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
          Object.entries(details).forEach(([key, value]) => {
            markdown += `- **${key}:** ${formatValueForMarkdown(value)}\n`;
          });
        }
        
        markdown += '\n---\n\n';
      });
      
      // Download der .md Datei
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.md`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setShowExportOptions(false);
    } catch (error) {
      console.error('Error exporting logs as Markdown:', error);
      setError('Fehler beim Markdown-Export der Logs');
    }
  };

  // PDF Export handler
  const handlePdfExport = () => {
    exportForPrint(filteredLogs);
    setShowExportOptions(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Möchten Sie die gefilterten Audit-Logs wirklich löschen?')) {
      return;
    }

    try {
      const logIds = filteredLogs.map(log => log.id);
      await deleteFilteredAuditLogs(logIds);
      fetchAuditLogs(); // Refresh after deletion
    } catch (error) {
      console.error('Error deleting audit logs:', error);
    }
  };

  // Delete single log entry
  const handleDeleteSingleLog = async (logId) => {
    if (!window.confirm('Möchten Sie diesen Audit-Log-Eintrag wirklich löschen?')) {
      return;
    }

    try {
      await axios.delete(`/api/audit-logs/${logId}`);
      // Remove from local state immediately for better UX
      setLogs(prevLogs => prevLogs.filter(log => log.id !== logId));
      setFilteredLogs(prevLogs => prevLogs.filter(log => log.id !== logId));
      // Update stats
      const updatedLogs = logs.filter(log => log.id !== logId);
      const today = new Date().toISOString().split('T')[0];
      const todayLogs = updatedLogs.filter(log => 
        log.createdAt && log.createdAt.startsWith(today)
      );
      const uniqueUsers = new Set(updatedLogs.map(log => log.username || 'System'));
      const criticalLogs = updatedLogs.filter(log => 
        criticalActions.includes(log.action)
      );
      
      setStats({
        totalLogs: updatedLogs.length,
        todayLogs: todayLogs.length,
        uniqueUsers: uniqueUsers.size,
        criticalActions: criticalLogs.length,
      });
    } catch (error) {
      console.error('Error deleting audit log:', error);
      setError('Fehler beim Löschen des Audit-Log-Eintrags');
      // Refresh on error to ensure consistency
      fetchAuditLogs();
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
                  onClick={() => {
                    setFiltersCollapsed(!filtersCollapsed);
                    // Wenn Filter ausgeblendet werden, auch Export-Optionen schließen
                    if (!filtersCollapsed) {
                      setShowExportOptions(false);
                    }
                  }}
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
                onDelete={handleDelete}
                uniqueUsers={uniqueUsers}
                uniqueActions={uniqueActions}
                uniqueResourceTypes={uniqueResourceTypes}
                cardStyles={cardStyles}
              />
              
              {/* Export Options Card - jetzt innerhalb des Filter-Collapse */}
              <Collapse in={showExportOptions}>
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
                        startIcon={<FileText size={16} />}
                        sx={{
                          backgroundColor: theme.palette.mode === 'dark'
                            ? 'rgba(100, 255, 150, 0.2)'
                            : 'rgba(0, 200, 100, 0.1)',
                          color: theme.palette.mode === 'dark' ? '#81c784' : '#4caf50',
                          '&:hover': {
                            backgroundColor: theme.palette.mode === 'dark'
                              ? 'rgba(100, 255, 150, 0.3)'
                              : 'rgba(0, 200, 100, 0.2)',
                          },
                        }}
                      >
                        CSV
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={handlePdfExport}
                        startIcon={<File size={16} />}
                        sx={{
                          backgroundColor: theme.palette.mode === 'dark'
                            ? 'rgba(255, 100, 100, 0.2)'
                            : 'rgba(255, 0, 0, 0.1)',
                          color: theme.palette.mode === 'dark' ? '#ef5350' : '#f44336',
                          '&:hover': {
                            backgroundColor: theme.palette.mode === 'dark'
                              ? 'rgba(255, 100, 100, 0.3)'
                              : 'rgba(255, 0, 0, 0.2)',
                          },
                        }}
                      >
                        PDF
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={handleMarkdownExport}
                        startIcon={<FileCode size={16} />}
                        sx={{
                          backgroundColor: theme.palette.mode === 'dark'
                            ? 'rgba(150, 100, 255, 0.2)'
                            : 'rgba(100, 0, 255, 0.1)',
                          color: theme.palette.mode === 'dark' ? '#b39ddb' : '#6200ea',
                          '&:hover': {
                            backgroundColor: theme.palette.mode === 'dark'
                              ? 'rgba(150, 100, 255, 0.3)'
                              : 'rgba(100, 0, 255, 0.2)',
                          },
                        }}
                      >
                        MD
                      </Button>
                    </Stack>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.secondary', textAlign: 'center' }}>
                      {filteredLogs.length} Einträge werden exportiert
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </Collapse>
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
                      onDeleteLog={handleDeleteSingleLog}
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
