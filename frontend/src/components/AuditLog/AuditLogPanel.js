import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Grid,
  Stack,
  InputAdornment,
  useTheme,
  alpha,
  Card,
  CardContent,
} from '@mui/material';
import {
  Activity,
  Calendar,
  User,
  Search,
  Filter,
  RefreshCw,
  FileText,
  Shield,
  Settings,
  Users,
  LogIn,
  LogOut,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Download,
  Terminal,
  Trash2,
  X,
  FileDown,
} from 'lucide-react';
import UnifiedPanelHeader from '../UnifiedPanelHeader';
import axios from '../../utils/axiosConfig';
import AuditLogTableMUI from './AuditLogTableMUI';
import { useSSE } from '../../hooks/useSSE';

const AuditLogPanel = ({ onClose, onWidthChange }) => {
  const theme = useTheme();
  
  // Compute card styles based on current theme
  const cardStyles = {
    backgroundColor: theme.palette.mode === 'dark' 
      ? 'rgba(80, 80, 90, 0.16)' 
      : 'rgba(240, 240, 245, 0.9)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: `1px solid ${theme.palette.mode === 'dark' 
      ? 'rgba(255, 255, 255, 0.12)' 
      : 'rgba(0, 0, 0, 0.15)'}`,
    borderRadius: 2,
    boxShadow: 'none',
    transition: 'all 0.3s ease',
  };
  
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
  const [stats, setStats] = useState({
    totalLogs: 0,
    todayLogs: 0,
    uniqueUsers: 0,
    criticalActions: 0,
  });

  // Panel resizing state
  const [isResizing, setIsResizing] = useState(false);
  const [panelWidth, setPanelWidth] = useState(() => {
    const savedWidth = localStorage.getItem('auditLogPanelWidth');
    return savedWidth ? parseInt(savedWidth) : 800;
  });
  const panelRef = useRef(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // SSE Hook
  const { addEventListener, isConnected } = useSSE();

  // Mobile Detection
  const [isMobile, setIsMobile] = useState(() => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent.toLowerCase()
    );
    const isSmallScreen = window.innerWidth <= 768;
    return isMobileDevice || isSmallScreen;
  });

  useEffect(() => {
    const handleResize = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent.toLowerCase()
      );
      const isSmallScreen = window.innerWidth <= 768;
      setIsMobile(isMobileDevice || isSmallScreen);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle resize
  const handleMouseDown = (e) => {
    if (isMobile) return;

    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = panelRef.current?.offsetWidth || 600;

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;

      const deltaX = startXRef.current - e.clientX;
      const newWidth = Math.max(400, Math.min(1200, startWidthRef.current + deltaX));

      if (panelRef.current) {
        panelRef.current.style.width = `${newWidth}px`;
        setPanelWidth(newWidth);
        if (onWidthChange) {
          onWidthChange(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        if (panelRef.current) {
          const width = panelRef.current.offsetWidth;
          setPanelWidth(width);
          localStorage.setItem('auditLogPanelWidth', width.toString());
        }
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onWidthChange]);

  // Critical actions
  const criticalActions = [
    'user_delete',
    'appliance_delete',
    'settings_update',
    'user_role_change',
    'backup_restore',
    'ssh_key_delete',
    'service_stop',
    'command_execute_failed',
    'login_failed',
    'failed_login',
    'audit_logs_delete',
  ];

  // Action icons mapping
  const actionIcons = {
    login: LogIn,
    user_login: LogIn,
    logout: LogOut,
    user_logout: LogOut,
    login_failed: AlertTriangle,
    failed_login: AlertTriangle,
    appliance_create: CheckCircle,
    appliance_update: Settings,
    appliance_delete: XCircle,
    appliance_open: Activity,
    user_create: Users,
    user_created: Users,
    user_update: Users,
    user_delete: XCircle,
    user_role_change: Shield,
    settings_update: Settings,
    backup_create: FileText,
    backup_restore: RefreshCw,
    ssh_key_create: Shield,
    ssh_key_delete: Shield,
    ssh_connection_test: Shield,
    service_start: CheckCircle,
    service_stop: XCircle,
    password_change: Shield,
    command_execute: Terminal,
    command_execute_failed: AlertTriangle,
    terminal_open: Terminal,
    terminal_disconnect: Terminal,
    terminal_command: Terminal,
    audit_logs_delete: Trash2,
  };

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get('/api/auditLogs');
      setLogs(response.data);
      setFilteredLogs(response.data);
      calculateStats(response.data);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError('Fehler beim Laden der Audit Logs');
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate statistics
  const calculateStats = (logsData) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayLogs = logsData.filter(log => new Date(log.created_at) >= today).length;
    const uniqueUsers = new Set(logsData.map(log => log.username).filter(Boolean)).size;
    const criticalActionCount = logsData.filter(log => criticalActions.includes(log.action)).length;

    setStats({
      totalLogs: logsData.length,
      todayLogs,
      uniqueUsers,
      criticalActions: criticalActionCount,
    });
  };

  // Format action name
  const formatActionName = (action) => {
    const actionMap = {
      login: 'Anmeldung',
      user_login: 'Anmeldung',
      logout: 'Abmeldung',
      user_logout: 'Abmeldung',
      login_failed: 'Anmeldung fehlgeschlagen',
      failed_login: 'Anmeldung fehlgeschlagen',
      appliance_create: 'Service erstellt',
      appliance_update: 'Service aktualisiert',
      appliance_delete: 'Service gelöscht',
      appliance_restore: 'Service wiederhergestellt',
      appliance_undelete: 'Service wiederhergestellt',
      appliance_open: 'Service/URL aufgerufen',
      category_created: 'Kategorie erstellt',
      category_updated: 'Kategorie aktualisiert',
      category_deleted: 'Kategorie gelöscht',
      category_restored: 'Kategorie wiederhergestellt',
      category_reverted: 'Kategorie zurückgesetzt',
      user_create: 'Benutzer erstellt',
      user_created: 'Benutzer erstellt',
      user_update: 'Benutzer aktualisiert',
      user_updated: 'Benutzer aktualisiert',
      user_delete: 'Benutzer gelöscht',
      user_deleted: 'Benutzer gelöscht',
      user_restored: 'Benutzer wiederhergestellt',
      user_reverted: 'Benutzer zurückgesetzt',
      user_role_change: 'Benutzerrolle geändert',
      settings_update: 'Einstellungen aktualisiert',
      backup_create: 'Backup erstellt',
      backup_created: 'Backup erstellt',
      backup_restore: 'Backup wiederhergestellt',
      backup_restored: 'Backup wiederhergestellt',
      ssh_key_create: 'SSH-Schlüssel erstellt',
      ssh_key_delete: 'SSH-Schlüssel gelöscht',
      ssh_connection_test: 'SSH-Verbindung getestet',
      ssh_file_upload: 'Datei hochgeladen',
      service_start: 'Service gestartet',
      service_stop: 'Service gestoppt',
      service_start_failed: 'Service Start fehlgeschlagen',
      service_stop_failed: 'Service Stop fehlgeschlagen',
      password_change: 'Passwort geändert',
      password_changed: 'Passwort geändert',
      command_execute: 'Kommando ausgeführt',
      command_execute_failed: 'Kommando fehlgeschlagen',
      terminal_open: 'Terminal geöffnet',
      terminal_disconnect: 'Terminal geschlossen',
      terminal_command: 'Terminal-Befehl',
      audit_logs_delete: 'Audit Logs gelöscht',
      audit_log_created: 'Audit Log erstellt',
    };

    return actionMap[action] || action;
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `vor ${diffMins} Minute${diffMins > 1 ? 'n' : ''}`;
    if (diffHours < 24) return `vor ${diffHours} Stunde${diffHours > 1 ? 'n' : ''}`;
    if (diffDays < 7) return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;

    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get action color
  const getActionColor = (action) => {
    if (criticalActions.includes(action)) return 'error';
    if (action.includes('failed')) return 'error';
    if (action.includes('create')) return 'success';
    if (action.includes('update')) return 'warning';
    if (action.includes('delete')) return 'error';
    return 'default';
  };

  // Initial load
  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Store fetchAuditLogs in a ref
  const fetchAuditLogsRef = useRef();
  fetchAuditLogsRef.current = fetchAuditLogs;

  // SSE Event Listeners
  useEffect(() => {
    if (!addEventListener || !isConnected) {
      return;
    }

    const auditEvents = [
      'appliance_created',
      'appliance_updated',
      'appliance_deleted',
      'appliance_restored',
      'appliance_undeleted',
      'appliance_opened',
      'category_created',
      'category_updated',
      'category_deleted',
      'category_restored',
      'category_reverted',
      'user_created',
      'user_updated',
      'user_deleted',
      'user_restored',
      'user_reverted',
      'user_activated',
      'user_deactivated',
      'user_status_changed',
      'service_started',
      'service_stopped',
      'user_login',
      'user_logout',
      'login_failed',
      'failed_login',
      'settings_updated',
      'backup_created',
      'backup_restored',
      'ssh_key_created',
      'ssh_key_deleted',
      'ssh_host_created',
      'ssh_host_updated',
      'ssh_host_deleted',
      'ssh_host_restored', 
      'ssh_host_reverted',
      'ssh_file_upload',
      'command_executed',
      'terminal_open',
      'terminal_disconnect',
      'terminal_command',
      'audit_logs_deleted',
      'audit_log_created',
    ];

    const unsubscribers = auditEvents
      .map(eventName => {
        try {
          const unsubscribe = addEventListener(eventName, data => {
            setTimeout(() => {
              if (fetchAuditLogsRef.current) {
                fetchAuditLogsRef.current();
              }
            }, 1000);
          });

          if (typeof unsubscribe !== 'function') {
            return null;
          }

          return unsubscribe;
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean);

    return () => {
      unsubscribers.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          try {
            unsubscribe();
          } catch (error) {
            // Silently ignore
          }
        }
      });
    };
  }, [addEventListener, isConnected]);

  // Filter logs
  useEffect(() => {
    let filtered = [...logs];

    if (showCriticalOnly) {
      filtered = filtered.filter(log => criticalActions.includes(log.action));
    } else {
      if (searchTerm) {
        filtered = filtered.filter(
          log =>
            log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.username && log.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (log.resource_type && log.resource_type.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (log.details && JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }

      if (selectedAction !== 'all') {
        filtered = filtered.filter(log => log.action === selectedAction);
      }
    }

    if (selectedUser !== 'all') {
      filtered = filtered.filter(log => log.username === selectedUser);
    }

    if (selectedResourceType !== 'all') {
      filtered = filtered.filter(log => log.resource_type === selectedResourceType);
    }

    // Date filter
    const now = new Date();
    let startDate = null;

    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        if (customStartDate) {
          startDate = new Date(customStartDate);
        }
        break;
    }

    if (startDate) {
      filtered = filtered.filter(log => new Date(log.created_at) >= startDate);
    }

    if (dateRange === 'custom' && customEndDate) {
      const endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(log => new Date(log.created_at) <= endDate);
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm, selectedAction, selectedUser, selectedResourceType, dateRange, customStartDate, customEndDate, showCriticalOnly]);

  // Export to CSV
  const exportToCSV = async () => {
    try {
      const params = new URLSearchParams();

      if (selectedAction !== 'all') {
        params.append('action', selectedAction);
      }

      if (selectedUser !== 'all') {
        const userLog = logs.find(log => log.username === selectedUser);
        if (userLog && userLog.user_id) {
          params.append('user_id', userLog.user_id);
        }
      }

      if (selectedResourceType !== 'all') {
        params.append('resource_type', selectedResourceType);
      }

      const response = await axios.get(`/api/auditLogs/export?${params.toString()}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting audit logs:', err);
      setError('Fehler beim Exportieren der Audit Logs');
    }
  };

  // Export to PDF
  const exportToPDF = () => {
    try {
      const printWindow = window.open('', '_blank');
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Audit Log Export - ${new Date().toLocaleDateString('de-DE')}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              margin: 20px;
              color: #333;
            }
            h1 {
              text-align: center;
              color: #1a1a1a;
              margin-bottom: 20px;
            }
            .info {
              margin-bottom: 20px;
              padding: 10px;
              background-color: #f5f5f5;
              border-radius: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              padding: 8px 12px;
              text-align: left;
              border-bottom: 1px solid #ddd;
            }
            th {
              background-color: #f0f0f0;
              font-weight: 600;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .critical { color: #dc2626; }
            .error { color: #ef4444; }
            .warning { color: #f59e0b; }
            .success { color: #10b981; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Audit Log Export</h1>
          <div class="info">
            <p><strong>Exportiert am:</strong> ${new Date().toLocaleString('de-DE')}</p>
            <p><strong>Anzahl Einträge:</strong> ${filteredLogs.length}</p>
            ${selectedUser !== 'all' ? `<p><strong>Filter - Benutzer:</strong> ${selectedUser}</p>` : ''}
            ${selectedAction !== 'all' ? `<p><strong>Filter - Aktion:</strong> ${formatActionName(selectedAction)}</p>` : ''}
            ${selectedResourceType !== 'all' ? `<p><strong>Filter - Ressource:</strong> ${selectedResourceType}</p>` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th>Zeit</th>
                <th>Benutzer</th>
                <th>Aktion</th>
                <th>Ressource</th>
                <th>IP-Adresse</th>
              </tr>
            </thead>
            <tbody>
      `);

      filteredLogs.forEach(log => {
        let resourceName = '';
        if (log.details) {
          try {
            const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
            resourceName = details.displayName || details.hostIdentifier || details.name || details.service_name || details.appliance_name || '';
          } catch (e) {
            console.error('Error parsing details:', e);
          }
        }

        const resourceDisplay = log.resource_name || resourceName || 
          (log.resource_type && log.resource_id ? `${log.resource_type} #${log.resource_id}` : log.resource_type || '-');

        printWindow.document.write(`
          <tr>
            <td>${formatTimestamp(log.created_at)}</td>
            <td>${log.username || 'System'}</td>
            <td class="${getActionColor(log.action)}">${formatActionName(log.action)}</td>
            <td>${resourceDisplay}</td>
            <td>${log.ip_address || '-'}</td>
          </tr>
        `);
      });

      printWindow.document.write(`
            </tbody>
          </table>
        </body>
        </html>
      `);

      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    } catch (err) {
      console.error('Error exporting to PDF:', err);
      setError('Fehler beim PDF Export');
    }
  };

  // Delete filtered logs
  const deleteFilteredLogs = async () => {
    if (filteredLogs.length === 0) return;

    const confirmMessage = showCriticalOnly
      ? `Möchten Sie wirklich alle ${filteredLogs.length} kritischen Audit Log Einträge löschen?`
      : `Möchten Sie wirklich ${filteredLogs.length} Audit Log Einträge löschen?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    if (filteredLogs.length > 100) {
      const secondConfirm = window.confirm(
        `ACHTUNG: Sie sind dabei ${filteredLogs.length} Einträge unwiderruflich zu löschen!\n\nSind Sie absolut sicher?`
      );
      if (!secondConfirm) return;
    }

    try {
      const logIds = filteredLogs.map(log => log.id);

      const response = await axios.delete('/api/auditLogs/delete', {
        data: { ids: logIds },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.data.success) {
        await fetchAuditLogs();
        alert(`${response.data.deletedCount} Audit Log Einträge wurden erfolgreich gelöscht.`);
      } else {
        // Sollte normalerweise nicht passieren, da das Backend bei Fehler einen HTTP-Fehlercode sendet
        throw new Error(response.data.error || 'Unbekannter Fehler beim Löschen');
      }
    } catch (err) {
      console.error('Error deleting audit logs:', err);
      setError('Fehler beim Löschen der Audit Logs');
      alert('Fehler beim Löschen der Audit Logs: ' + (err.response?.data?.error || err.message));
    }
  };

  // Get unique values for filters
  const uniqueActions = [...new Set(logs.map(log => log.action))].sort();
  const uniqueUsers = [...new Set(logs.map(log => log.username).filter(Boolean))].sort();
  const uniqueResourceTypes = [...new Set(logs.map(log => log.resource_type).filter(Boolean))].sort();

  const isCompactView = panelWidth < 700 && !isMobile;

  if (loading) {
    return (
      <Box
        ref={panelRef}
        sx={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: isMobile ? '100%' : `${panelWidth}px`,
          backgroundColor: theme.palette.mode === 'dark' 
            ? 'rgba(118, 118, 128, 0.12)' 
            : 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(30px) saturate(150%)',
          WebkitBackdropFilter: 'blur(30px) saturate(150%)',
          borderLeft: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.1)'}`,
          boxShadow: theme.palette.mode === 'dark' 
            ? '-20px 0 50px rgba(0, 0, 0, 0.5)'
            : '-20px 0 50px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 100,
        }}
      >
        <UnifiedPanelHeader title="Audit Log" icon={Activity} onClose={onClose} />
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      ref={panelRef}
      sx={{
        position: 'fixed',
        top: 0,
        right: 0,
        height: '100vh',
        width: isMobile ? '100%' : `${panelWidth}px`,
        backgroundColor: 'rgba(118, 118, 128, 0.12)',
        backdropFilter: 'blur(30px) saturate(150%)',
        WebkitBackdropFilter: 'blur(30px) saturate(150%)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '-20px 0 50px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        transition: 'transform 0.3s ease',
      }}
    >
      {!isMobile && (
        <Box
          onMouseDown={handleMouseDown}
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '5px',
            cursor: 'ew-resize',
            backgroundColor: 'transparent',
            '&:hover': {
              backgroundColor: 'var(--primary-color)',
              opacity: 0.5,
            },
            zIndex: 1,
          }}
        />
      )}

      <UnifiedPanelHeader title="Audit Log" icon={Activity} onClose={onClose} />

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: 'transparent',
        }}
      >
        {/* Statistics */}
        <Box sx={{ p: 2 }}>
          <Card 
            key={`stats-card-${theme.palette.mode}`}
            sx={cardStyles}
          >
            <CardContent>
              <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.1)'}`,
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(255, 255, 255, 0.15)'
                      : 'rgba(0, 0, 0, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px',
                  }}
                >
                  <FileText size={24} style={{ 
                    color: theme.palette.mode === 'dark' ? '#ffffff' : '#1a1a1a' 
                  }} />
                </Box>
                <Typography variant="h4" fontWeight={600}>
                  {stats.totalLogs}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Gesamt
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={6} md={3}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.1)'}`,
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    backgroundColor: theme.palette.mode === 'dark'
                      ? 'rgba(96, 165, 250, 0.25)'
                      : 'rgba(59, 130, 246, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px',
                  }}
                >
                  <Clock size={24} style={{ 
                    color: theme.palette.mode === 'dark' ? '#60a5fa' : '#3b82f6' 
                  }} />
                </Box>
                <Typography variant="h4" fontWeight={600}>
                  {stats.todayLogs}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Heute
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={6} md={3}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.1)'}`,
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    backgroundColor: theme.palette.mode === 'dark'
                      ? 'rgba(134, 239, 172, 0.25)'
                      : 'rgba(34, 197, 94, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px',
                  }}
                >
                  <Users size={24} style={{ 
                    color: theme.palette.mode === 'dark' ? '#86efac' : '#22c55e' 
                  }} />
                </Box>
                <Typography variant="h4" fontWeight={600}>
                  {stats.uniqueUsers}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Benutzer
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={6} md={3}>
              <Box
                onClick={() => setShowCriticalOnly(!showCriticalOnly)}
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  border: `1px solid ${showCriticalOnly ? 'rgba(252, 165, 165, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                  backgroundColor: showCriticalOnly 
                    ? theme.palette.mode === 'dark'
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(239, 68, 68, 0.1)'
                    : 'transparent',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: showCriticalOnly 
                      ? theme.palette.mode === 'dark'
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(255, 255, 255, 0.02)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    backgroundColor: theme.palette.mode === 'dark'
                      ? 'rgba(252, 165, 165, 0.25)'
                      : 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px',
                  }}
                >
                  <AlertTriangle size={24} style={{ 
                    color: theme.palette.mode === 'dark' ? '#fca5a5' : '#ef4444' 
                  }} />
                </Box>
                <Typography variant="h4" fontWeight={600} color={showCriticalOnly ? 'error' : 'text.primary'}>
                  {stats.criticalActions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Kritisch
                </Typography>
              </Box>
            </Grid>
          </Grid>
            </CardContent>
          </Card>
        </Box>

        {/* Filters */}
        <Box sx={{ p: 2, pt: 0 }}>
          <Card 
            key={`filter-card-${theme.palette.mode}`}
            sx={cardStyles}
          >
            <CardContent>
              <Stack spacing={2}>
            <TextField
              fullWidth
              size="small"
              placeholder="Suche..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  },
                  '&.Mui-focused': {
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  },
                },
              }}
            />

            <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Zeitraum</InputLabel>
                <Select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  label="Zeitraum"
                  sx={{
                    backgroundColor: 'transparent',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    },
                    '&.Mui-focused': {
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    },
                  }}
                >
                  <MenuItem value="today">Heute</MenuItem>
                  <MenuItem value="week">7 Tage</MenuItem>
                  <MenuItem value="month">30 Tage</MenuItem>
                  <MenuItem value="all">Alle</MenuItem>
                  <MenuItem value="custom">Benutzerdefiniert</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Aktion</InputLabel>
                <Select
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                  label="Aktion"
                  disabled={showCriticalOnly}
                  sx={{
                    backgroundColor: 'transparent',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    },
                    '&.Mui-focused': {
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    },
                  }}
                >
                  <MenuItem value="all">Alle Aktionen</MenuItem>
                  {uniqueActions.map(action => (
                    <MenuItem key={action} value={action}>
                      {formatActionName(action)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Benutzer</InputLabel>
                <Select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  label="Benutzer"
                  sx={{
                    backgroundColor: 'transparent',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    },
                    '&.Mui-focused': {
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    },
                  }}
                >
                  <MenuItem value="all">Alle Benutzer</MenuItem>
                  {uniqueUsers.map(user => (
                    <MenuItem key={user} value={user}>
                      {user}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Ressource</InputLabel>
                <Select
                  value={selectedResourceType}
                  onChange={(e) => setSelectedResourceType(e.target.value)}
                  label="Ressource"
                  sx={{
                    backgroundColor: 'transparent',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    },
                    '&.Mui-focused': {
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    },
                  }}
                >
                  <MenuItem value="all">Alle Ressourcen</MenuItem>
                  {uniqueResourceTypes.map(type => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            {dateRange === 'custom' && (
              <Stack direction="row" spacing={2}>
                <TextField
                  type="date"
                  size="small"
                  label="Von"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'transparent',
                    },
                  }}
                />
                <TextField
                  type="date"
                  size="small"
                  label="Bis"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'transparent',
                    },
                  }}
                />
              </Stack>
            )}
          </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Action Buttons Card */}
        <Box sx={{ p: 2, pt: 0 }}>
          <Card 
            key={`buttons-card-${theme.palette.mode}`}
            sx={cardStyles}
          >
            <CardContent>
              <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" gap={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshCw size={16} />}
                onClick={fetchAuditLogs}
                sx={{
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                  color: 'text.primary',
                  '&:hover': {
                    borderColor: 'var(--primary-color)',
                    backgroundColor: 'rgba(0, 122, 255, 0.05)',
                  },
                }}
              >
                Aktualisieren
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDown size={16} />}
                onClick={exportToCSV}
                sx={{
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                  color: 'text.primary',
                  '&:hover': {
                    borderColor: 'var(--primary-color)',
                    backgroundColor: 'rgba(0, 122, 255, 0.05)',
                  },
                }}
              >
                CSV
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileText size={16} />}
                onClick={exportToPDF}
                sx={{
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                  color: 'text.primary',
                  '&:hover': {
                    borderColor: 'var(--primary-color)',
                    backgroundColor: 'rgba(0, 122, 255, 0.05)',
                  },
                }}
              >
                PDF
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Trash2 size={16} />}
                onClick={deleteFilteredLogs}
                color="error"
                disabled={filteredLogs.length === 0}
              >
                Löschen ({filteredLogs.length})
              </Button>
            </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Error display */}
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        {/* Table */}
        <Box sx={{ p: 2, pt: 0 }}>
          <Card 
            key={`table-card-${theme.palette.mode}`}
            sx={cardStyles}
          >
            <CardContent sx={{ p: 2 }}>
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
            formatTimestamp={formatTimestamp}
            formatActionName={formatActionName}
            getActionIcon={(action) => {
              const IconComponent = actionIcons[action] || Activity;
              return <IconComponent size={16} />;
            }}
            getActionColor={getActionColor}
          />
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default AuditLogPanel;
