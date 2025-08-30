// Host-related renderers for audit log details
import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Chip,
  Alert,
} from '@mui/material';

// Renderer for host restored actions
export const renderHostRestored = (log, details, isDarkMode) => {
  // Parse restored data if it's a string
  let restoredData = details.restoredHostData || details.restored_host_data || details;
  if (typeof restoredData === 'string') {
    try {
      restoredData = JSON.parse(restoredData);
    } catch (e) {
      console.error('Error parsing restored host data:', e);
      restoredData = details;
    }
  }
  
  // Extract all relevant fields
  const id = restoredData.id || '-';
  const name = restoredData.name || '-';
  const description = restoredData.description || '-';
  const hostname = restoredData.hostname || '-';
  const port = restoredData.port || '-';
  const username = restoredData.username || '-';
  const icon = restoredData.icon || '-';
  const color = restoredData.color || '#00C7BE';
  const transparency = restoredData.transparency || restoredData.blur || '0.48';
  const sshKeyName = restoredData.sshKeyName || restoredData.ssh_key_name || '-';
  const privateKey = restoredData.privateKey || restoredData.private_key ? 'Vorhanden' : 'Nicht gesetzt';
  const isActive = restoredData.isActive !== undefined ? (restoredData.isActive ? 'Aktiv' : 'Inaktiv') : 
                  restoredData.is_active !== undefined ? (restoredData.is_active ? 'Aktiv' : 'Inaktiv') : 'Aktiv';
  
  // Remote Desktop Details
  const remoteDesktopEnabled = restoredData.remoteDesktopEnabled || restoredData.remote_desktop_enabled ? 'Ja' : 'Nein';
  const remoteDesktopType = restoredData.remoteDesktopType || restoredData.remote_desktop_type || '-';
  const remoteProtocol = restoredData.remoteProtocol || restoredData.remote_protocol || '-';
  const remotePort = restoredData.remotePort || restoredData.remote_port || '-';
  const remoteUsername = restoredData.remoteUsername || restoredData.remote_username || '-';
  const guacamolePerformanceMode = restoredData.guacamolePerformanceMode || restoredData.guacamole_performance_mode || '-';
  
  // RustDesk Details
  const rustdeskId = restoredData.rustdeskId || restoredData.rustdesk_id || '-';
  
  // Timestamps
  const createdAt = restoredData.createdAt || restoredData.created_at || '-';
  const updatedAt = restoredData.updatedAt || restoredData.updated_at || '-';
  const lastTested = restoredData.lastTested || restoredData.last_tested || null;
  const testStatus = restoredData.testStatus || restoredData.test_status || 'unknown';
  
  // Meta Information
  const restoredFromLogId = details.restoredFromLogId || details.restored_from_log_id || details.restoredLogId || '-';
  const restoredBy = details.restoredBy || details.restored_by || log.username || '-';
  
  // Format dates
  const formatDate = (date) => {
    if (!date || date === '-' || date === null) return '-';
    try {
      return new Date(date).toLocaleString('de-DE');
    } catch {
      return date;
    }
  };
  
  return (
    <Box>
      <Alert severity="success" sx={{ mb: 2 }}>
        Host wurde erfolgreich wiederhergestellt
      </Alert>
      
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        Wiederherstellungs-Details:
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
          <Chip 
            label={`Wiederhergestellt von Log ID: ${restoredFromLogId}`}
            size="small"
            color="info"
            variant="outlined"
          />
          <Chip 
            label={`Wiederhergestellt von: ${restoredBy}`}
            size="small"
            color="success"
            variant="outlined"
          />
        </Stack>
      </Box>
      
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        Host-Daten:
      </Typography>
      
      <Stack spacing={2}>
        {/* Basis-Informationen */}
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
            Basis-Informationen
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            {id !== '-' && (
              <Chip label={`ID: ${id}`} size="small" />
            )}
            <Chip 
              label={`Name: ${name}`} 
              size="small" 
              sx={{ fontWeight: 600 }}
            />
            {description !== '-' && (
              <Chip label={`Beschreibung: ${description}`} size="small" />
            )}
            <Chip 
              label={`Status: ${isActive}`}
              size="small"
              color={isActive === 'Aktiv' ? 'success' : 'default'}
            />
          </Stack>
        </Box>
        
        {/* Verbindungs-Details */}
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
            Verbindungs-Details
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            <Chip 
              label={`Hostname: ${hostname}`}
              size="small"
              sx={{ fontFamily: 'monospace' }}
            />
            <Chip 
              label={`Port: ${port}`}
              size="small"
            />
            <Chip 
              label={`Benutzername: ${username}`}
              size="small"
            />
            {sshKeyName !== '-' && (
              <Chip 
                label={`SSH-Key: ${sshKeyName}`}
                size="small"
                color="secondary"
              />
            )}
            <Chip 
              label={`Private Key: ${privateKey}`}
              size="small"
              color={privateKey === 'Vorhanden' ? 'success' : 'default'}
              variant="outlined"
            />
          </Stack>
        </Box>
        
        {/* Visuelle Einstellungen */}
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
            Visuelle Einstellungen
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            <Chip 
              label={`Icon: ${icon}`}
              size="small"
            />
            <Chip 
              label={`Farbe: ${color}`}
              size="small"
              sx={{ 
                backgroundColor: color,
                color: '#fff',
                fontWeight: 500
              }}
            />
            <Chip 
              label={`Transparenz: ${transparency}`}
              size="small"
            />
          </Stack>
        </Box>
        
        {/* Remote Desktop (wenn aktiviert) */}
        {remoteDesktopEnabled === 'Ja' && (
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Remote Desktop
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
              <Chip 
                label="Remote Desktop aktiviert"
                size="small"
                color="primary"
              />
              {remoteDesktopType !== '-' && (
                <Chip 
                  label={`Typ: ${remoteDesktopType}`}
                  size="small"
                />
              )}
              {remoteProtocol !== '-' && (
                <Chip 
                  label={`Protokoll: ${remoteProtocol}`}
                  size="small"
                />
              )}
              {remotePort !== '-' && (
                <Chip 
                  label={`Remote Port: ${remotePort}`}
                  size="small"
                />
              )}
              {remoteUsername !== '-' && (
                <Chip 
                  label={`Remote User: ${remoteUsername}`}
                  size="small"
                />
              )}
              {guacamolePerformanceMode !== '-' && (
                <Chip 
                  label={`Performance: ${guacamolePerformanceMode}`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Stack>
          </Box>
        )}
        
        {/* RustDesk (wenn vorhanden) */}
        {rustdeskId !== '-' && (
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
              RustDesk
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
              <Chip 
                label={`RustDesk ID: ${rustdeskId}`}
                size="small"
                color="info"
                sx={{ fontFamily: 'monospace' }}
              />
            </Stack>
          </Box>
        )}
        
        {/* Test-Status (wenn vorhanden) */}
        {testStatus !== 'unknown' && (
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Test-Status
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
              <Chip 
                label={`Status: ${testStatus}`}
                size="small"
                color={testStatus === 'success' ? 'success' : testStatus === 'failed' ? 'error' : 'default'}
              />
              {lastTested && (
                <Chip 
                  label={`Zuletzt getestet: ${formatDate(lastTested)}`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Stack>
          </Box>
        )}
        
        {/* Zeitstempel */}
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
            Zeitstempel
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            <Chip 
              label={`Erstellt: ${formatDate(createdAt)}`}
              size="small"
              variant="outlined"
            />
            <Chip 
              label={`Aktualisiert: ${formatDate(updatedAt)}`}
              size="small"
              variant="outlined"
            />
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

// Renderer for host reverted actions
export const renderHostReverted = (log, details, isDarkMode) => {
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
};

// Renderer for host update actions
export const renderHostUpdate = (log, details, isDarkMode) => {
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
};
