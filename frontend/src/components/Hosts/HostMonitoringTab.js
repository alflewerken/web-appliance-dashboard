import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
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
import MetricsTable from './MetricsTable';

const HostMonitoringTab = forwardRef(({ host, getInputStyles, asCard = false, snmpConfig: parentConfig, onConfigChange }, ref) => {
  const { t } = useTranslation();
  const metricsTableRef = useRef();
  
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
  const [lastPollTime, setLastPollTime] = useState(null);
  const [pollStatus, setPollStatus] = useState('idle'); // 'idle', 'polling', 'success', 'error'

  // Expose save method to parent
  useImperativeHandle(ref, () => ({
    saveMetricsConfiguration: async () => {
      if (metricsTableRef.current) {
        return await metricsTableRef.current.saveConfiguration();
      }
      return { success: true, message: t('monitoring.noMetricsToSave') };
    },
    hasUnsavedChanges: () => {
      if (metricsTableRef.current) {
        return metricsTableRef.current.hasUnsavedChanges();
      }
      return false;
    }
  }));

  // Initial fetch when tab opens
  const fetchInitialMetrics = async () => {
    if (!snmpConfig.enabled || !host?.id) {
      return;
    }
    
    setPollStatus('polling');
    
    try {
      // Use live-monitoring endpoint for initial fetch
      const response = await axios.get(`/api/hosts/${host.id}/live-monitoring`);
      
      if (response.data?.success || response.data?.metrics) {
        const metrics = response.data?.metrics;
        
        if (metrics) {
          // Transform metrics to the format expected by MetricsTable
          const transformedMetrics = transformMetrics(metrics);
          
          setMonitoringData({
            status: 'online',
            lastUpdate: new Date(),
            metrics: transformedMetrics
          });
          
          setLastPollTime(new Date());
          setPollStatus('success');
        }
      } else {
        setPollStatus('error');
        console.error('SNMP fetch failed:', response.data?.error);
      }
    } catch (err) {
      setPollStatus('error');
      console.error('SNMP fetch error:', err);
    }
  };
  
  // Transform metrics helper function
  const transformMetrics = (metrics) => {
    return {
      // System with OS info
      sysName: metrics.system?.name,
      sysDescr: metrics.system?.description,
      sysContact: metrics.system?.contact,
      sysLocation: metrics.system?.location,
      osType: metrics.system?.osType,
      osVersion: metrics.system?.osVersion,
      osDetails: metrics.system?.osDetails,
      uptime: {
        totalSeconds: metrics.system?.uptime,
        formatted: formatUptime(metrics.system?.uptime)
      },
      agentUptime: metrics.system?.agentUptime,
      
      // CPU - transform to percentage format
      cpu: {
        percent: metrics.cpu?.usage?.total || 0,
        user: metrics.cpu?.raw ? (metrics.cpu.raw.user / (metrics.cpu.raw.user + metrics.cpu.raw.system + metrics.cpu.raw.idle) * 100) : 0,
        system: metrics.cpu?.raw ? (metrics.cpu.raw.system / (metrics.cpu.raw.user + metrics.cpu.raw.system + metrics.cpu.raw.idle) * 100) : 0,
        idle: metrics.cpu?.raw ? (metrics.cpu.raw.idle / (metrics.cpu.raw.user + metrics.cpu.raw.system + metrics.cpu.raw.idle) * 100) : 0,
        load1: metrics.cpu?.load1,
        load5: metrics.cpu?.load5,
        load15: metrics.cpu?.load15,
        cores: metrics.cpu?.cores
      },
      
      // Memory - transform field names
      memory: {
        total: metrics.memory?.totalRam,
        used: metrics.memory?.usedRam,
        available: metrics.memory?.availableRam,
        usedPercent: metrics.memory?.percentRam,
        buffered: metrics.memory?.buffer,
        cached: metrics.memory?.cache,
        shared: metrics.memory?.shared,
        swapTotal: metrics.memory?.totalSwap,
        swapUsed: metrics.memory?.usedSwap,
        swapUsedPercent: metrics.memory?.percentSwap
      },
      
      // Disk - correct field name
      disk: metrics.disk?.map(d => ({
        path: d.path,
        device: d.device,
        total: d.total,
        used: d.used,
        available: d.available,
        percent: d.percent
      })) || [],
      
      // Network interfaces
      interfaces: metrics.network?.map(n => ({
        name: n.name || n.descr,
        descr: n.descr || n.name,
        type: n.type,
        speed: n.speed,
        operStatus: n.status === 'up' ? 1 : (n.operStatus || 2),
        status: n.status,
        inOctets: n.statistics?.bytesReceived || n.inOctets || 0,
        outOctets: n.statistics?.bytesSent || n.outOctets || 0,
        inErrors: n.statistics?.errorsIn || n.inErrors || 0,
        outErrors: n.statistics?.errorsOut || n.outErrors || 0
      })) || [],
      
      // Process info
      processes: {
        count: metrics.processes?.count || metrics.processCount || 0,
        user: metrics.processes?.user || 0,
        system: metrics.processes?.system || 0,
        running: metrics.processes?.running || 0,
        sleeping: metrics.processes?.sleeping || 0,
        stopped: metrics.processes?.stopped || 0,
        zombie: metrics.processes?.zombie || 0,
        top: metrics.processes?.top || []
      }
    };
  };
  
  // Setup polling effect
  useEffect(() => {

    if (!snmpConfig.enabled || !host?.id) {

      return;
    }
    
    // Fetch initial data

    fetchInitialMetrics();
    
    // Setup polling interval (10 seconds to match backend)
    const pollInterval = setInterval(() => {

      fetchInitialMetrics();
    }, 10000); // Poll every 10 seconds
    
    // Cleanup on unmount or config change
    return () => {

      clearInterval(pollInterval);
    };
  }, [snmpConfig.enabled, host?.id]);

  // Remove the duplicate polling effect - DELETE this entire useEffect

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
      // Add skipAudit parameter to prevent audit log for UI testing
      const response = await axios.post(`/api/hosts/${host.id}/snmp-test`, {
        ...snmpConfig,
        skipAudit: true  // Don't log UI tests in audit log
      });
      if (response.data?.success) {
        // Zeige detaillierte Metriken in der Success-Meldung
        const metrics = response.data?.details?.metrics;
        let successMsg = t('monitoring.snmpTestSuccess') + '\n\n';
        
        if (metrics) {
          successMsg += `📊 ${t('monitoring.retrievedMetrics')}:\n`;
          
          // System Info
          if (metrics.system) {
            successMsg += `• ${t('monitoring.system')}: ${metrics.system.name || t('monitoring.unknown')}\n`;
            if (metrics.system.uptime) {
              const uptimeStr = formatUptime(metrics.system.uptime);
              successMsg += `• ${t('monitoring.uptime')}: ${uptimeStr}\n`;
            }
          }
          
          // CPU Info
          if (metrics.cpu) {
            if (metrics.cpu.usage?.total !== undefined) {
              successMsg += `• ${t('monitoring.cpuUsage')}: ${metrics.cpu.usage.total}%\n`;
            }
            if (metrics.cpu.load1) {
              successMsg += `• ${t('monitoring.load')}: ${metrics.cpu.load1.toFixed(2)} / ${metrics.cpu.load5?.toFixed(2)} / ${metrics.cpu.load15?.toFixed(2)}\n`;
            }
          }
          
          // Memory Info
          if (metrics.memory) {
            const memUsed = formatBytes(metrics.memory.usedRam);
            const memTotal = formatBytes(metrics.memory.totalRam);
            const memPercent = metrics.memory.percentRam || 0;
            successMsg += `• ${t('monitoring.memory')}: ${memUsed} / ${memTotal} (${memPercent}%)\n`;
          }
          
          // Disk Info
          if (metrics.disk && metrics.disk.length > 0) {
            successMsg += `• ${t('monitoring.disks')}: ${t('monitoring.disksMounted', { count: metrics.disk.length })}\n`;
            metrics.disk.forEach(disk => {
              const diskUsed = formatBytes(disk.used);
              const diskTotal = formatBytes(disk.total);
              successMsg += `  - ${disk.path}: ${diskUsed} / ${diskTotal} (${disk.percent}%)\n`;
            });
          }
          
          // Network Info
          if (metrics.network && metrics.network.length > 0) {
            const upInterfaces = metrics.network.filter(n => n.status === 'up').length;
            successMsg += `• ${t('monitoring.network')}: ${t('monitoring.interfacesUp', { up: upInterfaces, total: metrics.network.length })}\n`;
          }
        }
        
        setSuccess(successMsg);
        setTestResult('success');
        
        // Transform metrics to the format expected by MetricsTable
        if (metrics) {
          const transformedMetrics = {
            // System
            sysName: metrics.system?.name,
            sysDescr: metrics.system?.description,
            sysContact: metrics.system?.contact,
            sysLocation: metrics.system?.location,
            uptime: {
              totalSeconds: metrics.system?.uptime,
              formatted: formatUptime(metrics.system?.uptime)
            },
            agentUptime: metrics.system?.agentUptime,  // SNMP agent uptime
            
            // CPU - transform to percentage format
            cpu: {
              percent: metrics.cpu?.usage?.total || 0,
              user: metrics.cpu?.raw ? (metrics.cpu.raw.user / (metrics.cpu.raw.user + metrics.cpu.raw.system + metrics.cpu.raw.idle) * 100) : 0,
              system: metrics.cpu?.raw ? (metrics.cpu.raw.system / (metrics.cpu.raw.user + metrics.cpu.raw.system + metrics.cpu.raw.idle) * 100) : 0,
              idle: metrics.cpu?.raw ? (metrics.cpu.raw.idle / (metrics.cpu.raw.user + metrics.cpu.raw.system + metrics.cpu.raw.idle) * 100) : 0,
              load1: metrics.cpu?.load1,
              load5: metrics.cpu?.load5,
              load15: metrics.cpu?.load15,
              cores: metrics.cpu?.cores
            },
            
            // Memory - transform field names
            memory: {
              total: metrics.memory?.totalRam,
              used: metrics.memory?.usedRam,
              available: metrics.memory?.availableRam,
              usedPercent: metrics.memory?.percentRam,
              buffered: metrics.memory?.buffer,
              cached: metrics.memory?.cache,
              shared: metrics.memory?.shared,
              swapTotal: metrics.memory?.totalSwap,
              swapUsed: metrics.memory?.usedSwap,
              swapPercent: metrics.memory?.percentSwap
            },
            
            // Disks - transform array
            disks: metrics.disk?.map(d => ({
              path: d.path,
              device: d.device,
              total: d.total,
              used: d.used,
              available: d.available,
              percentUsed: d.percent
            })) || [],
            
            // Network interfaces - transform array
            interfaces: metrics.network?.map(n => ({
              name: n.name,
              type: n.type,
              speed: n.speed,
              operStatus: n.status === 'up' ? 1 : 2,
              inOctets: n.statistics?.bytesReceived,
              outOctets: n.statistics?.bytesSent,
              inErrors: n.statistics?.errorsIn,
              outErrors: n.statistics?.errorsOut
            })) || [],
            
            // Process info if available
            processes: metrics.processes || [],
            processCount: metrics.processCount
          };
          
          setMonitoringData({
            status: 'online',
            lastUpdate: new Date(),
            metrics: transformedMetrics
          });
        } else {
          loadMonitoringData(); // Fallback to loading from DB
        }
        
        // Längere Anzeigezeit für detaillierte Metriken
        setTimeout(() => setTestResult(null), 5000);
      } else {
        // Handle error response - extract message if error is an object
        let errorMessage = t('monitoring.testFailed');
        if (response.data?.error) {
          if (typeof response.data.error === 'object') {
            // If error is an object (e.g., with type, message, recommendations)
            errorMessage = response.data.error.message || response.data.error.type || t('monitoring.connectionFailed');
            
            // Add recommendations if available
            if (response.data.error.recommendations && Array.isArray(response.data.error.recommendations)) {
              errorMessage += `\n\n${t('monitoring.recommendations')}:\n• ` + response.data.error.recommendations.join('\n• ');
            }
          } else {
            errorMessage = response.data.error;
          }
        } else if (response.data?.message) {
          errorMessage = response.data.message;
        }
        
        setError(errorMessage);
        setTestResult('error');
        setTimeout(() => setTestResult(null), 3000);
      }
    } catch (err) {
      console.error('SNMP test error:', err);
      let errorMessage = t('monitoring.snmpTestFailed');
      
      // Extract error message properly
      if (err.response?.data?.error) {
        if (typeof err.response.data.error === 'object') {
          errorMessage = `${errorMessage}: ${err.response.data.error.message || err.response.data.error.type || t('monitoring.unknown')}`;
        } else {
          errorMessage = `${errorMessage}: ${err.response.data.error}`;
        }
      } else if (err.response?.data?.message) {
        errorMessage = `${errorMessage}: ${err.response.data.message}`;
      } else if (err.message) {
        errorMessage = `${errorMessage}: ${err.message}`;
      }
      
      setError(errorMessage);
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
          {t('monitoring.snmpConfiguration')}
        </Typography>
      )}

      <FormControlLabel
        control={
          <Switch
            checked={snmpConfig.enabled}
            onChange={(e) => updateParentConfig({ ...snmpConfig, enabled: e.target.checked })}
          />
        }
        label={t('monitoring.enableMonitoring')}
        sx={{ mb: 2 }}
      />

      {snmpConfig.enabled && (
        <>
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <FormControl fullWidth sx={getInputStyles()}>
              <InputLabel>{t('monitoring.snmpVersion')}</InputLabel>
              <Select
                value={snmpConfig.version}
                onChange={(e) => updateParentConfig({ ...snmpConfig, version: e.target.value })}
                label={t('monitoring.snmpVersion')}
              >
                <MenuItem value="1">SNMP v1</MenuItem>
                <MenuItem value="2c">SNMP v2c</MenuItem>
                <MenuItem value="3">SNMP v3</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label={t('monitoring.port')}
              type="number"
              value={snmpConfig.port}
              onChange={(e) => updateParentConfig({ ...snmpConfig, port: parseInt(e.target.value) })}
              sx={getInputStyles()}
            />
          </Box>

          {(snmpConfig.version === '1' || snmpConfig.version === '2c') && (
            <TextField
              fullWidth
              label={t('monitoring.community')}
              value={snmpConfig.community}
              onChange={(e) => updateParentConfig({ ...snmpConfig, community: e.target.value })}
              sx={{ mt: 2, ...getInputStyles() }}
            />
          )}

          {snmpConfig.version === '3' && (
            <>
              <TextField
                fullWidth
                label={t('monitoring.username')}
                value={snmpConfig.username}
                onChange={(e) => updateParentConfig({ ...snmpConfig, username: e.target.value })}
                sx={{ mt: 2, ...getInputStyles() }}
              />

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
                <FormControl fullWidth sx={getInputStyles()}>
                  <InputLabel>{t('monitoring.authProtocol')}</InputLabel>
                  <Select
                    value={snmpConfig.authProtocol}
                    onChange={(e) => updateParentConfig({ ...snmpConfig, authProtocol: e.target.value })}
                    label={t('monitoring.authProtocol')}
                  >
                    <MenuItem value="MD5">MD5</MenuItem>
                    <MenuItem value="SHA">SHA</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label={t('monitoring.authPassword')}
                  type="password"
                  value={snmpConfig.authPassword}
                  onChange={(e) => updateParentConfig({ ...snmpConfig, authPassword: e.target.value })}
                  sx={getInputStyles()}
                />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
                <FormControl fullWidth sx={getInputStyles()}>
                  <InputLabel>{t('monitoring.privProtocol')}</InputLabel>
                  <Select
                    value={snmpConfig.privProtocol}
                    onChange={(e) => updateParentConfig({ ...snmpConfig, privProtocol: e.target.value })}
                    label={t('monitoring.privProtocol')}
                  >
                    <MenuItem value="DES">DES</MenuItem>
                    <MenuItem value="AES">AES</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label={t('monitoring.privPassword')}
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
            label={t('monitoring.pollingInterval') + ' (' + t('monitoring.seconds') + ')'}
            type="number"
            value={snmpConfig.pollInterval}
            onChange={(e) => updateParentConfig({ ...snmpConfig, pollInterval: parseInt(e.target.value) })}
            helperText={t('monitoring.howOftenToCollect')}
            sx={{ mt: 2, ...getInputStyles() }}
          />

          {/* Polling Status Display */}
          {snmpConfig.enabled && (
            <Box sx={{ 
              mt: 3, 
              p: 2, 
              bgcolor: 'var(--modal-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {pollStatus === 'polling' && (
                  <>
                    <CircularProgress size={20} />
                    <Typography variant="body2">{t('monitoring.updatingMetrics')}</Typography>
                  </>
                )}
                {pollStatus === 'success' && (
                  <>
                    <CheckCircle size={20} style={{ color: '#4caf50' }} />
                    <Typography variant="body2" sx={{ color: 'success.main' }}>
                      {t('monitoring.connectedAutoRefresh', { interval: snmpConfig.pollInterval })}
                    </Typography>
                  </>
                )}
                {pollStatus === 'error' && (
                  <>
                    <AlertCircle size={20} style={{ color: '#f44336' }} />
                    <Typography variant="body2" sx={{ color: 'error.main' }}>
                      {t('monitoring.connectionFailedRetrying')}
                    </Typography>
                  </>
                )}
                {pollStatus === 'idle' && (
                  <>
                    <Activity size={20} />
                    <Typography variant="body2">{t('monitoring.initializing')}</Typography>
                  </>
                )}
              </Box>
              
              {lastPollTime && (
                <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                  {t('monitoring.lastUpdateTime', { time: lastPollTime.toLocaleTimeString() })}
                </Typography>
              )}
            </Box>
          )}

          {/* Monitoring Data Display - Now using MetricsTable */}
          {monitoringData.status === 'online' && monitoringData.metrics && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, color: 'var(--text-primary)' }}>
                📊 {t('monitoring.systemMetricsOverview')}
              </Typography>
              <MetricsTable 
                ref={metricsTableRef}
                metrics={monitoringData.metrics}
                host={host}
                onLoggingChange={(metricKey, enabled) => {

                }}
                onConfigChange={(data) => {
                  // Pass metrics changes up to parent
                  if (onConfigChange && data.type === 'metrics') {
                    onConfigChange(data);
                  }
                }}
              />
            </Box>
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
      {/* SNMP Setup Wizard Dialog */}
      <SNMPSetupWizard
        open={showSetupWizard}
        onClose={() => setShowSetupWizard(false)}
        host={host}
        onSuccess={(wizardConfig) => {

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
});

export default HostMonitoringTab;
