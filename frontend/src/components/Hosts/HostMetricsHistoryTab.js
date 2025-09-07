import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  ButtonGroup,
  Button,
  Divider,
} from '@mui/material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  RefreshCw,
  Calendar,
  Clock,
  TrendingUp,
  Activity,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Download,
} from 'lucide-react';
import axios from '../../utils/axiosConfig';

// Color palette for charts
const CHART_COLORS = {
  cpu: '#4CAF50',
  memory: '#2196F3',
  disk: '#FF9800',
  network: '#9C27B0',
  swap: '#F44336',
  load: '#00BCD4',
};

const HostMetricsHistoryTab = ({ host, getInputStyles }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metricsData, setMetricsData] = useState([]);
  const [timeRange, setTimeRange] = useState('1h'); // 1h, 6h, 24h, 7d, 30d
  const [selectedMetrics, setSelectedMetrics] = useState(['cpu.user', 'memory.used']);
  const [availableMetrics, setAvailableMetrics] = useState([]);
  const [refreshInterval, setRefreshInterval] = useState(60000); // 60 seconds
  const refreshIntervalRef = useRef(null);

  // Time range options
  const timeRangeOptions = [
    { value: '1h', label: '1 Hour', dataPoints: 60 },
    { value: '6h', label: '6 Hours', dataPoints: 72 },
    { value: '24h', label: '24 Hours', dataPoints: 96 },
    { value: '7d', label: '7 Days', dataPoints: 168 },
    { value: '30d', label: '30 Days', dataPoints: 180 },
  ];

  // Fetch historical metrics data
  const fetchMetricsHistory = async () => {
    if (!host?.id) return;

    setLoading(true);
    setError(null);

    try {
      // Calculate hours based on time range
      const hoursMap = {
        '1h': 1,
        '6h': 6,
        '24h': 24,
        '7d': 168,
        '30d': 720,
      };
      const hours = hoursMap[timeRange] || 24;

      const response = await axios.get(`/api/polling/hosts/${host.id}/history`, {
        params: { hours }
      });

      if (response.data.success) {
        // Process and format the data for charts
        const processedData = processMetricsData(response.data.metrics);
        setMetricsData(processedData);
        
        // Extract available metrics from the data
        if (processedData.length > 0) {
          const metrics = new Set();
          processedData.forEach(point => {
            Object.keys(point).forEach(key => {
              if (key !== 'timestamp' && key !== 'time') {
                metrics.add(key);
              }
            });
          });
          setAvailableMetrics(Array.from(metrics));
        }
      }
    } catch (err) {
      console.error('Failed to fetch metrics history:', err);
      setError('Failed to load metrics history');
    } finally {
      setLoading(false);
    }
  };

  // Process raw metrics data for charts
  const processMetricsData = (rawData) => {
    if (!rawData || rawData.length === 0) return [];

    // Group data by timestamp
    const groupedData = {};
    
    rawData.forEach(metric => {
      const timestamp = new Date(metric.timestamp);
      const timeKey = timestamp.toISOString();
      
      if (!groupedData[timeKey]) {
        groupedData[timeKey] = {
          timestamp: timeKey,
          time: formatTimeLabel(timestamp),
        };
      }
      
      // Add metric value with custom name if available
      const metricKey = metric.metric_key || metric.metric_name;
      groupedData[timeKey][metricKey] = parseFloat(metric.metric_value) || 0;
    });

    // Convert to array and sort by timestamp
    return Object.values(groupedData)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  };

  // Format time label based on range
  const formatTimeLabel = (date) => {
    const d = new Date(date);
    
    switch (timeRange) {
      case '1h':
      case '6h':
        return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      case '24h':
        return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      case '7d':
        return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
      case '30d':
        return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
      default:
        return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    }
  };

  // Get chart color for metric
  const getMetricColor = (metric) => {
    if (metric.includes('cpu')) return CHART_COLORS.cpu;
    if (metric.includes('memory')) return CHART_COLORS.memory;
    if (metric.includes('disk')) return CHART_COLORS.disk;
    if (metric.includes('network')) return CHART_COLORS.network;
    if (metric.includes('swap')) return CHART_COLORS.swap;
    if (metric.includes('load')) return CHART_COLORS.load;
    return '#757575';
  };

  // Format metric value for display
  const formatMetricValue = (value, metric) => {
    if (metric.includes('memory') || metric.includes('disk')) {
      // Convert to GB
      const gb = value / (1024 * 1024 * 1024);
      return `${gb.toFixed(2)} GB`;
    }
    if (metric.includes('percent') || metric.includes('cpu') || metric.includes('load')) {
      return `${value.toFixed(1)}%`;
    }
    return value.toFixed(2);
  };

  // Setup auto-refresh
  useEffect(() => {
    fetchMetricsHistory();

    // Setup auto-refresh interval
    if (refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        fetchMetricsHistory();
      }, refreshInterval);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [host?.id, timeRange, refreshInterval]);

  // Calculate summary statistics
  const calculateStats = (metric) => {
    const values = metricsData
      .map(d => d[metric])
      .filter(v => v !== undefined && v !== null);
    
    if (values.length === 0) {
      return { current: 0, min: 0, max: 0, avg: 0 };
    }

    return {
      current: values[values.length - 1],
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
    };
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Time Range</InputLabel>
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                label="Time Range"
              >
                {timeRangeOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Metrics to Display</InputLabel>
              <Select
                multiple
                value={selectedMetrics}
                onChange={(e) => setSelectedMetrics(e.target.value)}
                label="Metrics to Display"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip 
                        key={value} 
                        label={value} 
                        size="small"
                        style={{ backgroundColor: getMetricColor(value), color: 'white' }}
                      />
                    ))}
                  </Box>
                )}
              >
                {availableMetrics.map(metric => (
                  <MenuItem key={metric} value={metric}>
                    {metric}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <ButtonGroup fullWidth>
              <Tooltip title="Refresh Now">
                <IconButton onClick={fetchMetricsHistory} disabled={loading}>
                  <RefreshCw className={loading ? 'spinning' : ''} />
                </IconButton>
              </Tooltip>
              <FormControl size="small" sx={{ flex: 1 }}>
                <Select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value={0}>No Auto-Refresh</MenuItem>
                  <MenuItem value={30000}>30 seconds</MenuItem>
                  <MenuItem value={60000}>1 minute</MenuItem>
                  <MenuItem value={300000}>5 minutes</MenuItem>
                </Select>
              </FormControl>
            </ButtonGroup>
          </Grid>
        </Grid>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      )}

      {/* No Data State */}
      {!loading && metricsData.length === 0 && (
        <Alert severity="info">
          No metrics data available for the selected time range. 
          Make sure SNMP monitoring is enabled and the polling service is running.
        </Alert>
      )}

      {/* Metrics Charts */}
      {!loading && metricsData.length > 0 && (
        <Grid container spacing={3}>
          {/* Main Chart - Line Chart for Selected Metrics */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <Activity style={{ verticalAlign: 'middle', marginRight: 8 }} />
                  Metrics Timeline
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={metricsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis />
                    <RechartsTooltip 
                      formatter={(value, name) => formatMetricValue(value, name)}
                    />
                    <Legend />
                    
                    {selectedMetrics.map(metric => (
                      <Line
                        key={metric}
                        type="monotone"
                        dataKey={metric}
                        stroke={getMetricColor(metric)}
                        strokeWidth={2}
                        dot={false}
                        name={metric}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Statistics Cards */}
          {selectedMetrics.map(metric => {
            const stats = calculateStats(metric);
            const Icon = metric.includes('cpu') ? Cpu : 
                        metric.includes('memory') ? MemoryStick :
                        metric.includes('disk') ? HardDrive :
                        metric.includes('network') ? Network : Activity;
            
            return (
              <Grid item xs={12} md={6} lg={3} key={metric}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Icon 
                        size={24} 
                        style={{ color: getMetricColor(metric), marginRight: 8 }}
                      />
                      <Typography variant="subtitle1">
                        {metric}
                      </Typography>
                    </Box>
                    
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="textSecondary">
                          Current
                        </Typography>
                        <Typography variant="h6">
                          {formatMetricValue(stats.current, metric)}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="textSecondary">
                          Average
                        </Typography>
                        <Typography variant="h6">
                          {formatMetricValue(stats.avg, metric)}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="textSecondary">
                          Min
                        </Typography>
                        <Typography variant="body2">
                          {formatMetricValue(stats.min, metric)}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="textSecondary">
                          Max
                        </Typography>
                        <Typography variant="body2">
                          {formatMetricValue(stats.max, metric)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Custom CSS for spinning animation */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spinning {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </Box>
  );
};

export default HostMetricsHistoryTab;
