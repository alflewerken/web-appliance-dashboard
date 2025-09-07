import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Chip,
  Typography,
  Box,
  Tooltip,
  IconButton,
  Collapse,
  Alert,
  TextField,
  Snackbar
} from '@mui/material';
import {
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  Clock,
  Server,
  ChevronDown,
  ChevronRight,
  Info,
  Database,
  Save,
  CheckCircle
} from 'lucide-react';

const MetricsTable = forwardRef(({ metrics, host, onLoggingChange, onConfigChange }, ref) => {
  const [expandedCategories, setExpandedCategories] = useState({
    system: true,  // System Information starts expanded
    cpu: false,    // All others start collapsed
    memory: false,
    disk: false,
    network: false,
    processes: false
  });
  const [loggingConfig, setLoggingConfig] = useState({});
  const [customNames, setCustomNames] = useState({});
  const [inputValues, setInputValues] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [interfaceMappings, setInterfaceMappings] = useState({});

  // Initialize logging config, custom names and interface mappings from backend
  useEffect(() => {
    loadLoggingConfig();
    loadInterfaceMappings();
  }, [host?.id]);

  // Update input values when customNames change
  useEffect(() => {
    setInputValues(customNames);
  }, [customNames]);

  const loadLoggingConfig = async () => {
    try {
      // Get token from localStorage or sessionStorage
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/hosts/${host.id}/metrics-logging`, {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        setLoggingConfig(data.config || {});
        setCustomNames(data.customNames || {});
        setInputValues(data.customNames || {});
      } else if (response.status === 401) {
        console.error('Authentication required - please log in');
      }
    } catch (error) {
      console.error('Failed to load logging config:', error);
    }
  };

  const loadInterfaceMappings = async () => {
    if (!host?.id) return;
    
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/hosts/${host.id}/interface-mappings`, {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data?.mappings) {
          // Create a map of interface name -> index
          const mappings = {};
          data.mappings.forEach(mapping => {
            mappings[mapping.interface_name] = mapping.interface_index;
          });
          setInterfaceMappings(mappings);

        }
      }
    } catch (error) {
      console.error('Failed to load interface mappings:', error);
    }
  };

  const handleLoggingToggle = (metricKey) => {

    const newConfig = {
      ...loggingConfig,
      [metricKey]: !loggingConfig[metricKey]
    };

    setLoggingConfig(newConfig);
    setHasUnsavedChanges(true);
    
    // Notify parent component of changes with complete state
    if (onConfigChange) {
      onConfigChange({
        type: 'metrics',
        hasChanges: true,
        config: newConfig,
        customNames: inputValues  // Send current inputValues
      });
    }
    
    if (onLoggingChange) {
      onLoggingChange(metricKey, !loggingConfig[metricKey]);
    }
  };

  const handleCustomNameChange = (metricKey, value) => {
    const newInputValues = {
      ...inputValues,
      [metricKey]: value
    };
    
    // If this is a network interface base name, also update sub-metrics
    if (metricKey.startsWith('network.interface.') && !metricKey.includes('.bytes') && !metricKey.includes('.errors') && !metricKey.includes('.status')) {
      // This is a base interface name like network.interface.5
      const subMetrics = ['bytesIn', 'bytesOut', 'errors', 'status'];
      subMetrics.forEach(subMetric => {
        const subKey = `${metricKey}.${subMetric}`;
        // Only update if the sub-metric exists in the current config
        if (loggingConfig[metricKey]) {
          let subName = '';
          switch(subMetric) {
            case 'bytesIn':
              subName = `${value} In`;
              break;
            case 'bytesOut':
              subName = `${value} Out`;
              break;
            case 'errors':
              subName = `${value} Errors`;
              break;
            case 'status':
              subName = `${value} Status`;
              break;
          }
          newInputValues[subKey] = subName;
        }
      });
    }
    
    setInputValues(newInputValues);
    setHasUnsavedChanges(true);
    
    // Notify parent component of changes with complete state
    if (onConfigChange) {
      onConfigChange({
        type: 'metrics',
        hasChanges: true,
        config: loggingConfig,  // Send current config
        customNames: newInputValues  // Send updated names
      });
    }
  };

  // Public method to save configuration (called from parent)
  const saveConfiguration = async () => {
    if (!hasUnsavedChanges) {

      return { success: true, message: 'No changes to save' };
    }
    
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      
      if (!token) {
        return { success: false, message: 'Authentication required' };
      }
      
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      // Debug: Log what we're saving

      const response = await fetch(`/api/hosts/${host.id}/metrics-logging`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ 
          config: loggingConfig,
          customNames: inputValues
        })
      });
      
      if (response.ok) {
        // Important: Update customNames with the saved values
        setCustomNames(inputValues);
        setHasUnsavedChanges(false);

        // Verify by reloading the config
        await loadLoggingConfig();
        
        return { success: true, message: 'Metrics configuration saved' };
      } else {
        const error = await response.text();
        console.error('Failed to save metrics config:', error);
        return { success: false, message: 'Failed to save metrics configuration' };
      }
    } catch (error) {
      console.error('Failed to save metrics config:', error);
      return { success: false, message: error.message };
    }
  };

  // Expose save method to parent via ref
  useImperativeHandle(ref, () => ({
    saveConfiguration,
    hasUnsavedChanges: () => hasUnsavedChanges
  }));

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Parse and structure metrics data
  const structuredMetrics = {
    system: {
      icon: <Server size={20} />,
      label: 'System Information',
      color: '#2196f3',
      hideLogging: true,  // No logging checkboxes for system info
      metrics: [
        {
          key: 'system.hostname',
          name: 'Hostname',
          value: metrics?.sysName || host?.hostname || 'N/A',
          description: 'System hostname from SNMP',
          unit: '',
          loggable: false
        },
        {
          key: 'system.os',
          name: 'Operating System',
          value: (() => {
            if (metrics?.osType && metrics?.osVersion) {
              const os = `${metrics.osType} ${metrics.osVersion}`;
              return metrics?.osDetails ? `${os} (${metrics.osDetails})` : os;
            }
            return metrics?.osType || 'Unknown';
          })(),
          description: 'Operating system and version',
          unit: '',
          loggable: false
        },
        {
          key: 'system.cores',
          name: 'CPU Cores',
          value: metrics?.cpu?.cores || 'N/A',
          description: 'Number of processor cores',
          unit: metrics?.cpu?.cores > 1 ? 'cores' : 'core',
          loggable: false
        },
        {
          key: 'system.uptime',
          name: 'System Uptime',
          value: metrics?.uptime?.formatted || formatUptime(metrics?.uptime?.totalSeconds) || 'N/A',
          description: 'Time since system boot',
          unit: '',
          loggable: false
        },
        {
          key: 'system.agentUptime',
          name: 'SNMP Agent Uptime',
          value: metrics?.agentUptime ? formatUptime(metrics.agentUptime) : 'N/A',
          description: 'Time since SNMP daemon start',
          unit: '',
          loggable: false
        },
        {
          key: 'system.contact',
          name: 'System Contact',
          value: metrics?.sysContact || 'N/A',
          description: 'System administrator contact',
          unit: '',
          loggable: false
        },
        {
          key: 'system.location',
          name: 'System Location',
          value: metrics?.sysLocation || 'N/A',
          description: 'Physical location',
          unit: '',
          loggable: false
        }
      ]
    },
    cpu: {
      icon: <Cpu size={20} />,
      label: 'CPU Metrics',
      color: '#4caf50',
      metrics: (() => {
        // Debug logging

        return [
          // CPU Usage - only if available
          ...(metrics?.cpu?.percent !== undefined && !isNaN(metrics.cpu.percent) ? [{
            key: 'cpu.usage',
            name: 'CPU Usage',
            value: metrics.cpu.percent.toFixed(1),
            description: 'Current CPU utilization percentage',
            unit: '%',
            loggable: true
          }] : []),
          // CPU User - only if available and not NaN
          ...(metrics?.cpu?.user !== undefined && !isNaN(metrics.cpu.user) ? [{
            key: 'cpu.user',
            name: 'CPU User Time',
            value: metrics.cpu.user.toFixed(1),
            description: 'Time spent in user mode',
            unit: '%',
            loggable: true
          }] : []),
          // CPU System - only if available and not NaN
          ...(metrics?.cpu?.system !== undefined && !isNaN(metrics.cpu.system) ? [{
            key: 'cpu.system',
            name: 'CPU System Time',
            value: metrics.cpu.system.toFixed(1),
            description: 'Time spent in system mode',
            unit: '%',
            loggable: true
          }] : []),
          // CPU Idle - only if available and not NaN
          ...(metrics?.cpu?.idle !== undefined && !isNaN(metrics.cpu.idle) ? [{
            key: 'cpu.idle',
            name: 'CPU Idle Time',
            value: metrics.cpu.idle.toFixed(1),
            description: 'Time spent idle',
            unit: '%',
            loggable: true
          }] : []),
          // Always show load averages (works on all systems)
          {
            key: 'cpu.load1',
            name: 'Load Average (1 min)',
            value: metrics?.cpu?.load1 !== undefined ? (metrics.cpu.load1 * 100 / (metrics?.cpu?.cores || 1)).toFixed(0) : 'N/A',
            description: 'System load average over 1 minute',
            unit: '%',
            loggable: true
          },
          {
            key: 'cpu.load5',
            name: 'Load Average (5 min)',
            value: metrics?.cpu?.load5 !== undefined ? (metrics.cpu.load5 * 100 / (metrics?.cpu?.cores || 1)).toFixed(0) : 'N/A',
            description: 'System load average over 5 minutes',
            unit: '%',
            loggable: true
          },
          {
            key: 'cpu.load15',
            name: 'Load Average (15 min)',
            value: metrics?.cpu?.load15 !== undefined ? (metrics.cpu.load15 * 100 / (metrics?.cpu?.cores || 1)).toFixed(0) : 'N/A',
            description: 'System load average over 15 minutes',
            unit: '%',
            loggable: true
          },
          // Add info message for Apple Silicon
          ...(metrics?.cpu?.user === undefined && 
              metrics?.system?.description?.includes('Darwin') && 
              metrics?.system?.description?.includes('ARM64') ? [{
            key: 'cpu.info',
            name: 'Note',
            value: 'CPU usage metrics not available on Apple Silicon',
            description: 'Load averages shown above indicate system activity',
            unit: '',
            loggable: false
          }] : [])
        ];
      })()  // Call the IIFE to execute it
    },
    memory: {
      icon: <Activity size={20} />,
      label: 'Memory',
      color: '#ff9800',
      metrics: [
        {
          key: 'memory.total',
          name: 'Memory Total',
          value: formatBytes(metrics?.memory?.total),
          description: 'Total physical memory',
          unit: '',
          loggable: false
        },
        {
          key: 'memory.used',
          name: 'Memory Used',
          value: formatBytes(metrics?.memory?.used),
          description: 'Currently used physical memory',
          unit: '',
          loggable: true
        },
        {
          key: 'memory.free',
          name: 'Memory Free',
          value: formatBytes(metrics?.memory?.available),
          description: 'Available physical memory',
          unit: '',
          loggable: true
        },
        {
          key: 'memory.percent',
          name: 'Memory Usage',
          value: metrics?.memory?.usedPercent !== undefined ? metrics.memory.usedPercent.toFixed(1) : 'N/A',
          description: 'Memory utilization percentage',
          unit: '%',
          loggable: true
        },
        // Only show cached/buffered if values exist and > 0 (Linux-specific)
        ...(metrics?.memory?.cached && metrics.memory.cached > 0 ? [{
          key: 'memory.cached',
          name: 'Cached',
          value: formatBytes(metrics.memory.cached),
          description: 'Memory used for caching (Linux)',
          unit: '',
          loggable: true
        }] : []),
        ...(metrics?.memory?.buffered && metrics.memory.buffered > 0 ? [{
          key: 'memory.buffered',
          name: 'Buffered',
          value: formatBytes(metrics.memory.buffered),
          description: 'Memory used for buffers (Linux)',
          unit: '',
          loggable: true
        }] : []),
        // Only show swap if available
        ...(metrics?.memory?.swapTotal && metrics.memory.swapTotal > 0 ? [{
          key: 'swap.total',
          name: 'Swap Total',
          value: formatBytes(metrics.memory.swapTotal),
          description: 'Total swap space',
          unit: '',
          loggable: false
        }] : []),
        ...(metrics?.memory?.swapUsed && metrics.memory.swapUsed > 0 ? [{
          key: 'swap.used',
          name: 'Swap Used',
          value: formatBytes(metrics.memory.swapUsed),
          description: 'Currently used swap space',
          unit: '',
          loggable: true
        }] : []),
        ...(metrics?.memory?.swapUsedPercent && metrics.memory.swapUsedPercent > 0 ? [{
          key: 'swap.percent',
          name: 'Swap Usage',
          value: metrics.memory.swapUsedPercent.toFixed(1),
          description: 'Swap utilization percentage',
          unit: '%',
          loggable: true
        }] : [])
      ]
    },
    disk: {
      icon: <HardDrive size={20} />,
      label: 'Disk Storage',
      color: '#9c27b0',
      isDisk: true,  // Special flag for disk rendering
      metrics: metrics?.disk?.map((disk, index) => ({
        key: `disk.${index}`,
        name: disk.path || disk.device || `Disk ${index}`,
        total: disk.total,
        used: disk.used,
        available: disk.available,
        percent: disk.percent,
        description: `${disk.device || 'Unknown device'}`,
        loggable: true
      })) || []
    },
    network: {
      icon: <Wifi size={20} />,
      label: 'Network Interfaces',
      color: '#00bcd4',
      isTable: true,  // Special flag for table rendering
      interfaces: metrics?.network || metrics?.interfaces || []
    },    processes: {
      icon: <Activity size={20} />,
      label: 'Process Information',
      color: '#673ab7',
      metrics: [
        {
          key: 'process.count',
          name: 'Total Processes',
          value: metrics?.processes?.count || 'N/A',
          description: 'Total number of running processes',
          unit: metrics?.processes?.count > 1 ? 'processes' : 'process',
          loggable: true
        },
        {
          key: 'process.user',
          name: 'User Processes',
          value: metrics?.processes?.user || 'N/A',
          description: 'Number of user processes',
          unit: '',
          loggable: true
        },
        {
          key: 'process.system',
          name: 'System Processes',
          value: metrics?.processes?.system || 'N/A',
          description: 'Number of system/kernel processes',
          unit: '',
          loggable: true
        },
        {
          key: 'process.running',
          name: 'Running',
          value: metrics?.processes?.running || 'N/A',
          description: 'Currently running processes',
          unit: '',
          loggable: true
        }
      ]
    }
  };

  // Format helpers
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
  }

  function formatUptime(seconds) {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
  // Render network interfaces as table
  const renderNetworkTable = () => {
    const interfaces = structuredMetrics.network.interfaces;
    
    if (interfaces.length === 0) {
      return (
        <Typography variant="body2" color="textSecondary" sx={{ p: 2 }}>
          No network interfaces detected
        </Typography>
      );
    }

    return (
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Typography variant="caption">Log</Typography>
              </TableCell>
              <TableCell>Interface</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="right">Speed</TableCell>
              <TableCell align="right">Traffic</TableCell>
              <TableCell align="right">Errors</TableCell>
              <TableCell>Custom Name</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {interfaces.map((iface, arrayIndex) => {
              const isActive = iface.operStatus === 1 || iface.status === 'up' || 
                              iface.statistics?.bytesReceived > 0 || iface.statistics?.bytesSent > 0 ||
                              iface.inOctets > 0 || iface.outOctets > 0;
              
              // KRITISCH: Wir brauchen den echten SNMP-Index!
              // Zuerst aus dynamischen Mappings versuchen
              let interfaceIndex = iface.index;
              
              // Wenn kein Index vorhanden, aus den dynamischen Mappings holen
              if (!interfaceIndex && interfaceIndex !== 0 && interfaceMappings) {
                interfaceIndex = interfaceMappings[iface.name];
                if (interfaceIndex !== undefined) {

                }
              }
              
              // Fallback auf hardcoded mapping (nur für Backward-Compatibility)
              if (!interfaceIndex && interfaceIndex !== 0) {

                // Hardcoded mapping für bekannte Interfaces (DEPRECATED)
                if (iface.name === 'en0') interfaceIndex = 5;
                else if (iface.name === 'en5') interfaceIndex = 4;
                else if (iface.name === 'awdl0') interfaceIndex = 6;
                else interfaceIndex = arrayIndex; // Last resort fallback
              }
              
              const metricKey = `network.interface.${interfaceIndex}`;

              // Get traffic values from either format
              const bytesIn = iface.statistics?.bytesReceived || iface.inOctets || 0;
              const bytesOut = iface.statistics?.bytesSent || iface.outOctets || 0;
              
              return (
                <TableRow key={arrayIndex} sx={{ 
                  backgroundColor: isActive ? 'transparent' : 'rgba(0,0,0,0.02)'
                }}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={!!loggingConfig[metricKey]}
                      onChange={() => handleLoggingToggle(metricKey)}
                      disabled={!isActive}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: isActive ? '#4caf50' : '#bdbdbd',
                          flexShrink: 0
                        }}
                      />
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {iface.name || iface.descr || `Interface ${index}`}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={isActive ? 'UP' : 'DOWN'}
                      color={isActive ? 'success' : 'default'}
                      sx={{ 
                        minWidth: 55,
                        height: 20,
                        fontSize: '0.7rem'
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                      {iface.speed > 0 ? `${(iface.speed / 1000000).toFixed(0)} Mbps` : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="caption" sx={{ display: 'block' }}>
                      ↓ {bytesIn > 0 ? formatBytes(bytesIn) : '-'}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block' }}>
                      ↑ {bytesOut > 0 ? formatBytes(bytesOut) : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontSize: '0.85rem', 
                      color: ((iface.statistics?.errorsIn || 0) + (iface.statistics?.errorsOut || 0) + 
                              (iface.inErrors || 0) + (iface.outErrors || 0)) > 0 ? 'error.main' : 'inherit' 
                    }}>
                      {((iface.statistics?.errorsIn || 0) + (iface.statistics?.errorsOut || 0) + 
                        (iface.inErrors || 0) + (iface.outErrors || 0)) || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {loggingConfig[metricKey] && (
                      <TextField
                        size="small"
                        variant="outlined"
                        placeholder="Custom name"
                        value={inputValues[metricKey] || iface.name || `Interface ${interfaceIndex}`}
                        onChange={(e) => handleCustomNameChange(metricKey, e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                          }
                        }}
                        sx={{ 
                          width: '150px',
                          '& .MuiInputBase-input': {
                            fontSize: '0.75rem',
                            padding: '4px 8px'
                          }
                        }}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // Render disk storage with visual gauge
  const renderDiskTable = () => {
    const disks = structuredMetrics.disk.metrics;
    
    if (disks.length === 0) {
      return (
        <Typography variant="body2" color="textSecondary" sx={{ p: 2 }}>
          No disk storage information available
        </Typography>
      );
    }

    return (
      <Table size="small">
        <TableBody>
          {disks.map((disk, index) => {
            const totalGB = disk.total ? (disk.total / (1024 * 1024 * 1024)).toFixed(1) : '0';
            const usedGB = disk.used ? (disk.used / (1024 * 1024 * 1024)).toFixed(1) : '0';
            const percent = disk.percent || 0;
            const metricKey = `disk.${index}`;
            
            return (
              <TableRow key={index}>
                <TableCell width="50px" padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={!!loggingConfig[metricKey]}
                    onChange={() => handleLoggingToggle(metricKey)}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {disk.name}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {disk.description}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" sx={{ minWidth: '100px' }}>
                      {usedGB} / {totalGB} GB
                    </Typography>
                    <Box sx={{ 
                      position: 'relative',
                      width: '150px',
                      height: '20px',
                      backgroundColor: 'rgba(0,0,0,0.1)',
                      borderRadius: '10px',
                      overflow: 'hidden'
                    }}>
                      <Box sx={{ 
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${percent}%`,
                        backgroundColor: percent > 90 ? '#f44336' : 
                                       percent > 75 ? '#ff9800' : 
                                       percent > 50 ? '#2196f3' : '#4caf50',
                        transition: 'width 0.3s ease'
                      }} />
                      <Typography variant="caption" sx={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: '#000',
                        fontWeight: 'bold'
                      }}>
                        {percent.toFixed(1)}%
                      </Typography>
                    </Box>
                    {loggingConfig[metricKey] && (
                      <TextField
                        size="small"
                        variant="outlined"
                        placeholder="Custom name"
                        value={inputValues[metricKey] || disk.name || '/'}
                        onChange={(e) => handleCustomNameChange(metricKey, e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                          }
                        }}
                        sx={{ 
                          width: '180px',
                          '& .MuiInputBase-input': {
                            fontSize: '0.875rem',
                            padding: '6px 10px'
                          }
                        }}
                      />
                    )}
                  </Box>
                </TableCell>
                <TableCell align="right" width="100px">
                  {/* Future: Add trend chart here */}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };
  
  const getActiveMetricsCount = (category) => {
    if (category === 'network') {
      const activeCount = structuredMetrics.network.interfaces.filter(iface => 
        iface.operStatus === 1 || iface.status === 'up' || 
        iface.inOctets > 0 || iface.outOctets > 0
      ).length;
      return `${activeCount}/${structuredMetrics.network.interfaces.length}`;
    }
    
    const metrics = structuredMetrics[category]?.metrics || [];
    const activeCount = metrics.filter(m => m.value !== 'N/A').length;
    return `${activeCount}/${metrics.length}`;
  };

  return (
    <Box>
      {hasUnsavedChanges && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You have unsaved changes in metrics configuration. Click "Save" in the host panel to apply them.
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width="50px"></TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Active Metrics</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(structuredMetrics).map(([key, category]) => (
              <React.Fragment key={key}>
                <TableRow
                  sx={{ 
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    cursor: 'pointer',
                    '& .MuiTableCell-root': {
                      borderBottom: '2px solid rgba(224, 224, 224, 1)'
                    },
                    '& .MuiTypography-root': {
                      color: 'text.primary'
                    }
                  }}
                  onClick={() => toggleCategory(key)}
                >
                  <TableCell>
                    <IconButton size="small">
                      {expandedCategories[key] ? <ChevronDown /> : <ChevronRight />}
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ 
                        color: category.color,
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        {category.icon}
                      </Box>
                      <Typography 
                        fontWeight="medium" 
                        sx={{ color: 'text.primary' }}
                      >
                        {category.label}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      size="small" 
                      label={getActiveMetricsCount(key)}
                      color={key === 'system' ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {/* No actions for categories */}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={4} sx={{ p: 0, border: 0 }}>
                    <Collapse in={expandedCategories[key]} timeout="auto" unmountOnExit>
                      {key === 'network' ? (
                        renderNetworkTable()
                      ) : key === 'disk' ? (
                        renderDiskTable()
                      ) : (
                        <Table size="small">
                          <TableBody>
                            {category.metrics?.map((metric, index) => (
                              <TableRow key={index}>
                                <TableCell width="50px" padding="checkbox">
                                  {!category.hideLogging && metric.loggable && metric.value !== 'N/A' && (
                                    <Checkbox
                                      size="small"
                                      checked={!!loggingConfig[metric.key]}
                                      onChange={() => handleLoggingToggle(metric.key)}
                                    />
                                  )}
                                </TableCell>
                                <TableCell>
                                  {metric.key === 'process.count' && metrics?.processes?.top && metrics.processes.top.length > 0 ? (
                                    <Tooltip
                                      title={
                                        <Box sx={{ p: 1 }}>
                                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                                            Top CPU Processes:
                                          </Typography>
                                          {metrics.processes.top.slice(0, 5).map((proc, idx) => (
                                            <Box key={idx} sx={{ mb: 0.5 }}>
                                              <Typography variant="caption" sx={{ display: 'block' }}>
                                                {idx + 1}. <strong>{proc.name}</strong>
                                              </Typography>
                                              <Typography variant="caption" sx={{ display: 'block', pl: 2, color: 'grey.300' }}>
                                                CPU: {proc.cpu?.toFixed(1) || 0}% | Mem: {formatBytes(proc.memory || 0)}
                                              </Typography>
                                            </Box>
                                          ))}
                                        </Box>
                                      }
                                      placement="right"
                                      arrow
                                    >
                                      <Box sx={{ cursor: 'help' }}>
                                        <Typography variant="body2" fontWeight="medium">
                                          {metric.name}
                                        </Typography>
                                        <Typography variant="caption" color="textSecondary">
                                          {metric.description} (hover for top processes)
                                        </Typography>
                                      </Box>
                                    </Tooltip>
                                  ) : (
                                    <>
                                      <Typography variant="body2" fontWeight="medium">
                                        {metric.name}
                                      </Typography>
                                      <Typography variant="caption" color="textSecondary">
                                        {metric.description}
                                      </Typography>
                                    </>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Box sx={{ flex: 1 }}>
                                      <Typography variant="body2" fontWeight="medium">
                                        {metric.value} {metric.unit}
                                      </Typography>
                                    </Box>
                                    {!category.hideLogging && metric.loggable && loggingConfig[metric.key] && (
                                      <TextField
                                        size="small"
                                        variant="outlined"
                                        placeholder="Custom name"
                                        value={inputValues[metric.key] || metric.name}
                                        onChange={(e) => handleCustomNameChange(metric.key, e.target.value)}
                                        onKeyPress={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                          }
                                        }}
                                        sx={{ 
                                          width: '200px',
                                          '& .MuiInputBase-input': {
                                            fontSize: '0.875rem',
                                            padding: '6px 10px'
                                          }
                                        }}
                                      />
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell align="right" width="100px">
                                  {/* Future: Add trend chart here */}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
});

export default MetricsTable;