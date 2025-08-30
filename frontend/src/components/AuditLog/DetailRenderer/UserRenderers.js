// User-related renderers for audit log details - COMPLETE VERSION
import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Chip,
  Alert,
} from '@mui/material';

// Helper function to format dates
const formatDate = (date) => {
  if (!date || date === '-' || date === null) return '-';
  try {
    return new Date(date).toLocaleString('de-DE');
  } catch {
    return date;
  }
};

// Renderer for user activated/deactivated actions
export const renderUserStatusChange = (log, details, isDarkMode) => {
  const username = details.username || details.user_name || '-';
  const originalStatus = details.originalStatus !== undefined ? details.originalStatus : 
                       details.original_status !== undefined ? details.original_status : null;
  const newStatus = details.newStatus !== undefined ? details.newStatus : 
                   details.new_status !== undefined ? details.new_status : null;
  const changedBy = details.changedBy || details.changed_by || '-';
  const timestamp = log.createdAt || details.timestamp || log.timestamp || '-';
  
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
};

// Renderer for user deleted actions
export const renderUserDeleted = (log, details, isDarkMode) => {
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
  const deletedBy = details.deleted_by || details.deletedBy || '-';

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
};

// Renderer for user update actions
export const renderUserUpdate = (log, details, isDarkMode) => {
  const originalData = details.original_data || {};
  const newData = details.new_data || {};
  const fieldsUpdated = details.fields_updated || details.changedFields || details.changed_fields || [];
  const username = details.username || details.user_name || '-';
  const updatedBy = details.updated_by || details.updatedBy || '-';
  
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
                  const oldValue = originalData[fieldName];
                  const newValue = newData[fieldName];
                  
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
                  const formatFieldName = (field) => fieldMap[field] || field;
                  
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
};

// Renderer for user restored actions
export const renderUserRestored = (log, details, isDarkMode) => {
  const restoredFromLogId = details.restoredFromLogId || details.restored_from_log_id || '-';
  const restoredBy = details.restoredBy || details.restored_by || '-';
  const newName = details.newName || details.new_name || null;
  const newEmail = details.newEmail || details.new_email || null;
  
  let userData = details.restoredUserData || details.restored_user_data || {};
  if (typeof userData === 'string') {
    try {
      userData = JSON.parse(userData);
    } catch (e) {
      console.error('Error parsing userData:', e);
    }
  }
  
  const username = userData.username || userData.user_name || '-';
  const email = userData.email || '-';
  const role = userData.role || '-';
  const isActive = userData.isActive !== undefined ? (userData.isActive ? 'Ja' : 'Nein') : 
                  userData.is_active !== undefined ? (userData.is_active ? 'Ja' : 'Nein') : '-';
  const createdAt = userData.createdAt || userData.created_at || '-';
  const updatedAt = userData.updatedAt || userData.updated_at || '-';
  const lastLogin = userData.lastLogin || userData.last_login || null;
  const lastActivity = userData.lastActivity || userData.last_activity || null;

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
};

// Renderer for user reverted actions
export const renderUserReverted = (log, details, isDarkMode) => {
  const revertedFromLogId = details.revertedFromLogId || details.reverted_from_log_id || '-';
  const revertedBy = details.revertedBy || details.reverted_by || log.username || '-';
  const revertedToData = details.revertedToData || details.reverted_to_data || {};
  const revertedFromData = details.revertedFromData || details.reverted_from_data || {};
  
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
  
  const changedFields = [];
  const allKeys = new Set([...Object.keys(toData), ...Object.keys(fromData)]);
  
  allKeys.forEach(key => {
    if (key === 'id' || key === 'created_at' || key === 'updated_at' || 
        key === 'createdAt' || key === 'updatedAt' || key === 'password') {
      return;
    }
    
    const fromValue = fromData[key];
    const toValue = toData[key];
    
    if (JSON.stringify(fromValue) !== JSON.stringify(toValue)) {
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
};
