import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Activity,
  Clock,
  Server,
  Gauge
} from 'lucide-react';

const MetricsDetailView = ({ metrics, formatBytes, formatUptime }) => {
  if (!metrics) return null;

  const getProgressColor = (percent) => {
    if (percent < 50) return 'success';
    if (percent < 80) return 'warning';
    return 'error';
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        System Metrics Overview
      </Typography>

      <Grid container spacing={2}>
        {/* CPU Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, backgroundColor: 'var(--card-bg)', backdropFilter: 'blur(var(--card-blur))' }}>
            <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Cpu size={20} style={{ marginRight: 8 }} />
              CPU & Load
            </Typography>
            
            {metrics.cpu && (
              <Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    CPU Usage: {metrics.cpu.percent || 0}%
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={metrics.cpu.percent || 0} 
                    color={getProgressColor(metrics.cpu.percent || 0)}
                    sx={{ mt: 1 }}
                  />
                </Box>
                
                <Grid container spacing={1}>
                  <Grid item xs={4}>
                    <Chip 
                      label={`1m: ${metrics.cpu.load1?.toFixed(2) || '0.00'}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <Chip 
                      label={`5m: ${metrics.cpu.load5?.toFixed(2) || '0.00'}`}
                      size="small"
                      variant="outlined"
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <Chip 
                      label={`15m: ${metrics.cpu.load15?.toFixed(2) || '0.00'}`}
                      size="small"
                      variant="outlined"
                    />
                  </Grid>
                </Grid>

                {(metrics.cpu.user || metrics.cpu.system) && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      CPU Counters: User: {metrics.cpu.user || 'N/A'} | System: {metrics.cpu.system || 'N/A'}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Memory Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, backgroundColor: 'var(--card-bg)', backdropFilter: 'blur(var(--card-blur))' }}>
            <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <MemoryStick size={20} style={{ marginRight: 8 }} />
              Memory
            </Typography>
            
            {metrics.memory && (
              <Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    RAM: {formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)} ({metrics.memory.usedPercent}%)
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={metrics.memory.usedPercent || 0} 
                    color={getProgressColor(metrics.memory.usedPercent || 0)}
                    sx={{ mt: 1 }}
                  />
                </Box>

                {metrics.memory.buffer > 0 && (
                  <Typography variant="caption" display="block">
                    Buffer: {formatBytes(metrics.memory.buffer)}
                  </Typography>
                )}
                
                {metrics.memory.cached > 0 && (
                  <Typography variant="caption" display="block">
                    Cached: {formatBytes(metrics.memory.cached)}
                  </Typography>
                )}

                {metrics.memory.swapTotal > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Swap: {formatBytes(metrics.memory.swapUsed)} / {formatBytes(metrics.memory.swapTotal)} ({metrics.memory.swapPercent}%)
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={metrics.memory.swapPercent || 0} 
                      color={getProgressColor(metrics.memory.swapPercent || 0)}
                      sx={{ mt: 1, height: 6 }}
                    />
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* System Info Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, backgroundColor: 'var(--card-bg)', backdropFilter: 'blur(var(--card-blur))' }}>
            <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Server size={20} style={{ marginRight: 8 }} />
              System Information
            </Typography>
            
            <List dense>
              {metrics.sysName && (
                <ListItem>
                  <ListItemText 
                    primary="Hostname"
                    secondary={metrics.sysName}
                  />
                </ListItem>
              )}
              
              {metrics.uptime && (
                <ListItem>
                  <ListItemText 
                    primary="Uptime"
                    secondary={formatUptime(metrics.uptime.totalSeconds || metrics.uptime)}
                  />
                </ListItem>
              )}
              
              {metrics.processes > 0 && (
                <ListItem>
                  <ListItemText 
                    primary="Processes"
                    secondary={`${metrics.processes} running`}
                  />
                </ListItem>
              )}
            </List>
          </Paper>
        </Grid>

        {/* Network Section */}
        {metrics.network && metrics.network.interfaceCount > 0 && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, backgroundColor: 'var(--card-bg)', backdropFilter: 'blur(var(--card-blur))' }}>
              <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Network size={20} style={{ marginRight: 8 }} />
                Network
              </Typography>
              
              <Typography variant="body2">
                Interfaces: {metrics.network.interfaceCount}
              </Typography>
              
              {metrics.network.interfaces && metrics.network.interfaces.length > 0 && (
                <List dense sx={{ mt: 1 }}>
                  {metrics.network.interfaces.map((iface, idx) => (
                    <ListItem key={idx}>
                      <ListItemText 
                        primary={iface.name}
                        secondary={`In: ${formatBytes(iface.inBytes || 0)} | Out: ${formatBytes(iface.outBytes || 0)}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
        )}

        {/* Disk Section - if we get disk data later */}
        {metrics.disk && metrics.disk.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2, backgroundColor: 'var(--card-bg)', backdropFilter: 'blur(var(--card-blur))' }}>
              <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <HardDrive size={20} style={{ marginRight: 8 }} />
                Storage
              </Typography>
              
              {metrics.disk.map((disk, idx) => (
                <Box key={idx} sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {disk.device}: {formatBytes(disk.used)} / {formatBytes(disk.total)} ({disk.percent}%)
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={disk.percent || 0} 
                    color={getProgressColor(disk.percent || 0)}
                    sx={{ mt: 1 }}
                  />
                </Box>
              ))}
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Last Update */}
      {metrics.timestamp && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Last Update: {new Date(metrics.timestamp).toLocaleString()}
        </Typography>
      )}
    </Box>
  );
};

export default MetricsDetailView;
