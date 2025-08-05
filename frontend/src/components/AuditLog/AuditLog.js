import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  FileDown,
} from 'lucide-react';
import axios from '../../utils/axiosConfig';
import AuditLogTable from './AuditLogTable';
import { useSSE } from '../../hooks/useSSE';
import './AuditLog.css';
import './AuditLog.light.css';

const AuditLog = ({ onClose }) => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedResourceType, setSelectedResourceType] = useState('all');
  const [dateRange, setDateRange] = useState('all');
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

  // SSE Hook
  const { addEventListener, isConnected } = useSSE();

  // Mobile Detection Hook - erweiterte Detection
  const [isMobile, setIsMobile] = useState(() => {
    // Check für Mobile Devices
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isMobileDevice =
      /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent.toLowerCase()
      );
    const isSmallScreen = window.innerWidth <= 768;
    return isMobileDevice || isSmallScreen;
  });

  // Container width detection for compact view
  const [containerWidth, setContainerWidth] = useState(window.innerWidth);
  const containerRef = useRef(null);
  const isCompactView = containerWidth < 900 && !isMobile;

  useEffect(() => {
    const handleResize = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobileDevice =
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
          userAgent.toLowerCase()
        );
      const isSmallScreen = window.innerWidth <= 768;
      setIsMobile(isMobileDevice || isSmallScreen);
    };

    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('resize', updateContainerWidth);

    updateContainerWidth();

    const resizeObserver = new ResizeObserver(updateContainerWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', updateContainerWidth);
      resizeObserver.disconnect();
    };
  }, []);

  // Definiere kritische Aktionen
  const criticalActions = [
    'user_delete',
    'user_deleted',
    'user_deactivated',
    'appliance_delete',
    'service_deleted',
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

  // Definiere Aktion-Icons
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
    service_created: CheckCircle,
    service_updated: Settings,
    service_deleted: XCircle,
    service_restored: RefreshCw,
    service_reverted: RefreshCw,
    appliance_reverted: RefreshCw,
    user_create: Users,
    user_created: Users,
    user_update: Users,
    user_updated: Users,
    user_delete: XCircle,
    user_deleted: XCircle,
    user_activated: CheckCircle,
    user_deactivated: XCircle,
    user_restore: RefreshCw,
    user_restored: RefreshCw,
    user_reverted: RefreshCw,
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
      // Debug-Ausgabe
      setLogs(response.data);
      setFilteredLogs(response.data);

      // Berechne Statistiken
      calculateStats(response.data);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError('Fehler beim Laden der Audit Logs');
    } finally {
      setLoading(false);
    }
  }, []);

  // Berechne Statistiken
  const calculateStats = logsData => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayLogs = logsData.filter(
      log => new Date(log.created_at) >= today
    ).length;

    const uniqueUsers = new Set(
      logsData.map(log => log.username).filter(Boolean)
    ).size;

    const criticalActionCount = logsData.filter(log =>
      criticalActions.includes(log.action)
    ).length;

    setStats({
      totalLogs: logsData.length,
      todayLogs,
      uniqueUsers,
      criticalActions: criticalActionCount,
    });
  };

  // Handle Kritische Aktionen Filter
  const handleCriticalActionsClick = () => {
    setShowCriticalOnly(!showCriticalOnly);
    // Reset andere Filter wenn kritische Aktionen aktiviert werden
    if (!showCriticalOnly) {
      setSelectedAction('all');
      setSearchTerm('');
    }
  };

  // Initial Load
  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Store fetchAuditLogs in a ref to avoid recreating event listeners
  const fetchAuditLogsRef = useRef();
  fetchAuditLogsRef.current = fetchAuditLogs;

  // SSE Event Listeners für Echtzeit-Updates
  useEffect(() => {
    if (!addEventListener) {
      console.error('❌ AuditLog: addEventListener is not available!');
      return;
    }

    // List of all events that should trigger audit log refresh
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
      'service_started',
      'service_stopped',
      'service_accessed',
      'user_created',
      'user_updated',
      'user_deleted',
      'user_restored',
      'user_reverted',
      'user_activated',
      'user_deactivated',
      'user_status_changed',
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
      'audit_log_created', // Generic event for any audit log creation
    ];

    // Create event listeners for all audit events
    const unsubscribers = auditEvents
      .map(eventName => {
        try {
          const unsubscribe = addEventListener(eventName, data => {

            // Special handling for user activation/deactivation
            if (
              eventName === 'user_activated' ||
              eventName === 'user_deactivated'
            ) {

            }

            // Use shorter delay for better UX but still ensure DB write is complete
            const delay = [
              'user_activated',
              'user_deactivated',
              'user_status_changed',
            ].includes(eventName)
              ? 1500
              : 1000;

            setTimeout(() => {

              // Call fetchAuditLogs through the ref
              if (fetchAuditLogsRef.current) {
                fetchAuditLogsRef.current();
              } else {
                console.error('❌ fetchAuditLogsRef.current is null!');
              }
            }, delay);
          });

          if (typeof unsubscribe !== 'function') {
            console.error(
              `❌ AuditLog: addEventListener for ${eventName} did not return a function`
            );
            return null;
          }

          return unsubscribe;
        } catch (error) {
          console.error(
            `❌ AuditLog: Error registering listener for ${eventName}:`,
            error
          );
          return null;
        }
      })
      .filter(Boolean); // Remove null values

    // Cleanup function
    return () => {
      unsubscribers.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          try {
            unsubscribe();
          } catch (error) {
            console.error('Error unsubscribing:', error);
          }
        }
      });
    };
  }, [addEventListener]); // Only depend on addEventListener

  // Filter Logs
  useEffect(() => {
    let filtered = [...logs];

    // Kritische Aktionen Filter (hat Priorität)
    if (showCriticalOnly) {
      filtered = filtered.filter(log => criticalActions.includes(log.action));
    } else {
      // Normale Filter nur wenn kritische Aktionen nicht aktiv sind

      // Textsuche
      if (searchTerm) {
        filtered = filtered.filter(
          log =>
            log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.username &&
              log.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (log.resource_type &&
              log.resource_type
                .toLowerCase()
                .includes(searchTerm.toLowerCase())) ||
            (log.details &&
              JSON.stringify(log.details)
                .toLowerCase()
                .includes(searchTerm.toLowerCase()))
        );
      }

      // Action Filter
      if (selectedAction !== 'all') {
        filtered = filtered.filter(log => log.action === selectedAction);
      }
    }

    // User Filter
    if (selectedUser !== 'all') {
      filtered = filtered.filter(log => log.username === selectedUser);
    }

    // Resource Type Filter
    if (selectedResourceType !== 'all') {
      filtered = filtered.filter(
        log => log.resource_type === selectedResourceType
      );
    }

    // Datumsfilter
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
  }, [
    logs,
    searchTerm,
    selectedAction,
    selectedUser,
    selectedResourceType,
    dateRange,
    customStartDate,
    customEndDate,
    showCriticalOnly,
  ]);

  // Toggle Row Expansion
  const toggleRowExpansion = logId => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  // SSH Host Restore Handler
  const handleSSHHostRestore = async hostId => {
    try {
      const response = await axios.post(`/api/hosts/${hostId}/restore`);
      if (response.data.success) {
        fetchAuditLogs(); // Refresh audit logs
        // Show success message (you might want to add a toast notification here)
        }
    } catch (error) {
      console.error('Error restoring SSH host:', error);
      setError('Fehler beim Wiederherstellen des SSH-Hosts');
    }
  };

  // SSH Host Revert Handler
  const handleSSHHostRevert = async (hostId, historyId) => {
    try {
      const response = await axios.post(
        `/api/hosts/${hostId}/revert/${historyId}`
      );
      if (response.data.success) {
        fetchAuditLogs(); // Refresh audit logs
        // Show success message
        }
    } catch (error) {
      console.error('Error reverting SSH host:', error);
      setError('Fehler beim Zurücksetzen des SSH-Hosts');
    }
  };

  // Format Timestamp
  const formatTimestamp = timestamp => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60)
      return `vor ${diffMins} Minute${diffMins > 1 ? 'n' : ''}`;
    if (diffHours < 24)
      return `vor ${diffHours} Stunde${diffHours > 1 ? 'n' : ''}`;
    if (diffDays < 7) return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;

    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format Action Name
  const formatActionName = action => {
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
      appliance_reverted: 'Service / Original wiederhergestellt',
      service_created: 'Service erstellt',
      service_updated: 'Service aktualisiert',
      service_deleted: 'Service gelöscht',
      service_restored: 'Service wiederhergestellt',
      service_reverted: 'Service / Änderung rückgängig gemacht',
      user_create: 'Benutzer erstellt',
      user_created: 'Benutzer erstellt',
      user_update: 'Benutzer aktualisiert',
      user_updated: 'Benutzer aktualisiert',
      user_delete: 'Benutzer gelöscht',
      user_deleted: 'Benutzer gelöscht',
      user_activated: 'Benutzer aktiviert',
      user_deactivated: 'Benutzer deaktiviert',
      user_restore: 'Benutzer wiederhergestellt',
      user_restored: 'Benutzer wiederhergestellt',
      user_reverted: 'Benutzer zurückgesetzt',
      user_role_change: 'Benutzerrolle geändert',
      settings_update: 'Einstellungen aktualisiert',
      backup_create: 'Backup erstellt',
      backup_restore: 'Backup wiederhergestellt',
      ssh_key_create: 'SSH-Schlüssel erstellt',
      ssh_key_delete: 'SSH-Schlüssel gelöscht',
      ssh_host_create: 'SSH-Host erstellt',
      ssh_host_update: 'SSH-Host aktualisiert',
      ssh_host_delete: 'SSH-Host gelöscht',
      ssh_host_restore: 'SSH-Host wiederhergestellt',
      ssh_host_revert: 'SSH-Host zurückgesetzt',
      ssh_connection_test: 'SSH-Verbindung getestet',
      ssh_file_upload: 'Datei hochgeladen',
      service_start: 'Service gestartet',
      service_stop: 'Service gestoppt',
      password_change: 'Passwort geändert',
      command_execute: 'Kommando ausgeführt',
      command_execute_failed: 'Kommando fehlgeschlagen',
      terminal_open: 'Terminal geöffnet',
      terminal_disconnect: 'Terminal geschlossen',
      terminal_command: 'Terminal-Befehl',
      audit_logs_delete: 'Audit Logs gelöscht',
    };

    return actionMap[action] || action;
  };

  // Export Audit Logs als CSV
  const exportToCSV = async () => {
    try {
      // Baue Query-Parameter basierend auf aktuellen Filtern
      const params = new URLSearchParams();

      if (selectedAction !== 'all') {
        params.append('action', selectedAction);
      }

      if (selectedUser !== 'all') {
        // Finde die user_id für den ausgewählten Benutzernamen
        const userLog = logs.find(log => log.username === selectedUser);
        if (userLog && userLog.user_id) {
          params.append('user_id', userLog.user_id);
        }
      }

      if (selectedResourceType !== 'all') {
        params.append('resource_type', selectedResourceType);
      }

      // Datumsfilter
      const now = new Date();
      let startDate = null;
      let endDate = null;

      switch (dateRange) {
        case 'today':
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );
          params.append('start_date', startDate.toISOString());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          params.append('start_date', startDate.toISOString());
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          params.append('start_date', startDate.toISOString());
          break;
        case 'custom':
          if (customStartDate) {
            params.append(
              'start_date',
              new Date(customStartDate).toISOString()
            );
          }
          if (customEndDate) {
            endDate = new Date(customEndDate);
            endDate.setHours(23, 59, 59, 999);
            params.append('end_date', endDate.toISOString());
          }
          break;
      }

      const response = await axios.get(
        `/api/auditLogs/export?${params.toString()}`,
        {
          responseType: 'blob',
        }
      );

      // Erstelle einen Download-Link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `audit_logs_${new Date().toISOString().split('T')[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting audit logs:', err);
      setError('Fehler beim Exportieren der Audit Logs');
    }
  };

  // Export Audit Logs als PDF
  const exportToPDF = () => {
    try {
      // Erstelle einen temporären Container für den PDF Export
      const printContent = document.querySelector('.audit-logs-table');
      if (!printContent) {
        setError('Keine Inhalte zum Exportieren gefunden');
        return;
      }

      // Öffne das Druckdialog-Fenster
      const printWindow = window.open('', '_blank');

      // Erstelle HTML für das Druckfenster
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

      // Füge die Tabellenzeilen hinzu
      filteredLogs.forEach(log => {
        let resourceName = '';
        if (log.details) {
          try {
            const details =
              typeof log.details === 'string'
                ? JSON.parse(log.details)
                : log.details;
            resourceName =
              details.displayName ||
              details.hostIdentifier ||
              details.name ||
              details.service_name ||
              details.appliance_name ||
              '';
          } catch (e) {
            console.error('Error parsing details:', e);
          }
        }

        const resourceDisplay =
          log.resource_name ||
          resourceName ||
          (log.resource_type && log.resource_id
            ? `${log.resource_type} #${log.resource_id}`
            : log.resource_type || '-');

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

      // Warte kurz, damit das Dokument geladen wird
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

    // Zweite Sicherheitsabfrage bei mehr als 100 Einträgen
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
        // Erfolg - Logs neu laden
        await fetchAuditLogs();

        // Erfolgsbenachrichtigung (optional - könnte auch ein Toast sein)
        alert(
          `${response.data.deletedCount} Audit Log Einträge wurden erfolgreich gelöscht.`
        );
      } else {
        // Sollte normalerweise nicht passieren, da das Backend bei Fehler einen HTTP-Fehlercode sendet
        throw new Error(response.data.error || 'Unbekannter Fehler beim Löschen');
      }
    } catch (err) {
      console.error('Error deleting audit logs:', err);
      setError('Fehler beim Löschen der Audit Logs');
      alert(
        'Fehler beim Löschen der Audit Logs: ' +
          (err.response?.data?.error || err.message)
      );
    }
  };

  // Get Action Icon
  const getActionIcon = action => {
    const IconComponent = actionIcons[action] || Activity;
    return <IconComponent size={16} />;
  };

  // Get Action Color
  const getActionColor = action => {
    if (criticalActions.includes(action)) return 'critical';
    if (action.includes('failed')) return 'error';
    if (action.includes('create') || action.includes('activated'))
      return 'success';
    if (action.includes('update')) return 'warning';
    if (action.includes('delete') || action.includes('deactivated'))
      return 'critical';
    return 'default';
  };

  // Get unique values for filters
  const uniqueActions = [...new Set(logs.map(log => log.action))].sort();
  const uniqueUsers = [
    ...new Set(logs.map(log => log.username).filter(Boolean)),
  ].sort();
  const uniqueResourceTypes = [
    ...new Set(logs.map(log => log.resource_type).filter(Boolean)),
  ].sort();

  // Add/remove no-blur class when component mounts/unmounts
  useEffect(() => {
    // Add no-blur class to body when AuditLog is shown
    document.body.classList.add('no-background-blur');

    // Remove no-blur class when component unmounts
    return () => {
      document.body.classList.remove('no-background-blur');
    };
  }, []);

  if (loading) {
    return (
      <div className="audit-log-modal">
        <div className="audit-log-overlay" onClick={onClose} />
        <div className="audit-log-container">
          <div className="loading-state">
            <Activity className="spin" />
            <span>Lade Audit Logs...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="audit-log-modal">
      <div className="audit-log-overlay" onClick={onClose} />
      <div className="audit-log-container" ref={containerRef}>
        <div className="audit-log-header">
          <h2>Audit Log</h2>
          <button className="close-btn" onClick={onClose}>
            <XCircle size={24} />
          </button>
        </div>

        {/* Statistiken */}
        <div className="audit-stats">
          <div className="stat-card">
            <div className="stat-icon">
              <FileText size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalLogs}</div>
              <div className="stat-label">Gesamt-Einträge</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.todayLogs}</div>
              <div className="stat-label">Heute</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <Users size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.uniqueUsers}</div>
              <div className="stat-label">Aktive Benutzer</div>
            </div>
          </div>
          <div
            className={`stat-card critical ${showCriticalOnly ? 'active' : ''}`}
            onClick={handleCriticalActionsClick}
            style={{ cursor: 'pointer' }}
            title="Klicken um nur kritische Aktionen anzuzeigen"
          >
            <div className="stat-icon">
              <AlertTriangle size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.criticalActions}</div>
              <div className="stat-label">Kritische Aktionen</div>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="audit-filters">
          {showCriticalOnly && (
            <div
              className="critical-filter-notice"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <AlertTriangle size={20} color="#ef4444" />
                <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                  Zeige nur kritische Aktionen ({stats.criticalActions}{' '}
                  Einträge)
                </span>
              </div>
              <button
                onClick={() => setShowCriticalOnly(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  padding: '4px 12px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Filter zurücksetzen
              </button>
            </div>
          )}
          <div className="filter-row">
            <div className="search-box">
              <Search size={20} />
              <input
                type="text"
                placeholder="Suche in Logs..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                disabled={showCriticalOnly}
              />
            </div>
          </div>

          {/* Mobile: Filter Dropdowns in 2x2 Grid */}
          {isMobile ? (
            <>
              <div className="filter-row">
                <div className="filter-group">
                  <label>Zeitraum</label>
                  <select
                    value={dateRange}
                    onChange={e => setDateRange(e.target.value)}
                  >
                    <option value="all">Alle</option>
                    <option value="today">Heute</option>
                    <option value="yesterday">Gestern</option>
                    <option value="week">Diese Woche</option>
                    <option value="month">Dieser Monat</option>
                    <option value="custom">Benutzerdefiniert</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Benutzer</label>
                  <select
                    value={selectedUser}
                    onChange={e => setSelectedUser(e.target.value)}
                  >
                    <option value="all">Alle Benutzer</option>
                    {uniqueUsers.map(user => (
                      <option key={user} value={user}>
                        {user}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Aktion</label>
                  <select
                    value={selectedAction}
                    onChange={e => setSelectedAction(e.target.value)}
                  >
                    <option value="all">Alle Aktionen</option>
                    {uniqueActions.map(action => (
                      <option key={action} value={action}>
                        {formatActionName(action)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Ressource</label>
                  <select
                    value={selectedResourceType}
                    onChange={e => setSelectedResourceType(e.target.value)}
                  >
                    <option value="all">Alle Ressourcen</option>
                    {uniqueResourceTypes.map(type => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="filter-row">
                <button className="refresh-btn" onClick={fetchAuditLogs}>
                  <RefreshCw size={16} />
                  <span>Aktualisieren</span>
                </button>

                {/* Löschen Button - nur anzeigen wenn Einträge vorhanden */}
                {filteredLogs.length > 0 && (
                  <button className="delete-btn" onClick={deleteFilteredLogs}>
                    <Trash2 size={16} />
                    <span>Löschen ({filteredLogs.length})</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            // Desktop Layout (unchanged)
            <>
              <div className="filter-row">
                <button
                  className="refresh-btn"
                  onClick={fetchAuditLogs}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    borderRadius: '8px',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontWeight: '500',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor =
                      'rgba(59, 130, 246, 0.3)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor =
                      'rgba(59, 130, 246, 0.2)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <RefreshCw size={20} />
                  Aktualisieren
                </button>

                <button
                  className="export-btn"
                  onClick={exportToCSV}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                    borderRadius: '8px',
                    color: '#22c55e',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontWeight: '500',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor =
                      'rgba(34, 197, 94, 0.3)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor =
                      'rgba(34, 197, 94, 0.2)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <Download size={20} />
                  CSV exportieren
                </button>

                <button
                  className="export-pdf-btn"
                  onClick={exportToPDF}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    backgroundColor: 'rgba(250, 204, 21, 0.2)',
                    border: '1px solid rgba(250, 204, 21, 0.4)',
                    borderRadius: '8px',
                    color: '#facc15',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontWeight: '500',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor =
                      'rgba(250, 204, 21, 0.3)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor =
                      'rgba(250, 204, 21, 0.2)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <FileDown size={20} />
                  PDF exportieren
                </button>

                {/* Löschen Button - nur anzeigen wenn Einträge vorhanden */}
                {filteredLogs.length > 0 && (
                  <button
                    className="delete-btn"
                    onClick={deleteFilteredLogs}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '8px',
                      color: '#ef4444',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontWeight: '500',
                    }}
                    onMouseEnter={e => {
                      e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
                      e.target.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                      e.target.style.transform = 'translateY(0)';
                    }}
                  >
                    <Trash2 size={20} />
                    Angezeigte löschen ({filteredLogs.length})
                  </button>
                )}
              </div>

              <div className="filter-row">
                <div className="filter-group">
                  {!isCompactView && <label>Zeitraum:</label>}
                  <select
                    value={dateRange}
                    onChange={e => setDateRange(e.target.value)}
                  >
                    <option value="all">Alle</option>
                    <option value="today">Heute</option>
                    <option value="yesterday">Gestern</option>
                    <option value="week">Diese Woche</option>
                    <option value="month">Dieser Monat</option>
                    <option value="custom">Benutzerdefiniert</option>
                  </select>
                </div>

                <div className="filter-group">
                  {!isCompactView && <label>Benutzer:</label>}
                  <select
                    value={selectedUser}
                    onChange={e => setSelectedUser(e.target.value)}
                  >
                    <option value="all">Alle Benutzer</option>
                    {uniqueUsers.map(user => (
                      <option key={user} value={user}>
                        {user}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  {!isCompactView && <label>Aktion:</label>}
                  <select
                    value={selectedAction}
                    onChange={e => setSelectedAction(e.target.value)}
                  >
                    <option value="all">Alle Aktionen</option>
                    {uniqueActions.map(action => (
                      <option key={action} value={action}>
                        {formatActionName(action)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  {!isCompactView && <label>Ressource:</label>}
                  <select
                    value={selectedResourceType}
                    onChange={e => setSelectedResourceType(e.target.value)}
                  >
                    <option value="all">Alle Ressourcen</option>
                    {uniqueResourceTypes.map(type => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Logs Table */}
        <div className="audit-logs-table">
          {error ? (
            <div className="error-state">{error}</div>
          ) : filteredLogs.length === 0 ? (
            <div className="empty-state">
              <FileText size={48} />
              <p>Keine Audit Logs gefunden</p>
            </div>
          ) : isMobile ? (
            // Mobile Card View
            <div className="mobile-logs-container">
              {filteredLogs.map(log => {
                let resourceName = '';
                if (log.details) {
                  try {
                    const details =
                      typeof log.details === 'string'
                        ? JSON.parse(log.details)
                        : log.details;
                    resourceName =
                      details.displayName ||
                      details.hostIdentifier ||
                      details.name ||
                      details.command_description ||
                      details.service_name ||
                      details.appliance_name ||
                      details.applianceName ||
                      '';

                    // Special handling for deleted appliances
                    if (
                      !resourceName &&
                      details.appliance &&
                      details.appliance.name
                    ) {
                      resourceName = details.appliance.name;
                    }
                  } catch (e) {
                    console.error('Error parsing details:', e);
                  }
                }

                let resourceDisplay = log.resource_name || resourceName;

                // Only use generic format if we have no name
                if (!resourceDisplay) {
                  if (log.resource_type && log.resource_id) {
                    resourceDisplay = `${log.resource_type} #${log.resource_id}`;
                  } else if (log.resource_type) {
                    resourceDisplay = log.resource_type;
                  } else {
                    resourceDisplay = '-';
                  }
                }

                const isExpanded = expandedRows.has(log.id);

                return (
                  <div
                    key={log.id}
                    className={`mobile-log-card log-row ${getActionColor(log.action)} ${isExpanded ? 'expanded' : 'collapsed'}`}
                    onClick={() => !isExpanded && toggleRowExpansion(log.id)}
                  >
                    {!isExpanded ? (
                      // Kompakte Ansicht
                      <div className="mobile-log-compact">
                        <div className="compact-left">
                          <div className="compact-time">
                            <Calendar size={12} />
                            <span>
                              {new Date(log.created_at).toLocaleTimeString(
                                'de-DE',
                                { hour: '2-digit', minute: '2-digit' }
                              )}
                            </span>
                          </div>
                          <div
                            className={`compact-action ${getActionColor(log.action)}`}
                          >
                            {formatActionName(log.action)}
                          </div>
                        </div>
                        <div className="compact-right">
                          <div className="compact-user">
                            <User size={12} />
                            <span>{log.username || 'System'}</span>
                          </div>
                          <ChevronDown size={16} className="compact-chevron" />
                        </div>
                      </div>
                    ) : (
                      // Erweiterte Ansicht (aktuelle Ansicht)
                      <div>
                        <div
                          className="mobile-log-header"
                          onClick={e => {
                            e.stopPropagation();
                            toggleRowExpansion(log.id);
                          }}
                        >
                          <div className="mobile-log-time">
                            <Calendar size={14} />
                            <span>{formatTimestamp(log.created_at)}</span>
                          </div>
                          <div
                            className={`mobile-log-action ${getActionColor(log.action)}`}
                          >
                            {formatActionName(log.action)}
                          </div>
                        </div>

                        <div className="mobile-log-content">
                          <div className="mobile-log-user">
                            <User size={16} />
                            <span>{log.username || 'System'}</span>
                          </div>

                          <div className="mobile-log-resource">
                            <span className="mobile-label">Ressource:</span>
                            <span>{resourceDisplay}</span>
                          </div>

                          <div className="mobile-log-ip">
                            <span className="mobile-label">IP:</span>
                            <span>{log.ip_address || '-'}</span>
                          </div>
                        </div>

                        {log.details && (
                          <button
                            className="mobile-expand-btn"
                            onClick={e => {
                              e.stopPropagation();
                              const details =
                                typeof log.details === 'string'
                                  ? JSON.parse(log.details)
                                  : log.details;
                              const hasDetails =
                                details && Object.keys(details).length > 0;
                              if (hasDetails) {
                                // Toggle details display
                                const newExpandedRows = new Set(expandedRows);
                                if (expandedRows.has(log.id)) {
                                  newExpandedRows.delete(log.id);
                                } else {
                                  newExpandedRows.add(log.id);
                                }
                                setExpandedRows(newExpandedRows);
                              }
                            }}
                          >
                            {expandedRows.has(log.id) ? (
                              <>
                                <ChevronUp size={18} />
                                <span>Details ausblenden</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown size={18} />
                                <span>Details anzeigen</span>
                              </>
                            )}
                          </button>
                        )}

                        {expandedRows.has(log.id) && log.details && (
                          <div className="mobile-details">
                            {/* SSH Host specific details */}
                            {log.resource_type === 'ssh_host' && (
                              <SSHAuditDetail
                                logEntry={log}
                                onClose={() => toggleRowExpansion(log.id)}
                                onRestore={handleSSHHostRestore}
                                onRevert={handleSSHHostRevert}
                              />
                            )}

                            {/* Other resource types */}
                            {log.resource_type !== 'ssh_host' &&
                              (() => {
                                const details =
                                  typeof log.details === 'string'
                                    ? JSON.parse(log.details)
                                    : log.details;

                                // Handler für die Wiederherstellung
                                const handleRestore = async () => {
                                  const isDeleted =
                                    log.action.includes('delete');
                                  const resourceType = log.resource_type;

                                  if (!isDeleted && !details.original_data) {
                                    alert(
                                      'Keine Originaldaten für die Wiederherstellung verfügbar.'
                                    );
                                    return;
                                  }

                                  // Build confirm message based on resource type
                                  let confirmMessage = '';
                                  if (isDeleted) {
                                    switch (resourceType) {
                                      case 'appliances':
                                        confirmMessage = `Möchten Sie den gelöschten Service "${details.appliance?.name || details.service?.name}" wiederherstellen?`;
                                        break;
                                      case 'users':
                                        confirmMessage = `Möchten Sie den gelöschten Benutzer "${details.user?.username}" wiederherstellen?`;
                                        break;
                                      case 'categories':
                                        confirmMessage = `Möchten Sie die gelöschte Kategorie "${details.category?.name}" wiederherstellen?`;
                                        break;
                                      case 'ssh_host':
                                        confirmMessage = `Möchten Sie den gelöschten SSH-Host "${details.deleted_host?.hostname || details.ssh_host?.hostname}" wiederherstellen?`;
                                        break;
                                      default:
                                        confirmMessage =
                                          'Möchten Sie diesen Eintrag wiederherstellen?';
                                    }
                                  } else {
                                    confirmMessage =
                                      'Möchten Sie wirklich die Originaldaten wiederherstellen?\n\n' +
                                      'Der Eintrag wird auf den Zustand vor dieser Änderung zurückgesetzt.';
                                  }

                                  const confirmRestore =
                                    window.confirm(confirmMessage);

                                  if (!confirmRestore) {
                                    return;
                                  }

                                  try {
                                    const token = localStorage.getItem('token');

                                    // Build endpoint based on resource type and action
                                    let endpoint = '';
                                    if (isDeleted) {
                                      switch (resourceType) {
                                        case 'appliances':
                                          endpoint = `/api/auditRestore/restore/appliances/${log.id}`;
                                          break;
                                        case 'users':
                                          endpoint = `/api/auditRestore/restore/users/${log.id}`;
                                          break;
                                        case 'categories':
                                          endpoint = `/api/auditRestore/restore/categories/${log.id}`;
                                          break;
                                        case 'ssh_host':
                                          endpoint = `/api/auditRestore/restore/ssh_hosts/${log.id}`;
                                          break;
                                        default:
                                          throw new Error(
                                            `Restore not supported for resource type: ${resourceType}`
                                          );
                                      }
                                    } else {
                                      switch (resourceType) {
                                        case 'appliances':
                                          endpoint = `/api/auditRestore/revert/appliances/${log.id}`;
                                          break;
                                        case 'users':
                                          endpoint = `/api/auditRestore/revert/users/${log.id}`;
                                          break;
                                        case 'categories':
                                          endpoint = `/api/auditRestore/revert/categories/${log.id}`;
                                          break;
                                        case 'ssh_host':
                                          endpoint = `/api/auditRestore/revert/ssh_hosts/${log.id}`;
                                          break;
                                        default:
                                          throw new Error(
                                            `Revert not supported for resource type: ${resourceType}`
                                          );
                                      }
                                    }

                                    const response = await fetch(endpoint, {
                                      method: 'POST',
                                      headers: {
                                        Authorization: token
                                          ? `Bearer ${token}`
                                          : '',
                                        'Content-Type': 'application/json',
                                      },
                                    });

                                    if (response.ok) {
                                      const result = await response.json();
                                      if (window.showNotification) {
                                        const message =
                                          result.message ||
                                          'Erfolgreich wiederhergestellt!';
                                        window.showNotification(
                                          message,
                                          'success'
                                        );
                                      }
                                      // Don't reload - let SSE handle the update
                                      // window.location.reload();
                                    } else {
                                      const error = await response.json();
                                      alert(
                                        `Fehler bei der Wiederherstellung: ${error.error || 'Unbekannter Fehler'}`
                                      );
                                    }
                                  } catch (error) {
                                    console.error('Error restoring:', error);
                                    alert(
                                      'Fehler bei der Wiederherstellung: ' +
                                        error.message
                                    );
                                  }
                                };

                                return (
                                  <>
                                    {((log.action.includes('update') ||
                                      log.action.includes('reverted')) &&
                                      details.original_data) ||
                                    (log.action.includes('delete') &&
                                      (details.appliance ||
                                        details.user ||
                                        details.category)) ? (
                                      <div
                                        style={{
                                          marginBottom: '12px',
                                          padding: '10px',
                                          backgroundColor: log.action.includes(
                                            'delete'
                                          )
                                            ? 'rgba(239, 68, 68, 0.1)'
                                            : 'rgba(46, 160, 67, 0.1)',
                                          borderRadius: '8px',
                                          border: `1px solid ${
                                            log.action.includes('delete')
                                              ? 'rgba(239, 68, 68, 0.3)'
                                              : 'rgba(46, 160, 67, 0.3)'
                                          }`,
                                        }}
                                      >
                                        <button
                                          onClick={handleRestore}
                                          style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            padding: '10px',
                                            backgroundColor:
                                              log.action.includes('delete')
                                                ? 'rgba(239, 68, 68, 0.2)'
                                                : 'rgba(46, 160, 67, 0.2)',
                                            border: `1px solid ${
                                              log.action.includes('delete')
                                                ? 'rgba(239, 68, 68, 0.4)'
                                                : 'rgba(46, 160, 67, 0.4)'
                                            }`,
                                            borderRadius: '6px',
                                            color: 'rgba(255, 255, 255, 0.9)',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                          }}
                                        >
                                          <RefreshCw size={16} />
                                          {log.action.includes('delete')
                                            ? 'Eintrag wiederherstellen'
                                            : 'Original wiederherstellen'}
                                        </button>
                                      </div>
                                    ) : null}

                                    {details.changes &&
                                      Object.keys(details.changes).length >
                                        0 && (
                                        <div
                                          style={{
                                            marginBottom: '12px',
                                            padding: '10px',
                                            backgroundColor:
                                              'rgba(255, 193, 7, 0.1)',
                                            borderRadius: '8px',
                                            border:
                                              '1px solid rgba(255, 193, 7, 0.3)',
                                          }}
                                        >
                                          <div
                                            style={{
                                              fontSize: '14px',
                                              fontWeight: '600',
                                              marginBottom: '8px',
                                            }}
                                          >
                                            Änderungen:
                                          </div>
                                          {Object.entries(details.changes).map(
                                            ([field, change]) => (
                                              <div
                                                key={field}
                                                style={{
                                                  marginBottom: '8px',
                                                  fontSize: '12px',
                                                }}
                                              >
                                                <div
                                                  style={{ fontWeight: '500' }}
                                                >
                                                  {field}:
                                                </div>
                                                <div
                                                  style={{ marginLeft: '10px' }}
                                                >
                                                  <span
                                                    style={{
                                                      color:
                                                        'rgba(239, 68, 68, 0.8)',
                                                    }}
                                                  >
                                                    Vorher:{' '}
                                                  </span>
                                                  {JSON.stringify(change.old)}
                                                </div>
                                                <div
                                                  style={{ marginLeft: '10px' }}
                                                >
                                                  <span
                                                    style={{
                                                      color:
                                                        'rgba(46, 160, 67, 0.8)',
                                                    }}
                                                  >
                                                    Nachher:{' '}
                                                  </span>
                                                  {JSON.stringify(change.new)}
                                                </div>
                                              </div>
                                            )
                                          )}
                                        </div>
                                      )}

                                    <pre>
                                      {JSON.stringify(details, null, 2)}
                                    </pre>
                                  </>
                                );
                              })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            // Desktop Table View
            <AuditLogTable
              filteredLogs={filteredLogs}
              getActionColor={getActionColor}
              formatTimestamp={formatTimestamp}
              formatActionName={formatActionName}
              getActionIcon={getActionIcon}
              expandedRows={expandedRows}
              toggleRowExpansion={toggleRowExpansion}
              onSSHHostRestore={handleSSHHostRestore}
              onSSHHostRevert={handleSSHHostRevert}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLog;
