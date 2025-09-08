import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  ButtonGroup,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Alert,
  Chip,
  Paper,
  Tooltip as MuiTooltip,
} from '@mui/material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import {
  Activity,
  Clock,
  TrendingUp,
  Download,
  RefreshCw,
  Calendar,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Pause,
  Play,
  Info,
  Save,
} from 'lucide-react';
import axios from '../../utils/axiosConfig';
import uiConfig, { useUIConfig } from '../../utils/uiConfigManager';

const MetricsHistory = ({ host }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metricsData, setMetricsData] = useState({});
  const [metricsConfig, setMetricsConfig] = useState({});
  const [combinedData, setCombinedData] = useState([]);
  const [configuredMetrics, setConfiguredMetrics] = useState([]);
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [timeRange, setTimeRange] = useState('15m'); // Standard auf 15 Minuten geändert
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [statistics, setStatistics] = useState({});
  const refreshIntervalRef = useRef(null);
  const pollIntervalRef = useRef(null);
  
  // Get UI configuration for tooltips
  const uiConfiguration = useUIConfig();

  // Time range options
  const timeRanges = [
    { value: '15m', label: '15 Min' },
    { value: '1h', label: '1 Hour' },
    { value: '6h', label: '6 Hours' },
    { value: '24h', label: '24 Hours' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
  ];

  // Category icons
  const categoryIcons = {
    cpu: <Cpu size={16} />,
    memory: <MemoryStick size={16} />,
    disk: <HardDrive size={16} />,
    network: <Network size={16} />,
    process: <Activity size={16} />,
  };

  // Fetch configured metrics on mount
  useEffect(() => {
    if (host?.id) {
      fetchConfiguredMetrics();
    }
  }, [host]);

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh && selectedMetrics.length > 0) {
      refreshIntervalRef.current = setInterval(() => {
        fetchMetricsData();
      }, 60000); // Refresh every minute
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, selectedMetrics, timeRange]);

  // Fetch configured metrics from backend
  const fetchConfiguredMetrics = async () => {
    try {
      const response = await axios.get(`/api/metrics-history/${host.id}/configured-metrics`);
      
      if (response.data.success && response.data.metrics) {
        setConfiguredMetrics(response.data.metrics);
        
        // Load saved settings if available
        if (response.data.savedSettings) {
          if (response.data.savedSettings.selectedMetrics) {
            setSelectedMetrics(response.data.savedSettings.selectedMetrics);
          }
          if (response.data.savedSettings.defaultTimeRange) {
            setTimeRange(response.data.savedSettings.defaultTimeRange);
          }
        } else {
          // Auto-select first few metrics if no saved settings
          const defaultMetrics = response.data.metrics
            .slice(0, 3)
            .map(m => m.key);
          setSelectedMetrics(defaultMetrics);
        }
      }
    } catch (err) {
      console.error('Failed to fetch configured metrics:', err);
    }
  };

  // Save metric selection to backend
  const saveMetricSelection = async () => {
    try {
      const response = await axios.post(`/api/metrics-history/${host.id}/save-settings`, {
        selectedMetrics: selectedMetrics,
        defaultTimeRange: timeRange,
      });
      
      if (response.data.success) {
        // Show success message (könnte später ein Snackbar sein)
        console.log('Settings saved successfully');
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  // Fetch metrics data using new unified API
  const fetchMetricsData = async () => {
    if (selectedMetrics.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch data for all selected metrics in one request
      const response = await axios.post(`/api/metrics-history/${host.id}/compare`, {
        metrics: selectedMetrics,
        period: timeRange,
      });

      if (response.data.success) {
        const newMetricsData = {};
        const newMetricsConfig = {};
        const newStatistics = {};
        
        // Process each metric's data and configuration
        for (const [metricKey, metricResult] of Object.entries(response.data.results)) {
          newMetricsData[metricKey] = metricResult.data || [];
          newMetricsConfig[metricKey] = metricResult.graphConfig || {};
          
          // Fetch statistics for each metric
          try {
            const statsResponse = await axios.get(
              `/api/metrics-history/${host.id}/${metricKey}/stats`,
              { params: { period: timeRange } }
            );
            
            if (statsResponse.data.success && statsResponse.data.stats) {
              newStatistics[metricKey] = statsResponse.data.stats;
            }
          } catch (err) {
            console.error(`Failed to fetch stats for ${metricKey}:`, err);
          }
        }
        
        setMetricsData(newMetricsData);
        setMetricsConfig(newMetricsConfig);
        setStatistics(newStatistics);
        
        // Combine data for multi-line chart
        const combined = combineMetricsData(newMetricsData);
        setCombinedData(combined);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
      setError('Failed to load metrics history');
    } finally {
      setLoading(false);
    }
  };

  // Trigger data fetch when metrics selection changes
  useEffect(() => {
    if (selectedMetrics.length > 0) {
      fetchMetricsData();
    } else {
      setMetricsData({});
      setCombinedData([]);
    }
  }, [selectedMetrics, timeRange]);

  // Combine multiple metrics data into single dataset
  const combineMetricsData = (metricsData) => {
    if (!metricsData || Object.keys(metricsData).length === 0) return [];
    
    // Get all unique timestamps
    const timestampSet = new Set();
    Object.values(metricsData).forEach(data => {
      data.forEach(point => timestampSet.add(point.timestamp));
    });
    
    // Sort timestamps
    const timestamps = Array.from(timestampSet).sort();
    
    // Create combined data points
    return timestamps.map(timestamp => {
      const point = { 
        timestamp,
        time: formatTimestamp(timestamp),
      };
      
      Object.entries(metricsData).forEach(([metricKey, data]) => {
        const metricPoint = data.find(p => p.timestamp === timestamp);
        if (metricPoint) {
          point[metricKey] = metricPoint.value;
          point[`${metricKey}_display`] = metricPoint.displayValue;
        }
      });
      
      return point;
    });
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = (now - date) / (1000 * 60 * 60);
    
    if (diffHours < 1) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  // Handle metric selection
  const handleMetricToggle = (metricKey) => {
    setSelectedMetrics(prev => {
      if (prev.includes(metricKey)) {
        return prev.filter(m => m !== metricKey);
      } else {
        return [...prev, metricKey];
      }
    });
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    // Calculate tooltip styles based on UI configuration
    const isLight = document.body.classList.contains('theme-light');
    const inputTransparency = (uiConfiguration?.inputTransparency ?? 25) / 100;
    const inputBlur = uiConfiguration?.inputBlur ?? 4;
    const inputTint = uiConfiguration?.inputTint ?? 20;
    const inputBorderOpacity = (uiConfiguration?.inputBorderOpacity ?? 20) / 100;
    
    // Calculate RGB value for tint
    const baseValue = isLight ? 255 : 0;
    const adjustment = Math.round((inputTint / 100) * 50);
    const rgb = isLight 
      ? Math.max(0, Math.min(255, baseValue - adjustment))
      : Math.max(0, Math.min(255, baseValue + adjustment));

    return (
      <Paper 
        elevation={3} 
        sx={{ 
          p: 1.5, 
          backgroundColor: `rgba(${rgb}, ${rgb}, ${rgb}, ${inputTransparency})`,
          backdropFilter: `blur(${inputBlur}px)`,
          WebkitBackdropFilter: `blur(${inputBlur}px)`,
          border: `1px solid rgba(${isLight ? '0, 0, 0' : '255, 255, 255'}, ${inputBorderOpacity})`,
          color: 'var(--text-primary)'
        }}
      >
        <Typography 
          variant="caption" 
          sx={{ 
            fontWeight: 'bold', 
            display: 'block', 
            mb: 0.5,
            color: 'var(--text-primary)'
          }}
        >
          {label}
        </Typography>
        {payload.map((entry, index) => {
          const config = metricsConfig[entry.dataKey] || {};
          // Für Network-Metriken, die bereits in MB/s konvertiert sind
          let displayValue = entry.payload[`${entry.dataKey}_display`];
          
          if (!displayValue) {
            // Falls kein displayValue vorhanden, formatiere den Wert
            if (entry.dataKey.includes('bytes')) {
              // Network-Metriken müssen von B/s zu MB/s konvertiert werden
              const mbps = (entry.value || 0) / (1024 * 1024);
              displayValue = `${mbps.toFixed(2)} MB/s`;
            } else {
              displayValue = entry.value?.toFixed(2) || '0';
              // Füge die Einheit hinzu, wenn vorhanden
              if (config.unit) {
                displayValue = `${displayValue} ${config.unit}`;
              }
            }
          }
          
          return (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  backgroundColor: entry.color,
                  borderRadius: '2px',
                }}
              />
              <Typography variant="caption" sx={{ color: 'var(--text-primary)' }}>
                {config.displayName || entry.dataKey}: {displayValue}
              </Typography>
            </Box>
          );
        })}
      </Paper>
    );
  };

  // Group metrics by category
  const groupedMetrics = configuredMetrics.reduce((acc, metric) => {
    const category = metric.key.split('.')[0];
    if (!acc[category]) acc[category] = [];
    acc[category].push(metric);
    return acc;
  }, {});

  return (
    <Box sx={{ px: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Activity size={20} />
          Metrics History
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {lastUpdate && (
            <Typography variant="caption" color="text.secondary">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </Typography>
          )}
          
          <Button
            size="small"
            startIcon={autoRefresh ? <Pause size={16} /> : <Play size={16} />}
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant="outlined"
          >
            {autoRefresh ? 'Pause' : 'Resume'}
          </Button>
          
          <Button
            size="small"
            startIcon={<RefreshCw size={16} />}
            onClick={fetchMetricsData}
            disabled={loading || selectedMetrics.length === 0}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Metric Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle2">
              Select Metrics to Display
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Save size={16} />}
              onClick={saveMetricSelection}
              disabled={selectedMetrics.length === 0}
              sx={{
                borderColor: '#4caf50',
                color: '#4caf50',
                '&:hover': {
                  borderColor: '#45a049',
                  backgroundColor: 'rgba(76, 175, 80, 0.08)',
                },
                '&:disabled': {
                  borderColor: 'rgba(255, 255, 255, 0.23)',
                  color: 'var(--text-secondary)',
                },
              }}
            >
              Auswahl speichern
            </Button>
          </Box>
          
          {Object.entries(groupedMetrics).map(([category, metrics]) => (
            <Box key={category} sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                {categoryIcons[category]}
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                  {category}
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {metrics
                  .filter(metric => {
                    // Filter out network errors and status metrics from history view
                    if (category === 'network') {
                      const lowerKey = metric.key.toLowerCase();
                      if (lowerKey.includes('errors') || lowerKey.includes('status')) {
                        return false;
                      }
                    }
                    return true;
                  })
                  .map(metric => {
                  const isSelected = selectedMetrics.includes(metric.key);
                  const metricColor = metricsConfig[metric.key]?.color || metric.color || '#94a3b8';
                  
                  return (
                    <Box
                      key={metric.key}
                      onClick={() => handleMetricToggle(metric.key)}
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        height: '24px',
                        padding: '0 8px',
                        fontSize: '0.8125rem',
                        borderRadius: '16px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'all 0.2s ease',
                        backgroundColor: isSelected ? metricColor : 'transparent',
                        border: `1px solid ${isSelected ? metricColor : 'rgba(255, 255, 255, 0.23)'}`,
                        color: isSelected ? '#ffffff' : 'var(--text-primary)',
                        fontWeight: isSelected ? 600 : 400,
                        '&:hover': {
                          backgroundColor: isSelected ? metricColor : `${metricColor}30`,
                          borderColor: metricColor,
                          transform: 'scale(1.05)',
                        },
                      }}
                    >
                      {metric.name}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ))}
        </CardContent>
      </Card>

      {/* Time Range Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2">
              Time Range
            </Typography>
            
            <ToggleButtonGroup
              value={timeRange}
              exclusive
              onChange={(e, value) => value && setTimeRange(value)}
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  border: '1px solid rgba(255, 255, 255, 0.23)',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.08)',
                    borderColor: 'rgba(25, 118, 210, 0.5)',
                  },
                  '&.Mui-selected': {
                    backgroundColor: '#1976d2',
                    color: '#ffffff',
                    fontWeight: 600,
                    border: '1px solid #1976d2',
                    boxShadow: '0 0 8px rgba(25, 118, 210, 0.4)',
                    '&:hover': {
                      backgroundColor: '#1565c0',
                      borderColor: '#1565c0',
                    },
                  },
                },
              }}
            >
              {timeRanges.map(range => (
                <ToggleButton key={range.value} value={range.value}>
                  {range.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        </CardContent>
      </Card>

      {/* Chart */}
      {loading ? (
        <Card>
          <CardContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
            <CircularProgress />
          </CardContent>
        </Card>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : selectedMetrics.length === 0 ? (
        <Alert severity="info">
          Please select at least one metric to display
        </Alert>
      ) : combinedData.length === 0 ? (
        <Alert severity="warning">
          No data available for the selected metrics and time range
        </Alert>
      ) : (
        <>
          {/* Main Chart */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={combinedData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time"
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    domain={[0, 'auto']}
                    tickFormatter={(value) => {
                      // Für Network-Metriken (die bereits in MB/s sind), 
                      // zeige die Werte korrekt formatiert
                      const hasNetworkMetrics = selectedMetrics.some(m => m.includes('bytes'));
                      if (hasNetworkMetrics) {
                        return value.toFixed(2);
                      }
                      return value;
                    }}
                    label={
                      selectedMetrics.some(m => m.includes('bytes')) 
                        ? { value: 'MB/s', angle: -90, position: 'insideLeft' }
                        : null
                    }
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  
                  {selectedMetrics.map(metricKey => {
                    const config = metricsConfig[metricKey] || {};
                    return (
                      <Line
                        key={metricKey}
                        type="monotone"
                        dataKey={metricKey}
                        name={config.displayName || metricKey}
                        stroke={config.color || '#8884d8'}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Statistics Table */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2">
                  Metrics Statistics
                </Typography>
                <MuiTooltip title="Statistics for selected time range">
                  <Info size={16} />
                </MuiTooltip>
              </Box>
              
              <Box sx={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid rgba(224, 224, 224, 1)' }}>
                      <th style={{ 
                        textAlign: 'left', 
                        padding: '12px 16px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)'
                      }}>
                        Metric
                      </th>
                      <th style={{ 
                        textAlign: 'right', 
                        padding: '12px 16px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)'
                      }}>
                        Min
                      </th>
                      <th style={{ 
                        textAlign: 'right', 
                        padding: '12px 16px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)'
                      }}>
                        Average
                      </th>
                      <th style={{ 
                        textAlign: 'right', 
                        padding: '12px 16px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)'
                      }}>
                        Max
                      </th>
                      <th style={{ 
                        textAlign: 'right', 
                        padding: '12px 16px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)'
                      }}>
                        Data Points
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMetrics.map((metricKey, index) => {
                      const config = metricsConfig[metricKey] || {};
                      const stats = statistics[metricKey];
                      
                      if (!stats) return null;
                      
                      return (
                        <tr 
                          key={metricKey}
                          style={{ 
                            borderBottom: index < selectedMetrics.length - 1 ? '1px solid rgba(224, 224, 224, 0.4)' : 'none',
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <td style={{ 
                            padding: '12px 16px',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: 'var(--text-primary)'
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: '50%',
                                  backgroundColor: config.color || '#8884d8',
                                  flexShrink: 0
                                }}
                              />
                              {config.displayName || metricKey}
                            </Box>
                          </td>
                          <td style={{ 
                            padding: '12px 16px',
                            textAlign: 'right',
                            fontSize: '0.875rem',
                            fontFamily: 'monospace',
                            color: 'var(--text-primary)'
                          }}>
                            {stats.min?.displayText || '-'}
                          </td>
                          <td style={{ 
                            padding: '12px 16px',
                            textAlign: 'right',
                            fontSize: '0.875rem',
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            color: 'var(--text-primary)'
                          }}>
                            {stats.average?.displayText || '-'}
                          </td>
                          <td style={{ 
                            padding: '12px 16px',
                            textAlign: 'right',
                            fontSize: '0.875rem',
                            fontFamily: 'monospace',
                            color: 'var(--text-primary)'
                          }}>
                            {stats.max?.displayText || '-'}
                          </td>
                          <td style={{ 
                            padding: '12px 16px',
                            textAlign: 'right',
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)'
                          }}>
                            {stats.dataPoints}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Box>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
};

export default MetricsHistory;
