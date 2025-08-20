  // Render mobile widget view
  const renderWidgetView = () => {
    return (
      <Stack spacing={1}>
        {logs.map((log) => {
          const isExpanded = expandedRows.has(log.id);
          
          return (
            <Paper
              key={log.id}
              sx={{
                ...cardStyles,
                p: 1,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: theme.shadows[2],
                }
              }}
              onClick={() => onToggleExpand(log.id)}
            >
              {/* Kompakte einzeilige Darstellung */}
              <Stack direction="row" alignItems="center" spacing={1}>
                {/* Zeitstempel */}
                <Typography 
                  variant="caption" 
                  color="text.secondary" 
                  sx={{ 
                    minWidth: '60px',
                    fontSize: '0.7rem',
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
                    gap: 0.5,
                    px: 1,
                    py: 0.25,
                    borderRadius: '10px',
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    minWidth: '80px',
                    backgroundColor: getActionColor(log.action) + '20',
                    color: getActionColor(log.action),
                  }}
                >
                  {getActionIcon(log.action, 12)}
                  <span>{formatActionName(log.action)}</span>
                </Box>

                {/* Benutzer */}
                <Typography 
                  variant="caption" 
                  sx={{ 
                    flex: 1,
                    fontSize: '0.75rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {log.username || 'System'}
                </Typography>

                {/* Resource */}
                {log.resourceName && (
                  <Typography 
                    variant="caption" 
                    color="text.secondary"
                    sx={{ 
                      fontSize: '0.7rem',
                      maxWidth: '100px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {log.resourceName}
                  </Typography>
                )}

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
                      p: 0.5,
                      color: '#ff6b6b',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 100, 100, 0.1)',
                      },
                    }}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                )}

                {/* Expand/Collapse Icon */}
                <IconButton 
                  size="small"
                  sx={{ p: 0.5 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(log.id);
                  }}
                >
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </IconButton>
              </Stack>

              {/* Expanded Details */}
              {isExpanded && (
                <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <Stack spacing={0.5}>
                    {log.details && (
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          fontSize: '0.7rem',
                          color: theme.palette.mode === 'dark' 
                            ? 'rgba(255, 255, 255, 0.87)' 
                            : 'rgba(0, 0, 0, 0.87)'
                        }}
                      >
                        Details: {JSON.stringify(log.details, null, 2)}
                      </Typography>
                    )}
                    {log.ipAddress && (
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          fontSize: '0.7rem',
                          color: theme.palette.mode === 'dark' 
                            ? 'rgba(255, 255, 255, 0.6)' 
                            : 'rgba(0, 0, 0, 0.6)'
                        }}
                      >
                        IP: {log.ipAddress}
                      </Typography>
                    )}
                    {log.userAgent && (
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          fontSize: '0.7rem',
                          color: theme.palette.mode === 'dark' 
                            ? 'rgba(255, 255, 255, 0.6)' 
                            : 'rgba(0, 0, 0, 0.6)'
                        }}
                      >
                        User Agent: {log.userAgent}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              )}
            </Paper>
          );
        })}
      </Stack>
    );
  };