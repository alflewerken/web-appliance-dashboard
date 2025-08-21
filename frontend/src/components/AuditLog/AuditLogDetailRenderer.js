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

const AuditLogDetailRenderer = ({ log, onRestoreComplete }) => {
  const theme = useTheme();
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState(null);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [newName, setNewName] = useState('');

  // Robuste Dark Mode Erkennung
  const isDarkMode = theme.palette.mode === 'dark' || document.body.classList.contains('theme-dark');
  
  const details = log.metadata || log.details || {};
  const restoreInfo = canRestore(log);

  const handleRestoreClick = async () => {
    setIsRestoring(true);
    setRestoreError(null);
    setRestoreSuccess(false);

    try {
      await handleRestore(log, showNameInput ? newName : null);
      setRestoreSuccess(true);
      if (onRestoreComplete) {
        onRestoreComplete();
      }
    } catch (error) {
      setRestoreError(error.response?.data?.error || error.message);
    } finally {
      setIsRestoring(false);
    }
  };

  // Render different views based on action type
  const renderContent = () => {
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
                          }}>{formattedField}:</td>
                          <td>
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Chip 
                                label={value || '-'} 
                                size="small" 
                                variant="outlined"
                                color="error"
                                sx={{ textDecoration: 'line-through' }}
                              />
                              <Typography variant="caption">→</Typography>
                              <Chip 
                                label={oldValue || '-'} 
                                size="small" 
                                variant="outlined"
                                color="success"
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
                            variant="outlined"
                            color="error"
                          />
                          <Typography variant="caption">→</Typography>
                          <Chip 
                            label={changes[field] || '-'} 
                            size="small" 
                            variant="outlined"
                            color="success"
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

    // For delete actions - show deleted resource details
    if (log.action.includes('delete')) {
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
    <Box>
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
              label="Neuer Name (optional)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              sx={{ mb: 2 }}
              placeholder={`Neuer Name für ${getResourceName(log)}`}
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
            
            {restoreInfo.type === 'restore' && !showNameInput && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => setShowNameInput(true)}
              >
                Mit neuem Namen
              </Button>
            )}
          </Stack>
        </>
      )}
    </Box>
  );
};

export default AuditLogDetailRenderer;
