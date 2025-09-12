import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  useMediaQuery,
  useTheme,
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
  ReferenceArea,
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
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import axios from '../../utils/axiosConfig';
import uiConfig, { useUIConfig } from '../../utils/uiConfigManager';

const MetricsHistory = ({ host }) => {
  const { t, i18n } = useTranslation();
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
  const [diskInfo, setDiskInfo] = useState({});
  const [isMobile, setIsMobile] = useState(false);
  const refreshIntervalRef = useRef(null);
  const pollIntervalRef = useRef(null);
  
  // Zoom functionality with overlay
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [zoomedRange, setZoomedRange] = useState(null);
  const chartContainerRef = useRef(null);
  
  // Get UI configuration for tooltips
  const uiConfiguration = useUIConfig();
  const theme = useTheme();
  const isMobileView = useMediaQuery(theme.breakpoints.down('sm'));

  // Time range options
  const timeRanges = [
    { value: '15m', label: t('metricsHistory.timeRange.15m') },
    { value: '1h', label: t('metricsHistory.timeRange.1h') },
    { value: '6h', label: t('metricsHistory.timeRange.6h') },
    { value: '24h', label: t('metricsHistory.timeRange.24h') },
    { value: '7d', label: t('metricsHistory.timeRange.7d') },
    { value: '30d', label: t('metricsHistory.timeRange.30d') },
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
      setError(t('metricsHistory.failedToFetchMetrics'));
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
    
    const startTime = Date.now();
    console.log(`[METRICS] Starting to load ${selectedMetrics.length} metrics...`);
    
    try {
      // Use optimized endpoint for better performance
      const response = await axios.post(`/api/metrics-history/${host.id}/compare-optimized`, {
        metrics: selectedMetrics,
        period: timeRange,
      });
      
      const loadTime = Date.now() - startTime;
      console.log(`[METRICS] Loaded in ${loadTime}ms, performance:`, response.data.performance);

      if (response.data.success) {
        const newMetricsData = {};
        const newMetricsConfig = {};
        const newStatistics = {};
        
        // Check if any disk metrics are selected and fetch disk info
        const hasDiskMetrics = selectedMetrics.some(m => m.includes('disk'));
        if (hasDiskMetrics) {
          try {
            const diskResponse = await axios.get(`/api/metrics-history/${host.id}/disk-info`);
            if (diskResponse.data.success) {
              setDiskInfo(diskResponse.data.disks);
            }
          } catch (err) {
            console.error('Failed to fetch disk info:', err);
          }
        }
        
        // Process each metric's data, configuration, and statistics
        for (const [metricKey, metricResult] of Object.entries(response.data.results)) {
          newMetricsData[metricKey] = metricResult.data || [];
          newMetricsConfig[metricKey] = metricResult.graphConfig || {};
          
          // Use stats from the response if available, otherwise fetch separately (fallback)
          if (metricResult.stats) {
            newStatistics[metricKey] = metricResult.stats;
          } else {
            // Fallback: fetch statistics separately (for backward compatibility)
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
      setError(t('metricsHistory.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  // Trigger data fetch when metrics selection changes
  useEffect(() => {
    if (selectedMetrics.length > 0) {
      // Reset zoom when timeRange changes
      handleZoomReset();
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
    
    // Use the current language for locale, always with 24h format
    const locale = i18n.language === 'de' ? 'de-DE' : 'en-GB'; // en-GB uses 24h format
    
    if (diffHours < 1) {
      return date.toLocaleTimeString(locale, { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } else if (diffHours < 24) {
      return date.toLocaleTimeString(locale, { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } else {
      return date.toLocaleDateString(locale, { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
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

  // Zoom functionality with overlay
  const handleOverlayMouseDown = (e) => {
    if (!chartContainerRef.current) return;
    
    const rect = chartContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Check if click is within chart area (exclude axis labels)
    const leftMargin = 20; // Reduced from 50
    const rightMargin = 20; // Reduced from 30
    const topMargin = 5;
    const bottomMargin = 30; // Reduced from 50
    
    if (x > leftMargin && x < rect.width - rightMargin && 
        e.clientY - rect.top > topMargin && e.clientY - rect.top < rect.height - bottomMargin) {
      setIsSelecting(true);
      setSelectionStart(x);
      setSelectionEnd(x);
    }
  };

  const handleOverlayMouseMove = (e) => {
    if (!isSelecting || !chartContainerRef.current) return;
    
    const rect = chartContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const rightMargin = 20; // Reduced from 30
    const leftMargin = 20; // Reduced from 50
    
    // Constrain selection within chart area
    const constrainedX = Math.max(leftMargin, Math.min(x, rect.width - rightMargin));
    setSelectionEnd(constrainedX);
  };

  const handleOverlayMouseUp = () => {
    if (!isSelecting || !chartContainerRef.current || selectionStart === selectionEnd) {
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionEnd(null);
      return;
    }
    
    // Calculate data range from pixel positions
    const rect = chartContainerRef.current.getBoundingClientRect();
    const chartWidth = rect.width - 20 - 20; // Updated margins: left 20, right 20
    const leftMargin = 20; // Reduced from 50
    
    const startPercent = ((Math.min(selectionStart, selectionEnd) - leftMargin) / chartWidth) * 100;
    const endPercent = ((Math.max(selectionStart, selectionEnd) - leftMargin) / chartWidth) * 100;
    
    const dataLength = combinedData.length;
    const startIndex = Math.max(0, Math.floor((startPercent / 100) * dataLength));
    const endIndex = Math.min(dataLength - 1, Math.ceil((endPercent / 100) * dataLength));
    
    if (endIndex > startIndex) {
      setZoomedRange({ startIndex, endIndex });
    }
    
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const handleZoomReset = () => {
    setZoomedRange(null);
    setSelectionStart(null);
    setSelectionEnd(null);
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
                {getTranslatedMetricName(entry.dataKey, config.displayName || entry.dataKey)}: {displayValue}
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

  // Helper function to translate metric names
  const getTranslatedMetricName = (metricKey, displayName) => {
    // Try to find a translation based on the metric key
    const keyParts = metricKey.toLowerCase().split('.');
    
    // Special cases for known metric patterns
    if (metricKey.includes('cpu.average')) {
      return t('metricsHistory.metrics.cpuAverage');
    }
    if (metricKey.includes('cpu.user')) {
      return t('metricsHistory.metrics.cpuUser');
    }
    if (metricKey.includes('cpu.system')) {
      return t('metricsHistory.metrics.cpuSystem');
    }
    if (metricKey.includes('cpu.idle')) {
      return t('metricsHistory.metrics.cpuIdle');
    }
    if (metricKey.includes('process.system')) {
      return t('metricsHistory.metrics.processSystem');
    }
    if (metricKey.includes('process.user')) {
      return t('metricsHistory.metrics.processUser');
    }
    if (metricKey.includes('WLAN') && metricKey.includes('In')) {
      return t('metricsHistory.metrics.wlanIn');
    }
    if (metricKey.includes('WLAN') && metricKey.includes('Out')) {
      return t('metricsHistory.metrics.wlanOut');
    }
    if (metricKey.includes('bytesIn')) {
      return t('metricsHistory.metrics.bytesIn');
    }
    if (metricKey.includes('bytesOut')) {
      return t('metricsHistory.metrics.bytesOut');
    }
    
    // For disk metrics, keep the disk name but translate the rest
    if (metricKey.startsWith('disk.') && displayName) {
      // Extract disk name (e.g., "Macintosh HD")
      const diskNameMatch = displayName.match(/^(.+?)(\s*[\(\-]|$)/);
      if (diskNameMatch) {
        return diskNameMatch[1]; // Return just the disk name
      }
    }
    
    // Default: return the display name as-is
    return displayName || metricKey;
  };

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
              Last updated: {lastUpdate.toLocaleTimeString(i18n.language === 'de' ? 'de-DE' : 'en-GB', { hour12: false })}
            </Typography>
          )}
          
          <Button
            size="small"
            startIcon={autoRefresh ? <Pause size={16} /> : <Play size={16} />}
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant="outlined"
          >
            {autoRefresh ? t('metricsHistory.pause') : t('metricsHistory.resume')}
          </Button>
          
          <Button
            size="small"
            startIcon={<RefreshCw size={16} />}
            onClick={fetchMetricsData}
            disabled={loading || selectedMetrics.length === 0}
          >
            {t('metricsHistory.refresh')}
          </Button>
        </Box>
      </Box>

      {/* Metric Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle2">
              {t('metricsHistory.selectMetricsToDisplay')}
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
              {t('metricsHistory.saveSelection')}
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
              {t('metricsHistory.timeRangeLabel')}
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
          {t('metricsHistory.noDataAvailable')}
        </Alert>
      ) : (
        <>
          {/* Main Chart */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              {/* Zoom Controls */}
              {zoomedRange && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                    {t('metricsHistory.showingDataPoints', { 
                      start: zoomedRange.startIndex + 1, 
                      end: zoomedRange.endIndex + 1, 
                      total: combinedData.length 
                    })}
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<ZoomOut size={16} />}
                    onClick={handleZoomReset}
                    variant="outlined"
                    sx={{
                      borderColor: '#ff9800',
                      color: '#ff9800',
                      '&:hover': {
                        borderColor: '#f57c00',
                        backgroundColor: 'rgba(255, 152, 0, 0.08)',
                      },
                    }}
                  >
                    {t('metricsHistory.resetZoom')}
                  </Button>
                </Box>
              )}
              
              {/* Instructions */}
              {!zoomedRange && combinedData.length > 0 && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" sx={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <ZoomIn size={14} />
                    Click and drag on the chart to select an area to zoom in
                  </Typography>
                </Box>
              )}
              
              {/* Chart with overlay */}
              <Box 
                ref={chartContainerRef}
                sx={{ 
                  position: 'relative',
                  width: '100%',
                  height: 400,
                  cursor: isSelecting ? 'col-resize' : 'crosshair'
                }}
                onMouseDown={handleOverlayMouseDown}
                onMouseMove={handleOverlayMouseMove}
                onMouseUp={handleOverlayMouseUp}
                onMouseLeave={handleOverlayMouseUp}
              >
                {/* Selection overlay */}
                {isSelecting && selectionStart !== null && selectionEnd !== null && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 5,
                      left: Math.min(selectionStart, selectionEnd),
                      width: Math.abs(selectionEnd - selectionStart),
                      height: 'calc(100% - 35px)', // Adjusted for smaller bottom margin
                      backgroundColor: 'rgba(25, 118, 210, 0.2)',
                      border: '1px solid rgba(25, 118, 210, 0.5)',
                      pointerEvents: 'none',
                      zIndex: 10,
                    }}
                  />
                )}
                
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={zoomedRange 
                      ? combinedData.slice(zoomedRange.startIndex, zoomedRange.endIndex + 1)
                      : combinedData}
                    margin={{ top: 5, right: 20, left: 20, bottom: 30 }}
                  >
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
                        const hasNetworkMetrics = selectedMetrics.some(m => m.includes('bytes'));
                        if (hasNetworkMetrics) {
                          return value.toFixed(2);
                        }
                        return value;
                      }}
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
                          name={getTranslatedMetricName(metricKey, config.displayName || metricKey)}
                          stroke={config.color || '#8884d8'}
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                          animationDuration={300}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>

          {/* Statistics Table */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2">
                  {t('metricsHistory.metricsStatistics')}
                </Typography>
                <MuiTooltip title={t('metricsHistory.statisticsTooltip')}>
                  <Info size={16} />
                </MuiTooltip>
              </Box>
              
              {/* Desktop View */}
              {!isMobileView ? (
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
                          {t('metricsHistory.metric')}
                        </th>
                        <th style={{ 
                          textAlign: 'right', 
                          padding: '12px 16px',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--text-secondary)'
                        }}>
                          {t('metricsHistory.min')}
                        </th>
                        <th style={{ 
                          textAlign: 'right', 
                          padding: '12px 16px',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--text-secondary)'
                        }}>
                          {t('metricsHistory.average')}
                        </th>
                        <th style={{ 
                          textAlign: 'right', 
                          padding: '12px 16px',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--text-secondary)'
                        }}>
                          {t('metricsHistory.max')}
                        </th>
                        <th style={{ 
                          textAlign: 'right', 
                          padding: '12px 16px',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--text-secondary)'
                        }}>
                          {t('metricsHistory.dataPoints')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMetrics.map((metricKey, index) => {
                        const config = metricsConfig[metricKey] || {};
                        const stats = statistics[metricKey];
                        const disk = diskInfo[metricKey];
                        
                        if (!stats) return null;
                        
                        // Enhanced display name for disk metrics
                        let displayName = getTranslatedMetricName(metricKey, config.displayName || metricKey);
                        if (disk) {
                          displayName = `${disk.customName} (${disk.percentUsed.toFixed(1)}% - ${disk.usedGB.toFixed(1)}GB / ${disk.totalGB.toFixed(1)}GB)`;
                        }
                        
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
                                {displayName}
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
              ) : (
                /* Mobile View - Compact Cards */
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {selectedMetrics.map((metricKey) => {
                    const config = metricsConfig[metricKey] || {};
                    const stats = statistics[metricKey];
                    const disk = diskInfo[metricKey];
                    
                    if (!stats) return null;
                    
                    // Enhanced display name for disk metrics
                    let displayName = getTranslatedMetricName(metricKey, config.displayName || metricKey);
                    let diskDetails = null;
                    if (disk) {
                      displayName = disk.customName;
                      diskDetails = `${disk.percentUsed.toFixed(1)}% - ${disk.usedGB.toFixed(1)}GB / ${disk.totalGB.toFixed(1)}GB`;
                    }
                    
                    return (
                      <Paper 
                        key={metricKey}
                        sx={{ 
                          p: 2,
                          backgroundColor: 'rgba(255, 255, 255, 0.01)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              backgroundColor: config.color || '#8884d8',
                              flexShrink: 0
                            }}
                          />
                          <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                            {getTranslatedMetricName(metricKey, displayName)}
                          </Typography>
                        </Box>
                        
                        {diskDetails && (
                          <Typography variant="caption" sx={{ color: 'var(--text-secondary)', display: 'block', mb: 1 }}>
                            {diskDetails}
                          </Typography>
                        )}
                        
                        <Grid container spacing={1}>
                          <Grid item xs={4}>
                            <Typography variant="caption" color="text.secondary">{t('metricsHistory.min')}</Typography>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {stats.min?.displayText || '-'}
                            </Typography>
                          </Grid>
                          <Grid item xs={4}>
                            <Typography variant="caption" color="text.secondary">{t('metricsHistory.avg')}</Typography>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                              {stats.average?.displayText || '-'}
                            </Typography>
                          </Grid>
                          <Grid item xs={4}>
                            <Typography variant="caption" color="text.secondary">{t('metricsHistory.max')}</Typography>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {stats.max?.displayText || '-'}
                            </Typography>
                          </Grid>
                        </Grid>
                        
                        <Typography variant="caption" sx={{ color: 'var(--text-secondary)', mt: 1, display: 'block' }}>
                          {stats.dataPoints} data points
                        </Typography>
                      </Paper>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
                      }}>

        </>
      )}
    </Box>
  );
};

export default MetricsHistory;
