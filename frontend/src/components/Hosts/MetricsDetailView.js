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
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  IconButton,
  Alert,
  Tooltip
} from '@mui/material';
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Activity,
  Clock,
  Server,
  Gauge,
  Thermometer,
  ChevronDown,
  ChevronUp,
  Zap,
  Users,
  Database,
  Wifi,
  WifiOff,
  AlertCircle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

const MetricsDetailView = ({ metrics, formatBytes, formatUptime }) => {
  const [expandedSections, setExpandedSections] = React.useState({
    cpu: true,
    memory: true,
    disk: true,
    network: true,
    processes: false,
    sensors: false
  });

  if (!metrics) {
    return (
      <Alert severity="info">
        No metrics available. Please ensure SNMP is configured and the host is reachable.
      </Alert>
    );
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getProgressColor = (percent) => {
    if (percent < 50) return 'success';
    if (percent < 80) return 'warning';
    return 'error';
  };

  const getCpuLoadColor = (load, cores = 1) => {
    const loadPerCore = load / cores;
    if (loadPerCore < 0.7) return 'success';
    if (loadPerCore < 1.0) return 'warning';
    return 'error';
  };

  // Render System Information
  const renderSystemInfo = () => {
    if (!metrics.system) return null;
    
    return (
      <Paper sx={{ p: 2, mb: 2, backgroundColor: 'var(--card-bg)', backdropFilter: 'blur(var(--card-blur))' }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Server size={20} style={{ marginRight: 8 }} />
          System Information
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">Hostname</Typography>
            <Typography variant="body1">{metrics.system.name || 'Unknown'}</Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" color="text.secondary">Uptime</Typography>
            <Typography variant="body1">{formatUptime(metrics.system.uptime)}</Typography>
          </Grid>
          {metrics.system.description && (
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">Description</Typography>
              <Typography variant="body1" sx={{ fontSize: '0.9rem' }}>
                {metrics.system.description}
              </Typography>
            </Grid>
          )}
          {metrics.system.location && (
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">Location</Typography>
              <Typography variant="body1">{metrics.system.location}</Typography>
            </Grid>
          )}
          {metrics.system.contact && (
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">Contact</Typography>
              <Typography variant="body1">{metrics.system.contact}</Typography>
            </Grid>
          )}
        </Grid>
      </Paper>
    );
  };

  // Render CPU Metrics with detailed breakdown
  const renderCpuMetrics = () => {
    if (!metrics.cpu) return null;
    
    const cores = metrics.cpu.cores || 1;
    const usage = metrics.cpu.usage || {};
    
    return (
      <Paper sx={{ p: 2, mb: 2, backgroundColor: 'var(--card-bg)', backdropFilter: 'blur(var(--card-blur))' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
            <Cpu size={20} style={{ marginRight: 8 }} />
            CPU Metrics ({cores} core{cores !== 1 ? 's' : ''})
          </Typography>
          <IconButton size="small" onClick={() => toggleSection('cpu')}>
            {expandedSections.cpu ? <ChevronUp /> : <ChevronDown />}
          </IconButton>
        </Box>
        
        <Collapse in={expandedSections.cpu}>
          <Box sx={{ mt: 2 }}>
            {/* Total CPU Usage */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Total CPU Usage
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {usage.total || 0}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={usage.total || 0} 
                color={getProgressColor(usage.total || 0)}
                sx={{ height: 8, borderRadius: 1 }}
              />
            </Box>
            
            {/* CPU Usage Breakdown */}
            {(usage.user !== undefined || usage.system !== undefined) && (
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6} md={3}>
                  <Chip
                    icon={<Users size={14} />}
                    label={`User: ${usage.user || 0}%`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <Chip
                    icon={<Zap size={14} />}
                    label={`System: ${usage.system || 0}%`}
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <Chip
                    label={`Idle: ${usage.idle || 0}%`}
                    size="small"
                    variant="outlined"
                  />
                </Grid>
                {usage.wait !== undefined && (
                  <Grid item xs={6} md={3}>
                    <Chip
                      label={`I/O Wait: ${usage.wait || 0}%`}
                      size="small"
                      color="warning"
                      variant="outlined"
                    />
                  </Grid>
                )}
              </Grid>
            )}
            
            {/* Load Averages */}
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Load Averages
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={4}>
                <Tooltip title="1 minute average">
                  <Chip 
                    label={`1m: ${metrics.cpu.load1?.toFixed(2) || '0.00'}`}
                    size="small"
                    color={getCpuLoadColor(metrics.cpu.load1 || 0, cores)}
                  />
                </Tooltip>
              </Grid>
              <Grid item xs={4}>
                <Tooltip title="5 minute average">
                  <Chip 
                    label={`5m: ${metrics.cpu.load5?.toFixed(2) || '0.00'}`}
                    size="small"
                    color={getCpuLoadColor(metrics.cpu.load5 || 0, cores)}
                  />
                </Tooltip>
              </Grid>
              <Grid item xs={4}>
                <Tooltip title="15 minute average">
                  <Chip 
                    label={`15m: ${metrics.cpu.load15?.toFixed(2) || '0.00'}`}
                    size="small"
                    color={getCpuLoadColor(metrics.cpu.load15 || 0, cores)}
                  />
                </Tooltip>
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </Paper>
    );
  };

  // Render Memory Metrics
  const renderMemoryMetrics = () => {
    if (!metrics.memory) return null;
    
    const mem = metrics.memory;
    
    return (
      <Paper sx={{ p: 2, mb: 2, backgroundColor: 'var(--card-bg)', backdropFilter: 'blur(var(--card-blur))' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
            <MemoryStick size={20} style={{ marginRight: 8 }} />
            Memory
          </Typography>
          <IconButton size="small" onClick={() => toggleSection('memory')}>
            {expandedSections.memory ? <ChevronUp /> : <ChevronDown />}
          </IconButton>
        </Box>
        
        <Collapse in={expandedSections.memory}>
          <Box sx={{ mt: 2 }}>
            {/* RAM Usage */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  RAM Usage
                </Typography>
                <Typography variant="body2">
                  {formatBytes(mem.usedRam)} / {formatBytes(mem.totalRam)} ({mem.percentRam}%)
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={mem.percentRam || 0} 
                color={getProgressColor(mem.percentRam || 0)}
                sx={{ height: 8, borderRadius: 1 }}
              />
              
              {/* Memory breakdown */}
              <Grid container spacing={1} sx={{ mt: 1 }}>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Available: {formatBytes(mem.availableRam)}
                  </Typography>
                </Grid>
                {mem.buffer > 0 && (
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">
                      Buffer: {formatBytes(mem.buffer)}
                    </Typography>
                  </Grid>
                )}
                {mem.cache > 0 && (
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">
                      Cache: {formatBytes(mem.cache)}
                    </Typography>
                  </Grid>
                )}
                {mem.shared > 0 && (
                  <Grid item xs={6} md={3}>
                    <Typography variant="caption" color="text.secondary">
                      Shared: {formatBytes(mem.shared)}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
            
            {/* Swap Usage */}
            {mem.totalSwap > 0 && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Swap Usage
                  </Typography>
                  <Typography variant="body2">
                    {formatBytes(mem.usedSwap)} / {formatBytes(mem.totalSwap)} ({mem.percentSwap}%)
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={mem.percentSwap || 0} 
                  color={getProgressColor(mem.percentSwap || 0)}
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </Box>
            )}
          </Box>
        </Collapse>
      </Paper>
    );
  };

  // Render Disk Usage
  const renderDiskUsage = () => {
    if (!metrics.disk || metrics.disk.length === 0) return null;
    
    return (
      <Paper sx={{ p: 2, mb: 2, backgroundColor: 'var(--card-bg)', backdropFilter: 'blur(var(--card-blur))' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
            <HardDrive size={20} style={{ marginRight: 8 }} />
            Disk Usage
          </Typography>
          <IconButton size="small" onClick={() => toggleSection('disk')}>
            {expandedSections.disk ? <ChevronUp /> : <ChevronDown />}
          </IconButton>
        </Box>
        
        <Collapse in={expandedSections.disk}>
          <TableContainer sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Mount Point</TableCell>
                  <TableCell>Device</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="right">Used</TableCell>
                  <TableCell align="right">Available</TableCell>
                  <TableCell>Usage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {metrics.disk.map((disk, index) => (
                  <TableRow key={index}>
                    <TableCell>{disk.path}</TableCell>
                    <TableCell>{disk.device}</TableCell>
                    <TableCell align="right">{formatBytes(disk.total)}</TableCell>
                    <TableCell align="right">{formatBytes(disk.used)}</TableCell>
                    <TableCell align="right">{formatBytes(disk.available)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={disk.percent || 0} 
                          color={getProgressColor(disk.percent || 0)}
                          sx={{ width: 60, mr: 1 }}
                        />
                        <Typography variant="body2">
                          {disk.percent}%
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </Paper>
    );
  };

  // Render Network Interfaces
  const renderNetworkInterfaces = () => {
    if (!metrics.network || metrics.network.length === 0) return null;
    
    return (
      <Paper sx={{ p: 2, mb: 2, backgroundColor: 'var(--card-bg)', backdropFilter: 'blur(var(--card-blur))' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
            <Network size={20} style={{ marginRight: 8 }} />
            Network Interfaces ({metrics.network.length})
          </Typography>
          <IconButton size="small" onClick={() => toggleSection('network')}>
            {expandedSections.network ? <ChevronUp /> : <ChevronDown />}
          </IconButton>
        </Box>
        
        <Collapse in={expandedSections.network}>
          <TableContainer sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Interface</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Speed</TableCell>
                  <TableCell>MAC</TableCell>
                  <TableCell align="right">RX Bytes</TableCell>
                  <TableCell align="right">TX Bytes</TableCell>
                  <TableCell align="right">Errors</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {metrics.network.map((iface, index) => (
                  <TableRow key={index}>
                    <TableCell>{iface.name}</TableCell>
                    <TableCell>{iface.type}</TableCell>
                    <TableCell>
                      <Chip
                        icon={iface.status === 'up' ? <Wifi size={14} /> : <WifiOff size={14} />}
                        label={iface.status}
                        size="small"
                        color={iface.status === 'up' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {iface.speed > 0 ? `${(iface.speed / 1000000).toFixed(0)} Mbps` : '-'}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {iface.mac || '-'}
                    </TableCell>
                    <TableCell align="right">
                      {formatBytes(iface.statistics?.bytesReceived || 0)}
                    </TableCell>
                    <TableCell align="right">
                      {formatBytes(iface.statistics?.bytesSent || 0)}
                    </TableCell>
                    <TableCell align="right">
                      {(iface.statistics?.errorsIn || 0) + (iface.statistics?.errorsOut || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </Paper>
    );
  };

  // Render Process Information
  const renderProcessInfo = () => {
    if (!metrics.processes) return null;
    
    const procs = metrics.processes;
    
    return (
      <Paper sx={{ p: 2, mb: 2, backgroundColor: 'var(--card-bg)', backdropFilter: 'blur(var(--card-blur))' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
            <Activity size={20} style={{ marginRight: 8 }} />
            Processes
          </Typography>
          <IconButton size="small" onClick={() => toggleSection('processes')}>
            {expandedSections.processes ? <ChevronUp /> : <ChevronDown />}
          </IconButton>
        </Box>
        
        <Collapse in={expandedSections.processes}>
          <Box sx={{ mt: 2 }}>
            {/* Process summary */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Total</Typography>
                <Typography variant="h6">{procs.total || 0}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Running</Typography>
                <Typography variant="h6" color="success.main">{procs.running || 0}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Sleeping</Typography>
                <Typography variant="h6">{procs.sleeping || 0}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Stopped</Typography>
                <Typography variant="h6" color="error.main">{procs.stopped || 0}</Typography>
              </Grid>
            </Grid>
            
            {/* Top processes by CPU */}
            {procs.topProcesses && procs.topProcesses.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Top Processes by CPU
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Process Name</TableCell>
                        <TableCell align="right">CPU Time</TableCell>
                        <TableCell align="right">Memory</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {procs.topProcesses.slice(0, 5).map((proc, index) => (
                        <TableRow key={index}>
                          <TableCell>{proc.name}</TableCell>
                          <TableCell align="right">{proc.cpu}</TableCell>
                          <TableCell align="right">{formatBytes(proc.memory)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Box>
        </Collapse>
      </Paper>
    );
  };

  // Render Temperature Sensors
  const renderSensors = () => {
    if (!metrics.sensors || metrics.sensors.length === 0) return null;
    
    return (
      <Paper sx={{ p: 2, mb: 2, backgroundColor: 'var(--card-bg)', backdropFilter: 'blur(var(--card-blur))' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
            <Thermometer size={20} style={{ marginRight: 8 }} />
            Temperature Sensors
          </Typography>
          <IconButton size="small" onClick={() => toggleSection('sensors')}>
            {expandedSections.sensors ? <ChevronUp /> : <ChevronDown />}
          </IconButton>
        </Box>
        
        <Collapse in={expandedSections.sensors}>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {metrics.sensors.map((sensor, index) => (
              <Grid item xs={6} md={4} key={index}>
                <Box sx={{ 
                  p: 1, 
                  border: '1px solid', 
                  borderColor: 'divider',
                  borderRadius: 1
                }}>
                  <Typography variant="caption" color="text.secondary">
                    {sensor.name}
                  </Typography>
                  <Typography variant="h6">
                    {sensor.temperature.toFixed(1)}°C
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Collapse>
      </Paper>
    );
  };

  // Render collection timestamp
  const renderTimestamp = () => {
    if (!metrics.timestamp) return null;
    
    return (
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Last updated: {new Date(metrics.timestamp).toLocaleString()}
        </Typography>
      </Box>
    );
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <Gauge size={24} style={{ marginRight: 8 }} />
        System Metrics Overview
      </Typography>
      
      {renderSystemInfo()}
      
      <Grid container spacing={2}>
        <Grid item xs={12} lg={6}>
          {renderCpuMetrics()}
        </Grid>
        <Grid item xs={12} lg={6}>
          {renderMemoryMetrics()}
        </Grid>
      </Grid>
      
      {renderDiskUsage()}
      {renderNetworkInterfaces()}
      {renderProcessInfo()}
      {renderSensors()}
      {renderTimestamp()}
    </Box>
  );
};

export default MetricsDetailView;