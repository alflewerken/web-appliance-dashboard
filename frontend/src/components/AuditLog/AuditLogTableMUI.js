// Simplified AuditLogTableMUI Component
import React, { useState, useEffect, useRef } from 'react';
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
  useTheme,
  Stack,
  Button,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  ChevronDown,
  ChevronUp,
  Globe,
  Monitor,
  Trash2,
  Users,
} from 'lucide-react';
import AuditLogDetailRenderer from './AuditLogDetailRenderer';
import { formatTimestamp, formatActionName, getActionIcon, getActionColor, getActionColorStyle } from './AuditLogActions';

const AuditLogTableMUI = ({
  logs = [],
  expandedRows = new Set(),
  onToggleExpand,
  onRefresh,
  onDeleteLog,
  cardStyles = {}, // Add default value
}) => {
  console.log('AuditLogTableMUI rendered with onDeleteLog:', typeof onDeleteLog);
  const theme = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef(null);

  // Common header cell styles
  const headerCellStyle = {
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(30, 30, 35, 0.5)'
      : 'rgba(200, 200, 210, 0.5)',
    borderBottom: `1px solid ${theme.palette.mode === 'dark' 
      ? 'rgba(255, 255, 255, 0.1)' 
      : 'rgba(0, 0, 0, 0.1)'}`,
    color: 'text.secondary',
    fontWeight: 600,
  };

  // Monitor container width for responsive view
  useEffect(() => {
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

  // Render mobile widget view
  const renderWidgetView = () => {
    return (
      <Stack spacing={0.5}>
        {logs.map((log) => {
          // Ensure we're comparing the same type (convert to string)
          const logIdStr = String(log.id);
          const isExpanded = expandedRows && expandedRows.has ? expandedRows.has(logIdStr) : false;
          
          // Debug logging
          if (logs.length > 0 && logs.indexOf(log) === 0) {
            console.log('[AuditLogTable] First log check:', {
              logId: log.id,
              logIdStr: logIdStr,
              expandedRows: expandedRows,
              isSet: expandedRows instanceof Set,
              hasMethod: typeof expandedRows.has,
              isExpanded: isExpanded
            });
          }
          
          return (
            <Paper
              key={log.id}
              sx={{
                ...cardStyles,
                p: 0.75,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: theme.shadows[2],
                }
              }}
              onClick={() => onToggleExpand && onToggleExpand(String(log.id))}
            >
              <Stack spacing={0.5}>
                {/* Erste Zeile: Zeitstempel, Action, Löschen/Expand */}
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  {/* Zeitstempel */}
                  <Typography 
                    variant="caption" 
                    color="text.secondary" 
                    sx={{ 
                      minWidth: '50px',
                      fontSize: '0.65rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {formatTimestamp(log.createdAt)}
                  </Typography>

                  {/* Action Badge */}
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.3,
                      px: 0.6,
                      py: 0.2,
                      borderRadius: '8px',
                      fontSize: '0.65rem',
                      fontWeight: 500,
                      flex: 1,
                      ...getActionColorStyle(log.action),
                    }}
                  >
                    {getActionIcon(log.action, 10)}
                    <span style={{ fontSize: '0.65rem' }}>{formatActionName(log.action)}</span>
                  </Box>

                  {/* Delete Button */}
                  {onDeleteLog && (
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDeleteLog) {
                          onDeleteLog(log);
                        }
                      }}
                      sx={{
                        p: 0.25,
                        color: '#ff6b6b',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 100, 100, 0.1)',
                        },
                      }}
                    >
                      <Trash2 size={12} />
                    </IconButton>
                  )}

                  {/* Expand Icon */}
                  <IconButton 
                    size="small"
                    sx={{ p: 0.25 }}
                  >
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </IconButton>
                </Stack>

                {/* Zweite Zeile: User Badge, Resource Badge, IP - mit festen Spalten */}
                <Stack direction="row" alignItems="center" spacing={0}>
                  {/* User Badge - Feste Breite */}
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.3,
                      px: 0.5,
                      py: 0.1,
                      borderRadius: '6px',
                      fontSize: '0.6rem',
                      backgroundColor: theme.palette.mode === 'dark' 
                        ? 'rgba(100, 100, 255, 0.2)'
                        : 'rgba(25, 118, 210, 0.15)',
                      color: theme.palette.mode === 'dark'
                        ? '#90caf9'
                        : '#1976d2',
                      border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(100, 100, 255, 0.3)' : 'rgba(25, 118, 210, 0.3)'}`,
                      minWidth: '80px',
                      maxWidth: '80px',
                      justifyContent: 'center',
                    }}
                  >
                    <Users size={9} />
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>{log.username || 'System'}</span>
                  </Box>

                  {/* Resource Badge - Feste Breite */}
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.3,
                      px: 0.5,
                      py: 0.1,
                      ml: 0.5,
                      borderRadius: '6px',
                      fontSize: '0.6rem',
                      backgroundColor: log.resourceName 
                        ? (theme.palette.mode === 'dark' 
                          ? 'rgba(100, 255, 100, 0.2)'
                          : 'rgba(76, 175, 80, 0.15)')
                        : 'transparent',
                      color: log.resourceName
                        ? (theme.palette.mode === 'dark'
                          ? '#81c784'
                          : '#4caf50')
                        : theme.palette.text.disabled,
                      border: log.resourceName 
                        ? `1px solid ${theme.palette.mode === 'dark' ? 'rgba(100, 255, 100, 0.3)' : 'rgba(76, 175, 80, 0.3)'}`
                        : 'none',
                      minWidth: '120px',
                      maxWidth: '120px',
                      justifyContent: 'center',
                    }}
                  >
                    <Monitor size={9} />
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>{log.resourceName || '-'}</span>
                  </Box>

                  {/* IP Address - Rest des verfügbaren Platzes */}
                  <Typography 
                    variant="caption" 
                    color="text.secondary"
                    sx={{ 
                      fontSize: '0.6rem',
                      marginLeft: 'auto',
                      opacity: 0.7,
                      minWidth: '90px',
                      textAlign: 'right',
                    }}
                  >
                    {log.ipAddress || '-'}
                  </Typography>
                </Stack>
              </Stack>

              {/* Expanded Details */}
              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <Divider sx={{ 
                  my: 1,
                  borderColor: theme.palette.mode === 'dark' 
                    ? 'rgba(255, 255, 255, 0.12)' 
                    : 'rgba(0, 0, 0, 0.12)'
                }} />
                <Box 
                  className="audit-log-detail-container"
                  sx={{
                    // Wichtige Styles für lange Inhalte in Widget-View
                    overflowX: 'auto',
                    maxWidth: '100%',
                    px: 1,
                    // Chips vollständig anzeigen und opak machen
                    '& .MuiChip-root': {
                      maxWidth: '100%',
                      height: 'auto',
                      opacity: '1 !important',
                      border: 'none !important',
                      backgroundColor: '#757575 !important',
                      color: '#ffffff !important',
                      '&[color="error"], &.MuiChip-colorError': {
                        backgroundColor: '#f44336 !important',
                      },
                      '&[color="success"], &.MuiChip-colorSuccess': {
                        backgroundColor: '#66bb6a !important',
                      },
                      '&[color="warning"], &.MuiChip-colorWarning': {
                        backgroundColor: '#ff9800 !important',
                      },
                      '&[color="info"], &.MuiChip-colorInfo': {
                        backgroundColor: '#2196f3 !important',
                      },
                      '&[style*="background-color: rgb(244, 67, 54)"]': {
                        backgroundColor: '#f44336 !important',
                      },
                      '&[style*="background-color: rgb(102, 187, 106)"]': {
                        backgroundColor: '#66bb6a !important',
                      },
                      '& .MuiChip-label': {
                        display: 'block',
                        overflow: 'visible',
                        textOverflow: 'unset',
                        whiteSpace: 'normal',
                        wordBreak: 'break-all',
                        padding: '6px 10px',
                        color: '#ffffff !important',
                      }
                    },
                    // Tabellen-Layout optimieren
                    '& table': {
                      tableLayout: 'auto',
                      width: '100%',
                    },
                    '& td': {
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                      '&:first-of-type': {
                        width: '35%',
                        minWidth: '80px',
                        verticalAlign: 'top',
                      }
                    },
                    // Stack für Chips responsive machen
                    '& .MuiStack-root': {
                      flexWrap: 'wrap',
                      gap: 0.5,
                      alignItems: 'flex-start',
                    }
                  }}>
                  <AuditLogDetailRenderer log={log} onRestoreComplete={onRefresh} />
                </Box>
              </Collapse>
            </Paper>
          );
        })}
      </Stack>
    );
  };

  // Render desktop table view
  const renderTableView = () => {
    return (
      <Box sx={{ 
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <TableContainer sx={{ 
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          boxShadow: 'none',
          flex: 1,
          overflow: 'auto',
        }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={headerCellStyle} width={50}></TableCell>
              <TableCell sx={headerCellStyle}>Zeitstempel</TableCell>
              <TableCell sx={headerCellStyle}>Benutzer</TableCell>
              <TableCell sx={{ ...headerCellStyle, minWidth: 200 }}>Aktion</TableCell>
              <TableCell sx={headerCellStyle}>Ressource</TableCell>
              <TableCell sx={headerCellStyle}>IP-Adresse</TableCell>
              <TableCell sx={headerCellStyle} width={50}>Aktion</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => {
              // Ensure we're comparing the same type (convert to string)
              const logIdStr = String(log.id);
              const isExpanded = expandedRows && expandedRows.has ? expandedRows.has(logIdStr) : false;
              
              return (
                <React.Fragment key={log.id}>
                  <TableRow
                    hover
                    sx={{
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.15)'
                          : 'rgba(0, 0, 0, 0.08)',
                      },
                    }}
                    onClick={() => onToggleExpand && onToggleExpand(String(log.id))}
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
                    <TableCell sx={{ minWidth: 200 }}>
                      <Box
                        component="span"
                        sx={{
                          display: 'flex',  // Changed to 'flex' for full width
                          alignItems: 'center',
                          justifyContent: 'center',  // Center the content
                          gap: 0.5,
                          px: 1.5,
                          py: 0.5,
                          borderRadius: '16px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          width: '100%',  // Take full width of the cell
                          ...getActionColorStyle(log.action),
                        }}
                      >
                        {getActionIcon(log.action)}
                        {formatActionName(log.action)}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {log.resourceName || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {log.ipAddress || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onDeleteLog) {
                            onDeleteLog(log);
                          }
                        }}
                        sx={{
                          color: '#ff6b6b',
                          '&:hover': {
                            backgroundColor: 'rgba(255, 100, 100, 0.1)',
                          },
                        }}
                        title="Eintrag löschen"
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  
                  {/* Expanded row with details */}
                  <TableRow>
                    <TableCell colSpan={8} sx={{ py: 0, px: 0 }}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box 
                          className="audit-log-detail-container"
                          sx={{
                            p: 3,
                            backgroundColor: theme.palette.mode === 'dark'
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'rgba(0, 0, 0, 0.02)',
                            // Wichtige Styles für lange Inhalte
                            overflowX: 'auto',
                            maxWidth: '100%',
                            // Chips vollständig anzeigen und opak machen
                            '& .MuiChip-root': {
                              maxWidth: '100%',
                              height: 'auto',
                              opacity: '1 !important',
                              border: 'none !important',
                              // Default opaque background
                              backgroundColor: '#757575 !important',
                              color: '#ffffff !important',
                              // Color variants
                              '&[color="error"], &.MuiChip-colorError': {
                                backgroundColor: '#f44336 !important',
                              },
                              '&[color="success"], &.MuiChip-colorSuccess': {
                                backgroundColor: '#66bb6a !important',
                              },
                              '&[color="warning"], &.MuiChip-colorWarning': {
                                backgroundColor: '#ff9800 !important',
                              },
                              '&[color="info"], &.MuiChip-colorInfo': {
                                backgroundColor: '#2196f3 !important',
                              },
                              '&[color="primary"], &.MuiChip-colorPrimary': {
                                backgroundColor: '#1976d2 !important',
                              },
                              '&[color="secondary"], &.MuiChip-colorSecondary': {
                                backgroundColor: '#dc004e !important',
                              },
                              // Override any sx styles that contain specific background colors
                              '&[style*="background-color: rgb(244, 67, 54)"]': {
                                backgroundColor: '#f44336 !important',
                              },
                              '&[style*="background-color: rgb(102, 187, 106)"]': {
                                backgroundColor: '#66bb6a !important',
                              },
                              '& .MuiChip-label': {
                                display: 'block',
                                overflow: 'visible',
                                textOverflow: 'unset',
                                whiteSpace: 'normal',
                                wordBreak: 'break-all',
                                padding: '8px 12px',
                                lineHeight: '1.4',
                                color: '#ffffff !important',
                              }
                            },
                            // Tabellen-Layout optimieren
                            '& table': {
                              tableLayout: 'auto',
                              width: '100%',
                              wordBreak: 'break-word',
                            },
                            '& td': {
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word',
                              '&:first-of-type': {
                                width: '30%',
                                minWidth: '100px',
                                verticalAlign: 'top',
                              },
                              '&:last-of-type': {
                                width: '70%',
                              }
                            },
                            // Stack für Chips responsive machen
                            '& .MuiStack-root': {
                              flexWrap: 'wrap',
                              gap: 1,
                              alignItems: 'flex-start',
                            }
                          }}>
                          <AuditLogDetailRenderer log={log} onRestoreComplete={onRefresh} />
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
      </Box>
    );
  };

  return (
    <Box ref={containerRef}>
      {useWidgetView ? renderWidgetView() : renderTableView()}
    </Box>
  );
};

export default AuditLogTableMUI;
