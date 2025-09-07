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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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
} from 'lucide-react';
import axios from '../../utils/axiosConfig';

const MetricsHistory = ({ host }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metricsData, setMetricsData] = useState({});
  const [combinedData, setCombinedData] = useState([]);
  const [configuredMetrics, setConfiguredMetrics] = useState([]);
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [timeRange, setTimeRange] = useState('1h');
  const [aggregation, setAggregation] = useState('avg');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshIntervalRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Predefined colors for metrics - each metric gets a unique color
  const metricColors = {
    'cpu.user': '#4caf50',
    'cpu.system': '#8bc34a', 
    'cpu.idle': '#cddc39',
    'cpu.load1': '#66bb6a',
    'cpu.load5': '#81c784',
    'cpu.load15': '#a5d6a7',
    'memory.used': '#2196f3',
    'memory.free': '#42a5f5',
    'memory.percent': '#64b5f6',
    'memory.cached': '#90caf9',
    'memory.buffered': '#bbdefb',
    'swap.used': '#00bcd4',
    'swap.percent': '#26c6da',
    'disk.0': '#ff9800',
    'disk.1': '#ffa726',
    'disk.2': '#ffb74d',
    'disk.3': '#ffcc80',
    'network.interface.0': '#9c27b0',
    'network.interface.1': '#ab47bc',
    'process.count': '#673ab7',
    'process.running': '#7e57c2',
  };

  // Get metric color - returns a unique color for each metric
  const getMetricColor = (metricKey) => {
    if (!metricKey) return '#757575';
    
    // If we have a predefined color, use it
    if (metricColors[metricKey]) {
      return metricColors[metricKey];
    }
    
    // Otherwise, generate a color based on the metric type
    if (metricKey.startsWith('cpu')) return '#4caf50';
    if (metricKey.startsWith('memory')) return '#2196f3';
    if (metricKey.startsWith('disk')) return '#ff9800';
    if (metricKey.startsWith('network')) return '#9c27b0';
    if (metricKey.startsWith('swap')) return '#00bcd4';
    if (metricKey.startsWith('process')) return '#673ab7';
    
    // Generate a consistent color based on the key
    let hash = 0;
    for (let i = 0; i < metricKey.length; i++) {
      hash = metricKey.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 50%)`;
  };

  // Get metric icon
  const getMetricIcon = (metricKey) => {
    if (!metricKey) return <Activity size={14} />;
    if (metricKey.startsWith('cpu')) return <Cpu size={14} />;
    if (metricKey.startsWith('memory')) return <MemoryStick size={14} />;
    if (metricKey.startsWith('disk')) return <HardDrive size={14} />;
    if (metricKey.startsWith('network')) return <Network size={14} />;
    return <Activity size={14} />;
  };

  // Time range options
  const timeRanges = [
    { value: '1h', label: '1H' },
    { value: '6h', label: '6H' },
    { value: '24h', label: '24H' },
    { value: '7d', label: '7D' },
    { value: '30d', label: '30D' },
  ];

  // Fetch configured metrics from host_metrics_logging
  const fetchConfiguredMetrics = async () => {
    if (!host?.id) return;
    
    try {
      const response = await axios.get(`/api/hosts/${host.id}/configured-metrics`);
      if (response.data.success && response.data.metrics.length > 0) {
        setConfiguredMetrics(response.data.metrics);
        // Select first metric by default if none selected
        if (selectedMetrics.length === 0 && response.data.metrics.length > 0) {
          setSelectedMetrics([response.data.metrics[0].key]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch configured metrics:', err);
    }
  };

  // Toggle metric selection
  const toggleMetric = (metricKey) => {
    setSelectedMetrics(prev => {
      if (prev.includes(metricKey)) {
        return prev.filter(m => m !== metricKey);
      } else {
        return [...prev, metricKey];
      }
    });
  };

  // Fetch metrics history for all selected metrics
  const fetchMetrics = async () => {
    if (!host?.id || selectedMetrics.length === 0) return;

    setLoading(true);
    setError(null);
    
    try {
      // Fetch data for each selected metric
      const promises = selectedMetrics.map(metricKey =>
        axios.get(`/api/hosts/${host.id}/metrics-history`, {
          params: {
            metric: metricKey,
            range: timeRange,
            aggregation: aggregation,
          },
        })
      );

      const responses = await Promise.all(promises);
      
      // Store individual metric data
      const newMetricsData = {};
      selectedMetrics.forEach((metricKey, index) => {
        if (responses[index].data.success) {
          newMetricsData[metricKey] = responses[index].data.data || [];
        }
      });
      
      setMetricsData(newMetricsData);
      
      // Combine data for multi-line chart
      const combined = combineMetricsData(newMetricsData);
      setCombinedData(combined);
      setLastUpdate(new Date());
      
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
      setError('Failed to load metrics history');
    } finally {
      setLoading(false);
    }
  };

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
      const point = { timestamp };
      
      Object.entries(metricsData).forEach(([metricKey, data]) => {
        const metricPoint = data.find(p => p.timestamp === timestamp);
        point[metricKey] = metricPoint ? metricPoint.value : null;
      });
      
      return point;
    });
  };

  // Initial load
  useEffect(() => {
    fetchConfiguredMetrics();
  }, [host?.id]);

  // Fetch data when metrics or settings change
  useEffect(() => {
    if (selectedMetrics.length > 0) {
      fetchMetrics();
    }
  }, [selectedMetrics, timeRange, aggregation]);

  // Auto-refresh with continuous updates
  useEffect(() => {
    // Clear existing intervals
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    if (autoRefresh && selectedMetrics.length > 0) {
      // Immediate fetch
      fetchMetrics();
      
      // Set up continuous polling (every 10 seconds for real-time feel)
      pollIntervalRef.current = setInterval(() => {
        fetchMetrics();
      }, 10000);
      
      // Also refresh configured metrics every minute
      refreshIntervalRef.current = setInterval(() => {
        fetchConfiguredMetrics();
      }, 60000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [autoRefresh, selectedMetrics.length, timeRange, aggregation]);

  // Format value based on metric type
  const formatValue = (value, metricKey) => {
    if (value === null || value === undefined) return 'N/A';
    if (!metricKey) return parseFloat(value).toFixed(2);
    
    if (metricKey.includes('percent') || metricKey.includes('.user') || 
        metricKey.includes('.system') || metricKey.includes('.idle')) {
      return `${parseFloat(value).toFixed(1)}%`;
    }
    if (metricKey.includes('memory') || metricKey.includes('swap')) {
      const gb = value / 1073741824;
      return gb >= 1 ? `${gb.toFixed(2)} GB` : `${(value / 1048576).toFixed(0)} MB`;
    }
    if (metricKey.includes('disk')) {
      return `${parseFloat(value).toFixed(1)}%`;
    }
    if (metricKey.includes('load')) {
      return parseFloat(value).toFixed(2);
    }
    return parseFloat(value).toFixed(2);
  };

  // Custom tooltip for charts showing all metrics
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <Paper sx={{ 
        p: 1.5, 
        backgroundColor: 'var(--modal-bg)', 
        border: '1px solid var(--card-border)',
        backdropFilter: 'blur(10px)'
      }}>
        <Typography variant="caption" sx={{ color: 'var(--text-secondary)', display: 'block', mb: 1 }}>
          {new Date(label).toLocaleString()}
        </Typography>
        {payload.map((entry, index) => {
          const metric = configuredMetrics.find(m => m.key === entry.dataKey);
          return (
            <Typography 
              key={index}
              variant="body2" 
              sx={{ 
                color: entry.color,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5
              }}
            >
              <Box 
                sx={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: '50%', 
                  backgroundColor: entry.color 
                }} 
              />
              {metric?.name || entry.dataKey}: {formatValue(entry.value, entry.dataKey)}
            </Typography>
          );
        })}
      </Paper>
    );
  };

  // Custom Y-axis tick with color
  const CustomYAxisTick = ({ x, y, payload }) => {
    // Find which metric this axis belongs to based on value ranges
    let color = '#666';
    if (selectedMetrics.length === 1) {
      color = getMetricColor(selectedMetrics[0]);
    }
    
    return (
      <text x={x} y={y} fill={color} textAnchor="end" fontSize={11}>
        {payload.value}
      </text>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 3 }}>
      {/* Metric Selection Buttons */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, color: 'var(--text-secondary)' }}>
          Select Metrics (Multiple)
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: 1,
          p: 2,
          backgroundColor: 'var(--card-bg)',
          borderRadius: 1,
          border: '1px solid var(--card-border)'
        }}>
          {configuredMetrics.length === 0 ? (
            <Alert severity="info" sx={{ width: '100%' }}>
              No metrics configured. Please configure metrics in the Monitoring tab first.
            </Alert>
          ) : (
            configuredMetrics.map((metric) => {
              const isSelected = selectedMetrics.includes(metric.key);
              const color = getMetricColor(metric.key);
              
              return (
                <Button
                  key={metric.key}
                  variant={isSelected ? "contained" : "outlined"}
                  size="small"
                  onClick={() => toggleMetric(metric.key)}
                  startIcon={getMetricIcon(metric.key)}
                  sx={{
                    borderColor: color,
                    color: isSelected ? 'white' : color,
                    backgroundColor: isSelected ? color : 'transparent',
                    '&:hover': {
                      backgroundColor: isSelected ? color : `${color}20`,
                      borderColor: color,
                    }
                  }}
                >
                  {metric.name}
                </Button>
              );
            })
          )}
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{ mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <ToggleButtonGroup
              value={timeRange}
              exclusive
              onChange={(e, value) => value && setTimeRange(value)}
              size="small"
            >
              {timeRanges.map(range => (
                <ToggleButton key={range.value} value={range.value}>
                  {range.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Grid>

          <Grid item>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={aggregation}
                onChange={(e) => setAggregation(e.target.value)}
              >
                <MenuItem value="avg">Average</MenuItem>
                <MenuItem value="max">Maximum</MenuItem>
                <MenuItem value="min">Minimum</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item sx={{ ml: 'auto' }}>
            <ButtonGroup size="small">
              <Button
                variant={autoRefresh ? "contained" : "outlined"}
                onClick={() => setAutoRefresh(!autoRefresh)}
                startIcon={autoRefresh ? <Pause size={16} /> : <Play size={16} />}
                color={autoRefresh ? "primary" : "inherit"}
              >
                {autoRefresh ? 'Live' : 'Paused'}
              </Button>
              <Button
                startIcon={<RefreshCw size={16} />}
                onClick={fetchMetrics}
                disabled={loading || selectedMetrics.length === 0}
              >
                Refresh
              </Button>
              <Button
                startIcon={<Download size={16} />}
                disabled={combinedData.length === 0}
              >
                Export
              </Button>
            </ButtonGroup>
          </Grid>
        </Grid>
      </Box>

      {/* Main Chart */}
      <Card sx={{ 
        flex: 1, 
        backgroundColor: 'var(--card-bg)', 
        border: '1px solid var(--card-border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Activity size={20} />
              Metrics History
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {autoRefresh && (
                <Chip
                  icon={<Activity size={14} />}
                  label="Live"
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ animation: 'pulse 2s infinite' }}
                />
              )}
              {lastUpdate && (
                <Chip
                  icon={<Clock size={14} />}
                  label={lastUpdate.toLocaleTimeString()}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>

          {loading && combinedData.length === 0 ? (
            <Box sx={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : selectedMetrics.length === 0 ? (
            <Box sx={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                Please select metrics to view their history
              </Typography>
            </Box>
          ) : combinedData.length === 0 ? (
            <Box sx={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                No data available for the selected time range
              </Typography>
            </Box>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combinedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis 
                  dataKey="timestamp" 
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  tickFormatter={(time) => {
                    const date = new Date(time);
                    if (timeRange === '1h' || timeRange === '6h') {
                      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } else if (timeRange === '24h') {
                      return date.toLocaleTimeString([], { hour: '2-digit' });
                    } else {
                      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                    }
                  }}
                />
                <YAxis 
                  tick={<CustomYAxisTick />}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  formatter={(value) => {
                    const metric = configuredMetrics.find(m => m.key === value);
                    return metric?.name || value;
                  }}
                  wrapperStyle={{
                    paddingTop: '10px',
                    fontSize: '12px'
                  }}
                />
                {selectedMetrics.map(metricKey => (
                  <Line
                    key={metricKey}
                    type="monotone"
                    dataKey={metricKey}
                    stroke={getMetricColor(metricKey)}
                    strokeWidth={2}
                    dot={false}
                    name={metricKey}
                    connectNulls={true}
                    isAnimationActive={!autoRefresh}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Legend with selected metrics */}
      {selectedMetrics.length > 0 && (
        <Box sx={{ 
          mt: 2, 
          p: 1,
          backgroundColor: 'var(--card-bg)',
          borderRadius: 1,
          border: '1px solid var(--card-border)'
        }}>
          <Grid container spacing={2}>
            {selectedMetrics.map(metricKey => {
              const metric = configuredMetrics.find(m => m.key === metricKey);
              const data = metricsData[metricKey] || [];
              const values = data.map(d => d.value).filter(v => v !== null);
              const current = values.length > 0 ? values[values.length - 1] : null;
              const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
              
              return (
                <Grid item xs={12} sm={6} md={3} key={metricKey}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box 
                      sx={{ 
                        width: 12, 
                        height: 12, 
                        borderRadius: '50%', 
                        backgroundColor: getMetricColor(metricKey) 
                      }} 
                    />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                        {metric?.name || metricKey}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: getMetricColor(metricKey) }}>
                        Current: {formatValue(current, metricKey)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'var(--text-tertiary)' }}>
                        Avg: {formatValue(avg, metricKey)}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}

      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </Box>
  );
};

export default MetricsHistory;
