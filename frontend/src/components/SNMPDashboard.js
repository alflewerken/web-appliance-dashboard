import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Grid,
  Typography,
  LinearProgress,
  Chip,
  Box,
  IconButton,
  Tooltip,
  Alert,
  Button,
  CircularProgress,
  Paper,
  Divider,
  Stack,
  Switch,
  FormControlLabel,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  TrendingUp,
  Memory,
  Storage,
  NetworkCheck,
  Refresh,
  Settings,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  AccessTime,
  Dns,
  Speed,
  BarChart
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
// Chart.js integration removed for now - will be added when needed
// import { Line } from 'react-chartjs-2';
// import { Chart as ChartJS, ... } from 'chart.js';

// Chart.js integration removed for now - will be added when needed
// ChartJS.register(
//   CategoryScale,
//   LinearScale,
//   PointElement,
//   LineElement,
//   Title,
//   ChartTooltip,
//   Legend,
//   Filler
// );

const SNMPDashboard = () => {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [selectedHost, setSelectedHost] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [hostStatus, setHostStatus] = useState({});
  
  // Get current theme from DOM
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';

  // Metriken abrufen
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/snmp/metrics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      
      const data = await response.json();
      
      // Metriken nach Host-ID organisieren
      const metricsMap = {};
      const statusMap = {};
      
      data.results?.forEach(result => {
        if (result.success && result.metrics) {
          metricsMap[result.host] = result.metrics;
          statusMap[result.host] = 'online';
        } else {
          statusMap[result.host] = 'offline';
        }
      });
      
      setMetrics(metricsMap);
      setHostStatus(statusMap);
      setError(null);
      
    } catch (err) {
      console.error('Error fetching SNMP metrics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Status abrufen
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/snmp/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      setHostStatus(data.hosts.reduce((acc, host) => {
        acc[host.name] = host.status;
        return acc;
      }, {}));
      
    } catch (err) {
      console.error('Error fetching status:', err);
    }
  }, []);

  // Auto-Refresh Setup
  useEffect(() => {
    fetchMetrics();
    fetchStatus();
    
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchMetrics();
        fetchStatus();
      }, refreshInterval);
      
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchMetrics, fetchStatus]);

  // Host Metric Card Component
  const HostMetricCard = ({ hostName, hostMetrics, status }) => {
    const getStatusColor = (value, thresholds) => {
      if (!value && value !== 0) return 'default';
      if (value >= thresholds.critical) return 'error';
      if (value >= thresholds.warning) return 'warning';
      return 'success';
    };

    const getStatusIcon = () => {
      switch (status) {
        case 'online':
          return <CheckCircle color="success" />;
        case 'offline':
          return <ErrorIcon color="error" />;
        default:
          return <Warning color="warning" />;
      }
    };

    if (!hostMetrics) {
      return (
        <Card 
          sx={{ 
            p: 2, 
            opacity: 0.5,
            backgroundColor: theme === 'dark' ? 'rgba(30,30,30,0.8)' : 'rgba(255,255,255,0.9)'
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <ErrorIcon color="disabled" />
            <Typography variant="h6">{hostName}</Typography>
          </Box>
          <Typography color="textSecondary" sx={{ mt: 1 }}>
            {t('monitoring.noData', 'Keine SNMP-Daten verfügbar')}
          </Typography>
        </Card>
      );
    }

    return (
      <Card 
        sx={{ 
          p: 2,
          cursor: 'pointer',
          transition: 'all 0.3s',
          backgroundColor: theme === 'dark' ? 'rgba(30,30,30,0.8)' : 'rgba(255,255,255,0.9)',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: 4
          }
        }}
        onClick={() => setSelectedHost({ name: hostName, metrics: hostMetrics })}
      >
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            {getStatusIcon()}
            <Typography variant="h6">{hostName}</Typography>
          </Box>
          <Chip 
            icon={<AccessTime />}
            label={hostMetrics.uptime?.formatted || 'N/A'}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* CPU */}
        <Box sx={{ mb: 2 }}>
          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <TrendingUp sx={{ fontSize: 16 }} />
            <Typography variant="caption" color="textSecondary">
              CPU Load
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={Math.min(hostMetrics.cpu?.percent || 0, 100)}
            color={getStatusColor(hostMetrics.cpu?.percent, { warning: 80, critical: 95 })}
            sx={{ height: 8, borderRadius: 1 }}
          />
          <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
            {hostMetrics.cpu?.percent?.toFixed(1) || 0}% • Load: {hostMetrics.cpu?.load?.toFixed(2) || 0}
          </Typography>
        </Box>

        {/* Memory */}
        <Box sx={{ mb: 2 }}>
          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <Memory sx={{ fontSize: 16 }} />
            <Typography variant="caption" color="textSecondary">
              Memory
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={hostMetrics.memory?.usedPercent || 0}
            color={getStatusColor(hostMetrics.memory?.usedPercent, { warning: 85, critical: 95 })}
            sx={{ height: 8, borderRadius: 1 }}
          />
          <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
            {hostMetrics.memory?.usedPercent?.toFixed(1) || 0}% • 
            {formatBytes(hostMetrics.memory?.used)} / {formatBytes(hostMetrics.memory?.total)}
          </Typography>
        </Box>

        {/* Processes */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Chip
            icon={<Dns />}
            label={`${hostMetrics.processes || 0} Processes`}
            size="small"
            variant="outlined"
          />
          <Chip
            label={hostMetrics.sysName || 'Unknown'}
            size="small"
            variant="outlined"
            color="secondary"
          />
        </Box>
      </Card>
    );
  };

  // Bytes formatieren
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Settings Dialog
  const SettingsDialog = () => (
    <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
      <DialogTitle>SNMP Monitoring Settings</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
            }
            label="Auto-Refresh"
          />
          
          <TextField
            label="Refresh Interval (ms)"
            type="number"
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(parseInt(e.target.value) || 30000)}
            disabled={!autoRefresh}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowSettings(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  // Host Detail Dialog
  const HostDetailDialog = () => {
    if (!selectedHost) return null;

    return (
      <Dialog 
        open={!!selectedHost} 
        onClose={() => setSelectedHost(null)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <NetworkCheck />
            {selectedHost.name} - SNMP Details
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>System Info</Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">
                    <strong>Name:</strong> {selectedHost.metrics.sysName}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Uptime:</strong> {selectedHost.metrics.uptime?.formatted}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Processes:</strong> {selectedHost.metrics.processes}
                  </Typography>
                </Stack>
              </Paper>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Performance</Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">
                    <strong>CPU:</strong> {selectedHost.metrics.cpu?.percent?.toFixed(1)}%
                  </Typography>
                  <Typography variant="body2">
                    <strong>Memory:</strong> {selectedHost.metrics.memory?.usedPercent?.toFixed(1)}%
                  </Typography>
                  <Typography variant="body2">
                    <strong>Load:</strong> {selectedHost.metrics.cpu?.load?.toFixed(2)}
                  </Typography>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedHost(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  };

  // Main Render
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" display="flex" alignItems="center" gap={1}>
          <BarChart />
          SNMP Monitoring
        </Typography>
        
        <Box display="flex" gap={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => { fetchMetrics(); fetchStatus(); }}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton onClick={() => setShowSettings(true)}>
              <Settings />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Status Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2, backgroundColor: 'success.main', color: 'white' }}>
            <Typography variant="h6">Online</Typography>
            <Typography variant="h3">
              {Object.values(hostStatus).filter(s => s === 'online').length}
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2, backgroundColor: 'error.main', color: 'white' }}>
            <Typography variant="h6">Offline</Typography>
            <Typography variant="h3">
              {Object.values(hostStatus).filter(s => s === 'offline').length}
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2, backgroundColor: 'info.main', color: 'white' }}>
            <Typography variant="h6">Total Hosts</Typography>
            <Typography variant="h3">
              {Object.keys(hostStatus).length}
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Loading */}
      {loading && (
        <Box display="flex" justifyContent="center" p={5}>
          <CircularProgress />
        </Box>
      )}

      {/* Host Metrics Grid */}
      {!loading && (
        <Grid container spacing={3}>
          {Object.entries(metrics).map(([hostName, hostMetrics]) => (
            <Grid item xs={12} md={6} lg={4} key={hostName}>
              <HostMetricCard 
                hostName={hostName} 
                hostMetrics={hostMetrics}
                status={hostStatus[hostName]}
              />
            </Grid>
          ))}
          
          {Object.keys(metrics).length === 0 && (
            <Grid item xs={12}>
              <Alert severity="info">
                {t('monitoring.noHosts', 'Keine SNMP-fähigen Hosts gefunden. Aktivieren Sie SNMP in den Host-Einstellungen.')}
              </Alert>
            </Grid>
          )}
        </Grid>
      )}

      {/* Dialogs */}
      <SettingsDialog />
      <HostDetailDialog />
    </Box>
  );
};

export default SNMPDashboard;