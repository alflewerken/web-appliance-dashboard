import React, { useState } from 'react';
import {
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  Code,
  Eye,
  Server,
  Shield,
  Terminal,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Database,
  Key,
  HardDrive,
  Globe,
  Clock,
  Hash,
  FileText,
  Layers,
  RefreshCw,
  History,
  Trash2,
  Info,
  GitBranch,
} from 'lucide-react';
import axios from '../../utils/axiosConfig';

const AuditLogTable = ({
  filteredLogs,
  getActionColor,
  formatTimestamp,
  formatActionName,
  getActionIcon,
  expandedRows,
  toggleRowExpansion,
  onRefresh,
  isCompactView = false,
  onSSHHostRestore,
  onSSHHostRevert,
}) => {
  // State für die Ansichtsumschaltung pro Zeile
  const [viewModes, setViewModes] = useState({});
  const [restoringLogs, setRestoringLogs] = useState(new Set());
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = React.useRef(null);

  // Überwache die Container-Breite
  React.useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);

    // Beobachte auch Änderungen am Container
    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateWidth);
      resizeObserver.disconnect();
    };
  }, []);

  // Bestimme, ob wir in den kompakten Modus wechseln sollten
  const shouldUseCompactView = containerWidth < 800 || isCompactView;

  // CSS für die Spin-Animation
  const spinStyle = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    .spin-animation {
      animation: spin 1s linear infinite;
      display: inline-block;
    }
  `;

  // Füge die Styles zum Document Head hinzu
  React.useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = spinStyle;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Toggle zwischen JSON und formatierter Ansicht
  const toggleViewMode = logId => {
    setViewModes(prev => ({
      ...prev,
      [logId]: prev[logId] === 'formatted' ? 'json' : 'formatted',
    }));
  };

  // Handler für direkte Wiederherstellung
  const handleDirectRestore = async log => {
    const confirmMessage = log.action.includes('delete')
      ? 'Möchten Sie diesen gelöschten Eintrag wiederherstellen?'
      : 'Möchten Sie die Originaldaten wiederherstellen?';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setRestoringLogs(prev => new Set(prev).add(log.id));

    try {
      let endpoint = '';

      // Determine endpoint based on resource type and action
      if (log.action.includes('delete')) {
        // For deletions, use the appropriate restore endpoint based on resource type
        switch (log.resourceType) {
          case 'appliances':
            endpoint = `/api/auditRestore/restore/appliances/${log.id}`;
            break;
          case 'users':
            endpoint = `/api/auditRestore/restore/users/${log.id}`;
            break;
          case 'categories':
            endpoint = `/api/auditRestore/restore/category/${log.id}`;
            break;
          case 'ssh_host':
            endpoint = `/api/auditRestore/restore/ssh_hosts/${log.id}`;
            break;
          case 'hosts':
            endpoint = `/api/auditRestore/restore/hosts/${log.id}`;
            break;
          default:
            throw new Error(
              `Restore not supported for resource type: ${log.resource_type}`
            );
        }
      } else if (
        log.action.includes('update') ||
        log.action.includes('reverted')
      ) {
        // For updates/reverts, use the appropriate revert endpoint based on resource type
        switch (log.resourceType) {
          case 'appliances':
            endpoint = `/api/auditRestore/revert/appliances/${log.id}`;
            break;
          case 'users':
            endpoint = `/api/auditRestore/revert/users/${log.id}`;
            break;
          case 'categories':
            endpoint = `/api/auditRestore/revert/category/${log.id}`;
            break;
          case 'ssh_host':
            endpoint = `/api/auditRestore/revert/ssh_hosts/${log.id}`;
            break;
          case 'hosts':
            endpoint = `/api/auditRestore/revert/hosts/${log.id}`;
            break;
          default:
            throw new Error(
              `Revert not supported for resource type: ${log.resource_type}`
            );
        }
      }

      const response = await axios.post(
        endpoint,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (response.data.success) {
        const message =
          response.data.message || 'Erfolgreich wiederhergestellt';

        if (window.showNotification) {
          window.showNotification(message, 'success');
        }

        if (onRefresh) {
          onRefresh();
        }
      }
    } catch (error) {
      console.error('Error restoring:', error);
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        'Fehler beim Wiederherstellen';

      if (window.showNotification) {
        window.showNotification(errorMessage, 'error');
      }
    } finally {
      setRestoringLogs(prev => {
        const newSet = new Set(prev);
        newSet.delete(log.id);
        return newSet;
      });
    }
  };

  // Formatierte Details-Komponente
  const FormattedDetails = ({ details, action, logId, resourceId }) => {
    const detailsObj =
      typeof details === 'string' ? JSON.parse(details) : details;

    // Debug logging für SSH host updates
    if (action === 'ssh_host_updated' || action === 'ssh_host_update') {
      }

    // REMOVED: Local handleRestore function - now using the modal for all restore operations

    // Icon-Zuordnung für verschiedene Detail-Typen
    const getDetailIcon = key => {
      const iconMap = {
        name: FileText,
        appliance_name: Server,
        service_name: Server,
        command: Terminal,
        command_description: Terminal,
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
        appliances_count: Database,
        categories_count: Database,
        users_count: User,
        ssh_keys_count: Key,
      };

      return iconMap[key] || FileText;
    };

    // Formatiere Feldnamen für bessere Lesbarkeit
    const formatFieldName = key => {
      const translations = {
        name: 'Name',
        appliance_name: 'Service Name',
        service_name: 'Service Name',
        applianceName: 'Service Name',
        command: 'Befehl',
        command_description: 'Befehlsbeschreibung',
        output: 'Ausgabe',
        stderr: 'Fehlerausgabe',
        stdout: 'Standardausgabe',
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
        appliances_count: 'Anzahl Services',
        categories_count: 'Anzahl Kategorien',
        users_count: 'Anzahl Benutzer',
        ssh_keys_count: 'Anzahl SSH-Schlüssel',
        backup_created_at: 'Backup erstellt am',
        sessionId: 'Session ID',
        session_id: 'Session ID',
        appliance_id: 'Service ID',
        changes: 'Änderungen',
        stdout: 'Standard-Ausgabe',
        previous_value: 'Vorheriger Wert',
        new_value: 'Neuer Wert',
        // Diese werden in der kompakten Ansicht nicht als Labels angezeigt
        action: '',
        resource: '',
        // Neue Übersetzungen für revert-bezogene Felder
        original_data: 'Originaldaten',
        new_data: 'Neue Daten',
        reverted_from_log_id: 'Wiederhergestellt von Log ID',
        fields_updated: 'Aktualisierte Felder',
        reverted_by: 'Wiederhergestellt von',
        note: 'Notiz',
        // Benutzer-spezifische Felder
        role: 'Rolle',
        is_active: 'Status',
        email: 'E-Mail',
        password: 'Passwort',
      };

      return (
        translations[key] ||
        key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      );
    };

    // Formatiere Werte für bessere Lesbarkeit
    const formatValue = (key, value) => {
      // Spezielle Behandlung für Benutzernamen-Felder
      if (
        (key === 'username' ||
          key === 'created_by' ||
          key === 'updated_by' ||
          key === 'deleted_by') &&
        value
      ) {
        // Wenn der Wert wie "user #X" aussieht, ersetze ihn durch einen besseren Wert
        if (value.match(/^user #\d+$/)) {
          return 'Unbekannter Benutzer';
        }
        return value;
      }

      // Benutzerrollen
      if (key === 'role') {
        const roleMap = {
          admin: '👨‍💼 Administrator',
          user: '👤 Benutzer',
        };
        return roleMap[value] || value;
      }

      // Aktiv-Status
      if (key === 'is_active') {
        return value === 1 || value === true ? '✅ Aktiv' : '❌ Inaktiv';
      }

      // Passwort-Felder
      if (key === 'password' || key === 'password_hash') {
        if (value === '(geändert)') {
          return (
            <span
              style={{
                color: 'rgba(250, 204, 21, 0.9)',
                fontStyle: 'italic',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Key size={14} />
              Passwort wurde geändert
            </span>
          );
        }
        return '••••••••';
      }

      // Zeitstempel formatieren
      if (
        key === 'created_at' ||
        key === 'timestamp' ||
        key === 'backup_created_at' ||
        key.endsWith('_at')
      ) {
        const date = new Date(value);
        return date.toLocaleString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      }

      // Ausgabelänge
      if (key === 'output_length') {
        return `${value.toLocaleString('de-DE')} Zeichen`;
      }

      // Boolean-Werte
      if (key === 'success' || key === 'failed' || typeof value === 'boolean') {
        return value ? '✅ Ja' : '❌ Nein';
      }

      // Exit Codes
      if (key === 'exit_code') {
        return value === 0 ? '✅ 0 (Erfolgreich)' : `❌ ${value} (Fehler)`;
      }

      // SSH Verbindungen
      if (key === 'executed_on' && value.includes('@')) {
        const [userHost, port] = value.split(':');
        return `${userHost} (Port ${port || '22'})`;
      }

      // Große Textblöcke (stdout, stderr, output, error messages, command)
      if (
        (key === 'stdout' ||
          key === 'stderr' ||
          key === 'output' ||
          key === 'error' ||
          key === 'command') &&
        value &&
        value.length > 100
      ) {
        const isError = key === 'error' || key === 'stderr';
        const lineCount = value.split('\n').length;
        return (
          <details style={{ cursor: 'pointer' }}>
            <summary
              style={{
                color: isError
                  ? 'rgba(239, 68, 68, 0.8)'
                  : 'rgba(46, 160, 67, 0.8)',
                marginBottom: '4px',
              }}
            >
              Klicken zum Anzeigen ({value.length} Zeichen, {lineCount} Zeilen)
            </summary>
            <pre
              style={{
                marginTop: '8px',
                padding: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '4px',
                fontSize: '11px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '400px',
                overflow: 'auto',
                border: isError
                  ? '1px solid rgba(239, 68, 68, 0.3)'
                  : '1px solid rgba(46, 160, 67, 0.3)',
              }}
            >
              {value}
            </pre>
          </details>
        );
      }

      // Kurze Befehle oder Ausgaben direkt anzeigen
      if (
        (key === 'command' || key === 'output') &&
        value &&
        value.length <= 100
      ) {
        return (
          <code
            style={{
              padding: '2px 6px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '4px',
              fontSize: '12px',
              fontFamily: 'monospace',
              color: 'rgba(46, 160, 67, 0.9)',
            }}
          >
            {value}
          </code>
        );
      }

      // Objekte und Arrays
      if (typeof value === 'object' && value !== null) {
        // Arrays als Liste darstellen
        if (Array.isArray(value)) {
          return (
            <ul
              style={{
                margin: 0,
                padding: '0 0 0 20px',
                listStyleType: 'disc',
              }}
            >
              {value.map((item, index) => (
                <li key={index} style={{ marginBottom: '4px' }}>
                  {typeof item === 'object'
                    ? JSON.stringify(item, null, 2)
                    : item}
                </li>
              ))}
            </ul>
          );
        }

        // Objekte als Tabelle darstellen
        return (
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '4px',
              padding: '4px',
              marginTop: '4px',
              width: '100%',
            }}
          >
            {Object.entries(value).map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  padding: '2px 0',
                }}
              >
                <div
                  style={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontWeight: '500',
                    fontSize: '11px',
                    paddingRight: '8px',
                    flexShrink: 0,
                    minWidth: 'fit-content',
                  }}
                >
                  {formatFieldName(k)}:
                </div>
                <div
                  style={{
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: '11px',
                    wordBreak: 'break-word',
                    flex: 1,
                  }}
                >
                  {typeof v === 'object' ? (
                    <pre
                      style={{
                        margin: 0,
                        padding: '4px',
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '3px',
                        fontSize: '10px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontFamily: 'monospace',
                        lineHeight: '1.3',
                      }}
                    >
                      {JSON.stringify(v, null, 2)}
                    </pre>
                  ) : (
                    v || '-'
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      }

      // Standard-Werte
      return value || '-';
    };

    // Gruppiere Details nach Kategorien
    const categorizedDetails = {
      primary: {},
      user: {},
      technical: {},
      stats: {},
      other: {},
    };

    Object.entries(detailsObj).forEach(([key, value]) => {
      // fields_updated, original_data, new_data, changes und action_type werden separat behandelt
      if (
        [
          'fields_updated',
          'original_data',
          'new_data',
          'changes',
          'action_type',
        ].includes(key)
      ) {
        return;
      }

      // Bei SSH host updates, old_data und new_data nicht in die normale Kategorisierung aufnehmen
      if (
        (action === 'ssh_host_update' || action === 'ssh_host_updated') &&
        ['old_data', 'new_data'].includes(key)
      ) {
        return;
      }

      // Username wird bei user-actions separat angezeigt
      if (
        key === 'username' &&
        [
          'user_updated',
          'user_activated',
          'user_deactivated',
          'user_deleted',
          'user_created',
        ].includes(action)
      ) {
        return;
      }

      if (
        [
          'name',
          'command_description',
          'service_name',
          'appliance_name',
          'applianceName',
        ].includes(key)
      ) {
        categorizedDetails.primary[key] = value;
      } else if (
        key.includes('user') ||
        key.includes('_by') ||
        key === 'username'
      ) {
        categorizedDetails.user[key] = value;
      } else if (
        key.includes('ssh') ||
        key.includes('executed') ||
        key.includes('host') ||
        key === 'ip_address'
      ) {
        categorizedDetails.technical[key] = value;
      } else if (
        key === 'command' ||
        key === 'output' ||
        key === 'stdout' ||
        key === 'stderr' ||
        key === 'error'
      ) {
        categorizedDetails.technical[key] = value;
      } else if (
        key.includes('count') ||
        key === 'output_length' ||
        key === 'exit_code'
      ) {
        categorizedDetails.stats[key] = value;
      } else {
        categorizedDetails.other[key] = value;
      }
    });

    const detailCardStyle = {
      marginBottom: '16px',
      padding: '12px',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      width: '100%',
      boxSizing: 'border-box',
    };

    const detailGroupStyle = {
      marginBottom: '16px',
    };

    const detailRowStyle = {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      marginBottom: '8px',
      padding: '8px',
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      borderRadius: '6px',
      width: '100%',
      boxSizing: 'border-box',
    };

    const labelStyle = {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '13px',
      color: 'rgba(255, 255, 255, 0.6)',
      fontWeight: '500',
      flexShrink: 0,
      whiteSpace: 'nowrap',
    };

    const valueStyle = {
      flex: 1,
      fontSize: '13px',
      color: 'rgba(255, 255, 255, 0.9)',
      wordBreak: 'break-word',
    };

    const sectionTitleStyle = {
      fontSize: '14px',
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.8)',
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '6px',
      borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
    };

    const renderDetailGroup = (title, icon, details) => {
      if (Object.keys(details).length === 0) return null;

      const Icon = icon;
      return (
        <div style={detailGroupStyle}>
          <div style={sectionTitleStyle}>
            <Icon size={16} />
            {title}
          </div>
          <div style={{ width: '100%' }}>
            {Object.entries(details).map(([key, value]) => {
              const DetailIcon = getDetailIcon(key);

              // Spezielle Behandlung für nested objects wie original_data, new_data
              if (
                (key === 'original_data' || key === 'new_data') &&
                typeof value === 'object'
              ) {
                return (
                  <div key={key} style={{ marginBottom: '12px' }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: 'rgba(255, 255, 255, 0.7)',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <DetailIcon size={14} />
                      {formatFieldName(key)}
                    </div>
                    <div
                      style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '6px',
                        padding: '8px',
                        width: '100%',
                      }}
                    >
                      {formatValue(key, value)}
                    </div>
                  </div>
                );
              }

              return (
                <div key={key} style={detailRowStyle}>
                  {formatFieldName(key) && (
                    <div style={labelStyle}>
                      <DetailIcon size={14} />
                      {formatFieldName(key)}:
                    </div>
                  )}
                  <div style={valueStyle}>{formatValue(key, value)}</div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div style={detailCardStyle}>
        {/* Restore buttons removed - now handled via the modal */}

        {/* Spezielle Anzeige für user_updated - zeige betroffenen Benutzer */}
        {(action === 'user_updated' ||
          action === 'user_activated' ||
          action === 'user_deactivated' ||
          action === 'user_deleted' ||
          action === 'user_created') &&
          detailsObj.username && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                borderRadius: '8px',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <User size={20} style={{ color: 'rgba(59, 130, 246, 0.8)' }} />
              <div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.6)',
                    marginBottom: '2px',
                  }}
                >
                  {action === 'user_created'
                    ? 'Erstellter Benutzer'
                    : action === 'user_deleted'
                      ? 'Gelöschter Benutzer'
                      : 'Betroffener Benutzer'}
                </div>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: 'rgba(255, 255, 255, 0.9)',
                  }}
                >
                  {detailsObj.username}
                </div>
              </div>
            </div>
          )}

        {/* Aktualisierte Felder zuerst anzeigen, wenn verfügbar */}
        {detailsObj.fields_updated &&
          Array.isArray(detailsObj.fields_updated) &&
          detailsObj.fields_updated.length > 0 &&
          detailsObj.original_data &&
          detailsObj.new_data &&
          (() => {
            // Filtere nur die Felder, die sich tatsächlich geändert haben
            const changedFields = detailsObj.fields_updated.filter(field => {
              const oldValue = detailsObj.original_data[field];
              const newValue = detailsObj.new_data[field];

              // Konvertiere beide Werte zu Strings für konsistenten Vergleich
              const oldStr =
                oldValue === null || oldValue === undefined
                  ? ''
                  : String(oldValue);
              const newStr =
                newValue === null || newValue === undefined
                  ? ''
                  : String(newValue);

              return oldStr !== newStr;
            });

            // Zeige den Bereich nur an, wenn es tatsächlich Änderungen gibt
            if (changedFields.length === 0) return null;

            return (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: 'rgba(250, 204, 21, 0.15)',
                  borderRadius: '8px',
                  border: '1px solid rgba(250, 204, 21, 0.2)',
                }}
              >
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'rgba(255, 255, 255, 0.8)',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <RefreshCw size={16} />
                  Aktualisierte Felder
                </div>
                {changedFields.map(field => {
                  const oldValue = detailsObj.original_data[field];
                  const newValue = detailsObj.new_data[field];

                  return (
                    <div
                      key={field}
                      style={{
                        marginBottom: '8px',
                        padding: '8px',
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '6px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          color: 'rgba(255, 255, 255, 0.7)',
                          marginBottom: '4px',
                        }}
                      >
                        {formatFieldName(field)}:
                      </div>
                      <div style={{ fontSize: '12px', marginBottom: '2px' }}>
                        <span style={{ color: 'rgba(239, 68, 68, 0.8)' }}>
                          Alt:
                        </span>{' '}
                        {field === 'password'
                          ? '••••••••'
                          : formatValue(field, oldValue)}
                      </div>
                      <div style={{ fontSize: '12px' }}>
                        <span style={{ color: 'rgba(46, 160, 67, 0.8)' }}>
                          Neu:
                        </span>{' '}
                        {formatValue(field, newValue)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

        {/* Show changes if available */}
        {detailsObj.changes && Object.keys(detailsObj.changes).length > 0 && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: 'rgba(255, 193, 7, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 193, 7, 0.3)',
            }}
          >
            <div
              style={{
                fontSize: '14px',
                fontWeight: '600',
                color: 'rgba(255, 255, 255, 0.8)',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <History size={16} />
              Änderungen
            </div>
            {Object.entries(detailsObj.changes).map(([field, change]) => (
              <div
                key={field}
                style={{
                  marginBottom: '8px',
                  padding: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              >
                <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                  {formatFieldName(field)}:
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <span
                      style={{
                        color: 'rgba(239, 68, 68, 0.8)',
                        fontSize: '12px',
                      }}
                    >
                      Vorher:
                    </span>
                    <div style={{ marginTop: '2px' }}>
                      {formatValue(field, change.old)}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span
                      style={{
                        color: 'rgba(46, 160, 67, 0.8)',
                        fontSize: '12px',
                      }}
                    >
                      Nachher:
                    </span>
                    <div style={{ marginTop: '2px' }}>
                      {formatValue(field, change.new)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Special handling for SSH host updates with old_data and new_data */}
        {(action === 'ssh_host_update' || action === 'ssh_host_updated') &&
          detailsObj.old_data &&
          detailsObj.new_data && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: 'rgba(255, 193, 7, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 193, 7, 0.3)',
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'rgba(255, 255, 255, 0.8)',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <GitBranch size={16} />
                SSH Host Änderungen
              </div>

              {/* Compare old and new data */}
              {(() => {
                const changes = {};
                Object.keys(detailsObj.old_data).forEach(field => {
                  if (
                    detailsObj.old_data[field] !== detailsObj.new_data[field]
                  ) {
                    changes[field] = {
                      old: detailsObj.old_data[field],
                      new: detailsObj.new_data[field],
                    };
                  }
                });

                return Object.entries(changes).map(([field, change]) => (
                  <div
                    key={field}
                    style={{
                      marginBottom: '8px',
                      padding: '8px',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  >
                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                      {formatFieldName(field)}:
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '16px',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <span
                          style={{
                            color: 'rgba(239, 68, 68, 0.8)',
                            fontSize: '12px',
                          }}
                        >
                          Vorher:
                        </span>
                        <div style={{ marginTop: '2px' }}>
                          {formatValue(field, change.old)}
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span
                          style={{
                            color: 'rgba(46, 160, 67, 0.8)',
                            fontSize: '12px',
                          }}
                        >
                          Nachher:
                        </span>
                        <div style={{ marginTop: '2px' }}>
                          {formatValue(field, change.new)}
                        </div>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}

        {/* Restore section removed - now handled via the modal */}
        {action === 'appliance_delete' && detailsObj.appliance && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <div
              style={{
                fontSize: '14px',
                fontWeight: '600',
                color: 'rgba(255, 255, 255, 0.8)',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Trash2 size={16} />
              Gelöschter Service
            </div>
            <div style={{ fontSize: '13px', marginBottom: '4px' }}>
              <strong>Name:</strong> {detailsObj.appliance.name}
            </div>
            <div style={{ fontSize: '13px', marginBottom: '4px' }}>
              <strong>URL:</strong> {detailsObj.appliance.url}
            </div>
            <div style={{ fontSize: '13px', marginBottom: '4px' }}>
              <strong>Kategorie:</strong> {detailsObj.appliance.category}
            </div>
            {detailsObj.customCommands &&
              detailsObj.customCommands.length > 0 && (
                <div style={{ fontSize: '13px', marginTop: '8px' }}>
                  <strong>Eigene Kommandos:</strong>{' '}
                  {detailsObj.customCommands.length}
                  <details style={{ marginTop: '4px' }}>
                    <summary
                      style={{
                        cursor: 'pointer',
                        color: 'rgba(239, 68, 68, 0.8)',
                      }}
                    >
                      Kommandos anzeigen
                    </summary>
                    <ul
                      style={{
                        marginTop: '8px',
                        paddingLeft: '20px',
                        listStyle: 'none',
                      }}
                    >
                      {detailsObj.customCommands.map((cmd, idx) => (
                        <li
                          key={idx}
                          style={{
                            marginBottom: '8px',
                            padding: '8px',
                            backgroundColor: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '4px',
                          }}
                        >
                          <div style={{ marginBottom: '4px' }}>
                            <strong>{cmd.description}</strong>
                          </div>
                          <code
                            style={{
                              display: 'block',
                              padding: '4px 8px',
                              backgroundColor: 'rgba(0, 0, 0, 0.4)',
                              borderRadius: '4px',
                              fontSize: '11px',
                              wordBreak: 'break-all',
                            }}
                          >
                            {cmd.command}
                          </code>
                          {cmd.ssh_connection && (
                            <div
                              style={{
                                marginTop: '4px',
                                fontSize: '11px',
                                color: 'rgba(255, 255, 255, 0.6)',
                              }}
                            >
                              SSH: {cmd.ssh_connection.username}@
                              {cmd.ssh_connection.host}:
                              {cmd.ssh_connection.port}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              )}
          </div>
        )}

        {/* Special handling for SSH host updates with old_data and new_data */}
        {(action === 'ssh_host_update' || action === 'ssh_host_updated') &&
          detailsObj.old_data &&
          detailsObj.new_data && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: 'rgba(255, 193, 7, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 193, 7, 0.3)',
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'rgba(255, 255, 255, 0.8)',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <GitBranch size={16} />
                SSH Host Änderungen
              </div>

              {/* Compare old and new data */}
              {(() => {
                const changes = {};
                Object.keys(detailsObj.old_data).forEach(field => {
                  if (
                    detailsObj.old_data[field] !== detailsObj.new_data[field]
                  ) {
                    changes[field] = {
                      old: detailsObj.old_data[field],
                      new: detailsObj.new_data[field],
                    };
                  }
                });

                return Object.entries(changes).map(([field, change]) => (
                  <div
                    key={field}
                    style={{
                      marginBottom: '8px',
                      padding: '8px',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  >
                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                      {formatFieldName(field)}:
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '16px',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <span
                          style={{
                            color: 'rgba(239, 68, 68, 0.8)',
                            fontSize: '12px',
                          }}
                        >
                          Vorher:
                        </span>
                        <div style={{ marginTop: '2px' }}>
                          {formatValue(field, change.old)}
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span
                          style={{
                            color: 'rgba(46, 160, 67, 0.8)',
                            fontSize: '12px',
                          }}
                        >
                          Nachher:
                        </span>
                        <div style={{ marginTop: '2px' }}>
                          {formatValue(field, change.new)}
                        </div>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}

        {renderDetailGroup(
          'Hauptinformationen',
          FileText,
          categorizedDetails.primary
        )}
        {renderDetailGroup(
          'Benutzerinformationen',
          User,
          categorizedDetails.user
        )}
        {renderDetailGroup(
          'Technische Details',
          Terminal,
          categorizedDetails.technical
        )}
        {renderDetailGroup('Statistiken', Database, categorizedDetails.stats)}
        {renderDetailGroup('Weitere Details', Layers, categorizedDetails.other)}
      </div>
    );
  };

  // Table styles
  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'auto',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '8px',
  };

  const thStyle = {
    textAlign: 'left',
    padding: '12px',
    fontSize: '14px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  };

  const tdStyle = {
    padding: '12px',
    fontSize: '14px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    verticalAlign: 'middle',
    color: 'rgba(255, 255, 255, 0.9)',
    wordBreak: 'break-word',
  };

  const iconTextStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  // Kompakte Listenansicht für schmale Panels
  if (shouldUseCompactView) {
    return (
      <div ref={containerRef} style={{ width: '100%' }}>
        <div
          className="audit-log-compact-list"
          style={{ padding: '0 24px 24px 24px' }}
        >
          {filteredLogs.map(log => {
            // Parse details if needed
            let resourceName = '';
            if (log.metadata) {
              try {
                const details =
                  typeof log.metadata === 'string'
                    ? JSON.parse(log.metadata)
                    : log.metadata;
                resourceName =
                  details.name ||
                  details.command_description ||
                  details.service_name ||
                  details.appliance_name ||
                  details.applianceName ||
                  '';

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

            const isExpanded = expandedRows.has(log.id);

            return (
              <div key={log.id} className="compact-log-item">
                <button
                  className={`compact-log-button ${getActionColor(log.action)}`}
                  onClick={() => toggleRowExpansion(log.id)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: 'rgba(255, 255, 255, 0.9)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    marginBottom: '8px',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor =
                      'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor =
                      'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                    }}
                  >
                    {getActionIcon(log.action)}
                    <span>{formatActionName(log.action)}</span>
                    {isExpanded ? (
                      <ChevronUp size={16} style={{ marginLeft: 'auto' }} />
                    ) : (
                      <ChevronDown size={16} style={{ marginLeft: 'auto' }} />
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      fontSize: '12px',
                      color: 'rgba(255, 255, 255, 0.6)',
                    }}
                  >
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Clock size={12} />
                      {formatTimestamp(log.createdAt)}
                    </span>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <User size={12} />
                      {log.username || 'System'}
                    </span>
                  </div>

                  {resourceName && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontStyle: 'italic',
                      }}
                    >
                      {resourceName}
                    </div>
                  )}
                </button>

                {isExpanded && log.metadata && (
                  <div
                    style={{
                      marginTop: '-8px',
                      marginBottom: '8px',
                      padding: '16px',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '0 0 8px 8px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderTop: 'none',
                    }}
                  >
                    {/* Umschalt-Buttons */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        marginBottom: '12px',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          gap: '8px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          onClick={() => toggleViewMode(log.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            backgroundColor:
                              viewModes[log.id] === 'formatted' ||
                              !viewModes[log.id]
                                ? 'rgba(46, 160, 67, 0.2)'
                                : 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid',
                            borderColor:
                              viewModes[log.id] === 'formatted' ||
                              !viewModes[log.id]
                                ? 'rgba(46, 160, 67, 0.4)'
                                : 'rgba(255, 255, 255, 0.2)',
                            borderRadius: '6px',
                            color: 'rgba(255, 255, 255, 0.9)',
                            fontSize: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          <Eye size={14} />
                          Formatiert
                        </button>
                        <button
                          onClick={() => toggleViewMode(log.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            backgroundColor:
                              viewModes[log.id] === 'json'
                                ? 'rgba(46, 160, 67, 0.2)'
                                : 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid',
                            borderColor:
                              viewModes[log.id] === 'json'
                                ? 'rgba(46, 160, 67, 0.4)'
                                : 'rgba(255, 255, 255, 0.2)',
                            borderRadius: '6px',
                            color: 'rgba(255, 255, 255, 0.9)',
                            fontSize: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          <Code size={14} />
                          JSON
                        </button>
                      </div>

                      {/* Wiederherstellen Button für gelöschte und geänderte Items */}
                      {(log.action.includes('delete') ||
                        log.action.includes('update') ||
                        log.action.includes('reverted')) && (
                        <button
                          onClick={() => handleDirectRestore(log)}
                          disabled={restoringLogs.has(log.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            background: 'rgba(59, 130, 246, 0.2)',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            borderRadius: '6px',
                            color: 'rgba(59, 130, 246, 0.9)',
                            fontSize: '13px',
                            fontWeight: '500',
                            cursor: restoringLogs.has(log.id)
                              ? 'not-allowed'
                              : 'pointer',
                            opacity: restoringLogs.has(log.id) ? 0.6 : 1,
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => {
                            if (!restoringLogs.has(log.id)) {
                              e.currentTarget.style.background =
                                'rgba(59, 130, 246, 0.3)';
                              e.currentTarget.style.transform =
                                'translateY(-1px)';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!restoringLogs.has(log.id)) {
                              e.currentTarget.style.background =
                                'rgba(59, 130, 246, 0.2)';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }
                          }}
                        >
                          <RefreshCw
                            size={16}
                            className={
                              restoringLogs.has(log.id) ? 'spin-animation' : ''
                            }
                          />
                          {restoringLogs.has(log.id)
                            ? 'Wird wiederhergestellt...'
                            : log.action.includes('delete')
                              ? 'Wiederherstellen'
                              : 'Original wiederherstellen'}
                        </button>
                      )}
                    </div>

                    {/* Details Anzeige */}
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                      {viewModes[log.id] === 'json' ? (
                        <pre
                          style={{
                            margin: 0,
                            padding: '12px',
                            backgroundColor: 'rgba(0, 0, 0, 0.6)',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            color: 'rgba(255, 255, 255, 0.8)',
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordWrap: 'break-word',
                            maxWidth: '100%',
                          }}
                        >
                          {JSON.stringify(
                            typeof log.metadata === 'string'
                              ? JSON.parse(log.metadata)
                              : log.metadata,
                            null,
                            2
                          )}
                        </pre>
                      ) : (
                        <FormattedDetails
                          details={log.metadata}
                          action={log.action}
                          logId={log.id}
                          resourceId={log.resourceId}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <div style={{ width: '100%' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle }}>Zeit</th>
              <th style={{ ...thStyle }}>Benutzer</th>
              <th style={{ ...thStyle }}>Aktion</th>
              <th style={{ ...thStyle }}>Ressource</th>
              {containerWidth > 900 && (
                <th style={{ ...thStyle }}>IP-Adresse</th>
              )}
              <th style={{ ...thStyle, width: '80px' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map(log => {
              // Parse details if needed
              let resourceName = '';
              if (log.metadata) {
                try {
                  const details =
                    typeof log.metadata === 'string'
                      ? JSON.parse(log.metadata)
                      : log.metadata;
                  // Erweiterte Suche nach Namen - prüfe verschiedene mögliche Felder
                  resourceName =
                    details.displayName ||
                    details.hostIdentifier ||
                    details.name ||
                    details.command_description ||
                    details.service_name ||
                    details.appliance_name ||
                    details.applianceName ||
                    '';
                } catch (e) {
                  console.error('Error parsing details:', e);
                }
              }

              // Determine resource display
              let resourceDisplay = log.resourceName || resourceName;

              // If we don't have a name from metadata, check for specific fields in metadata
              if (!resourceDisplay && log.metadata) {
                try {
                  const details =
                    typeof log.metadata === 'string'
                      ? JSON.parse(log.metadata)
                      : log.metadata;

                  // For appliances/services
                  if (log.resourceType === 'appliances' || log.resourceType === 'appliance') {
                    // Check for service object (used in create operations)
                    if (details.service && details.service.name) {
                      resourceDisplay = details.service.name;
                    }
                    // For deleted appliances, check the appliance object
                    else if (details.appliance && details.appliance.name) {
                      resourceDisplay = details.appliance.name;
                    }
                    // Check for old_data/new_data (used in update operations)
                    else if (details.old_data && details.old_data.name) {
                      resourceDisplay = details.old_data.name;
                    }
                    else if (details.new_data && details.new_data.name) {
                      resourceDisplay = details.new_data.name;
                    }
                    // Check for direct appliance_name field (used in access logs)
                    else if (details.appliance_name) {
                      resourceDisplay = details.appliance_name;
                    }
                    // For updates, check the name field directly
                    else if (details.name) {
                      resourceDisplay = details.name;
                    }
                  }
                  // For other resource types, keep existing logic
                  else {
                    // For deleted items, check the nested object
                    if (details.appliance && details.appliance.name) {
                      resourceDisplay = details.appliance.name;
                    }
                    // For updates, check the name field directly
                    else if (details.name) {
                      resourceDisplay = details.name;
                    }
                    // For changes object with new value
                    else if (
                      details.changes &&
                      details.changes.name &&
                      details.changes.name.new
                    ) {
                      resourceDisplay = details.changes.name.new;
                    }
                  }
                } catch (e) {
                  console.error('Error extracting resource name:', e);
                }
              }

              // Only fall back to generic display if we still don't have a name
              if (!resourceDisplay) {
                if (log.resourceType && log.resourceId) {
                  resourceDisplay = `${log.resourceType} #${log.resourceId}`;
                } else if (log.resourceType) {
                  resourceDisplay = log.resourceType;
                } else {
                  resourceDisplay = '-';
                }
              }

              return (
                <React.Fragment key={log.id}>
                  <tr className={`log-row ${getActionColor(log.action)}`}>
                    <td style={tdStyle}>
                      <div style={iconTextStyle}>
                        <Calendar size={14} />
                        <span>{formatTimestamp(log.createdAt)}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={iconTextStyle}>
                        <User size={14} />
                        <span>{log.username || 'System'}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={iconTextStyle}>
                        {getActionIcon(log.action)}
                        <span>{formatActionName(log.action)}</span>
                      </div>
                    </td>
                    <td style={tdStyle} title={resourceDisplay}>
                      {resourceDisplay}
                    </td>
                    {containerWidth > 900 && (
                      <td
                        style={{
                          ...tdStyle,
                          fontFamily: 'monospace',
                          fontSize: '13px',
                        }}
                      >
                        {log.ipAddress || '-'}
                      </td>
                    )}
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {log.metadata && (
                          <button
                            className="expand-btn"
                            onClick={() => toggleRowExpansion(log.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              background: 'rgba(255, 255, 255, 0.1)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              borderRadius: '6px',
                              color: 'rgba(255, 255, 255, 0.8)',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            {expandedRows.has(log.id) ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                            Details
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedRows.has(log.id) && log.metadata && (
                    <tr className="details-row">
                      <td
                        colSpan="6"
                        style={{
                          padding: 0,
                          backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        }}
                      >
                        <div style={{ padding: '16px 24px' }}>
                          {/* Details Container mit voller Breite */}
                          <div style={{ width: '100%' }}>
                            {/* Umschalt-Buttons über dem Detail Container */}
                            <div
                              style={{
                                display: 'flex',
                                gap: '8px',
                                marginBottom: '12px',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={() => toggleViewMode(log.id)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    backgroundColor:
                                      viewModes[log.id] === 'formatted' ||
                                      !viewModes[log.id]
                                        ? 'rgba(46, 160, 67, 0.2)'
                                        : 'rgba(255, 255, 255, 0.1)',
                                    border: '1px solid',
                                    borderColor:
                                      viewModes[log.id] === 'formatted' ||
                                      !viewModes[log.id]
                                        ? 'rgba(46, 160, 67, 0.4)'
                                        : 'rgba(255, 255, 255, 0.2)',
                                    borderRadius: '6px',
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  <Eye size={14} />
                                  Formatierte Ansicht
                                </button>
                                <button
                                  onClick={() => toggleViewMode(log.id)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    backgroundColor:
                                      viewModes[log.id] === 'json'
                                        ? 'rgba(46, 160, 67, 0.2)'
                                        : 'rgba(255, 255, 255, 0.1)',
                                    border: '1px solid',
                                    borderColor:
                                      viewModes[log.id] === 'json'
                                        ? 'rgba(46, 160, 67, 0.4)'
                                        : 'rgba(255, 255, 255, 0.2)',
                                    borderRadius: '6px',
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  <Code size={14} />
                                  JSON Ansicht
                                </button>
                              </div>

                              {/* Wiederherstellen Button für gelöschte und geänderte Items */}
                              {(log.action.includes('delete') ||
                                log.action.includes('update') ||
                                log.action.includes('reverted')) && (
                                <button
                                  onClick={() => handleDirectRestore(log)}
                                  disabled={restoringLogs.has(log.id)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 16px',
                                    background: 'rgba(59, 130, 246, 0.2)',
                                    border: '1px solid rgba(59, 130, 246, 0.4)',
                                    borderRadius: '6px',
                                    color: 'rgba(59, 130, 246, 0.9)',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    cursor: restoringLogs.has(log.id)
                                      ? 'not-allowed'
                                      : 'pointer',
                                    opacity: restoringLogs.has(log.id)
                                      ? 0.6
                                      : 1,
                                    transition: 'all 0.2s',
                                  }}
                                  onMouseEnter={e => {
                                    if (!restoringLogs.has(log.id)) {
                                      e.currentTarget.style.background =
                                        'rgba(59, 130, 246, 0.3)';
                                      e.currentTarget.style.transform =
                                        'translateY(-1px)';
                                    }
                                  }}
                                  onMouseLeave={e => {
                                    if (!restoringLogs.has(log.id)) {
                                      e.currentTarget.style.background =
                                        'rgba(59, 130, 246, 0.2)';
                                      e.currentTarget.style.transform =
                                        'translateY(0)';
                                    }
                                  }}
                                >
                                  <RefreshCw
                                    size={16}
                                    className={
                                      restoringLogs.has(log.id)
                                        ? 'spin-animation'
                                        : ''
                                    }
                                  />
                                  {restoringLogs.has(log.id)
                                    ? 'Wird wiederhergestellt...'
                                    : log.action.includes('delete')
                                      ? 'Wiederherstellen'
                                      : 'Original wiederherstellen'}
                                </button>
                              )}
                            </div>

                            {/* Details Anzeige mit voller Breite */}
                            <div style={{ width: '100%', overflowX: 'auto' }}>
                              {viewModes[log.id] === 'json' ? (
                                <pre
                                  style={{
                                    margin: 0,
                                    padding: '12px',
                                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontFamily: 'monospace',
                                    color: 'rgba(255, 255, 255, 0.8)',
                                    overflow: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    wordWrap: 'break-word',
                                    maxWidth: '100%',
                                  }}
                                >
                                  {JSON.stringify(
                                    typeof log.metadata === 'string'
                                      ? JSON.parse(log.metadata)
                                      : log.metadata,
                                    null,
                                    2
                                  )}
                                </pre>
                              ) : (
                                <FormattedDetails
                                  details={log.metadata}
                                  action={log.action}
                                  logId={log.id}
                                  resourceId={log.resourceId}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLogTable;
