// Appliance/Service-related renderers for audit log details - COMPLETE VERSION with Chip Layout
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
  const changes = details.changes || {};
  const oldValues = details.oldValues || details.old_values || {};
  const name = details.name || details.appliance_name || '-';
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
      <Alert severity="info" sx={{ mb: 2 }}>
        Service wurde aktualisiert
      </Alert>
      
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        Service-Informationen:
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
          <Chip 
            label={`Service: ${name}`}
            size="small"
            color="primary"
            sx={{ fontWeight: 600 }}
          />
          <Chip 
            label={`Anzahl Änderungen: ${changedFields.length}`}
            size="small"
            color="info"
            variant="outlined"
          />
        </Stack>
      </Box>
      
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        Geänderte Felder:
      </Typography>
      
      <Stack spacing={2}>
        {changedFields.map(field => {
          const fieldNameMap = {
            isFavorite: 'Favorit',
            startCommand: 'Start-Befehl',
            stopCommand: 'Stop-Befehl',
            statusCommand: 'Status-Befehl',
            restartCommand: 'Restart-Befehl',
            remoteDesktopEnabled: 'Remote Desktop',
            transparency: 'Transparenz',
            blurAmount: 'Unschärfe',
            openModeMini: 'Öffnungsmodus Mini',
            openModeMobile: 'Öffnungsmodus Mobile',
            openModeDesktop: 'Öffnungsmodus Desktop',
            autoStart: 'Auto-Start',
            url: 'URL',
            icon: 'Icon',
            color: 'Farbe',
            category: 'Kategorie',
            description: 'Beschreibung'
          };
          
          const formattedField = fieldNameMap[field] || field
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
            
          const oldValue = oldValues[field];
          const newValue = changes[field];
          
          // Format boolean values
          const formatValue = (val) => {
            if (typeof val === 'boolean') return val ? 'Ja' : 'Nein';
            if (val === null || val === undefined) return '-';
            if (typeof val === 'object') return JSON.stringify(val);
            return val.toString();
          };
          
          return (
            <Box key={field}>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                {formattedField}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip 
                  label={formatValue(oldValue)}
                  size="small"
                  sx={{
                    backgroundColor: '#f44336',
                    color: '#fff',
                    textDecoration: 'line-through'
                  }}
                />
                <Typography variant="caption">→</Typography>
                <Chip 
                  label={formatValue(newValue)}
                  size="small"
                  sx={{
                    backgroundColor: '#66bb6a',
                    color: '#fff'
                  }}
                />
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
};

// Renderer for appliance deleted actions  
export const renderApplianceDeleted = (log, details, isDarkMode) => {
  // Parse deleted appliance data if it's a string
  let applianceData = details.deletedApplianceData || details.deleted_appliance_data || details;
  if (typeof applianceData === 'string') {
    try {
      applianceData = JSON.parse(applianceData);
    } catch (e) {
      console.error('Error parsing deleted appliance data:', e);
      applianceData = details;
    }
  }
  
  // Extract all relevant fields
  const id = applianceData.id || '-';
  const name = applianceData.name || details.appliance_name || '-';
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
  
  // Timestamps
  const createdAt = applianceData.createdAt || applianceData.created_at || '-';
  const updatedAt = applianceData.updatedAt || applianceData.updated_at || '-';
  const deletedBy = details.deletedBy || details.deleted_by || log.username || '-';
  const deletedAt = details.deletedAt || details.deleted_at || log.timestamp || '-';
  
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
      <Alert severity="error" sx={{ mb: 2 }}>
        Service wurde gelöscht
      </Alert>
      
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        Löschungs-Details:
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
          <Chip 
            label={`Gelöscht von: ${deletedBy}`}
            size="small"
            color="error"
            variant="outlined"
          />
          <Chip 
            label={`Gelöscht am: ${formatDate(deletedAt)}`}
            size="small"
            color="error"
            variant="outlined"
          />
        </Stack>
      </Box>
      
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        Gelöschte Service-Daten:
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
              variant="outlined"
            />
            <Chip 
              label={`Auto-Start: ${autoStart}`}
              size="small"
              color={autoStart === 'Ja' ? 'success' : 'default'}
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

// Renderer for appliance reverted actions
export const renderApplianceReverted = (log, details, isDarkMode) => {
  const name = details.appliance_name || log.resourceName || '-';
  const revertedLogId = details.revertedFromLogId || details.reverted_from_log_id || '-';
  const revertedBy = details.revertedBy || details.reverted_by || '-';
  
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
      <Alert severity="info" sx={{ mb: 2 }}>
        Service-Änderungen wurden rückgängig gemacht
      </Alert>
      
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        Wiederherstellungs-Details:
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
          <Chip 
            label={`Service: ${name}`}
            size="small"
            color="primary"
            sx={{ fontWeight: 600 }}
          />
          <Chip 
            label={`Rückgängig von Log ID: ${revertedLogId}`}
            size="small"
            color="info"
            variant="outlined"
          />
          <Chip 
            label={`Durchgeführt von: ${revertedBy}`}
            size="small"
            color="success"
            variant="outlined"
          />
        </Stack>
      </Box>
      
      {Object.keys(changedFields).length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            Rückgängig gemachte Änderungen:
          </Typography>
          
          <Stack spacing={2}>
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
                openModeMini: 'Öffnungsmodus Mini',
                openModeMobile: 'Öffnungsmodus Mobile',
                openModeDesktop: 'Öffnungsmodus Desktop',
                url: 'URL',
                description: 'Beschreibung',
                color: 'Farbe'
              };
              
              const formattedField = fieldNameMap[field] || field
                .replace(/_/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
              
              // Format values
              const formatValue = (val) => {
                if (typeof val === 'boolean') return val ? 'Ja' : 'Nein';
                if (val === null || val === undefined) return '-';
                return val.toString();
              };
              
              return (
                <Box key={field}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                    {formattedField}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip 
                      label={formatValue(values.from)}
                      size="small"
                      sx={{
                        backgroundColor: '#f44336',
                        color: '#fff',
                        textDecoration: 'line-through'
                      }}
                    />
                    <Typography variant="caption">→</Typography>
                    <Chip 
                      label={formatValue(values.to)}
                      size="small"
                      sx={{
                        backgroundColor: '#66bb6a',
                        color: '#fff'
                      }}
                    />
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </>
      )}
    </Box>
  );
};

// Renderer for appliance restored actions - bereits komplett mit Chips implementiert
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
