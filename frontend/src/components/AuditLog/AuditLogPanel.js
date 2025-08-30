// AuditLogPanel mit einheitlichem Resize-Hook und Internationalisierung
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
import { useTranslation } from 'react-i18next';
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
import { usePanelResize, getPanelStyles, getResizeHandleStyles } from '../../hooks/usePanelResize';
import './AuditLogPanel.css';
import './AuditLogTableCardFix.css';

const AuditLogPanel = ({ onClose, onWidthChange }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  
  // EINHEITLICHER RESIZE-HOOK
  const { panelWidth, isResizing, startResize, panelRef } = usePanelResize(
    'auditLogPanelWidth',
    800,
    onWidthChange
  );

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
  const [activeUserFilter, setActiveUserFilter] = useState(false);  // NEU: State für Benutzer-Filter
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [stats, setStats] = useState({
    totalLogs: 0,           // Immer ungefiltert
    todayLogs: 0,           // Immer ungefiltert
    uniqueUsers: 0,         // Gefilterte Benutzer-Aktionen
    criticalActions: 0,     // Gefilterte kritische Aktionen
  });
  const [baseStats, setBaseStats] = useState({
    totalLogs: 0,
    todayLogs: 0,
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
      
      const uniqueUsers = new Set(logsArray.map(log => log.username || t('auditLog.system')));
      const criticalLogs = logsArray.filter(log => 
        criticalActions.includes(log.action)
      );
      
      // Basis-Statistiken (ungefiltert) speichern
      setBaseStats({
        totalLogs: logsArray.length,
        todayLogs: todayLogs.length,
      });
      
      setStats({
        totalLogs: logsArray.length,
        todayLogs: todayLogs.length,
        uniqueUsers: uniqueUsers.size,
        criticalActions: criticalLogs.length,
      });
      
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError(t('auditLog.errorLoading'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(0, 0, 0, 0);
          
          const yesterdayEnd = new Date();
          yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
          yesterdayEnd.setHours(23, 59, 59, 999);
          
          filtered = filtered.filter(log => {
            const logDate = new Date(log.createdAt);
            return logDate >= yesterday && logDate <= yesterdayEnd;
          });
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case 'custom':
          if (customStartDate && customEndDate) {
            // Startdatum auf 00:00:00 setzen
            startDate = new Date(customStartDate);
            startDate.setHours(0, 0, 0, 0);
            
            // Enddatum auf 23:59:59 setzen für den ganzen Tag
            const endDate = new Date(customEndDate);
            endDate.setHours(23, 59, 59, 999);
            
            filtered = filtered.filter(log => {
              const logDate = new Date(log.createdAt);
              return logDate >= startDate && logDate <= endDate;
            });
          }
          break;
        default:
          break;
      }
      
      if (startDate && dateRange !== 'custom' && dateRange !== 'yesterday') {
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

    // NEU: Filter für Benutzer-Aktionen
    if (activeUserFilter) {
      const userActions = [
        'user_login', 
        'user_logout', 
        'user_created',
        'user_updated',
        'user_deleted',
        'user_reverted',
        'login_failed',
        'service_accessed',
        'password_changed',
        'session_timeout',
        'session_started',
        'session_ended'
      ];
      filtered = filtered.filter(log =>
        userActions.includes(log.action) || 
        log.resourceType === 'users' ||
        log.action.toLowerCase().includes('user') ||
        log.action.toLowerCase().includes('login') ||
        log.action.toLowerCase().includes('logout') ||
        log.action.toLowerCase().includes('session')
      );
    }

    setFilteredLogs(filtered);
    
    // Statistiken: Erste beiden bleiben unverändert, letzte beiden basieren auf Filter
    const criticalFilteredLogs = filtered.filter(log => 
      criticalActions.includes(log.action)
    );
    
    // Benutzer-bezogene Logs zählen (aus gefilterten Daten)
    const userRelatedActions = [
      'user_login', 'user_logout', 'user_created', 'user_updated', 'user_deleted',
      'user_reverted', 'login_failed', 'service_accessed', 'password_changed',
      'session_timeout', 'session_started', 'session_ended'
    ];
    const userActionLogs = filtered.filter(log =>
      userRelatedActions.includes(log.action) || 
      log.resourceType === 'users' ||
      log.action.toLowerCase().includes('user') ||
      log.action.toLowerCase().includes('login') ||
      log.action.toLowerCase().includes('session')
    );
    
    // WICHTIG: totalLogs und todayLogs bleiben IMMER die ungefilterten Werte
    setStats({
      totalLogs: baseStats.totalLogs || logs.length,  // Immer ungefiltert
      todayLogs: baseStats.todayLogs || logs.filter(log => 
        log.createdAt && log.createdAt.startsWith(new Date().toISOString().split('T')[0])
      ).length,  // Immer ungefiltert
      uniqueUsers: userActionLogs.length,  // Gefilterte Benutzer-Aktionen
      criticalActions: criticalFilteredLogs.length,  // Gefilterte kritische Aktionen
    });
    
  }, [logs, searchTerm, selectedAction, selectedUser, selectedResourceType, 
      dateRange, customStartDate, customEndDate, showCriticalOnly, activeUserFilter, baseStats]);

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
      setError(t('auditLog.errorExportCSV'));
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
      setError(t('auditLog.errorExportJSON'));
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
    } else if (type === 'userFilter') {
      // NEU: Für "Aktive Benutzer" - Toggle-Funktion
      if (value === 'toggle') {
        setActiveUserFilter(prev => !prev);
      } else {
        setActiveUserFilter(value);
      }
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
      const currentLang = localStorage.getItem('i18nextLng') || 'en';
      const dateFormat = currentLang === 'de' ? 'de-DE' : 'en-US';
      
      let markdown = `# ${t('auditLog.report.title')}\n\n`;
      markdown += `**${t('auditLog.report.createdAt')}:** ${new Date().toLocaleString(dateFormat)}\n\n`;
      markdown += `**${t('auditLog.report.entryCount')}:** ${filteredLogs.length}\n\n`;
      
      // Filter-Info
      markdown += `## ${t('auditLog.report.activeFilters')}\n\n`;
      if (selectedAction !== 'all') markdown += `- **${t('auditLog.action')}:** ${selectedAction}\n`;
      if (selectedUser !== 'all') markdown += `- **${t('auditLog.user')}:** ${selectedUser}\n`;
      if (selectedResourceType !== 'all') markdown += `- **${t('auditLog.resource')}:** ${selectedResourceType}\n`;
      if (dateRange !== 'all') markdown += `- **${t('auditLog.filters.dateRange')}:** ${dateRange}\n`;
      if (showCriticalOnly) markdown += `- **${t('auditLog.showCriticalOnly')}**\n`;
      if (activeUserFilter) markdown += `- **${t('auditLog.stats.uniqueUsers')}**\n`;
      markdown += '\n---\n\n';
      
      // Log-Einträge
      markdown += `## ${t('auditLog.report.entries')}\n\n`;
      
      filteredLogs.forEach((log, index) => {
        markdown += `### ${index + 1}. ${log.action} - ${log.resourceName || log.resourceType || '-'}\n\n`;
        markdown += `**${t('auditLog.report.time')}:** ${new Date(log.createdAt).toLocaleString(dateFormat)}\n`;
        markdown += `**${t('auditLog.report.user')}:** ${log.username || t('auditLog.system')}\n`;
        markdown += `**${t('auditLog.report.ipAddress')}:** ${log.ipAddress || '-'}\n`;
        
        if (log.details) {
          markdown += `\n**${t('auditLog.report.details')}:**\n`;
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
      setError(t('auditLog.errorExportMarkdown'));
    }
  };

  // PDF Export handler
  const handlePdfExport = () => {
    exportForPrint(filteredLogs);
    setShowExportOptions(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(t('auditLog.confirmDeleteFiltered'))) {
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
    if (!window.confirm(t('auditLog.confirmDeleteLog'))) {
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
      const uniqueUsers = new Set(updatedLogs.map(log => log.username || t('auditLog.system')));
      const criticalLogs = updatedLogs.filter(log => 
        criticalActions.includes(log.action)
      );
      
      // Update base stats
      setBaseStats({
        totalLogs: updatedLogs.length,
        todayLogs: todayLogs.length,
      });
      
      setStats({
        totalLogs: updatedLogs.length,
        todayLogs: todayLogs.length,
        uniqueUsers: uniqueUsers.size,
        criticalActions: criticalLogs.length,
      });
    } catch (error) {
      console.error('Error deleting audit log:', error);
      setError(t('auditLog.errorDeleting'));
      // Refresh on error to ensure consistency
      fetchAuditLogs();
    }
  };

  const uniqueUsers = [...new Set(logs.map(log => log.username || t('auditLog.system')))];
  const uniqueActions = [...new Set(logs.map(log => log.action))].sort((a, b) => {
    // Sort by formatted names for better user experience
    const nameA = formatActionName(a, t);
    const nameB = formatActionName(b, t);
    const currentLang = localStorage.getItem('i18nextLng') || 'en';
    return nameA.localeCompare(nameB, currentLang);
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
      style={{ width: `${panelWidth}px` }}  // Width als style für Safari/iPad
      sx={getPanelStyles(isResizing)}
    >
      {/* Resize handle - einheitlich */}
      <Box
        onMouseDown={startResize}
        onTouchStart={startResize}
        onPointerDown={startResize}
        sx={getResizeHandleStyles()}
      />

      <UnifiedPanelHeader 
        title={t('auditLog.title')}
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
              activeUserFilter={activeUserFilter}
            />
            
            <Box sx={{ px: 1, py: 0.5, display: 'flex', justifyContent: 'center' }}>
              <Tooltip title={filtersCollapsed ? t('auditLog.showFilters') : t('auditLog.hideFilters')}>
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
                  {filtersCollapsed ? t('auditLog.showFilters') : t('auditLog.hideFilters')}
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
                      {t('auditLog.exportOptions.title')}
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
                        {t('auditLog.exportOptions.json')}
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
                        {t('auditLog.exportOptions.csv')}
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
                        {t('auditLog.exportOptions.pdf')}
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
                        {t('auditLog.exportOptions.markdown')}
                      </Button>
                    </Stack>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.secondary', textAlign: 'center' }}>
                      {t('auditLog.exportOptions.entriesWillBeExported', { count: filteredLogs.length })}
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
                    <Alert severity="info">{t('auditLog.noLogsFound')}</Alert>
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