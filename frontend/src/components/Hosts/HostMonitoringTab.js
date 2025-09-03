import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Divider,
  FormControlLabel,
  Switch,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
} from '@mui/material';
import {
  Activity,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Thermometer,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Save,
  Zap,
  Download,
} from 'lucide-react';
import axios from '../../utils/axiosConfig';
import SNMPSetupWizard from '../SNMP/SNMPSetupWizard';

const HostMonitoringTab = ({ host, getInputStyles }) => {
  const { t } = useTranslation();
  
  // State for Setup Wizard
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  
  // State for SNMP configuration
  const [snmpConfig, setSnmpConfig] = useState({
    enabled: false,
    version: '2c',
    community: 'public',
    port: 161,
    username: '',
    authProtocol: 'SHA',
    authPassword: '',
    privProtocol: 'AES', 
    privPassword: '',
    pollInterval: 60,
  });

  // State for monitoring data
  const [monitoringData, setMonitoringData] = useState({
    status: 'offline',
    lastUpdate: null,
    metrics: {
      cpu: null,
      memory: null,
      disk: [],
      network: [],
      temperature: null,
      uptime: null,
    }
  });

  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load SNMP configuration
  useEffect(() => {
    if (host?.id) {
      loadSNMPConfig();
    }
  }, [host?.id]);

  const loadSNMPConfig = async () => {
    try {
      const response = await axios.get(`/api/hosts/${host.id}/snmp-config`);
      if (response.data?.config) {
        setSnmpConfig(response.data.config);
        if (response.data.config.enabled) {
          loadMonitoringData();
        }
      }
    } catch (err) {
      console.error('Failed to load SNMP config:', err);
    }
  };

  const loadMonitoringData = async () => {
    try {
      const response = await axios.get(`/api/hosts/${host.id}/monitoring-data`);
      setMonitoringData(response.data);
    } catch (err) {
      console.error('Failed to load monitoring data:', err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await axios.put(`/api/hosts/${host.id}/snmp-config`, snmpConfig);
      setSuccess('SNMP configuration saved successfully');
      if (snmpConfig.enabled) {
        loadMonitoringData();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(`/api/hosts/${host.id}/snmp-test`, snmpConfig);
      if (response.data?.success) {
        setSuccess('SNMP connection test successful');
        loadMonitoringData();
      } else {
        setError(response.data?.error || 'Test failed');
      }
    } catch (err) {
      setError('Connection test failed');
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    return parts.join(' ') || '< 1m';
  };

  const formatBytes = (bytes) => {
    if (!bytes) return 'N/A';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <Box sx={{ padding: '24px 24px 16px 24px' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        SNMP Monitoring Configuration
      </Typography>

      <FormControlLabel
        control={
          <Switch
            checked={snmpConfig.enabled}
            onChange={(e) => setSnmpConfig({ ...snmpConfig, enabled: e.target.checked })}
          />
        }
        label="Enable SNMP Monitoring"
        sx={{ mb: 2 }}
      />

      {snmpConfig.enabled && (
        <>
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <FormControl fullWidth sx={getInputStyles()}>
              <InputLabel>SNMP Version</InputLabel>
              <Select
                value={snmpConfig.version}
                onChange={(e) => setSnmpConfig({ ...snmpConfig, version: e.target.value })}
                label="SNMP Version"
              >
                <MenuItem value="1">SNMP v1</MenuItem>
                <MenuItem value="2c">SNMP v2c</MenuItem>
                <MenuItem value="3">SNMP v3</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Port"
              type="number"
              value={snmpConfig.port}
              onChange={(e) => setSnmpConfig({ ...snmpConfig, port: parseInt(e.target.value) })}
              sx={getInputStyles()}
            />
          </Box>

          {(snmpConfig.version === '1' || snmpConfig.version === '2c') && (
            <TextField
              fullWidth
              label="Community String"
              value={snmpConfig.community}
              onChange={(e) => setSnmpConfig({ ...snmpConfig, community: e.target.value })}
              sx={{ mt: 2, ...getInputStyles() }}
            />
          )}

          {snmpConfig.version === '3' && (
            <>
              <TextField
                fullWidth
                label="Username"
                value={snmpConfig.username}
                onChange={(e) => setSnmpConfig({ ...snmpConfig, username: e.target.value })}
                sx={{ mt: 2, ...getInputStyles() }}
              />

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
                <FormControl fullWidth sx={getInputStyles()}>
                  <InputLabel>Auth Protocol</InputLabel>
                  <Select
                    value={snmpConfig.authProtocol}
                    onChange={(e) => setSnmpConfig({ ...snmpConfig, authProtocol: e.target.value })}
                    label="Auth Protocol"
                  >
                    <MenuItem value="MD5">MD5</MenuItem>
                    <MenuItem value="SHA">SHA</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Auth Password"
                  type="password"
                  value={snmpConfig.authPassword}
                  onChange={(e) => setSnmpConfig({ ...snmpConfig, authPassword: e.target.value })}
                  sx={getInputStyles()}
                />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
                <FormControl fullWidth sx={getInputStyles()}>
                  <InputLabel>Privacy Protocol</InputLabel>
                  <Select
                    value={snmpConfig.privProtocol}
                    onChange={(e) => setSnmpConfig({ ...snmpConfig, privProtocol: e.target.value })}
                    label="Privacy Protocol"
                  >
                    <MenuItem value="DES">DES</MenuItem>
                    <MenuItem value="AES">AES</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Privacy Password"
                  type="password"
                  value={snmpConfig.privPassword}
                  onChange={(e) => setSnmpConfig({ ...snmpConfig, privPassword: e.target.value })}
                  sx={getInputStyles()}
                />
              </Box>
            </>
          )}

          <TextField
            fullWidth
            label="Poll Interval (seconds)"
            type="number"
            value={snmpConfig.pollInterval}
            onChange={(e) => setSnmpConfig({ ...snmpConfig, pollInterval: parseInt(e.target.value) })}
            helperText="How often to collect metrics"
            sx={{ mt: 2, ...getInputStyles() }}
          />

          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            <Button
              variant="outlined"
              onClick={handleTest}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <Activity />}
            >
              Test Connection
            </Button>

            <Button
              variant="contained"
              onClick={handleSave}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <Save />}
            >
              Save Configuration
            </Button>
          </Box>

          {/* Monitoring Data Display */}
          {monitoringData.status === 'online' && (
            <>
              <Divider sx={{ my: 3 }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Current Metrics</Typography>
                <IconButton onClick={loadMonitoringData} size="small">
                  <RefreshCw size={20} />
                </IconButton>
              </Box>

              {monitoringData.lastUpdate && (
                <Typography variant="caption" sx={{ display: 'block', mb: 2 }}>
                  Last Update: {new Date(monitoringData.lastUpdate).toLocaleString()}
                </Typography>
              )}

              <List>
                {monitoringData.metrics.cpu !== null && (
                  <ListItem>
                    <ListItemIcon><Cpu /></ListItemIcon>
                    <ListItemText 
                      primary="CPU Usage"
                      secondary={`${monitoringData.metrics.cpu}%`}
                    />
                  </ListItem>
                )}

                {monitoringData.metrics.memory && (
                  <ListItem>
                    <ListItemIcon><MemoryStick /></ListItemIcon>
                    <ListItemText 
                      primary="Memory Usage"
                      secondary={`${formatBytes(monitoringData.metrics.memory.used)} / ${formatBytes(monitoringData.metrics.memory.total)}`}
                    />
                  </ListItem>
                )}

                {monitoringData.metrics.uptime && (
                  <ListItem>
                    <ListItemIcon><Clock /></ListItemIcon>
                    <ListItemText 
                      primary="Uptime"
                      secondary={formatUptime(monitoringData.metrics.uptime)}
                    />
                  </ListItem>
                )}
              </List>
            </>
          )}
        </>
      )}

      {/* Auto-Setup Button - Prominent display when SNMP is not configured */}
      {!snmpConfig.enabled && !loading && (
        <Box sx={{ mt: 3, textAlign: 'center', p: 3, bgcolor: 'background.paper', borderRadius: 2 }}>
          <Zap size={48} style={{ marginBottom: '16px', color: '#1976d2' }} />
          <Typography variant="h6" gutterBottom>
            SNMP Not Configured
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enable monitoring with our automatic SNMP setup wizard.
            No manual configuration required!
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<Download />}
            onClick={() => setShowSetupWizard(true)}
            sx={{ 
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
            }}
          >
            Auto-Setup SNMP
          </Button>
        </Box>
      )}

      {/* Status Messages */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* SNMP Setup Wizard Dialog */}
      <SNMPSetupWizard
        open={showSetupWizard}
        onClose={() => setShowSetupWizard(false)}
        host={host}
        onSuccess={() => {
          setShowSetupWizard(false);
          setSuccess('SNMP setup completed successfully!');
          // Reload SNMP config
          fetchSnmpConfig();
        }}
      />
    </Box>
  );
};

export default HostMonitoringTab;
