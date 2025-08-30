// User-related renderers for audit log details - COMPLETE VERSION with Chip Layout
import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Chip,
  Alert,
} from '@mui/material';

// Renderer for user status change actions
export const renderUserStatusChange = (log, details, isDarkMode) => {
  const action = log.action;
  const username = details.username || details.user_name || '-';
  const email = details.email || '-';
  const performedBy = details.performedBy || details.performed_by || '-';
  const reason = details.reason || details.status_change_reason || null;
  
  const isActivation = action === 'user_activated' || action === 'userActivated';
  const statusText = isActivation ? 'aktiviert' : 'deaktiviert';
  const statusColor = isActivation ? 'success' : 'error';
  
  return (
    <Box>
      <Alert severity={isActivation ? 'success' : 'warning'} sx={{ mb: 2 }}>
        Benutzer wurde {statusText}
      </Alert>
      
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        Status-Änderung Details:
      </Typography>
      
      <Stack spacing={2}>
        {/* Benutzer-Informationen */}
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
            Benutzer-Informationen
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            <Chip 
              label={`Benutzername: ${username}`}
              size="small"
              sx={{ fontWeight: 600 }}
            />
            <Chip 
              label={`E-Mail: ${email}`}
              size="small"
            />
            <Chip 
              label={`Status: ${statusText}`}
              size="small"
              color={statusColor}
            />
          </Stack>
        </Box>
        
        {/* Durchgeführt von */}
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
            Aktion Details
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            <Chip 
              label={`Durchgeführt von: ${performedBy}`}
              size="small"
              color="info"
              variant="outlined"
            />
            {reason && (
              <Chip 
                label={`Grund: ${reason}`}
                size="small"
                variant="outlined"
              />
            )}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

// Renderer for user deleted actions
export const renderUserDeleted = (log, details, isDarkMode) => {
  // Parse deleted user data if it's a string
  let userData = details.deletedUserData || details.deleted_user_data || details;
  if (typeof userData === 'string') {
    try {
      userData = JSON.parse(userData);
    } catch (e) {
      console.error('Error parsing deleted user data:', e);
      userData = details;
    }
  }
  
  // Extract all relevant fields
  const id = userData.id || '-';
  const username = userData.username || userData.user_name || '-';
  const email = userData.email || '-';
  const role = userData.role || '-';
  const isActive = userData.isActive !== undefined ? (userData.isActive ? 'Aktiv' : 'Inaktiv') :
                  userData.is_active !== undefined ? (userData.is_active ? 'Aktiv' : 'Inaktiv') : '-';
  const createdAt = userData.createdAt || userData.created_at || '-';
  const updatedAt = userData.updatedAt || userData.updated_at || '-';
  const lastLogin = userData.lastLogin || userData.last_login || null;
  const lastActivity = userData.lastActivity || userData.last_activity || null;
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
        Benutzer wurde gelöscht
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
        Gelöschte Benutzer-Daten:
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
              label={`Benutzername: ${username}`}
              size="small"
              sx={{ fontWeight: 600 }}
            />
            <Chip 
              label={`E-Mail: ${email}`}
              size="small"
            />
            <Chip 
              label={`Rolle: ${role}`}
              size="small"
              color="secondary"
            />
            <Chip 
              label={`Status: ${isActive}`}
              size="small"
              color={isActive === 'Aktiv' ? 'success' : 'default'}
              variant="outlined"
            />
          </Stack>
        </Box>
        
        {/* Aktivitäts-Informationen */}
        {(lastLogin || lastActivity) && (
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Aktivitäts-Informationen
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
              {lastLogin && (
                <Chip 
                  label={`Letzter Login: ${formatDate(lastLogin)}`}
                  size="small"
                  variant="outlined"
                />
              )}
              {lastActivity && (
                <Chip 
                  label={`Letzte Aktivität: ${formatDate(lastActivity)}`}
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

// Renderer for user update actions  
export const renderUserUpdate = (log, details, isDarkMode) => {
  const changes = details.changes || {};
  const oldValues = details.oldValues || details.old_values || {};
  const username = details.username || details.user_name || '-';
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
        Benutzer wurde aktualisiert
      </Alert>
      
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        Benutzer-Informationen:
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
          <Chip 
            label={`Benutzername: ${username}`}
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
          const formattedField = field
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

// Renderer for user restored actions
export const renderUserRestored = (log, details, isDarkMode) => {
  // Parse restored data if it's a string
  let userData = details.restoredUserData || details.restored_user_data || details;
  if (typeof userData === 'string') {
    try {
      userData = JSON.parse(userData);
    } catch (e) {
      console.error('Error parsing restored user data:', e);
      userData = details;
    }
  }
  
  // Extract all relevant fields
  const id = userData.id || '-';
  const username = userData.username || userData.user_name || '-';
  const email = userData.email || '-';
  const role = userData.role || '-';
  const isActive = userData.isActive !== undefined ? (userData.isActive ? 'Aktiv' : 'Inaktiv') :
                  userData.is_active !== undefined ? (userData.is_active ? 'Aktiv' : 'Inaktiv') : 'Aktiv';
  const createdAt = userData.createdAt || userData.created_at || '-';
  const updatedAt = userData.updatedAt || userData.updated_at || '-';
  const lastLogin = userData.lastLogin || userData.last_login || null;
  const lastActivity = userData.lastActivity || userData.last_activity || null;
  
  // Meta Information
  const restoredFromLogId = details.restoredFromLogId || details.restored_from_log_id || '-';
  const restoredBy = details.restoredBy || details.restored_by || log.username || '-';
  const newName = details.newName || details.new_name || null;
  const newEmail = details.newEmail || details.new_email || null;
  
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
        Benutzer wurde erfolgreich wiederhergestellt
        {(newName || newEmail) && ' (mit neuen Daten)'}
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
      
      {(newName || newEmail) && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            Neue Benutzerdaten:
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
              {newName && (
                <Chip 
                  label={`Neuer Benutzername: ${newName}`}
                  size="small"
                  color="warning"
                  sx={{ fontWeight: 600 }}
                />
              )}
              {newEmail && (
                <Chip 
                  label={`Neue E-Mail: ${newEmail}`}
                  size="small"
                  color="warning"
                />
              )}
            </Stack>
          </Box>
        </>
      )}
      
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        Benutzer-Daten:
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
              label={`Benutzername: ${username}`}
              size="small"
              sx={{ fontWeight: 600 }}
            />
            <Chip 
              label={`E-Mail: ${email}`}
              size="small"
            />
            <Chip 
              label={`Rolle: ${role}`}
              size="small"
              color="secondary"
            />
            <Chip 
              label={`Status: ${isActive}`}
              size="small"
              color={isActive === 'Aktiv' ? 'success' : 'default'}
            />
          </Stack>
        </Box>
        
        {/* Aktivitäts-Informationen */}
        {(lastLogin || lastActivity) && (
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
              Aktivitäts-Informationen
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
              {lastLogin && (
                <Chip 
                  label={`Letzter Login: ${formatDate(lastLogin)}`}
                  size="small"
                  variant="outlined"
                />
              )}
              {lastActivity && (
                <Chip 
                  label={`Letzte Aktivität: ${formatDate(lastActivity)}`}
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

// Renderer for user reverted actions
export const renderUserReverted = (log, details, isDarkMode) => {
  const name = details.username || details.user_name || '-';
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
      <Alert severity="info" sx={{ mb: 2 }}>
        Benutzer-Änderungen wurden rückgängig gemacht
      </Alert>
      
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        Wiederherstellungs-Details:
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
          <Chip 
            label={`Benutzer: ${name}`}
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
      
      {Object.keys(revertedChanges).length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            Rückgängig gemachte Änderungen:
          </Typography>
          
          <Stack spacing={2}>
            {Object.entries(revertedChanges).map(([field, value]) => {
              const formattedField = field
                .replace(/_/g, ' ')
                .replace(/([A-Z])/g, ' $1')
                .trim()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
              
              const oldValue = restoredValues[field];
              
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
                      label={formatValue(value)}
                      size="small"
                      sx={{
                        backgroundColor: '#f44336',
                        color: '#fff',
                        textDecoration: 'line-through'
                      }}
                    />
                    <Typography variant="caption">→</Typography>
                    <Chip 
                      label={formatValue(oldValue)}
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
