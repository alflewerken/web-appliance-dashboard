import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './HostMonitoringTab.css';
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
  Zap,
  Download,
} from 'lucide-react';
import axios from '../../utils/axiosConfig';
import SNMPSetupWizard from '../SNMP/SNMPSetupWizard';
import MetricsDetailView from './MetricsDetailView';

const HostMonitoringTab = ({ host, getInputStyles, asCard = false, snmpConfig: parentConfig, onConfigChange }) => {
  const { t } = useTranslation();
  
  // State for Setup Wizard
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  
  // State for SNMP configuration - use parent config if provided
  const [snmpConfig, setSnmpConfig] = useState(parentConfig || {
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
  
  // Sync with parent config when it changes
  useEffect(() => {
    if (parentConfig) {
      setSnmpConfig(parentConfig);
    }
  }, [parentConfig]);
  
  // Update parent when config changes - but avoid infinite loops
  const updateParentConfig = (newConfig) => {
    setSnmpConfig(newConfig);
    if (onConfigChange) {
      onConfigChange(newConfig);
    }
  };

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
  const [testResult, setTestResult] = useState(null); // 'success' or 'error'

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
        // Don't call updateParentConfig here to avoid loops
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

  const handleTest = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    setTestResult(null);

    try {
      const response = await axios.post(`/api/hosts/${host.id}/snmp-test`, snmpConfig);
      if (response.data?.success) {
        // Zeige detaillierte Metriken in der Success-Meldung
        const metrics = response.data?.details?.metrics;
        let successMsg = 'SNMP connection test successful!\n\n';
        
        if (metrics) {
          successMsg += '📊 Retrieved Metrics:\n';
          
          // CPU Info
          if (metrics.cpu) {
            successMsg += `• CPU Usage: ${metrics.cpu.percent || 0}%`;
            if (metrics.cpu.load !== undefined) {
              successMsg += ` (Load: ${metrics.cpu.load})`;
            }
            successMsg += '\n';
          }
          
          // Memory Info
          if (metrics.memory) {
            const memUsed = formatBytes(metrics.memory.used);
            const memTotal = formatBytes(metrics.memory.total);
            const memPercent = metrics.memory.usedPercent || 0;
            successMsg += `• Memory: ${memUsed} / ${memTotal} (${memPercent.toFixed(1)}%)\n`;
          }
          
          // Uptime Info
          if (metrics.uptime) {
            const uptimeStr = formatUptime(metrics.uptime.totalSeconds);
            successMsg += `• Uptime: ${uptimeStr}`;
            if (metrics.uptime.formatted) {
              successMsg += ` (${metrics.uptime.formatted})`;
            }
            successMsg += '\n';
          }
          
          // System Info
          if (metrics.sysName) {
            successMsg += `• System: ${metrics.sysName}\n`;
          }
          
          // Disk Info
          if (metrics.disks && metrics.disks.length > 0) {
            successMsg += `• Disks: ${metrics.disks.length} mounted\n`;
            metrics.disks.forEach(disk => {
              const diskUsed = formatBytes(disk.used);
              const diskTotal = formatBytes(disk.total);
              successMsg += `  - ${disk.device}: ${diskUsed} / ${diskTotal} (${disk.percentUsed}%)\n`;
            });
          }
          
          // Interface Info
          if (metrics.interfaces && metrics.interfaces.length > 0) {
            successMsg += `• Network Interfaces: ${metrics.interfaces.length} found\n`;
          }
        }
        
        setSuccess(successMsg);
        setTestResult('success');
        
        // Update monitoring data directly with fresh test results
        if (metrics) {
          setMonitoringData({
            status: 'online',
            lastUpdate: new Date(),
            metrics: {
              cpu: metrics.cpu?.percent || 0,
              memory: metrics.memory || null,
              disk: metrics.disk || [],
              network: metrics.network || [],
              temperature: metrics.temperature || null,
              uptime: metrics.uptime?.totalSeconds || null,
            }
          });
        } else {
          loadMonitoringData(); // Fallback to loading from DB
        }
        
        // Längere Anzeigezeit für detaillierte Metriken
        setTimeout(() => setTestResult(null), 5000);
      } else {
        setError(response.data?.error || response.data?.message || 'Test failed');
        setTestResult('error');
        setTimeout(() => setTestResult(null), 3000);
      }
    } catch (err) {
      console.error('SNMP test error:', err);
      setError(`Connection test failed: ${err.response?.data?.error || err.message}`);
      setTestResult('error');
      setTimeout(() => setTestResult(null), 3000);
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
    <Box sx={{ padding: asCard ? 0 : '24px 24px 16px 24px' }}>
      {!asCard && (
        <Typography variant="h6" sx={{ mb: 2 }}>
          SNMP Monitoring Configuration
        </Typography>
      )}

      <FormControlLabel
        control={
          <Switch
            checked={snmpConfig.enabled}
            onChange={(e) => updateParentConfig({ ...snmpConfig, enabled: e.target.checked })}
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
                onChange={(e) => updateParentConfig({ ...snmpConfig, version: e.target.value })}
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
              onChange={(e) => updateParentConfig({ ...snmpConfig, port: parseInt(e.target.value) })}
              sx={getInputStyles()}
            />
          </Box>

          {(snmpConfig.version === '1' || snmpConfig.version === '2c') && (
            <TextField
              fullWidth
              label="Community String"
              value={snmpConfig.community}
              onChange={(e) => updateParentConfig({ ...snmpConfig, community: e.target.value })}
              sx={{ mt: 2, ...getInputStyles() }}
            />
          )}

          {snmpConfig.version === '3' && (
            <>
              <TextField
                fullWidth
                label="Username"
                value={snmpConfig.username}
                onChange={(e) => updateParentConfig({ ...snmpConfig, username: e.target.value })}
                sx={{ mt: 2, ...getInputStyles() }}
              />

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
                <FormControl fullWidth sx={getInputStyles()}>
                  <InputLabel>Auth Protocol</InputLabel>
                  <Select
                    value={snmpConfig.authProtocol}
                    onChange={(e) => updateParentConfig({ ...snmpConfig, authProtocol: e.target.value })}
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
                  onChange={(e) => updateParentConfig({ ...snmpConfig, authPassword: e.target.value })}
                  sx={getInputStyles()}
                />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
                <FormControl fullWidth sx={getInputStyles()}>
                  <InputLabel>Privacy Protocol</InputLabel>
                  <Select
                    value={snmpConfig.privProtocol}
                    onChange={(e) => updateParentConfig({ ...snmpConfig, privProtocol: e.target.value })}
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
                  onChange={(e) => updateParentConfig({ ...snmpConfig, privPassword: e.target.value })}
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
            onChange={(e) => updateParentConfig({ ...snmpConfig, pollInterval: parseInt(e.target.value) })}
            helperText="How often to collect metrics"
            sx={{ mt: 2, ...getInputStyles() }}
          />

          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            <Button
              variant="outlined"
              onClick={handleTest}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <Activity />}
              sx={{
                ...(testResult === 'success' && {
                  borderColor: 'success.main',
                  color: 'success.main',
                  boxShadow: '0 0 10px rgba(76, 175, 80, 0.5)',
                  animation: 'pulse-green 2s ease-out',
                  '&:hover': {
                    borderColor: 'success.dark',
                    backgroundColor: 'rgba(76, 175, 80, 0.08)',
                  }
                }),
                ...(testResult === 'error' && {
                  borderColor: 'error.main',
                  color: 'error.main',
                  boxShadow: '0 0 10px rgba(244, 67, 54, 0.5)',
                  animation: 'pulse-red 2s ease-out',
                  '&:hover': {
                    borderColor: 'error.dark',
                    backgroundColor: 'rgba(244, 67, 54, 0.08)',
                  }
                })
              }}
            >
              Test Connection
            </Button>
          </Box>

          {/* Monitoring Data Display */}
          {monitoringData.status === 'online' && monitoringData.metrics && (
            <MetricsDetailView 
              metrics={monitoringData.metrics}
              formatBytes={formatBytes}
              formatUptime={formatUptime}
            />
          )}
        </>
      )}

      {/* Auto-Setup Button - Prominent display when SNMP is not configured */}
      {!snmpConfig.enabled && !loading && (
        <Box sx={{ 
          mt: 3, 
          textAlign: 'center', 
          p: 3, 
          bgcolor: 'var(--modal-bg)', 
          backdropFilter: 'blur(var(--modal-blur))',
          WebkitBackdropFilter: 'blur(var(--modal-blur))',
          border: '1px solid var(--card-border)',
          borderRadius: 2 
        }}>
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
            onClick={() => {
              console.log('Auto-Setup SNMP button clicked');
              console.log('Current host:', host);
              setShowSetupWizard(true);
            }}
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
        <Alert 
          severity="error" 
          sx={{ 
            mt: 2,
            backgroundColor: 'rgba(211, 47, 47, 0.95) !important',
            color: 'white !important',
            border: '1px solid rgba(211, 47, 47, 1) !important',
            '& .MuiAlert-icon': {
              color: 'white !important'
            },
            '& .MuiAlert-message': {
              color: 'white !important'
            },
            '& .MuiAlert-action': {
              color: 'white !important'
            }
          }} 
          onClose={() => setError('')}
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert 
          severity="success" 
          sx={{ 
            mt: 2,
            backgroundColor: 'rgba(76, 175, 80, 0.95) !important',
            color: 'white !important',
            border: '1px solid rgba(76, 175, 80, 1) !important',
            '& .MuiAlert-icon': {
              color: 'white !important'
            },
            '& .MuiAlert-message': {
              color: 'white !important'
            },
            '& .MuiAlert-action': {
              color: 'white !important'
            }
          }} 
          onClose={() => setSuccess('')}
        >
          {success}
        </Alert>
      )}

      {/* SNMP Setup Wizard Dialog */}
      <SNMPSetupWizard
        open={showSetupWizard}
        onClose={() => setShowSetupWizard(false)}
        host={host}
        onSuccess={(wizardConfig) => {
          console.log('Wizard success, config:', wizardConfig);
          setShowSetupWizard(false);
          setSuccess('SNMP setup completed successfully!');
          
          // Update local config with values from wizard IMMEDIATELY
          if (wizardConfig) {
            const newConfig = {
              enabled: true,
              version: '2c',
              community: wizardConfig.community || 'public',
              port: wizardConfig.port || 161,
              username: '',
              authProtocol: 'SHA',
              authPassword: '',
              privProtocol: 'AES',
              privPassword: '',
              pollInterval: 60
            };
            console.log('Setting new config:', newConfig);
            updateParentConfig(newConfig);  // Use updateParentConfig instead
          }
          
          // Then reload for monitoring data
          setTimeout(() => {
            loadMonitoringData();
          }, 1000);
        }}
      />
    </Box>
  );
};

export default HostMonitoringTab;
