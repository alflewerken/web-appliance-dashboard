// Appliance/Service-related renderers for audit log details - COMPLETE VERSION
import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Chip,
  Alert,
} from '@mui/material';

// Renderer for appliance update actions
export const renderApplianceUpdate = (log, details, isDarkMode) => {
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
};

// Renderer for appliance deleted actions
export const renderApplianceDeleted = (log, details, isDarkMode) => {
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
};

// Renderer for appliance reverted actions
export const renderApplianceReverted = (log, details, isDarkMode) => {
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
};

// Renderer for appliance restored actions
export const renderApplianceRestored = (log, details, isDarkMode) => {
  // Parse restored data if it's a string
  let applianceData = details.restoredApplianceData || details.restored_appliance_data || details;
  if (typeof applianceData === 'string') {
    try {
      applianceData = JSON.parse(applianceData);
    } catch (e) {
      console.error('Error parsing restored appliance data:', e);
      applianceData = details;
    }
  }
  
  // Extract all relevant fields
  const id = applianceData.id || '-';
  const name = applianceData.name || details.appliance_name || '-';
  const newName = details.newName || name;
  const category = applianceData.category || '-';
  const description = applianceData.description || '-';
  const url = applianceData.url || '-';
  const icon = applianceData.icon || '-';
  const color = applianceData.color || '#00C7BE';
  const transparency = applianceData.transparency || applianceData.blur || '0.48';
  const isFavorite = applianceData.isFavorite !== undefined ? (applianceData.isFavorite ? 'Ja' : 'Nein') : 
                     applianceData.is_favorite !== undefined ? (applianceData.is_favorite ? 'Ja' : 'Nein') : 'Nein';
  const autoStart = applianceData.autoStart !== undefined ? (applianceData.autoStart ? 'Ja' : 'Nein') :
                    applianceData.auto_start !== undefined ? (applianceData.auto_start ? 'Ja' : 'Nein') : 'Nein';
  
  // Commands
  const statusCommand = applianceData.statusCommand || applianceData.status_command || '-';
  const startCommand = applianceData.startCommand || applianceData.start_command || '-';
  const stopCommand = applianceData.stopCommand || applianceData.stop_command || '-';
  const restartCommand = applianceData.restartCommand || applianceData.restart_command || '-';
  
  // Remote Desktop Details
  const remoteDesktopEnabled = applianceData.remoteDesktopEnabled || applianceData.remote_desktop_enabled ? 'Ja' : 'Nein';
  const remoteProtocol = applianceData.remoteProtocol || applianceData.remote_protocol || '-';
  const remoteHost = applianceData.remoteHost || applianceData.remote_host || '-';
  const remotePort = applianceData.remotePort || applianceData.remote_port || '-';
  const remoteUsername = applianceData.remoteUsername || applianceData.remote_username || '-';
  
  // SSH Connection
  const sshConnection = applianceData.sshConnection || applianceData.ssh_connection || '-';
  
  // Custom Commands
  const customCommands = applianceData.customCommands || applianceData.custom_commands || [];
  
  // Open Modes
  const openModeMini = applianceData.openModeMini || applianceData.open_mode_mini || 'external';
  const openModeMobile = applianceData.openModeMobile || applianceData.open_mode_mobile || 'external';
  const openModeDesktop = applianceData.openModeDesktop || applianceData.open_mode_desktop || 'external';
  
  // Timestamps
  const createdAt = applianceData.createdAt || applianceData.created_at || '-';
  const updatedAt = applianceData.updatedAt || applianceData.updated_at || '-';
  
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
        Service wurde erfolgreich wiederhergestellt
        {newName !== name && ` (umbenannt zu: ${newName})`}
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
        Service-Daten:
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
            {newName !== name && (
              <Chip 
                label={`Neuer Name: ${newName}`}
                size="small"
                color="warning"
              />
            )}
            <Chip label={`Kategorie: ${category}`} size="small" />
            {description !== '-' && (
              <Chip label={`Beschreibung: ${description}`} size="small" />
            )}
          </Stack>
        </Box>
        
        {/* Service-Details */}
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
            Service-Details
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            {url !== '-' && (
              <Chip 
                label={`URL: ${url}`}
                size="small"
                sx={{ fontFamily: 'monospace' }}
              />
            )}
            <Chip 
              label={`Favorit: ${isFavorite}`}
              size="small"
              color={isFavorite === 'Ja' ? 'warning' : 'default'}
            />
            <Chip 
              label={`Auto-Start: ${autoStart}`}
              size="small"
              color={autoStart === 'Ja' ? 'success' : 'default'}
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
        
        {/* Öffnungs-Modi */}
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
            Öffnungs-Modi
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            <Chip 
              label={`Mini: ${openModeMini}`}
              size="small"
              variant="outlined"
            />
            <Chip 
              label={`Mobile: ${openModeMobile}`}
              size="small"
              variant="outlined"
            />
            <Chip 
              label={`Desktop: ${openModeDesktop}`}
              size="small"
              variant="outlined"
            />
          </Stack>
        </Box>
        
        {/* Befehle (wenn vorhanden) */}
        {(statusCommand !== '-' || startCommand !== '-' || stopCommand !== '-' || restartCommand !== '-') && (
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Service-Befehle
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
              {statusCommand !== '-' && (
                <Chip 
                  label={`Status: ${statusCommand}`}
                  size="small"
                  sx={{ fontFamily: 'monospace' }}
                />
              )}
              {startCommand !== '-' && (
                <Chip 
                  label={`Start: ${startCommand}`}
                  size="small"
                  sx={{ fontFamily: 'monospace' }}
                />
              )}
              {stopCommand !== '-' && (
                <Chip 
                  label={`Stop: ${stopCommand}`}
                  size="small"
                  sx={{ fontFamily: 'monospace' }}
                />
              )}
              {restartCommand !== '-' && (
                <Chip 
                  label={`Restart: ${restartCommand}`}
                  size="small"
                  sx={{ fontFamily: 'monospace' }}
                />
              )}
            </Stack>
          </Box>
        )}
        
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
              {remoteProtocol !== '-' && (
                <Chip 
                  label={`Protokoll: ${remoteProtocol}`}
                  size="small"
                />
              )}
              {remoteHost !== '-' && (
                <Chip 
                  label={`Host: ${remoteHost}`}
                  size="small"
                />
              )}
              {remotePort !== '-' && (
                <Chip 
                  label={`Port: ${remotePort}`}
                  size="small"
                />
              )}
              {remoteUsername !== '-' && (
                <Chip 
                  label={`Username: ${remoteUsername}`}
                  size="small"
                />
              )}
            </Stack>
          </Box>
        )}
        
        {/* SSH Connection (wenn vorhanden) */}
        {sshConnection !== '-' && (
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
              SSH-Verbindung
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
              <Chip 
                label={`SSH: ${sshConnection}`}
                size="small"
                color="info"
                sx={{ fontFamily: 'monospace' }}
              />
            </Stack>
          </Box>
        )}
        
        {/* Benutzerdefinierte Befehle (wenn vorhanden) */}
        {customCommands && customCommands.length > 0 && (
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Benutzerdefinierte Befehle
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
              {customCommands.map((cmd, index) => (
                <Chip 
                  key={index}
                  label={`${cmd.description || `Befehl ${index + 1}`}: ${cmd.command}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontFamily: 'monospace' }}
                />
              ))}
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
