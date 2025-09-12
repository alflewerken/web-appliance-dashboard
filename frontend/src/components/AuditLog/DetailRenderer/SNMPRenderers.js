import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Chip,
  Alert,
} from '@mui/material';

// Renderer for SNMP config created
export const renderSNMPConfigCreated = (log, details, isDarkMode) => {
  const newValues = details.newValues || {};
  const hostName = log.resourceName || details.hostName || '-';
  
  return (
    <Box>
      <Alert severity="success" sx={{ mb: 2 }}>
        SNMP-Konfiguration wurde erstellt
      </Alert>
      
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        Host: {hostName}
      </Typography>
      
      <Stack spacing={2}>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
            SNMP-Einstellungen
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            <Chip 
              label={`Status: ${newValues.enabled ? 'Aktiviert' : 'Deaktiviert'}`}
              size="small"
              color={newValues.enabled ? 'success' : 'default'}
            />
            <Chip 
              label={`Version: ${newValues.version || '2c'}`}
              size="small"
            />
            <Chip 
              label={`Port: ${newValues.port || 161}`}
              size="small"
            />
            <Chip 
              label={`Community: ***`}
              size="small"
              color="warning"
              variant="outlined"
            />
            {newValues.pollInterval && (
              <Chip 
                label={`Poll-Intervall: ${newValues.pollInterval}s`}
                size="small"
              />
            )}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

// Renderer for SNMP config updated
export const renderSNMPConfigUpdated = (log, details, isDarkMode) => {
  const oldValues = details.oldValues || {};
  const newValues = details.newValues || {};
  const changes = details.changes || {};
  const hostName = log.resourceName || details.hostName || '-';
  
  // Filter out undefined changes
  const actualChanges = Object.entries(changes).filter(([_, value]) => value !== undefined);
  
  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        SNMP-Konfiguration wurde aktualisiert
      </Alert>
      
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        Host: {hostName}
      </Typography>
      
      {actualChanges.length > 0 ? (
        <Stack spacing={2}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Geänderte Felder:
          </Typography>
          
          {actualChanges.map(([field, change]) => {
            const formatFieldName = (field) => {
              switch(field) {
                case 'enabled': return 'Status';
                case 'version': return 'SNMP Version';
                case 'community': return 'Community String';
                case 'port': return 'Port';
                case 'pollInterval': return 'Poll-Intervall';
                case 'poll_interval': return 'Poll-Intervall';
                default: return field;
              }
            };
            
            const formatValue = (val, field) => {
              if (field === 'enabled') return val ? 'Aktiviert' : 'Deaktiviert';
              if (field === 'community') return '***'; // Maskiert
              if (field === 'pollInterval' || field === 'poll_interval') return `${val}s`;
              return val?.toString() || '-';
            };
            
            return (
              <Box key={field}>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                  {formatFieldName(field)}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip 
                    label={formatValue(change.old, field)}
                    size="small"
                    sx={{
                      backgroundColor: '#f44336',
                      color: '#fff',
                      textDecoration: 'line-through'
                    }}
                  />
                  <Typography variant="caption">→</Typography>
                  <Chip 
                    label={formatValue(change.new, field)}
                    size="small"
                    sx={{
                      backgroundColor: '#4caf50',
                      color: '#fff'
                    }}
                  />
                </Stack>
              </Box>
            );
          })}
        </Stack>
      ) : (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            Aktuelle Konfiguration:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            <Chip 
              label={`Status: ${newValues.enabled ? 'Aktiviert' : 'Deaktiviert'}`}
              size="small"
              color={newValues.enabled ? 'success' : 'default'}
            />
            <Chip 
              label={`Version: ${newValues.version || '2c'}`}
              size="small"
            />
            <Chip 
              label={`Port: ${newValues.port || 161}`}
              size="small"
            />
            {newValues.pollInterval && (
              <Chip 
                label={`Poll-Intervall: ${newValues.pollInterval}s`}
                size="small"
              />
            )}
          </Stack>
        </Box>
      )}
    </Box>
  );
};

// Renderer for SNMP config reverted
export const renderSNMPConfigReverted = (log, details, isDarkMode) => {
  const revertedFromLogId = details.revertedFromLogId || '-';
  const oldValues = details.oldValues || {};
  const newValues = details.newValues || {};
  const hostName = log.resourceName || details.hostName || '-';
  
  return (
    <Box>
      <Alert severity="warning" sx={{ mb: 2 }}>
        SNMP-Konfiguration wurde zurückgesetzt
      </Alert>
      
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        Host: {hostName}
      </Typography>
      
      <Box sx={{ mb: 2 }}>
        <Chip 
          label={`Zurückgesetzt von Log ID: ${revertedFromLogId}`}
          size="small"
          color="warning"
          variant="outlined"
        />
      </Box>
      
      <Stack spacing={2}>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
            Wiederhergestellte Konfiguration
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            <Chip 
              label={`Status: ${newValues.enabled ? 'Aktiviert' : 'Deaktiviert'}`}
              size="small"
              color={newValues.enabled ? 'success' : 'default'}
            />
            <Chip 
              label={`Version: ${newValues.version || '2c'}`}
              size="small"
            />
            <Chip 
              label={`Port: ${newValues.port || 161}`}
              size="small"
            />
            {newValues.pollInterval && (
              <Chip 
                label={`Poll-Intervall: ${newValues.pollInterval}s`}
                size="small"
              />
            )}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

// Renderer for metrics logging updated
export const renderMetricsLoggingUpdated = (log, details, isDarkMode) => {
  const hostName = log.resourceName || details.hostName || '-';
  
  // Parse config and customNames if they're strings
  let config = details.config || {};
  let customNames = details.customNames || details.custom_names || {};
  
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch (e) {
      console.error('Error parsing metrics config:', e);
    }
  }
  
  if (typeof customNames === 'string') {
    try {
      customNames = JSON.parse(customNames);
    } catch (e) {
      console.error('Error parsing custom names:', e);
    }
  }
  
  const enabledMetrics = Object.entries(config).filter(([_, enabled]) => enabled);
  
  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        Metrics Logging-Konfiguration wurde aktualisiert
      </Alert>
      
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        Host: {hostName}
      </Typography>
      
      <Stack spacing={2}>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
            Aktivierte Metriken ({enabledMetrics.length})
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            {enabledMetrics.map(([metric]) => (
              <Chip 
                key={metric}
                label={customNames[metric] || metric}
                size="small"
                color="primary"
                variant="outlined"
              />
            ))}
          </Stack>
        </Box>
        
        {Object.keys(customNames).length > 0 && (
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Benutzerdefinierte Namen
            </Typography>
            <Box sx={{ pl: 1 }}>
              {Object.entries(customNames).map(([key, name]) => (
                <Typography key={key} variant="caption" sx={{ display: 'block', fontSize: '0.75rem' }}>
                  {key} → {name}
                </Typography>
              ))}
            </Box>
          </Box>
        )}
      </Stack>
    </Box>
  );
};
