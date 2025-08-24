// Audit Log Detail Renderer
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Stack,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  useTheme,
} from '@mui/material';
import {
  History,
  RefreshCw,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { canRestore, getResourceName, handleRestore } from './AuditLogRestore';
import './AuditLogDetail.css';

// Custom Chip component that handles long text better
const ResponsiveChip = ({ label, ...props }) => {
  const [showFull, setShowFull] = useState(false);
  const maxLength = 50;
  const isLong = label && label.length > maxLength;
  
  const displayLabel = isLong && !showFull 
    ? label.substring(0, maxLength) + '...' 
    : label;
  
  return (
    <Chip 
      {...props}
      label={displayLabel}
      onClick={isLong ? () => setShowFull(!showFull) : undefined}
      sx={{
        ...props.sx,
        maxWidth: '100%',
        height: 'auto',
        '& .MuiChip-label': {
          display: 'block',
          whiteSpace: isLong ? 'normal' : 'nowrap',
          overflow: 'hidden',
          textOverflow: isLong && !showFull ? 'ellipsis' : 'unset',
          wordBreak: isLong ? 'break-word' : 'normal',
          padding: '4px 12px',
          cursor: isLong ? 'pointer' : 'default',
        }
      }}
      title={isLong ? (showFull ? 'Klicken zum Verkleinern' : 'Klicken für vollständigen Text') : label}
    />
  );
};

const AuditLogDetailRenderer = ({ log, onRestoreComplete }) => {
  const theme = useTheme();
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState(null);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);

  // Robuste Dark Mode Erkennung
  const isDarkMode = theme.palette.mode === 'dark' || document.body.classList.contains('theme-dark');
  
  const details = log.metadata || log.details || {};
  const restoreInfo = canRestore(log);

  const handleRestoreClick = async () => {
    // Validierung: Bei User-Wiederherstellung mit neuen Daten muss E-Mail angegeben werden
    if (showEmailInput && (log.action === 'user_delete' || log.action === 'user_deleted') && !newEmail) {
      setRestoreError('Bitte geben Sie eine neue E-Mail-Adresse ein.');
      return;
    }

    setIsRestoring(true);
    setRestoreError(null);
    setRestoreSuccess(false);

    try {
      // For user restore, pass both new name and email if provided
      const restoreData = {};
      if (showNameInput && newName) {
        restoreData.newName = newName;
      }
      if (showEmailInput && newEmail) {
        restoreData.newEmail = newEmail;
      }
      
      await handleRestore(log, Object.keys(restoreData).length > 0 ? restoreData : null);
      setRestoreSuccess(true);
      if (onRestoreComplete) {
        onRestoreComplete();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      
      // Check if error is about email or username already in use for user restoration
      if (log.action === 'user_delete' || log.action === 'user_deleted') {
        if (errorMessage.includes('Email') && errorMessage.includes('already in use')) {
          // Show BOTH name and email inputs when email conflict occurs
          if (!showEmailInput) {
            setShowEmailInput(true);
            setShowNameInput(true);  // Also show name input for complete flexibility
            setRestoreError('Die E-Mail-Adresse ist bereits vergeben. Bitte geben Sie neue Benutzerdaten ein.');
          } else {
            // If email input is already shown, the provided email is also taken
            setRestoreError('Diese E-Mail-Adresse ist ebenfalls bereits vergeben. Bitte verwenden Sie eine andere.');
          }
        } else if (errorMessage.includes('username') && errorMessage.includes('already exists')) {
          // Show BOTH inputs when username conflict occurs
          if (!showNameInput) {
            setShowNameInput(true);
            setShowEmailInput(true);  // Also show email input
            setRestoreError('Der Benutzername ist bereits vergeben. Bitte geben Sie neue Benutzerdaten ein.');
          } else {
            // If name input is already shown, the provided name is also taken
            setRestoreError('Dieser Benutzername ist ebenfalls bereits vergeben. Bitte verwenden Sie einen anderen.');
          }
        } else {
          setRestoreError(errorMessage);
        }
      } else {
        setRestoreError(errorMessage);
      }
    } finally {
      setIsRestoring(false);
    }
  };

  // Render different views based on action type
  const renderContent = () => {
    // For user activated/deactivated actions - show formatted status change
    if (log.action === 'user_activated' || log.action === 'userActivated' || 
        log.action === 'user_deactivated' || log.action === 'userDeactivated') {
      const username = details.username || details.user_name || '-';
      const originalStatus = details.originalStatus !== undefined ? details.originalStatus : 
                           details.original_status !== undefined ? details.original_status : null;
      const newStatus = details.newStatus !== undefined ? details.newStatus : 
                       details.new_status !== undefined ? details.new_status : null;
      const changedBy = details.changedBy || details.changed_by || '-';
      const timestamp = log.createdAt || details.timestamp || log.timestamp || '-';
      
      // Format date
      const formatDate = (date) => {
        if (!date || date === '-') return '-';
        try {
          return new Date(date).toLocaleString('de-DE');
        } catch {
          return date;
        }
      };
      
      return (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            Status-Änderung:
          </Typography>
          
          <Box sx={{
            '& table': {
              borderCollapse: 'collapse',
              width: '100%',
            },
            '& td': {
              padding: '10px 12px',
              borderBottom: `1px solid ${isDarkMode 
                ? 'rgba(255, 255, 255, 0.08)' 
                : 'rgba(0, 0, 0, 0.08)'}`,
            },
            '& tr:last-child td': {
              borderBottom: 'none',
            },
            '& td:first-of-type': {
              fontWeight: 500,
              color: isDarkMode 
                ? 'rgba(255, 255, 255, 0.6)' 
                : 'rgba(0, 0, 0, 0.6)',
              width: '35%',
            },
          }}>
            <table>
              <tbody>
                {originalStatus !== null && (
                  <tr>
                    <td>Original Status:</td>
                    <td>
                      <Chip 
                        label={originalStatus ? "Aktiv" : "Inaktiv"} 
                        size="small"
                        sx={{ 
                          backgroundColor: originalStatus ? '#66bb6a' : '#f44336',
                          color: '#fff',
                          fontWeight: 500
                        }}
                      />
                    </td>
                  </tr>
                )}
                {newStatus !== null && (
                  <tr>
                    <td>Neuer Status:</td>
                    <td>
                      <Chip 
                        label={newStatus ? "Aktiv" : "Inaktiv"} 
                        size="small"
                        sx={{ 
                          backgroundColor: newStatus ? '#66bb6a' : '#f44336',
                          color: '#fff',
                          fontWeight: 500
                        }}
                      />
                    </td>
                  </tr>
                )}
                <tr><td>Benutzername:</td><td>{username}</td></tr>
                <tr><td>Geändert von:</td><td>{changedBy}</td></tr>
                <tr><td>Zeitstempel:</td><td>{formatDate(timestamp)}</td></tr>
              </tbody>
            </table>
          </Box>
        </Box>
      );
    }
    
    // For SSH file upload/download actions - show file transfer details
    if (log.action === 'ssh_file_upload' || log.action === 'ssh_file_download' || 
        log.action === 'file_upload' || log.action === 'file_download' ||
        log.action === 'fileUpload' || log.action === 'fileDownload') {
      
      // Handle different data structures from backend
      let fileName = details.fileName || details.file_name || details.filename || '-';
      let fileSize = details.fileSize || details.file_size || details.size || '-';
      let hostName = details.hostname || details.hostName || details.host_name || details.host || '-';
      let targetPath = details.target_path || details.targetPath || details.destinationPath || details.destination_path || details.destination || '-';
      
      // Check if files array exists (new structure from sshUploadHandler)
      if (details.files && Array.isArray(details.files) && details.files.length > 0) {
        const firstFile = details.files[0];
        fileName = firstFile.name || firstFile.filename || fileName;
        fileSize = firstFile.bytes || firstFile.size || fileSize;
      }
      
      const hostIp = details.host_ip || details.hostIp || '-';
      const sourcePath = details.sourcePath || details.source_path || details.source || '-';
      const transferredBy = details.transferredBy || details.transferred_by || details.username || log.username || '-';
      const timestamp = log.createdAt || details.timestamp || log.timestamp || '-';
      
      // Format file size
      const formatFileSize = (size) => {
        if (!size || size === '-') return '-';
        const bytes = parseInt(size);
        if (isNaN(bytes)) return size;
        
        const units = ['B', 'KB', 'MB', 'GB'];
        let unitIndex = 0;
        let formattedSize = bytes;
        
        while (formattedSize >= 1024 && unitIndex < units.length - 1) {
          formattedSize /= 1024;
          unitIndex++;
        }
        
        return `${formattedSize.toFixed(2)} ${units[unitIndex]}`;
      };
      
      // Format date
      const formatDate = (date) => {
        if (!date || date === '-') return '-';
        try {
          return new Date(date).toLocaleString('de-DE');
        } catch {
          return date;
        }
      };
      
      const isUpload = log.action.includes('upload');
      
      return (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            {isUpload ? 'Datei wurde hochgeladen' : 'Datei wurde heruntergeladen'}
          </Alert>
          
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            Dateiübertragung-Details:
          </Typography>
          
          <Box sx={{
            '& table': {
              borderCollapse: 'collapse',
              width: '100%',
            },
            '& td': {
              padding: '10px 12px',
              borderBottom: `1px solid ${isDarkMode 
                ? 'rgba(255, 255, 255, 0.08)' 
                : 'rgba(0, 0, 0, 0.08)'}`,
            },
            '& tr:last-child td': {
              borderBottom: 'none',
            },
            '& td:first-of-type': {
              fontWeight: 500,
              color: isDarkMode 
                ? 'rgba(255, 255, 255, 0.6)' 
                : 'rgba(0, 0, 0, 0.6)',
              width: '35%',
            },
          }}>
            <table>
              <tbody>
                {fileName !== '-' && (
                  <tr><td>Dateiname:</td><td style={{ fontFamily: 'monospace' }}>{fileName}</td></tr>
                )}
                {fileSize !== '-' && (
                  <tr><td>Dateigröße:</td><td>{formatFileSize(fileSize)}</td></tr>
                )}
                {hostName !== '-' && (
                  <tr><td>Host:</td><td style={{ fontWeight: 600 }}>{hostName}</td></tr>
                )}
                {hostIp !== '-' && (
                  <tr><td>Host-IP:</td><td style={{ fontFamily: 'monospace' }}>{hostIp}</td></tr>
                )}
                {targetPath !== '-' && (
                  <tr><td>Zielpfad:</td><td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{targetPath}</td></tr>
                )}
                {sourcePath !== '-' && (
                  <tr><td>Quellpfad:</td><td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{sourcePath}</td></tr>
                )}
                {transferredBy !== '-' && (
                  <tr><td>Übertragen von:</td><td>{transferredBy}</td></tr>
                )}
                <tr><td>Zeitstempel:</td><td>{formatDate(timestamp)}</td></tr>
              </tbody>
            </table>
          </Box>
        </Box>
      );
    }
    
    // For host revert actions - show clean details
    if (log.action === 'host_reverted' || log.action === 'hostReverted' || 
        log.action === 'host_revert' || log.action === 'hostRevert') {
      const name = details.name || details.resourceName || '-';
      const revertedLogId = details.reverted_audit_log_id || details.revertedAuditLogId || '-';
      const revertedBy = details.reverted_by || details.revertedBy || '-';
      
      // Parse reverted_changes and restored_values if they are strings
      let revertedChanges = details.reverted_changes || details.revertedChanges || {};
      let restoredValues = details.restored_values || details.restoredValues || {};
      
      if (typeof revertedChanges === 'string') {
        try {
          revertedChanges = JSON.parse(revertedChanges);
        } catch (e) {
          console.error('Error parsing reverted_changes:', e);
        }
      }
      
      if (typeof restoredValues === 'string') {
        try {
          restoredValues = JSON.parse(restoredValues);
        } catch (e) {
          console.error('Error parsing restored_values:', e);
        }
      }

      return (
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ 
            mb: 2, 
            color: isDarkMode 
              ? 'rgba(255, 255, 255, 0.87)' 
              : 'rgba(0, 0, 0, 0.87)' 
          }}>
            Wiederhergestellte Host-Details:
          </Typography>
          <Box sx={{
            '& table': {
              borderCollapse: 'collapse',
              width: '100%',
            },
            '& td': {
              padding: '8px 12px',
              borderBottom: `1px solid ${isDarkMode 
                ? 'rgba(255, 255, 255, 0.08)' 
                : 'rgba(0, 0, 0, 0.08)'}`,
            },
            '& tr:last-child td': {
              borderBottom: 'none',
            },
            '& td:first-of-type': {
              fontWeight: 500,
              color: isDarkMode 
                ? 'rgba(255, 255, 255, 0.6)' 
                : 'rgba(0, 0, 0, 0.6)',
              width: '30%',
              minWidth: '120px',
            },
          }}>
            <table>
              <tbody>
                <tr>
                  <td>Host-Name:</td>
                  <td>{name}</td>
                </tr>
                <tr>
                  <td>Wiederhergestellt von Log-ID:</td>
                  <td>{revertedLogId}</td>
                </tr>
                <tr>
                  <td>Wiederhergestellt von:</td>
                  <td>{revertedBy}</td>
                </tr>
              </tbody>
            </table>
          </Box>
          
          {Object.keys(revertedChanges).length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ 
                mt: 3,
                mb: 2, 
                color: isDarkMode 
                  ? 'rgba(255, 255, 255, 0.87)' 
                  : 'rgba(0, 0, 0, 0.87)' 
              }}>
                Rückgängig gemachte Änderungen:
              </Typography>
              <Box sx={{
                '& table': {
                  borderCollapse: 'collapse',
                  width: '100%',
                },
                '& td': {
                  padding: '8px 12px',
                  borderBottom: `1px solid ${isDarkMode 
                    ? 'rgba(255, 255, 255, 0.08)' 
                    : 'rgba(0, 0, 0, 0.08)'}`,
                },
                '& tr:last-child td': {
                  borderBottom: 'none',
                },
              }}>
                <table>
                  <tbody>
                    {Object.entries(revertedChanges).map(([field, value]) => {
                      const formattedField = field
                        .replace(/_/g, ' ')
                        .replace(/([A-Z])/g, ' $1')
                        .trim()
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                        .join(' ');
                      
                      const oldValue = restoredValues[field];
                      
                      return (
                        <tr key={field}>
                          <td style={{
                            fontWeight: 500,
                            color: isDarkMode 
                              ? 'rgba(255, 255, 255, 0.6)' 
                              : 'rgba(0, 0, 0, 0.6)',
                            width: '30%',
                            verticalAlign: 'top',
                            paddingTop: '12px',
                          }}>{formattedField}:</td>
                          <td style={{
                            paddingTop: '8px',
                            paddingBottom: '8px',
                          }}>
                            <Stack 
                              direction="row" 
                              spacing={1} 
                              alignItems="flex-start"
                              sx={{
                                flexWrap: 'wrap',
                                gap: 1,
                              }}
                            >
                              <Box
                                sx={{
                                  display: 'inline-block',
                                  padding: '4px 12px',
                                  backgroundColor: 'rgba(244, 67, 54, 0.1)',
                                  border: '1px solid rgba(244, 67, 54, 0.5)',
                                  borderRadius: '16px',
                                  color: '#f44336',
                                  fontSize: '0.75rem',
                                  textDecoration: 'line-through',
                                  wordBreak: 'break-all',
                                  maxWidth: '100%',
                                  whiteSpace: 'pre-wrap',
                                }}
                              >
                                {value || '-'}
                              </Box>
                              <Typography variant="caption" sx={{ alignSelf: 'center' }}>→</Typography>
                              <Box
                                sx={{
                                  display: 'inline-block',
                                  padding: '4px 12px',
                                  backgroundColor: 'rgba(102, 187, 106, 0.1)',
                                  border: '1px solid rgba(102, 187, 106, 0.5)',
                                  borderRadius: '16px',
                                  color: '#66bb6a',
                                  fontSize: '0.75rem',
                                  wordBreak: 'break-all',
                                  maxWidth: '100%',
                                  whiteSpace: 'pre-wrap',
                                }}
                              >
                                {oldValue || '-'}
                              </Box>
                            </Stack>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Box>
            </>
          )}
        </Box>
      );
    }

    // For host update actions - show before/after comparison
    if (log.action === 'host_update' || log.action === 'host_updated' || 
        log.action === 'hostUpdate' || log.action === 'hostUpdated') {
      const changes = details.changes || {};
      const oldValues = details.oldValues || {};
      const changedFields = Object.keys(changes);

      if (changedFields.length === 0) {
        return (
          <Alert severity="warning">
            Keine Änderungsdetails verfügbar
          </Alert>
        );
      }

      return (
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ 
            mb: 2, 
            color: isDarkMode 
              ? 'rgba(255, 255, 255, 0.87)' 
              : 'rgba(0, 0, 0, 0.87)' 
          }}>
            Geänderte Felder:
          </Typography>
          <Box sx={{
            '& table': {
              borderCollapse: 'collapse',
              width: '100%',
            },
            '& td': {
              padding: '8px 12px',
              borderBottom: `1px solid ${isDarkMode 
                ? 'rgba(255, 255, 255, 0.08)' 
                : 'rgba(0, 0, 0, 0.08)'}`,
            },
            '& tr:last-child td': {
              borderBottom: 'none',
            },
            '& td:first-of-type': {
              fontWeight: 500,
              color: isDarkMode 
                ? 'rgba(255, 255, 255, 0.6)' 
                : 'rgba(0, 0, 0, 0.6)',
              width: '25%',
              minWidth: '100px',
            },
            '& td:last-of-type': {
              color: isDarkMode 
                ? 'rgba(255, 255, 255, 0.87)' 
                : 'rgba(0, 0, 0, 0.87)',
            },
          }}>
            <table>
              <tbody>
                {changedFields.map(field => {
                  const formattedField = field
                    .replace(/_/g, ' ')
                    .replace(/([A-Z])/g, ' $1')
                    .trim()
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
                    
                  return (
                    <tr key={field}>
                      <td style={{
                        fontWeight: 500,
                        color: isDarkMode 
                          ? 'rgba(255, 255, 255, 0.6)' 
                          : 'rgba(0, 0, 0, 0.6)',
                      }}>{formattedField}:</td>
                      <td style={{
                        color: isDarkMode 
                          ? 'rgba(255, 255, 255, 0.87)' 
                          : 'rgba(0, 0, 0, 0.87)',
                      }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Chip 
                            label={oldValues[field] || '-'} 
                            size="small" 
                            color="error"
                            sx={{
                              backgroundColor: '#f44336',
                              color: '#ffffff',
                              fontWeight: 500,
                            }}
                          />
                          <Typography variant="caption">→</Typography>
                          <Chip 
                            label={changes[field] || '-'} 
                            size="small" 
                            color="success"
                            sx={{
                              backgroundColor: '#66bb6a',
                              color: '#ffffff',
                              fontWeight: 500,
                            }}
                          />
                        </Stack>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>
        </Box>
      );
    }

    // For appliance update actions - show clean before/after comparison
    if (log.action === 'appliance_update' || log.action === 'appliance_updated') {
      const name = details.appliance_name || details.applianceName || '-';
      const changes = details.changes || {};
      const oldValues = details.oldValues || details.old_values || {};
      const updatedBy = details.updated_by || details.updatedBy || '-';
      
      // Extract changed fields
      const changedFields = [];
      const fieldsUpdated = details.fields_updated || details.fieldsUpdated || Object.keys(changes);
      
      fieldsUpdated.forEach(field => {
        const oldValue = oldValues[field];
        const newValue = changes[field];
        
        // Format boolean values
        let formattedOld = oldValue;
        let formattedNew = newValue;
        
        if (typeof oldValue === 'boolean') {
          formattedOld = oldValue ? 'Ja' : 'Nein';
        }
        if (typeof newValue === 'boolean') {
          formattedNew = newValue ? 'Ja' : 'Nein';
        }
        
        // Format null values
        if (oldValue === null || oldValue === undefined) {
          formattedOld = '-';
        }
        if (newValue === null || newValue === undefined) {
          formattedNew = '-';
        }
        
        // Format field names
        const fieldNameMap = {
          isFavorite: 'Favorit',
          startCommand: 'Start-Befehl',
          stopCommand: 'Stop-Befehl',
          statusCommand: 'Status-Befehl',
          restartCommand: 'Restart-Befehl',
          remoteDesktopEnabled: 'Remote Desktop',
          visualSettings: 'Visuelle Einstellungen',
          transparency: 'Transparenz',
          blurAmount: 'Unschärfe',
        };
        
        const formattedField = fieldNameMap[field] || field;
        
        changedFields.push({
          field: formattedField,
          oldValue: formattedOld,
          newValue: formattedNew
        });
      });
      
      // Special handling for visualSettings
      let visualChanges = null;
      if (changes.visualSettings || oldValues.visualSettings) {
        try {
          const newVisual = typeof changes.visualSettings === 'string' 
            ? JSON.parse(changes.visualSettings) 
            : changes.visualSettings;
          const oldVisual = typeof oldValues.visualSettings === 'string'
            ? JSON.parse(oldValues.visualSettings)
            : oldValues.visualSettings;
          
          if (newVisual && oldVisual) {
            visualChanges = { new: newVisual, old: oldVisual };
          }
        } catch (e) {
          console.error('Error parsing visualSettings:', e);
        }
      }
      
      return (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>Service-Details:</Typography>
          <Box sx={{
            '& table': { borderCollapse: 'collapse', width: '100%' },
            '& td': { 
              padding: '8px', 
              borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`
            },
            '& td:first-of-type': { fontWeight: 500, width: '35%' }
          }}>
            <table>
              <tbody>
                <tr><td>Service Name:</td><td>{name}</td></tr>
                <tr><td>Geändert von:</td><td>{updatedBy}</td></tr>
              </tbody>
            </table>
          </Box>
          
          {changedFields.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 3, mb: 2 }}>Geänderte Felder:</Typography>
              <Box sx={{
                '& table': { borderCollapse: 'collapse', width: '100%' },
                '& td': { 
                  padding: '8px', 
                  borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`
                }
              }}>
                <table>
                  <tbody>
                    {changedFields.map((item, index) => (
                      <tr key={index}>
                        <td style={{ width: '35%', fontWeight: 500 }}>{item.field}:</td>
                        <td>
                          <Chip 
                            label={String(item.oldValue)} 
                            size="small"
                            sx={{ 
                              backgroundColor: '#f44336',
                              color: '#fff',
                              mr: 1,
                              fontSize: '0.75rem'
                            }} 
                          />
                          →
                          <Chip 
                            label={String(item.newValue)} 
                            size="small"
                            sx={{ 
                              backgroundColor: '#66bb6a',
                              color: '#fff',
                              ml: 1,
                              fontSize: '0.75rem'
                            }} 
                          />
                        </td>
                      </tr>
                    ))}
                    {visualChanges && (
                      <tr>
                        <td style={{ width: '35%', fontWeight: 500 }}>Visual Settings:</td>
                        <td>
                          <Chip 
                            label={`Transparenz: ${visualChanges.old.transparency || '-'}`} 
                            size="small"
                            sx={{ 
                              backgroundColor: '#f44336',
                              color: '#fff',
                              mr: 1,
                              fontSize: '0.75rem'
                            }} 
                          />
                          →
                          <Chip 
                            label={`Transparenz: ${visualChanges.new.transparency || '-'}`} 
                            size="small"
                            sx={{ 
                              backgroundColor: '#66bb6a',
                              color: '#fff',
                              ml: 1,
                              fontSize: '0.75rem'
                            }} 
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Box>
            </>
          )}
        </Box>
      );
    }

    // For appliance delete actions - show formatted deleted service details
    if (log.action === 'appliance_delete' || log.action === 'appliance_deleted') {
      // Die Daten sind direkt in details gespeichert (durch den Spread-Operator im Backend)
      const applianceData = details;
      
      // Extract all fields with fallbacks
      const name = applianceData.appliance_name || applianceData.name || '-';
      const category = applianceData.category || '-';
      const description = applianceData.description || '-';
      const url = applianceData.url || '-';
      const icon = applianceData.icon || '-';
      const color = applianceData.color || '#000000';
      const isFavorite = applianceData.isFavorite ? 'Ja' : 'Nein';
      const autoStart = applianceData.autoStart ? 'Ja' : 'Nein';
      const statusCommand = applianceData.statusCommand || applianceData.status_command || '-';
      const startCommand = applianceData.startCommand || applianceData.start_command || '-';
      const stopCommand = applianceData.stopCommand || applianceData.stop_command || '-';
      const restartCommand = applianceData.restartCommand || applianceData.restart_command || '-';
      const remoteDesktopEnabled = applianceData.remoteDesktopEnabled || applianceData.remote_desktop_enabled ? 'Ja' : 'Nein';
      const remoteProtocol = applianceData.remoteProtocol || applianceData.remote_protocol || '-';
      const remoteHost = applianceData.remoteHost || applianceData.remote_host || '-';
      const remotePort = applianceData.remotePort || applianceData.remote_port || '-';
      const remoteUsername = applianceData.remoteUsername || applianceData.remote_username || '-';
      const sshConnection = applianceData.sshConnection || applianceData.ssh_connection || '-';
      
      return (
        <Box>
          <Alert severity="error" sx={{ mb: 2 }}>Dieser Service wurde gelöscht</Alert>
          
          <Typography variant="subtitle2" sx={{ mb: 2 }}>Gelöschte Service-Details:</Typography>
          <Box sx={{
            '& table': { borderCollapse: 'collapse', width: '100%' },
            '& td': { 
              padding: '8px', 
              borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`
            },
            '& td:first-of-type': { fontWeight: 500, width: '35%' }
          }}>
            <table>
              <tbody>
                <tr><td>Service Name:</td><td>{name}</td></tr>
                <tr><td>Kategorie:</td><td>{category}</td></tr>
                <tr><td>Beschreibung:</td><td>{description}</td></tr>
                <tr><td>URL:</td><td>{url}</td></tr>
                <tr><td>Icon:</td><td>{icon}</td></tr>
                <tr><td>Farbe:</td><td><span style={{backgroundColor: color, padding: '2px 8px', borderRadius: '4px'}}>{color}</span></td></tr>
                <tr><td>Favorit:</td><td>{isFavorite}</td></tr>
                <tr><td>Auto-Start:</td><td>{autoStart}</td></tr>
              </tbody>
            </table>
          </Box>
          
          {(statusCommand !== '-' || startCommand !== '-' || stopCommand !== '-' || restartCommand !== '-') && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 3, mb: 2 }}>Befehle:</Typography>
              <Box sx={{
                '& table': { borderCollapse: 'collapse', width: '100%' },
                '& td': { 
                  padding: '8px', 
                  borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`
                }
              }}>
                <table>
                  <tbody>
                    {statusCommand !== '-' && <tr><td style={{width: '35%'}}>Status-Befehl:</td><td style={{fontFamily: 'monospace'}}>{statusCommand}</td></tr>}
                    {startCommand !== '-' && <tr><td style={{width: '35%'}}>Start-Befehl:</td><td style={{fontFamily: 'monospace'}}>{startCommand}</td></tr>}
                    {stopCommand !== '-' && <tr><td style={{width: '35%'}}>Stop-Befehl:</td><td style={{fontFamily: 'monospace'}}>{stopCommand}</td></tr>}
                    {restartCommand !== '-' && <tr><td style={{width: '35%'}}>Restart-Befehl:</td><td style={{fontFamily: 'monospace'}}>{restartCommand}</td></tr>}
                  </tbody>
                </table>
              </Box>
            </>
          )}
          
          {remoteDesktopEnabled === 'Ja' && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 3, mb: 2 }}>Remote Desktop:</Typography>
              <Box sx={{
                '& table': { borderCollapse: 'collapse', width: '100%' },
                '& td': { 
                  padding: '8px', 
                  borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`
                }
              }}>
                <table>
                  <tbody>
                    <tr><td style={{width: '35%'}}>Remote Desktop aktiviert:</td><td>{remoteDesktopEnabled}</td></tr>
                    {remoteProtocol !== '-' && <tr><td>Protokoll:</td><td>{remoteProtocol}</td></tr>}
                    {remoteHost !== '-' && <tr><td>Host:</td><td>{remoteHost}</td></tr>}
                    {remotePort !== '-' && <tr><td>Port:</td><td>{remotePort}</td></tr>}
                    {remoteUsername !== '-' && <tr><td>Benutzername:</td><td>{remoteUsername}</td></tr>}
                  </tbody>
                </table>
              </Box>
            </>
          )}
          
          {sshConnection !== '-' && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 3, mb: 2 }}>SSH-Verbindung:</Typography>
              <Box sx={{
                '& table': { borderCollapse: 'collapse', width: '100%' },
                '& td': { padding: '8px' }
              }}>
                <table>
                  <tbody>
                    <tr><td style={{width: '35%'}}>SSH-Verbindung:</td><td style={{fontFamily: 'monospace'}}>{sshConnection}</td></tr>
                  </tbody>
                </table>
              </Box>
            </>
          )}
          
          {details.customCommands && details.customCommands.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 3, mb: 2 }}>Benutzerdefinierte Befehle:</Typography>
              <Box sx={{
                '& table': { borderCollapse: 'collapse', width: '100%' },
                '& td': { padding: '8px' }
              }}>
                <table>
                  <tbody>
                    {details.customCommands.map((cmd, index) => (
                      <tr key={index}>
                        <td style={{width: '35%'}}>{cmd.description || `Befehl ${index + 1}`}:</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{cmd.command}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            </>
          )}
        </Box>
      );
    }

    // For user restored actions - show nicely formatted restored user details
    if (log.action === 'user_restored' || log.action === 'userRestored') {
      const restoredFromLogId = details.restoredFromLogId || details.restored_from_log_id || '-';
      const restoredBy = details.restoredBy || details.restored_by || '-';
      const newName = details.newName || details.new_name || null;
      const newEmail = details.newEmail || details.new_email || null;
      
      // Parse the restored user data
      let userData = details.restoredUserData || details.restored_user_data || {};
      if (typeof userData === 'string') {
        try {
          userData = JSON.parse(userData);
        } catch (e) {
          console.error('Error parsing userData:', e);
        }
      }
      
      // Extract fields with proper handling for both camelCase and snake_case
      const username = userData.username || userData.user_name || '-';
      const email = userData.email || '-';
      const role = userData.role || '-';
      const isActive = userData.isActive !== undefined ? (userData.isActive ? 'Ja' : 'Nein') : 
                      userData.is_active !== undefined ? (userData.is_active ? 'Ja' : 'Nein') : '-';
      const createdAt = userData.createdAt || userData.created_at || '-';
      const updatedAt = userData.updatedAt || userData.updated_at || '-';
      const lastLogin = userData.lastLogin || userData.last_login || null;
      const lastActivity = userData.lastActivity || userData.last_activity || null;
      
      // Format dates if they exist
      const formatDate = (date) => {
        if (!date || date === '-' || date === null) return 'Nie';
        try {
          return new Date(date).toLocaleString('de-DE');
        } catch {
          return date;
        }
      };

      return (
        <Box>
          <Alert severity="success" sx={{ mb: 2 }}>
            Benutzer wurde erfolgreich wiederhergestellt
          </Alert>
          
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            Wiederherstellungs-Details:
          </Typography>
          
          <Box sx={{
            '& table': {
              borderCollapse: 'collapse',
              width: '100%',
            },
            '& td': {
              padding: '10px 12px',
              borderBottom: `1px solid ${isDarkMode 
                ? 'rgba(255, 255, 255, 0.08)' 
                : 'rgba(0, 0, 0, 0.08)'}`,
            },
            '& tr:last-child td': {
              borderBottom: 'none',
            },
            '& td:first-of-type': {
              fontWeight: 500,
              color: isDarkMode 
                ? 'rgba(255, 255, 255, 0.6)' 
                : 'rgba(0, 0, 0, 0.6)',
              width: '35%',
            },
          }}>
            <table>
              <tbody>
                <tr><td>Wiederhergestellt von Log ID:</td><td>{restoredFromLogId}</td></tr>
                {newName && (
                  <tr>
                    <td>Neuer Benutzername:</td>
                    <td>
                      <Chip 
                        label={newName} 
                        size="small"
                        color="success"
                        sx={{ fontWeight: 500 }}
                      />
                    </td>
                  </tr>
                )}
                {newEmail && (
                  <tr>
                    <td>Neue E-Mail-Adresse:</td>
                    <td>
                      <Chip 
                        label={newEmail} 
                        size="small"
                        color="success"
                        sx={{ fontWeight: 500 }}
                      />
                    </td>
                  </tr>
                )}
                <tr><td>Wiederhergestellt von:</td><td style={{ fontWeight: 600 }}>{restoredBy}</td></tr>
              </tbody>
            </table>
          </Box>

          <Typography variant="subtitle2" sx={{ mt: 3, mb: 2, fontWeight: 600 }}>
            Ursprüngliche Benutzerdaten:
          </Typography>
          
          <Box sx={{
            '& table': {
              borderCollapse: 'collapse',
              width: '100%',
            },
            '& td': {
              padding: '10px 12px',
              borderBottom: `1px solid ${isDarkMode 
                ? 'rgba(255, 255, 255, 0.08)' 
                : 'rgba(0, 0, 0, 0.08)'}`,
            },
            '& tr:last-child td': {
              borderBottom: 'none',
            },
            '& td:first-of-type': {
              fontWeight: 500,
              color: isDarkMode 
                ? 'rgba(255, 255, 255, 0.6)' 
                : 'rgba(0, 0, 0, 0.6)',
              width: '35%',
            },
          }}>
            <table>
              <tbody>
                <tr>
                  <td>Benutzername:</td>
                  <td>
                    {newName ? (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography 
                          sx={{ 
                            textDecoration: 'line-through',
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'
                          }}
                        >
                          {username}
                        </Typography>
                        <Typography variant="caption">→</Typography>
                        <Typography sx={{ fontWeight: 500 }}>{newName}</Typography>
                      </Stack>
                    ) : username}
                  </td>
                </tr>
                <tr>
                  <td>E-Mail:</td>
                  <td>
                    {newEmail ? (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography 
                          sx={{ 
                            textDecoration: 'line-through',
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'
                          }}
                        >
                          {email}
                        </Typography>
                        <Typography variant="caption">→</Typography>
                        <Typography sx={{ fontWeight: 500 }}>{newEmail}</Typography>
                      </Stack>
                    ) : email}
                  </td>
                </tr>
                <tr>
                  <td>Rolle:</td>
                  <td>
                    <Chip 
                      label={role} 
                      size="small"
                      color={role === 'admin' ? 'error' : 'default'}
                      sx={{ fontWeight: 500 }}
                    />
                  </td>
                </tr>
                <tr>
                  <td>Aktiv:</td>
                  <td>
                    <Chip 
                      label={isActive} 
                      size="small"
                      color={isActive === 'Ja' ? 'success' : 'default'}
                    />
                  </td>
                </tr>
                <tr><td>Erstellt am:</td><td>{formatDate(createdAt)}</td></tr>
                <tr><td>Zuletzt geändert:</td><td>{formatDate(updatedAt)}</td></tr>
                <tr><td>Letzter Login:</td><td>{formatDate(lastLogin)}</td></tr>
                <tr><td>Letzte Aktivität:</td><td>{formatDate(lastActivity)}</td></tr>
              </tbody>
            </table>
          </Box>
        </Box>
      );
    }

    // For user reverted actions - show before/after comparison
    if (log.action === 'user_reverted') {
      const revertedFromLogId = details.revertedFromLogId || details.reverted_from_log_id || '-';
      const revertedBy = details.revertedBy || details.reverted_by || log.username || '-';
      const revertedToData = details.revertedToData || details.reverted_to_data || {};
      const revertedFromData = details.revertedFromData || details.reverted_from_data || {};
      
      // Parse data if it's a string
      let toData = revertedToData;
      let fromData = revertedFromData;
      
      try {
        if (typeof toData === 'string') {
          toData = JSON.parse(toData);
        }
        if (typeof fromData === 'string') {
          fromData = JSON.parse(fromData);
        }
      } catch (e) {
        console.error('Error parsing reverted data:', e);
      }
      
      // Extract all fields that changed
      const changedFields = [];
      const allKeys = new Set([...Object.keys(toData), ...Object.keys(fromData)]);
      
      allKeys.forEach(key => {
        // Skip system fields
        if (key === 'id' || key === 'created_at' || key === 'updated_at' || 
            key === 'createdAt' || key === 'updatedAt' || key === 'password') {
          return;
        }
        
        const fromValue = fromData[key];
        const toValue = toData[key];
        
        // Only show fields that actually changed
        if (JSON.stringify(fromValue) !== JSON.stringify(toValue)) {
          // Format field name
          const fieldName = key
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          
          changedFields.push({
            name: fieldName,
            from: fromValue,
            to: toValue,
            key: key
          });
        }
      });
      
      // Format value for display
      const formatValue = (value, key) => {
        if (value === null || value === undefined) return '-';
        if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
        if (key === 'role') {
          const roleMap = {
            'admin': 'Administrator',
            'power_user': 'Power User',
            'user': 'Benutzer'
          };
          return roleMap[value] || value;
        }
        if (key === 'is_active' || key === 'isActive') {
          return value ? 'Aktiv' : 'Inaktiv';
        }
        return value.toString();
      };
      
      return (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            Benutzer-Änderungen wurden rückgängig gemacht
          </Alert>
          
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            Rückgängig-Details:
          </Typography>
          
          <Box sx={{
            '& table': {
              borderCollapse: 'collapse',
              width: '100%',
            },
            '& td': {
              padding: '10px 12px',
              borderBottom: `1px solid ${isDarkMode 
                ? 'rgba(255, 255, 255, 0.08)' 
                : 'rgba(0, 0, 0, 0.08)'}`,
            },
            '& tr:last-child td': {
              borderBottom: 'none',
            },
            '& td:first-of-type': {
              fontWeight: 500,
              color: isDarkMode 
                ? 'rgba(255, 255, 255, 0.6)' 
                : 'rgba(0, 0, 0, 0.6)',
              width: '35%',
            },
          }}>
            <table>
              <tbody>
                <tr>
                  <td>Reverted From Log Id:</td>
                  <td>{revertedFromLogId}</td>
                </tr>
                <tr>
                  <td>Reverted By:</td>
                  <td style={{ fontWeight: 600 }}>{revertedBy}</td>
                </tr>
              </tbody>
            </table>
          </Box>
          
          {changedFields.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 3, mb: 2, fontWeight: 600 }}>
                Geänderte Felder:
              </Typography>
              
              <Stack spacing={2}>
                {changedFields.map((field, index) => (
                  <Box key={index}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                      {field.name}:
                    </Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Chip
                        label={`Vorher: ${formatValue(field.from, field.key)}`}
                        size="small"
                        color="error"
                        sx={{
                          backgroundColor: '#f44336',
                          color: '#ffffff',
                          fontWeight: 500,
                        }}
                      />
                      <Typography variant="caption">→</Typography>
                      <Chip
                        label={`Nachher: ${formatValue(field.to, field.key)}`}
                        size="small"
                        color="success"
                        sx={{
                          backgroundColor: '#66bb6a',
                          color: '#ffffff',
                          fontWeight: 500,
                        }}
                      />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </>
          )}
          
          {changedFields.length === 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Keine Änderungen gefunden
            </Alert>
          )}
        </Box>
      );
    }

    // For user delete actions - show formatted user details
    if (log.action === 'user_delete' || log.action === 'user_deleted') {
      const userData = details.user || details.User || details;
      
      // Extract fields with proper handling for both camelCase and snake_case
      const username = userData.username || userData.user_name || '-';
      const email = userData.email || '-';
      const role = userData.role || '-';
      const isActive = userData.isActive !== undefined ? (userData.isActive ? 'Ja' : 'Nein') : 
                      userData.is_active !== undefined ? (userData.is_active ? 'Ja' : 'Nein') : '-';
      const createdAt = userData.createdAt || userData.created_at || '-';
      const updatedAt = userData.updatedAt || userData.updated_at || '-';
      const lastLogin = userData.lastLogin || userData.last_login || 'Nie';
      const lastActivity = userData.lastActivity || userData.last_activity || 'Keine';
      const deletedBy = details.deleted_by || details.deletedBy || req.user?.username || '-';
      
      // Format dates if they exist
      const formatDate = (date) => {
        if (!date || date === '-') return '-';
        try {
          return new Date(date).toLocaleString('de-DE');
        } catch {
          return date;
        }
      };

      return (
        <Box>
          <Alert severity="error" sx={{ mb: 2 }}>
            Dieser Benutzer wurde gelöscht
          </Alert>
          
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            Benutzer-Details:
          </Typography>
          
          <Box sx={{
            '& table': {
              borderCollapse: 'collapse',
              width: '100%',
            },
            '& td': {
              padding: '10px 12px',
              borderBottom: `1px solid ${isDarkMode 
                ? 'rgba(255, 255, 255, 0.08)' 
                : 'rgba(0, 0, 0, 0.08)'}`,
            },
            '& tr:last-child td': {
              borderBottom: 'none',
            },
            '& td:first-of-type': {
              fontWeight: 500,
              color: isDarkMode 
                ? 'rgba(255, 255, 255, 0.6)' 
                : 'rgba(0, 0, 0, 0.6)',
              width: '35%',
            },
          }}>
            <table>
              <tbody>
                <tr><td>Benutzername:</td><td>{username}</td></tr>
                <tr><td>E-Mail:</td><td>{email}</td></tr>
                <tr>
                  <td>Rolle:</td>
                  <td>
                    <Chip 
                      label={role} 
                      size="small"
                      color={role === 'admin' ? 'error' : 'default'}
                      sx={{ fontWeight: 500 }}
                    />
                  </td>
                </tr>
                <tr>
                  <td>Aktiv:</td>
                  <td>
                    <Chip 
                      label={isActive} 
                      size="small"
                      color={isActive === 'Ja' ? 'success' : 'default'}
                    />
                  </td>
                </tr>
                <tr><td>Erstellt am:</td><td>{formatDate(createdAt)}</td></tr>
                <tr><td>Zuletzt geändert:</td><td>{formatDate(updatedAt)}</td></tr>
                <tr><td>Letzter Login:</td><td>{formatDate(lastLogin)}</td></tr>
                <tr><td>Letzte Aktivität:</td><td>{formatDate(lastActivity)}</td></tr>
                <tr><td>Gelöscht von:</td><td style={{ fontWeight: 600 }}>{deletedBy}</td></tr>
              </tbody>
            </table>
          </Box>
        </Box>
      );
    }

    // For user update actions - show before/after comparison
    if (log.action === 'user_update' || log.action === 'user_updated') {
      const originalData = details.original_data || {};
      const newData = details.new_data || {};
      const fieldsUpdated = details.fields_updated || details.changedFields || details.changed_fields || [];
      const username = details.username || details.user_name || '-';
      const updatedBy = details.updated_by || details.updatedBy || req.user?.username || '-';
      
      return (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            Benutzer-Änderungen:
          </Typography>
          
          <Box sx={{
            '& table': {
              borderCollapse: 'collapse',
              width: '100%',
            },
            '& td': {
              padding: '10px 12px',
              borderBottom: `1px solid ${isDarkMode 
                ? 'rgba(255, 255, 255, 0.08)' 
                : 'rgba(0, 0, 0, 0.08)'}`,
            },
            '& tr:last-child td': {
              borderBottom: 'none',
            },
          }}>
            <table>
              <tbody>
                <tr>
                  <td style={{ width: '35%', fontWeight: 500 }}>Benutzer:</td>
                  <td>{username}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 500 }}>Geändert von:</td>
                  <td>{updatedBy}</td>
                </tr>
              </tbody>
            </table>
          </Box>
          
          {fieldsUpdated.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 3, mb: 2, fontWeight: 600 }}>
                Geänderte Felder:
              </Typography>
              <Box sx={{
                '& table': {
                  borderCollapse: 'collapse',
                  width: '100%',
                },
                '& td': {
                  padding: '10px 12px',
                  borderBottom: `1px solid ${isDarkMode 
                    ? 'rgba(255, 255, 255, 0.08)' 
                    : 'rgba(0, 0, 0, 0.08)'}`,
                }
              }}>
                <table>
                  <tbody>
                    {fieldsUpdated.map((fieldName, index) => {
                      // Get the old and new values from the data objects
                      const oldValue = originalData[fieldName];
                      const newValue = newData[fieldName];
                      
                      // Format field names
                      const formatFieldName = (field) => {
                        const fieldMap = {
                          'username': 'Benutzername',
                          'email': 'E-Mail',
                          'role': 'Rolle',
                          'isActive': 'Aktiv',
                          'is_active': 'Aktiv',
                          'password': 'Passwort',
                          'passwordHash': 'Passwort',
                          'password_hash': 'Passwort'
                        };
                        return fieldMap[field] || field;
                      };
                      
                      // Format values
                      const formatValue = (value, field) => {
                        if (field === 'isActive' || field === 'is_active') {
                          return value ? 'Ja' : 'Nein';
                        }
                        if (field === 'password' || field === 'passwordHash' || field === 'password_hash') {
                          return '••••••••';
                        }
                        return value !== undefined && value !== null ? value : '-';
                      };
                      
                      return (
                        <tr key={index}>
                          <td style={{ width: '35%', fontWeight: 500 }}>
                            {formatFieldName(fieldName)}:
                          </td>
                          <td>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip 
                                label={`Vorher: ${formatValue(oldValue, fieldName)}`} 
                                size="small"
                                color="error"
                                sx={{ 
                                  backgroundColor: '#f44336',
                                  color: '#ffffff',
                                  fontSize: '0.75rem',
                                  fontWeight: 500
                                }} 
                              />
                              <Typography variant="caption">→</Typography>
                              <Chip 
                                label={`Nachher: ${formatValue(newValue, fieldName)}`} 
                                size="small"
                                color="success"
                                sx={{ 
                                  backgroundColor: '#66bb6a',
                                  color: '#ffffff',
                                  fontSize: '0.75rem',
                                  fontWeight: 500
                                }} 
                              />
                            </Stack>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Box>
            </>
          )}
        </Box>
      );
    }

    // For delete actions - show deleted resource details (but skip appliance_deleted and user_deleted as they have their own handlers)
    if (log.action.includes('delete') && log.action !== 'appliance_delete' && log.action !== 'appliance_deleted' && log.action !== 'user_delete' && log.action !== 'user_deleted') {
      return (
        <Box>
          <Alert severity="error" sx={{ mb: 2 }}>
            Diese Ressource wurde gelöscht
          </Alert>
          <Box sx={{
            '& table': {
              borderCollapse: 'collapse',
              width: '100%',
            },
            '& td': {
              padding: '8px 12px',
              borderBottom: `1px solid ${isDarkMode 
                ? 'rgba(255, 255, 255, 0.08)' 
                : 'rgba(0, 0, 0, 0.08)'}`,
            },
            '& tr:last-child td': {
              borderBottom: 'none',
            },
            '& td:first-of-type': {
              fontWeight: 500,
              color: isDarkMode 
                ? 'rgba(255, 255, 255, 0.6)' 
                : 'rgba(0, 0, 0, 0.6)',
              width: '30%',
              minWidth: '120px',
            },
            '& td:last-of-type': {
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              wordBreak: 'break-word',
              color: isDarkMode 
                ? 'rgba(255, 255, 255, 0.87)' 
                : 'rgba(0, 0, 0, 0.87)',
            },
          }}>
            <table>
              <tbody>
                {Object.entries(details).map(([key, value]) => {
                  if (key === 'password' || key.includes('secret')) return null;
                  
                  const formattedKey = key
                    .replace(/_/g, ' ')
                    .replace(/([A-Z])/g, ' $1')
                    .trim()
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
                  
                  let formattedValue = value;
                  if (typeof value === 'object' && value !== null) {
                    formattedValue = JSON.stringify(value, null, 2);
                  } else if (value === null || value === undefined) {
                    formattedValue = '-';
                  } else {
                    formattedValue = value.toString();
                  }
                  
                  return (
                    <tr key={key}>
                      <td style={{
                        fontWeight: 500,
                        color: isDarkMode 
                          ? 'rgba(255, 255, 255, 0.6)' 
                          : 'rgba(0, 0, 0, 0.6)',
                      }}>{formattedKey}:</td>
                      <td style={{
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        wordBreak: 'break-word',
                        color: isDarkMode 
                          ? 'rgba(255, 255, 255, 0.87)' 
                          : 'rgba(0, 0, 0, 0.87)',
                      }}>{formattedValue}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>
        </Box>
      );
    }

    // For appliance revert actions - show clean details
    if (log.action === 'appliance_reverted' || log.action === 'applianceReverted') {
      const name = details.appliance_name || log.resourceName || '-';
      const revertedLogId = details.revertedFromLogId || '-';
      const revertedBy = details.revertedBy || '-';
      
      // Parse JSON strings if needed
      let revertedToData = details.revertedToData || {};
      let revertedFromData = details.revertedFromData || {};
      
      if (typeof revertedToData === 'string') {
        try {
          revertedToData = JSON.parse(revertedToData);
        } catch (e) {
          console.error('Error parsing revertedToData:', e);
        }
      }
      
      if (typeof revertedFromData === 'string') {
        try {
          revertedFromData = JSON.parse(revertedFromData);
        } catch (e) {
          console.error('Error parsing revertedFromData:', e);
        }
      }
      
      // Extract changed fields by comparison
      const changedFields = {};
      const fieldsToCompare = ['transparency', 'openModeMini', 'openModeMobile', 
                              'openModeDesktop', 'blurAmount', 'color', 'isFavorite',
                              'startCommand', 'stopCommand', 'statusCommand', 'restartCommand',
                              'remoteDesktopEnabled', 'url', 'description'];
      
      fieldsToCompare.forEach(field => {
        const fromValue = revertedFromData[field];
        const toValue = revertedToData[field];
        
        if (fromValue !== toValue && fromValue !== undefined) {
          changedFields[field] = {
            from: fromValue,
            to: toValue
          };
        }
      });
      
      return (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>Wiederhergestellte Service-Details:</Typography>
          <Box sx={{
            '& table': { borderCollapse: 'collapse', width: '100%' },
            '& td': { 
              padding: '8px', 
              borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`
            },
            '& td:first-of-type': { fontWeight: 500, width: '35%' }
          }}>
            <table>
              <tbody>
                <tr><td>Service-Name:</td><td>{name}</td></tr>
                <tr><td>Wiederhergestellt von Log-ID:</td><td>{revertedLogId}</td></tr>
                <tr><td>Wiederhergestellt von:</td><td>{revertedBy}</td></tr>
              </tbody>
            </table>
          </Box>
          
          {Object.keys(changedFields).length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 3, mb: 2 }}>Rückgängig gemachte Änderungen:</Typography>
              <Box sx={{
                '& table': { borderCollapse: 'collapse', width: '100%' },
                '& td': { padding: '8px' }
              }}>
                <table>
                  <tbody>
                    {Object.entries(changedFields).map(([field, values]) => {
                      const fieldNameMap = {
                        isFavorite: 'Favorit',
                        startCommand: 'Start-Befehl',
                        stopCommand: 'Stop-Befehl',
                        statusCommand: 'Status-Befehl',
                        restartCommand: 'Restart-Befehl',
                        remoteDesktopEnabled: 'Remote Desktop',
                        transparency: 'Transparenz',
                        blurAmount: 'Unschärfe',
                      };
                      const formattedField = fieldNameMap[field] || field;
                      
                      let formattedFrom = values.from;
                      let formattedTo = values.to;
                      
                      if (typeof values.from === 'boolean') {
                        formattedFrom = values.from ? 'Ja' : 'Nein';
                      }
                      if (typeof values.to === 'boolean') {
                        formattedTo = values.to ? 'Ja' : 'Nein';
                      }
                      
                      return (
                        <tr key={field}>
                          <td style={{width: '35%'}}>{formattedField}:</td>
                          <td>
                            <Chip 
                              label={String(formattedFrom)} 
                              size="small"
                              sx={{ 
                                backgroundColor: '#f44336',
                                color: '#fff',
                                mr: 1,
                                textDecoration: 'line-through'
                              }} 
                            />
                            →
                            <Chip 
                              label={String(formattedTo)} 
                              size="small"
                              sx={{ 
                                backgroundColor: '#66bb6a',
                                color: '#fff',
                                ml: 1
                              }} 
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Box>
            </>
          )}
        </Box>
      );
    }

    // For appliance restored actions - show formatted restored service details  
    if (log.action === 'appliance_restored' || log.action === 'applianceRestored') {
      const applianceData = details.restoredApplianceData || details;
      const name = applianceData.name || details.appliance_name || '-';
      const restoredFromLogId = details.restoredFromLogId || '-';
      const newName = details.newName || name;
      
      return (
        <Box>
          <Alert severity="success" sx={{ mb: 2 }}>
            Service wurde erfolgreich wiederhergestellt
            {newName !== name && ` (umbenannt zu: ${newName})`}
          </Alert>
          
          <Typography variant="subtitle2" sx={{ mb: 2 }}>Wiederhergestellte Service-Details:</Typography>
          <Box sx={{
            '& table': { borderCollapse: 'collapse', width: '100%' },
            '& td': { 
              padding: '8px', 
              borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`
            },
            '& td:first-of-type': { fontWeight: 500, width: '35%' }
          }}>
            <table>
              <tbody>
                <tr><td>Service Name:</td><td>{name}</td></tr>
                {newName !== name && <tr><td>Neuer Name:</td><td>{newName}</td></tr>}
                <tr><td>Kategorie:</td><td>{applianceData.category || '-'}</td></tr>
                <tr><td>Beschreibung:</td><td>{applianceData.description || '-'}</td></tr>
                <tr><td>URL:</td><td>{applianceData.url || '-'}</td></tr>
                <tr><td>Icon:</td><td>{applianceData.icon || '-'}</td></tr>
                <tr><td>Farbe:</td><td>
                  <span style={{
                    backgroundColor: applianceData.color || '#000000', 
                    padding: '2px 8px', 
                    borderRadius: '4px'
                  }}>
                    {applianceData.color || '-'}
                  </span>
                </td></tr>
                <tr><td>Favorit:</td><td>{applianceData.isFavorite ? 'Ja' : 'Nein'}</td></tr>
                <tr><td>Auto-Start:</td><td>{applianceData.autoStart ? 'Ja' : 'Nein'}</td></tr>
              </tbody>
            </table>
          </Box>
          
          {applianceData.customCommands && applianceData.customCommands.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 3, mb: 2 }}>Benutzerdefinierte Befehle:</Typography>
              <Box sx={{
                '& table': { borderCollapse: 'collapse', width: '100%' },
                '& td': { padding: '8px' }
              }}>
                <table>
                  <tbody>
                    {applianceData.customCommands.map((cmd, index) => (
                      <tr key={index}>
                        <td style={{width: '35%'}}>{cmd.description || `Befehl ${index + 1}`}:</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{cmd.command}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            </>
          )}
          
          <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic' }}>
            Wiederhergestellt aus Audit-Log ID: {restoredFromLogId}
          </Typography>
        </Box>
      );
    }

    // Default view - show all details in table format
    return (
      <Box sx={{
        '& table': {
          borderCollapse: 'collapse',
          width: '100%',
        },
        '& td': {
          padding: '8px 12px',
          borderBottom: `1px solid ${isDarkMode 
            ? 'rgba(255, 255, 255, 0.08)' 
            : 'rgba(0, 0, 0, 0.08)'}`,
        },
        '& tr:last-child td': {
          borderBottom: 'none',
        },
        '& td:first-of-type': {
          fontWeight: 500,
          color: isDarkMode 
            ? 'rgba(255, 255, 255, 0.6)' 
            : 'rgba(0, 0, 0, 0.6)',
          width: '30%',
          minWidth: '120px',
        },
        '& td:last-of-type': {
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          wordBreak: 'break-word',
          color: isDarkMode 
            ? 'rgba(255, 255, 255, 0.87)' 
            : 'rgba(0, 0, 0, 0.87)',
        },
      }}>
        <table>
          <tbody>
            {Object.entries(details).map(([key, value]) => {
              if (key === 'password' || key.includes('secret')) return null;
              
              // Special handling for restored_items or restoredItems
              if ((key === 'restored_items' || key === 'restoredItems') && typeof value === 'object' && value !== null) {
                // Return a special component for restored items
                return (
                  <tr key={key}>
                    <td colSpan={2} style={{ padding: 0 }}>
                      <Box sx={{ p: 1 }}>
                        <Typography variant="subtitle2" sx={{ 
                          mb: 1,
                          fontWeight: 500,
                          color: isDarkMode 
                            ? 'rgba(255, 255, 255, 0.6)' 
                            : 'rgba(0, 0, 0, 0.6)',
                        }}>
                          Restored Items:
                        </Typography>
                        <Box sx={{
                          ml: 2,
                          p: 1,
                          backgroundColor: isDarkMode
                            ? 'rgba(255, 255, 255, 0.03)'
                            : 'rgba(0, 0, 0, 0.03)',
                          borderRadius: 1,
                          border: `1px solid ${isDarkMode 
                            ? 'rgba(255, 255, 255, 0.08)' 
                            : 'rgba(0, 0, 0, 0.08)'}`,
                        }}>
                          <Stack spacing={0.5}>
                            {Object.entries(value)
                              .filter(([_, count]) => count > 0)
                              .map(([itemKey, count]) => {
                                const formattedItemKey = itemKey
                                  .replace(/_/g, ' ')
                                  .split(' ')
                                  .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                                  .join(' ');
                                return (
                                  <Box key={itemKey} sx={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    py: 0.5,
                                    px: 1,
                                    '&:hover': {
                                      backgroundColor: isDarkMode
                                        ? 'rgba(255, 255, 255, 0.05)'
                                        : 'rgba(0, 0, 0, 0.05)',
                                      borderRadius: 0.5,
                                    }
                                  }}>
                                    <Typography variant="body2" sx={{ 
                                      color: isDarkMode 
                                        ? 'rgba(255, 255, 255, 0.7)' 
                                        : 'rgba(0, 0, 0, 0.7)' 
                                    }}>
                                      {formattedItemKey}
                                    </Typography>
                                    <Chip 
                                      label={count} 
                                      size="small"
                                      sx={{
                                        backgroundColor: isDarkMode
                                          ? 'rgba(100, 200, 255, 0.2)'
                                          : 'rgba(0, 150, 255, 0.1)',
                                        color: isDarkMode 
                                          ? '#64b5f6' 
                                          : '#1976d2',
                                        fontWeight: 600,
                                        minWidth: '40px',
                                      }}
                                    />
                                  </Box>
                                );
                              })}
                            {Object.values(value).every(count => count === 0) && (
                              <Typography variant="body2" sx={{ 
                                color: isDarkMode 
                                  ? 'rgba(255, 255, 255, 0.5)' 
                                  : 'rgba(0, 0, 0, 0.5)',
                                fontStyle: 'italic',
                              }}>
                                Keine Elemente wiederhergestellt
                              </Typography>
                            )}
                          </Stack>
                        </Box>
                      </Box>
                    </td>
                  </tr>
                );
              }
              
              // Skip rendering if this was handled above
              if (key === 'restored_items' || key === 'restoredItems') {
                return null;
              }
              
              // Format the key to be more readable
              const formattedKey = key
                .replace(/_/g, ' ')
                .replace(/([A-Z])/g, ' $1')
                .trim()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
              
              // Format the value
              let formattedValue = value;
              
              // Special handling for restored_items or restoredItems
              if ((key === 'restored_items' || key === 'restoredItems') && typeof value === 'object' && value !== null) {
                // Create a formatted list of restored items
                const items = Object.entries(value)
                  .filter(([_, count]) => count > 0)
                  .map(([itemKey, count]) => {
                    const formattedItemKey = itemKey
                      .replace(/_/g, ' ')
                      .split(' ')
                      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                      .join(' ');
                    return `${formattedItemKey}: ${count}`;
                  });
                
                if (items.length > 0) {
                  formattedValue = items.join(', ');
                } else {
                  formattedValue = 'Keine Elemente wiederhergestellt';
                }
              } else if (typeof value === 'object' && value !== null) {
                formattedValue = JSON.stringify(value, null, 2);
              } else if (value === null || value === undefined) {
                formattedValue = '-';
              } else {
                formattedValue = value.toString();
              }
              
              return (
                <tr key={key}>
                  <td style={{
                    fontWeight: 500,
                    color: isDarkMode 
                      ? 'rgba(255, 255, 255, 0.6)' 
                      : 'rgba(0, 0, 0, 0.6)',
                  }}>{formattedKey}:</td>
                  <td style={{
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    wordBreak: 'break-word',
                    color: isDarkMode 
                      ? 'rgba(255, 255, 255, 0.87)' 
                      : 'rgba(0, 0, 0, 0.87)',
                  }}>{formattedValue}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Box>
    );
  };

  return (
    <Box onClick={(e) => e.stopPropagation()}>
      {renderContent()}
      
      {/* Restore section */}
      {restoreInfo.canRestore && (
        <>
          <Divider sx={{ my: 2 }} />
          
          {restoreSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Erfolgreich {restoreInfo.type === 'restore' ? 'wiederhergestellt' : 'zurückgesetzt'}!
            </Alert>
          )}
          
          {restoreError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {restoreError}
            </Alert>
          )}

          {showNameInput && (
            <TextField
              fullWidth
              size="small"
              label={
                (log.action === 'user_delete' || log.action === 'user_deleted') && showEmailInput
                  ? "Neuer Benutzername (optional)"
                  : "Neuer Name (optional)"
              }
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              sx={{ mb: 2 }}
              placeholder={
                (log.action === 'user_delete' || log.action === 'user_deleted')
                  ? `Neuer Benutzername für ${getResourceName(log)}`
                  : `Neuer Name für ${getResourceName(log)}`
              }
              helperText={
                (log.action === 'user_delete' || log.action === 'user_deleted') && showEmailInput
                  ? "Lassen Sie leer, um den ursprünglichen Namen zu behalten"
                  : null
              }
            />
          )}

          {showEmailInput && (log.action === 'user_delete' || log.action === 'user_deleted') && (
            <TextField
              fullWidth
              size="small"
              label="Neue E-Mail-Adresse (erforderlich)"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              sx={{ mb: 2 }}
              placeholder="neue.email@example.com"
              required
              error={showEmailInput && !newEmail}
              helperText={
                showEmailInput && !newEmail 
                  ? "E-Mail-Adresse ist erforderlich für die Wiederherstellung"
                  : "Eine neue E-Mail-Adresse verhindert Konflikte mit bestehenden Benutzern"
              }
            />
          )}

          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              color={restoreInfo.type === 'restore' ? 'success' : 'warning'}
              startIcon={isRestoring ? <CircularProgress size={16} /> : 
                restoreInfo.type === 'restore' ? <History size={16} /> : <RotateCcw size={16} />}
              onClick={handleRestoreClick}
              disabled={isRestoring || restoreSuccess}
            >
              {restoreInfo.type === 'restore' ? 'Wiederherstellen' : 'Änderungen rückgängig machen'}
            </Button>
            
            {restoreInfo.type === 'restore' && !showNameInput && !showEmailInput && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setShowNameInput(true);
                  // Bei User-Wiederherstellung auch E-Mail-Feld anzeigen
                  if (log.action === 'user_delete' || log.action === 'user_deleted') {
                    setShowEmailInput(true);
                  }
                }}
              >
                {(log.action === 'user_delete' || log.action === 'user_deleted') 
                  ? 'Mit neuen Daten' 
                  : 'Mit neuem Namen'}
              </Button>
            )}
          </Stack>
        </>
      )}
    </Box>
  );
};

export default AuditLogDetailRenderer;
