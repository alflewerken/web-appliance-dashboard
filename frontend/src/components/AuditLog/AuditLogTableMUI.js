import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Collapse,
  Box,
  Typography,
  Chip,
  useTheme,
  alpha,
  Stack,
  Button,
  Tooltip,
  Divider,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Code,
  RefreshCw,
  History,
  User,
  FileText,
  Shield,
  Terminal,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Server,
  Key,
  Database,
  Globe,
  Hash,
  Layers,
  RotateCcw,
  X,
} from 'lucide-react';
import axios from '../../utils/axiosConfig';
import AuditLogDetail from './AuditLogDetail';

const AuditLogTableMUI = ({
  logs,
  expandedRows,
  onToggleExpand,
  formatTimestamp,
  formatActionName,
  getActionIcon,
  getActionColor,
  onRefresh,
}) => {
  const theme = useTheme();
  const [viewModes, setViewModes] = useState({});
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = React.useRef(null);
  const [restoringLogs, setRestoringLogs] = useState(new Set());
  const [restoreResults, setRestoreResults] = useState({});
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedLogEntry, setSelectedLogEntry] = useState(null);
  
  // Common header cell styles
  const headerCellStyle = {
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(50, 50, 60, 0.2)'
      : 'rgba(200, 200, 210, 0.4)',
    borderBottom: `1px solid ${theme.palette.mode === 'dark' 
      ? 'rgba(255, 255, 255, 0.08)' 
      : 'rgba(0, 0, 0, 0.08)'}`,
    color: 'text.secondary',
    fontWeight: 600,
  };

  // Monitor container width
  React.useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);

    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateWidth);
      resizeObserver.disconnect();
    };
  }, []);

  // Switch to widget view when width < 600px
  const useWidgetView = containerWidth < 600;

  // Handler für Detail-Ansicht
  const handleOpenDetail = (log) => {
    setSelectedLogEntry(log);
    setDetailDialogOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailDialogOpen(false);
    setSelectedLogEntry(null);
  };

  const handleDetailRestore = () => {
    handleCloseDetail();
    if (onRefresh) {
      onRefresh();
    }
  };

  // Toggle between JSON and formatted view
  const toggleViewMode = (logId) => {
    setViewModes(prev => ({
      ...prev,
      [logId]: prev[logId] === 'formatted' ? 'json' : 'formatted',
    }));
  };

  // Get row background color based on action
  const getRowBackgroundColor = (action) => {
    // Base background for all rows
    const baseBackground = theme.palette.mode === 'dark'
      ? 'rgba(60, 60, 70, 0.12)'  // Slightly darker than the card
      : 'rgba(220, 220, 225, 0.4)';
      
    // Gelöschte Aktionen - Rot
    if (action.includes('delete') || action.includes('gelöscht')) {
      return theme.palette.mode === 'dark'
        ? alpha(theme.palette.error.main, 0.2)
        : alpha(theme.palette.error.light, 0.15);
    }
    // Erstellte Aktionen - Grün
    if (action.includes('create') || action.includes('erstellt')) {
      return theme.palette.mode === 'dark'
        ? alpha(theme.palette.success.main, 0.2)
        : alpha(theme.palette.success.light, 0.15);
    }
    // Fehlgeschlagene Aktionen - Rot/Orange
    if (action.includes('failed') || action.includes('fehlgeschlagen')) {
      return theme.palette.mode === 'dark'
        ? alpha(theme.palette.error.main, 0.15)
        : alpha(theme.palette.error.light, 0.1);
    }
    // Update Aktionen - Blau
    if (action.includes('update') || action.includes('aktualisiert')) {
      return theme.palette.mode === 'dark'
        ? alpha(theme.palette.info.main, 0.15)
        : alpha(theme.palette.info.light, 0.1);
    }
    
    // Standard - return base background
    return baseBackground;
  };

  // Format field names
  const formatFieldName = (key) => {
    const translations = {
      name: 'Name',
      appliance_name: 'Service Name',
      service_name: 'Service Name',
      command: 'Befehl',
      command_description: 'Befehlsbeschreibung',
      username: 'Benutzername',
      created_by: 'Erstellt von',
      deleted_by: 'Gelöscht von',
      updated_by: 'Aktualisiert von',
      executed_on: 'Ausgeführt auf',
      ssh_host: 'SSH Host',
      ip_address: 'IP-Adresse',
      created_at: 'Erstellt am',
      timestamp: 'Zeitstempel',
      error: 'Fehler',
      success: 'Erfolgreich',
      failed: 'Fehlgeschlagen',
      category: 'Kategorie',
      url: 'URL',
      key_name: 'Schlüsselname',
      backup_version: 'Backup Version',
      output_length: 'Ausgabelänge',
      exit_code: 'Exit Code',
      role: 'Rolle',
      is_active: 'Status',
      email: 'E-Mail',
      password: 'Passwort',
      // Host-spezifische Felder
      hostname: 'Hostname',
      port: 'Port',
      ssh_key_name: 'SSH-Schlüssel',
      icon: 'Icon',
      color: 'Farbe',
      transparency: 'Transparenz',
      blur: 'Unschärfe',
      remote_desktop_enabled: 'Remote Desktop aktiviert',
      remote_desktop_type: 'Remote Desktop Typ',
      remote_protocol: 'Remote Protokoll',
      remote_port: 'Remote Port',
      remote_username: 'Remote Benutzername',
      guacamole_performance_mode: 'Guacamole Performance',
      rustdesk_id: 'RustDesk ID',
      changes: 'Änderungen',
      oldValues: 'Alte Werte',
      privateKey: 'Privater Schlüssel',
      sshKeyName: 'SSH-Schlüssel',
      remoteDesktopEnabled: 'Remote Desktop aktiviert',
      remoteDesktopType: 'Remote Desktop Typ',
      remoteProtocol: 'Remote Protokoll',
      remotePort: 'Remote Port',
      remoteUsername: 'Remote Benutzername',
    };

    return translations[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Format values
  const formatValue = (key, value) => {
    if (key === 'role') {
      const roleMap = {
        admin: 'Administrator',
        user: 'Benutzer',
      };
      return roleMap[value] || value;
    }

    if (key === 'is_active') {
      return value === 1 || value === true ? 'Aktiv' : 'Inaktiv';
    }

    if (key === 'password' || key === 'password_hash') {
      return '••••••••';
    }

    if (key.includes('_at') || key === 'timestamp') {
      const date = new Date(value);
      return date.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    if (key === 'output_length') {
      return `${value.toLocaleString('de-DE')} Zeichen`;
    }

    if (typeof value === 'boolean') {
      return value ? 'Ja' : 'Nein';
    }

    if (key === 'exit_code') {
      return value === 0 ? '0 (Erfolgreich)' : `${value} (Fehler)`;
    }

    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    }

    return value || '-';
  };

  // Get detail icon
  const getDetailIcon = (key) => {
    const iconMap = {
      name: FileText,
      appliance_name: Server,
      service_name: Server,
      command: Terminal,
      username: User,
      created_by: User,
      deleted_by: User,
      updated_by: User,
      executed_on: Server,
      ssh_host: Server,
      ip_address: Globe,
      created_at: Clock,
      timestamp: Clock,
      error: AlertTriangle,
      success: CheckCircle,
      failed: XCircle,
      category: Layers,
      url: Globe,
      key_name: Key,
      backup_version: Database,
      output_length: Hash,
      exit_code: Hash,
    };

    return iconMap[key] || FileText;
  };

  // Format resource type for display
  const formatResourceType = (resourceType) => {
    const typeMap = {
      'appliances': 'Service',
      'appliance': 'Service',
      'categories': 'Kategorie',
      'category': 'Kategorie',
      'users': 'Benutzer',
      'user': 'Benutzer',
      'ssh_host': 'SSH-Host',
      'ssh_hosts': 'SSH-Host',
      'ssh_key': 'SSH-Schlüssel',
      'ssh_keys': 'SSH-Schlüssel',
      'command': 'Befehl',
      'backup': 'Backup',
      'restore': 'Wiederherstellung'
    };
    
    return typeMap[resourceType] || resourceType || '-';
  };

  // Parse resource name from details
  const getResourceName = (log) => {
    if (!log.details) return null;
    
    try {
      const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
      
      // For command executions, prioritize showing service name with command description
      if (log.action === 'command_execute' || log.action === 'command_execute_failed') {
        const serviceName = details.appliance_name || '';
        const commandName = details.name || details.command_description || '';
        if (serviceName && commandName) {
          return `${serviceName}: ${commandName}`;
        } else if (serviceName) {
          return serviceName;
        }
      }
      
      // Appliance/Service specific handling
      if (log.resourceType === 'appliances' || log.resourceType === 'appliance') {
        // Check for service object (used in create operations)
        if (details.service && details.service.name) {
          return details.service.name;
        }
        // Check for appliance object (used in delete operations)
        if (details.appliance && details.appliance.name) {
          return details.appliance.name;
        }
        // Check for old_data/new_data (used in update operations)
        if (details.old_data && details.old_data.name) {
          return details.old_data.name;
        }
        if (details.new_data && details.new_data.name) {
          return details.new_data.name;
        }
        // Check for direct appliance_name field (used in access logs)
        if (details.appliance_name) {
          return details.appliance_name;
        }
        return details.name || null;
      }
      
      // SSH Host specific handling
      if (log.resourceType === 'ssh_host') {
        // Check for nested deleted_host object (used in delete operations)
        if (details.deleted_host && details.deleted_host.hostname) {
          return details.deleted_host.hostname;
        }
        // Check for old_data/new_data (used in update operations)
        if (details.old_data && details.old_data.hostname) {
          return details.old_data.hostname;
        }
        if (details.new_data && details.new_data.hostname) {
          return details.new_data.hostname;
        }
        return details.hostname || details.ssh_host || details.host || null;
      }
      
      // Category specific handling
      if (log.resourceType === 'categories' || log.resourceType === 'category') {
        // Check for nested category object (used in delete operations)
        if (details.category && details.category.name) {
          return details.category.name;
        }
        // Check for old_data/new_data (used in update operations)
        if (details.old_data && details.old_data.name) {
          return details.old_data.name;
        }
        if (details.new_data && details.new_data.name) {
          return details.new_data.name;
        }
        return details.category_name || details.name || null;
      }
      
      // User specific handling
      if (log.resourceType === 'users' || log.resourceType === 'user') {
        // Check for old_data/new_data (used in update operations)
        if (details.old_data && details.old_data.username) {
          return details.old_data.username;
        }
        if (details.new_data && details.new_data.username) {
          return details.new_data.username;
        }
        // Check for user object
        if (details.user && details.user.username) {
          return details.user.username;
        }
        return details.username || details.name || null;
      }
      
      // Host specific handling
      if (log.resourceType === 'hosts' || log.resourceType === 'host') {
        // Check for host_name field (used in host operations)
        if (details.host_name) {
          return details.host_name;
        }
        // Check for old_data/new_data (used in update operations)
        if (details.old_data && details.old_data.name) {
          return details.old_data.name;
        }
        if (details.new_data && details.new_data.name) {
          return details.new_data.name;
        }
        // Check for host object
        if (details.host && details.host.name) {
          return details.host.name;
        }
        return details.name || null;
      }
      
      // Service/Appliance specific handling
      if (log.resourceType === 'appliances' || log.resourceType === 'appliance') {
        // Check for old_data/new_data (used in update operations)
        if (details.old_data && details.old_data.name) {
          return details.old_data.name;
        }
        if (details.new_data && details.new_data.name) {
          return details.new_data.name;
        }
        // Check for service object
        if (details.service && details.service.name) {
          return details.service.name;
        }
        if (details.appliance && details.appliance.name) {
          return details.appliance.name;
        }
        return details.name || details.service_name || details.appliance_name || null;
      }
      
      // SSH Key specific handling
      if (log.resourceType === 'ssh_key') {
        return details.key_name || details.name || null;
      }
      
      // For restore operations, check restored_* fields
      if (log.action.includes('restore')) {
        const restoredName = details.restored_name || details.restored_hostname || details.restored_username || 
                           details.restored_service_name || details.restored_appliance_name || details.name;
        if (restoredName) return restoredName;
      }
      
      // For delete operations, check deleted_* fields
      if (log.action.includes('delete')) {
        const deletedName = details.deleted_name || details.deleted_hostname || details.deleted_username || 
                          details.deleted_service_name || details.deleted_appliance_name || details.name;
        if (deletedName) return deletedName;
      }
      
      // Check for nested data structures
      const nestedObjects = ['old_data', 'new_data', 'deleted_host', 'category', 'service', 'appliance', 'user'];
      for (const objName of nestedObjects) {
        if (details[objName] && typeof details[objName] === 'object') {
          const name = details[objName].name || details[objName].hostname || details[objName].username || 
                      details[objName].service_name || details[objName].appliance_name || details[objName].category_name;
          if (name) return name;
        }
      }
      
      // Generic fallback - check all common name fields
      return details.name || details.service_name || details.appliance_name || details.hostname || 
             details.username || details.key_name || details.category_name || null;
    } catch (e) {
      return null;
    }
  };

  // Check if log can be restored
  const canRestore = (log) => {
    // Deleted actions
    if (log.action === 'appliance_delete' || log.action === 'appliance_deleted') {
      return { canRestore: true, type: 'restore', resourceType: 'appliances' };
    }
    if (log.action === 'category_deleted') {
      return { canRestore: true, type: 'restore', resourceType: 'categories' };
    }
    if (log.action === 'user_delete' || log.action === 'user_deleted') {
      return { canRestore: true, type: 'restore', resourceType: 'users' };
    }
    if (log.action === 'ssh_host_deleted') {
      return { canRestore: true, type: 'restore', resourceType: 'ssh_hosts' };
    }
    if (log.action === 'host_deleted') {
      return { canRestore: true, type: 'restore', resourceType: 'hosts' };
    }

    // Updated actions
    if (log.action === 'appliance_update' || log.action === 'appliance_updated') {
      return { canRestore: true, type: 'revert', resourceType: 'appliances' };
    }
    if (log.action === 'category_updated') {
      return { canRestore: true, type: 'revert', resourceType: 'categories' };
    }
    if (log.action === 'user_update' || log.action === 'user_updated') {
      return { canRestore: true, type: 'revert', resourceType: 'users' };
    }
    if (log.action === 'ssh_host_updated') {
      return { canRestore: true, type: 'revert', resourceType: 'ssh_hosts' };
    }
    if (log.action === 'host_updated') {
      return { canRestore: true, type: 'revert', resourceType: 'hosts' };
    }

    return { canRestore: false };
  };

  // Handle restore
  const handleRestore = async (log) => {
    const restoreInfo = canRestore(log);
    if (!restoreInfo.canRestore) return;

    // Get resource name for confirmation
    let resourceName = '';
    if (log.details) {
      try {
        const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        const resource = details.appliance || details.service || details.category || details.user || details.ssh_host || details.host || details;
        resourceName = resource.name || resource.service_name || resource.appliance_name || resource.username || '';
      } catch (e) {
        console.error('Error parsing details for name:', e);
      }
    }

    const actionText = restoreInfo.type === 'restore' ? 'wiederherstellen' : 'auf Original zurücksetzen';
    const confirmMessage = resourceName 
      ? `Möchten Sie "${resourceName}" wirklich ${actionText}?`
      : `Möchten Sie diesen Eintrag wirklich ${actionText}?`;

    if (!window.confirm(confirmMessage)) {

      return;
    }

    setRestoringLogs(prev => new Set(prev).add(log.id));
    setRestoreResults(prev => ({ ...prev, [log.id]: null }));

    const attemptRestore = async (newName = null) => {
      try {
        let endpoint = '';
        
        // Map resource types to endpoints
        if (restoreInfo.resourceType === 'appliances') {
          endpoint = restoreInfo.type === 'restore' 
            ? `/api/auditRestore/restore/appliances/${log.id}`
            : `/api/auditRestore/revert/appliances/${log.id}`;
        } else if (restoreInfo.resourceType === 'categories') {
          endpoint = restoreInfo.type === 'restore'
            ? `/api/auditRestore/restore/category/${log.id}`
            : `/api/auditRestore/revert/category/${log.id}`;
        } else if (restoreInfo.resourceType === 'users') {
          endpoint = restoreInfo.type === 'restore'
            ? `/api/auditRestore/restore/user/${log.id}`
            : `/api/auditRestore/revert/user/${log.id}`;
        } else if (restoreInfo.resourceType === 'ssh_hosts') {
          endpoint = restoreInfo.type === 'restore'
            ? `/api/auditRestore/restore/ssh_hosts/${log.id}`
            : `/api/auditRestore/revert/ssh_hosts/${log.id}`;
        } else if (restoreInfo.resourceType === 'hosts') {
          endpoint = restoreInfo.type === 'restore'
            ? `/api/auditRestore/restore/hosts/${log.id}`
            : `/api/auditRestore/revert/hosts/${log.id}`;
        }

        // Add new name to request body if provided
        const requestData = newName ? { newName } : {};
        const response = await axios.post(endpoint, requestData);

        if (response.data.success) {
          setRestoreResults(prev => ({
            ...prev,
            [log.id]: { success: true, message: response.data.message || 'Erfolgreich wiederhergestellt' }
          }));
        } else {
          throw new Error(response.data.error || 'Wiederherstellung fehlgeschlagen');
        }
      } catch (error) {
        console.error('Error restoring:', error);
        console.error('Error response:', error.response);
        
        // Check if error is due to name conflict
        if (error.response?.status === 409 || 
            (error.response?.data?.error && error.response.data.error.toLowerCase().includes('already exists'))) {
          
          // Ask for new name
          const newName = window.prompt(
            `Ein Eintrag mit dem Namen "${resourceName}" existiert bereits.\n\nBitte geben Sie einen neuen Namen ein:`,
            resourceName + ' (Kopie)'
          );
          
          if (newName && newName.trim()) {
            // Retry with new name
            await attemptRestore(newName.trim());
          } else {
            setRestoreResults(prev => ({
              ...prev,
              [log.id]: { 
                success: false, 
                message: 'Wiederherstellung abgebrochen' 
              }
            }));
          }
        } else {
          setRestoreResults(prev => ({
            ...prev,
            [log.id]: { 
              success: false, 
              message: error.response?.data?.error || error.message || 'Fehler bei der Wiederherstellung' 
            }
          }));
        }
      }
    };

    try {
      await attemptRestore();
    } finally {
      setRestoringLogs(prev => {
        const newSet = new Set(prev);
        newSet.delete(log.id);
        return newSet;
      });
    }
  };

  // Render details
  const renderDetails = (log) => {
    if (!log.details) {
      return (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Keine Detailinformationen verfügbar
          </Typography>
        </Box>
      );
    }

    const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
    const isJsonView = viewModes[log.id] === 'json';

    // Helper function to render update table
    const renderUpdateTable = (title, changes, oldValues) => {
      return (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            {title}
          </Typography>
          <TableContainer component={Paper} sx={{ 
            backgroundColor: theme.palette.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.03)' 
              : 'rgba(0, 0, 0, 0.02)',
            border: `1px solid ${theme.palette.divider}`,
          }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{
                    color: theme.palette.text.primary,
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(255, 255, 255, 0.05)' 
                      : 'rgba(0, 0, 0, 0.03)',
                  }}>Feldname</TableCell>
                  <TableCell sx={{
                    color: theme.palette.text.primary,
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(255, 255, 255, 0.05)' 
                      : 'rgba(0, 0, 0, 0.03)',
                  }}>Alter Wert</TableCell>
                  <TableCell sx={{
                    color: theme.palette.text.primary,
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(255, 255, 255, 0.05)' 
                      : 'rgba(0, 0, 0, 0.03)',
                  }}>Neuer Wert</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(changes).map(([field, newValue]) => (
                  <TableRow key={field}>
                    <TableCell sx={{ fontWeight: 500, color: theme.palette.text.primary }}>
                      {formatFieldName(field)}
                    </TableCell>
                    <TableCell sx={{ color: 'error.main' }}>
                      {formatFieldValue(oldValues?.[field])}
                    </TableCell>
                    <TableCell sx={{ color: 'success.main' }}>
                      {formatFieldValue(newValue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      );
    };

    // Helper function to render deletion details
    const renderDeletionTable = (title, data) => {
      // Filter out sensitive fields
      const filteredData = Object.entries(data)
        .filter(([key]) => !['password', 'password_hash', 'remote_password', 'rustdesk_password', 
                            'private_key', 'ssh_private_key', 'vnc_password', 'rdp_password'].includes(key));

      return (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'error.main' }}>
            {title}
          </Typography>
          <TableContainer component={Paper} sx={{ 
            backgroundColor: theme.palette.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.03)' 
              : 'rgba(0, 0, 0, 0.02)',
            border: `1px solid ${theme.palette.divider}`,
          }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(255, 255, 255, 0.05)' 
                      : 'rgba(0, 0, 0, 0.03)',
                  }}>Feldname</TableCell>
                  <TableCell sx={{
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(255, 255, 255, 0.05)' 
                      : 'rgba(0, 0, 0, 0.03)',
                  }}>Wert</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData.map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell sx={{ fontWeight: 500, color: theme.palette.text.primary }}>
                      {formatFieldName(key)}
                    </TableCell>
                    <TableCell sx={{ color: theme.palette.text.primary }}>{formatFieldValue(value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      );
    };

    // Format field names for display
    const formatFieldName = (fieldName) => {
      const translations = {
        name: 'Name',
        hostname: 'Hostname',
        ip_address: 'IP-Adresse',
        remote_address: 'Remote-Adresse',
        port: 'Port',
        username: 'Benutzername',
        email: 'E-Mail',
        role: 'Rolle',
        is_active: 'Aktiv',
        use_https: 'HTTPS verwenden',
        remote_desktop_enabled: 'Remote Desktop',
        remote_desktop_type: 'Remote Desktop Typ',
        category_id: 'Kategorie',
        visibility: 'Sichtbarkeit',
        icon: 'Icon',
        description: 'Beschreibung',
        url: 'URL',
        created_at: 'Erstellt am',
        updated_at: 'Aktualisiert am',
        last_used: 'Zuletzt verwendet',
        display_name: 'Anzeigename',
        vnc_enabled: 'VNC aktiviert',
        rdp_enabled: 'RDP aktiviert',
        ssh_enabled: 'SSH aktiviert',
      };
      return translations[fieldName] || fieldName;
    };

    // Format field values for display
    const formatFieldValue = (value) => {
      if (value === null || value === undefined) return '-';
      
      // Handle boolean values (including 0/1 from database)
      if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
      if (value === 1 || value === '1' || value === true) return 'Ja';
      if (value === 0 || value === '0' || value === false) return 'Nein';
      
      // Handle objects and arrays
      if (typeof value === 'object') {
        // Check if it's an array
        if (Array.isArray(value)) {
          return value.map(item => {
            if (typeof item === 'object') {
              return JSON.stringify(item, null, 2);
            }
            return item;
          }).join(', ');
        }
        
        // For objects, check if it's already a parsed changes object
        if (value.old !== undefined && value.new !== undefined) {
          return `${value.old} → ${value.new}`;
        }
        
        // For other objects, return formatted JSON
        return JSON.stringify(value, null, 2);
      }
      
      return value;
    };

    // Handle different action types
    // Updates (appliance, host, user, category)
    if (log.action.includes('_update') || log.action.includes('_updated')) {
      if (details.changes || details.old_data) {
        let changes = {};
        let oldValues = {};
        
        // Check if changes already contain old/new structure (like in host_update)
        if (details.changes && typeof details.changes === 'object') {
          const firstKey = Object.keys(details.changes)[0];
          if (firstKey && details.changes[firstKey] && 
              typeof details.changes[firstKey] === 'object' && 
              'old' in details.changes[firstKey] && 
              'new' in details.changes[firstKey]) {
            // Extract old and new values from structured changes
            Object.entries(details.changes).forEach(([field, change]) => {
              if (typeof change === 'object' && change.old !== undefined && change.new !== undefined) {
                oldValues[field] = change.old;
                changes[field] = change.new;
              } else {
                changes[field] = change;
              }
            });
          } else {
            // Use changes as is
            changes = details.changes;
            oldValues = details.oldValues || details.old_data || {};
          }
        } else if (details.old_data && details.new_data) {
          changes = details.new_data;
          oldValues = details.old_data;
        } else {
          changes = details.changes || details.new_data || {};
          oldValues = details.oldValues || details.old_data || {};
        }
        
        return (
          <>
            {renderUpdateTable('Geänderte Felder', changes, oldValues)}
            {/* Restore button for updates */}
            {canRestore(log).canRestore && (
              <Box sx={{ mt: 2 }}>
                <Button
                  startIcon={<History size={16} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRestore(log);
                  }}
                  disabled={restoringLogs.has(log.id)}
                  sx={{
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(34, 197, 94, 0.2)' 
                      : 'rgba(34, 197, 94, 0.15)',
                    color: theme.palette.mode === 'dark' ? '#86efac' : '#22c55e',
                    border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(134, 239, 172, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                    '&:hover': {
                      backgroundColor: theme.palette.mode === 'dark' 
                        ? 'rgba(34, 197, 94, 0.3)' 
                        : 'rgba(34, 197, 94, 0.25)',
                    },
                  }}
                >
                  {restoringLogs.has(log.id) ? 'Wird zurückgesetzt...' : 'Änderungen zurücksetzen'}
                </Button>
              </Box>
            )}
          </>
        );
      }
    }

    // Deletions (appliance, host, user, category)
    if (log.action.includes('_delete') || log.action.includes('_deleted')) {
      const title = log.action.includes('appliance') ? 'Gelöschte Appliance-Details' :
                    log.action.includes('host') ? 'Gelöschte Host-Details' :
                    log.action.includes('user') ? 'Gelöschte Benutzer-Details' :
                    log.action.includes('category') ? 'Gelöschte Kategorie-Details' :
                    'Gelöschte Details';
      return (
        <>
          {renderDeletionTable(title, details)}
          {/* Restore button for deletions */}
          {canRestore(log).canRestore && (
            <Box sx={{ mt: 2 }}>
              <Button
                startIcon={<RefreshCw size={16} />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRestore(log);
                }}
                disabled={restoringLogs.has(log.id)}
                sx={{
                  backgroundColor: theme.palette.mode === 'dark' 
                    ? 'rgba(34, 197, 94, 0.2)' 
                    : 'rgba(34, 197, 94, 0.15)',
                  color: theme.palette.mode === 'dark' ? '#86efac' : '#22c55e',
                  border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(134, 239, 172, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                  '&:hover': {
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(34, 197, 94, 0.3)' 
                      : 'rgba(34, 197, 94, 0.25)',
                  },
                }}
              >
                {restoringLogs.has(log.id) ? 'Wird wiederhergestellt...' : 'Wiederherstellen'}
              </Button>
            </Box>
          )}
        </>
      );
    }

    // Special rendering for SSH file upload
    if (log.action === 'ssh_file_upload' && details.files) {
      return (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Upload Details
          </Typography>
          
          {/* Host information */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Host:</strong> {details.hostname || details.host_ip}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Zielverzeichnis:</strong> {details.target_path}
            </Typography>
          </Box>

          {/* Files table */}
          <TableContainer component={Paper} sx={{ backgroundColor: 'transparent' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: theme.palette.text.primary }}>Name</TableCell>
                  <TableCell align="right" sx={{ color: theme.palette.text.primary }}>Anzahl Bytes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {details.files.map((file, index) => (
                  <TableRow key={index}>
                    <TableCell sx={{ color: theme.palette.text.primary }}>{file.name}</TableCell>
                    <TableCell align="right" sx={{ color: theme.palette.text.primary }}>
                      {file.bytes.toLocaleString('de-DE')} Bytes
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      );
    }

    if (isJsonView) {
      return (
        <Box
          component="pre"
          sx={{
            p: 2,
            backgroundColor: theme.palette.mode === 'dark' 
              ? 'rgba(0, 0, 0, 0.3)' 
              : 'rgba(0, 0, 0, 0.05)',
            borderRadius: 1,
            fontSize: '12px',
            overflow: 'auto',
            maxHeight: '400px',
          }}
        >
          {JSON.stringify(details, null, 2)}
        </Box>
      );
    }

    // Formatted view
    const categorizedDetails = {
      primary: {},
      user: {},
      technical: {},
      other: {},
    };

    Object.entries(details).forEach(([key, value]) => {
      if (['fields_updated', 'original_data', 'new_data', 'changes'].includes(key)) {
        return;
      }

      if (['name', 'command_description', 'service_name', 'appliance_name'].includes(key)) {
        categorizedDetails.primary[key] = value;
      } else if (key.includes('user') || key.includes('_by')) {
        categorizedDetails.user[key] = value;
      } else if (key.includes('ssh') || key.includes('executed') || key === 'ip_address' || 
                 key === 'command' || key === 'output' || key === 'error') {
        categorizedDetails.technical[key] = value;
      } else {
        categorizedDetails.other[key] = value;
      }
    });

    const renderDetailSection = (title, icon, detailsObj) => {
      if (Object.keys(detailsObj).length === 0) return null;

      const Icon = icon;
      return (
        <Box sx={{ mb: 3 }}>
          <Typography 
            variant="h6" 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1, 
              mb: 2,
              fontWeight: 600,
            }}
          >
            <Icon size={18} />
            {title}
          </Typography>
          <TableContainer component={Paper} sx={{ 
            backgroundColor: theme.palette.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.03)' 
              : 'rgba(0, 0, 0, 0.02)',
            border: `1px solid ${theme.palette.divider}`,
          }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ 
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(255, 255, 255, 0.05)' 
                      : 'rgba(0, 0, 0, 0.03)',
                  }}>Feldname</TableCell>
                  <TableCell sx={{ 
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(255, 255, 255, 0.05)' 
                      : 'rgba(0, 0, 0, 0.03)',
                  }}>Wert</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(detailsObj).map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell sx={{ 
                      fontWeight: 500,
                      color: theme.palette.text.secondary,
                    }}>
                      {formatFieldName(key)}
                    </TableCell>
                    <TableCell sx={{
                      color: theme.palette.text.primary,
                    }}>
                      {formatValue(key, value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      );
    };

    // Render fields_updated if available
    const renderFieldsUpdated = () => {
      if (!details.fields_updated || !Array.isArray(details.fields_updated) || 
          !details.original_data || !details.new_data) {
        return null;
      }

      const changedFields = details.fields_updated.filter(field => {
        const oldValue = details.original_data[field];
        const newValue = details.new_data[field];
        return String(oldValue || '') !== String(newValue || '');
      });

      if (changedFields.length === 0) return null;

      return (
        <Box 
          sx={{ 
            mb: 2, 
            p: 2, 
            backgroundColor: alpha(theme.palette.warning.main, 0.1),
            borderRadius: 1,
            border: 1,
            borderColor: alpha(theme.palette.warning.main, 0.3),
          }}
        >
          <Typography 
            variant="subtitle2" 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1, 
              mb: 1,
              fontWeight: 600,
            }}
          >
            <RefreshCw size={16} />
            Aktualisierte Felder
          </Typography>
          {changedFields.map(field => (
            <Box key={field} sx={{ mb: 1 }}>
              <Typography variant="body2" fontWeight={600}>
                {formatFieldName(field)}:
              </Typography>
              <Box sx={{ pl: 2 }}>
                <Typography variant="body2" color="error.main">
                  Alt: {formatValue(field, details.original_data[field])}
                </Typography>
                <Typography variant="body2" color="success.main">
                  Neu: {formatValue(field, details.new_data[field])}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      );
    };

    return (
      <Box sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          {/* Restore button if applicable */}
          {canRestore(log).canRestore && (
            <Box>
              {restoreResults[log.id] ? (
                <Alert 
                  severity={restoreResults[log.id].success ? 'success' : 'error'}
                  sx={{ py: 0.5, px: 2 }}
                >
                  {restoreResults[log.id].message}
                </Alert>
              ) : (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={restoringLogs.has(log.id) ? <CircularProgress size={16} /> : <RotateCcw size={16} />}
                  onClick={(e) => {
                    e.stopPropagation();

                    handleRestore(log);
                  }}
                  disabled={restoringLogs.has(log.id)}
                  sx={{
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(34, 197, 94, 0.2)' 
                      : 'rgba(34, 197, 94, 0.15)',
                    color: theme.palette.mode === 'dark' ? '#86efac' : '#22c55e',
                    border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(134, 239, 172, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                    '&:hover': {
                      backgroundColor: theme.palette.mode === 'dark' 
                        ? 'rgba(34, 197, 94, 0.3)' 
                        : 'rgba(34, 197, 94, 0.25)',
                    },
                    '&:disabled': {
                      opacity: 0.7,
                    },
                  }}
                >
                  {restoringLogs.has(log.id) ? 'Wird wiederhergestellt...' : 'Original wiederherstellen'}
                </Button>
              )}
            </Box>
          )}
          
          {/* View toggle button */}
          <Button
            size="small"
            startIcon={isJsonView ? <Eye size={16} /> : <Code size={16} />}
            onClick={() => toggleViewMode(log.id)}
            sx={{ ml: 'auto' }}
          >
            {isJsonView ? 'Formatiert' : 'JSON'}
          </Button>
        </Stack>

        {renderFieldsUpdated()}

        {renderDetailSection('Hauptinformationen', FileText, categorizedDetails.primary)}
        {renderDetailSection('Benutzerinformationen', User, categorizedDetails.user)}
        {renderDetailSection('Technische Details', Terminal, categorizedDetails.technical)}
        {renderDetailSection('Weitere Details', FileText, categorizedDetails.other)}
      </Box>
    );
  };

  // Widget view for narrow screens
  if (useWidgetView) {
    return (
      <Box ref={containerRef} sx={{ backgroundColor: 'transparent' }}>
        <Stack spacing={0.5} sx={{ p: 1 }}>
          {logs.map(log => {
            const isExpanded = expandedRows.has(log.id);
            const resourceName = getResourceName(log);
            const resourceDisplay = log.resourceName || resourceName || 
              (log.resourceType && log.resourceId 
                ? `${formatResourceType(log.resourceType)} #${log.resourceId}` 
                : formatResourceType(log.resourceType));

            return (
              <Box
                key={log.id}
                sx={{
                  backgroundColor: getRowBackgroundColor(log.action),
                  borderRadius: 1,
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.action.hover, 0.1),
                  },
                }}
              >
                <Box
                  onClick={() => onToggleExpand(log.id)}
                  sx={{
                    p: 1.5,
                    cursor: 'pointer',
                  }}
                >
                  {/* Compact header row */}
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: '80px' }}>
                      {formatTimestamp(log.createdAt)}
                    </Typography>
                    <Chip
                      icon={getActionIcon(log.action)}
                      label={formatActionName(log.action)}
                      size="small"
                      color={getActionColor(log.action)}
                      variant="outlined"
                      sx={{ height: '24px' }}
                    />
                    <Box sx={{ flexGrow: 1 }} />
                    <IconButton size="small" sx={{ p: 0.5 }}>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </IconButton>
                  </Stack>

                  {/* User and resource row */}
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <User size={12} style={{ opacity: 0.6 }} />
                      <Typography variant="caption">
                        {log.username || 'System'}
                      </Typography>
                    </Stack>
                    
                    {resourceDisplay !== '-' && (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Server size={12} style={{ opacity: 0.6 }} />
                        <Typography variant="caption" sx={{ wordBreak: 'break-word' }}>
                          {resourceDisplay}
                        </Typography>
                      </Stack>
                    )}

                    {log.ipAddress && (
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ ml: 'auto' }}>
                        <Globe size={12} style={{ opacity: 0.6 }} />
                        <Typography variant="caption" color="text.secondary">
                          {log.ipAddress}
                        </Typography>
                      </Stack>
                    )}
                  </Stack>
                </Box>

                {/* Expanded details */}
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box sx={{ 
                    p: 2, 
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(255, 255, 255, 0.05)' 
                      : 'rgba(0, 0, 0, 0.02)',
                    color: theme.palette.text.primary
                  }}>
                    <Divider sx={{ mb: 2, opacity: 0.3 }} />
                    {renderDetails(log)}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Stack>
      </Box>
    );
  }

  // Regular table view
  return (
    <Box ref={containerRef}>
      <TableContainer 
        sx={{ 
          backgroundColor: 'transparent',
          boxShadow: 'none',
          '& .MuiTable-root': {
            backgroundColor: 'transparent',
          },
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell 
                width="40px" 
                sx={{ 
                  backgroundColor: theme.palette.mode === 'dark'
                    ? 'rgba(50, 50, 60, 0.2)'
                    : 'rgba(200, 200, 210, 0.4)',
                  borderBottom: `1px solid ${theme.palette.mode === 'dark' 
                    ? 'rgba(255, 255, 255, 0.08)' 
                    : 'rgba(0, 0, 0, 0.08)'}`,
                }}
              />
              <TableCell
                sx={headerCellStyle}
              >
                Zeit
              </TableCell>
              <TableCell
                sx={headerCellStyle}
              >
                Benutzer
              </TableCell>
              <TableCell
                sx={headerCellStyle}
              >
                Aktion
              </TableCell>
              <TableCell
                sx={headerCellStyle}
              >
                Ressource
              </TableCell>
              <TableCell
                sx={headerCellStyle}
              >
                IP-Adresse
              </TableCell>
              <TableCell
                sx={headerCellStyle}
                align="center"
              >
                Aktionen
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map(log => {
              const isExpanded = expandedRows.has(log.id);
              const resourceName = getResourceName(log);
              const resourceDisplay = log.resourceName || resourceName || 
                (log.resourceType && log.resourceId 
                  ? `${formatResourceType(log.resourceType)} #${log.resourceId}` 
                  : formatResourceType(log.resourceType));

              return (
                <React.Fragment key={log.id}>
                  <TableRow 
                    hover
                    sx={{ 
                      '& > *': { borderBottom: 'unset' },
                      cursor: 'pointer',
                      backgroundColor: getRowBackgroundColor(log.action),
                      '&:hover': {
                        backgroundColor: theme.palette.mode === 'dark'
                          ? alpha(theme.palette.action.hover, 0.2)
                          : alpha(theme.palette.action.hover, 0.15),
                      },
                      transition: 'background-color 0.2s ease',
                    }}
                    onClick={() => {
                      onToggleExpand(log.id);
                    }}
                  >
                    <TableCell>
                      <IconButton size="small">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>
                        {formatTimestamp(log.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {log.username || 'System'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getActionIcon(log.action)}
                        label={formatActionName(log.action)}
                        size="small"
                        color={getActionColor(log.action)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>
                        {resourceDisplay}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {log.ipAddress || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Details anzeigen">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(log);
                          }}
                          sx={{
                            color: theme.palette.primary.main,
                          }}
                        >
                          <Eye size={16} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ 
                          p: 2,
                          backgroundColor: theme.palette.mode === 'dark' 
                            ? 'rgba(255, 255, 255, 0.05)' 
                            : 'rgba(0, 0, 0, 0.02)',
                          color: theme.palette.text.primary
                        }}>
                          {renderDetails(log)}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={handleCloseDetail}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.mode === 'dark' 
              ? 'rgba(30, 30, 40, 0.95)' 
              : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <Typography variant="h6">Audit-Log Details</Typography>
          <IconButton
            edge="end"
            color="inherit"
            onClick={handleCloseDetail}
            aria-label="close"
          >
            <X />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedLogEntry && (
            <AuditLogDetail
              entry={selectedLogEntry}
              onClose={handleCloseDetail}
              onRestore={handleDetailRestore}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default AuditLogTableMUI;
