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
  logs,
  expandedRows,
  onToggleExpand,
  onRefresh,
  onDeleteLog,
  cardStyles, // Add cardStyles prop
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
          const isExpanded = expandedRows.has(log.id);
          
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
              onClick={() => onToggleExpand(log.id)}
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
                <AuditLogDetailRenderer log={log} onRestoreComplete={onRefresh} />
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
              <TableCell sx={headerCellStyle}>Aktion</TableCell>
              <TableCell sx={headerCellStyle}>Ressource</TableCell>
              <TableCell sx={headerCellStyle}>IP-Adresse</TableCell>
              <TableCell sx={headerCellStyle} width={50}>Aktion</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => {
              const isExpanded = expandedRows.has(log.id);
              
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
                    onClick={() => onToggleExpand(log.id)}
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
                    <TableCell>
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 1.5,
                          py: 0.5,
                          borderRadius: '16px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
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
                        <Box sx={{
                          p: 3,
                          backgroundColor: theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(0, 0, 0, 0.02)',
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
