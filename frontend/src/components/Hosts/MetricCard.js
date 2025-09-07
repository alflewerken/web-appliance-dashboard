import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  LinearProgress,
  Chip,
  Skeleton,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
} from 'lucide-react';
import axios from '../../utils/axiosConfig';

const MetricCard = ({ 
  hostId, 
  metricKey, 
  title, 
  icon, 
  refreshInterval = 60000,
  showTrend = true,
  showStats = false,
  height = 120,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentValue, setCurrentValue] = useState(null);
  const [displayText, setDisplayText] = useState('--');
  const [unit, setUnit] = useState('');
  const [trend, setTrend] = useState(null);
  const [stats, setStats] = useState(null);
  const [graphConfig, setGraphConfig] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    fetchMetricData();
    
    const interval = setInterval(fetchMetricData, refreshInterval);
    return () => clearInterval(interval);
  }, [hostId, metricKey]);

  const fetchMetricData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch current value
      const currentResponse = await axios.get(
        `/api/metrics-history/${hostId}/${metricKey}/current`
      );

      if (currentResponse.data.success) {
        setCurrentValue(currentResponse.data.value);
        setDisplayText(currentResponse.data.displayText);
        setUnit(currentResponse.data.unit);
        setLastUpdate(new Date());
      }

      // Fetch trend data if enabled
      if (showTrend) {
        const historyResponse = await axios.get(
          `/api/metrics-history/${hostId}/${metricKey}`,
          { params: { period: '1h' } }
        );

        if (historyResponse.data.success && historyResponse.data.data.length > 1) {
          const data = historyResponse.data.data;
          const recent = data[data.length - 1].value;
          const previous = data[Math.max(0, data.length - 10)].value;
          
          if (recent > previous) {
            setTrend('up');
          } else if (recent < previous) {
            setTrend('down');
          } else {
            setTrend('stable');
          }

          setGraphConfig(historyResponse.data.graphConfig || {});
        }
      }

      // Fetch statistics if enabled
      if (showStats) {
        const statsResponse = await axios.get(
          `/api/metrics-history/${hostId}/${metricKey}/stats`,
          { params: { period: '24h' } }
        );

        if (statsResponse.data.success) {
          setStats(statsResponse.data.stats);
        }
      }

    } catch (err) {
      console.error(`Error fetching metric ${metricKey}:`, err);
      setError('Failed to load metric');
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = () => {
    if (!showTrend || !trend) return null;

    switch (trend) {
      case 'up':
        return <TrendingUp size={16} color="#4caf50" />;
      case 'down':
        return <TrendingDown size={16} color="#f44336" />;
      case 'stable':
        return <Minus size={16} color="#9e9e9e" />;
      default:
        return null;
    }
  };

  const getProgressColor = () => {
    if (!graphConfig.graphMax) return 'primary';
    
    const percentage = (currentValue / graphConfig.graphMax) * 100;
    
    if (percentage >= 90) return 'error';
    if (percentage >= 70) return 'warning';
    return 'primary';
  };

  const renderContent = () => {
    if (loading && !currentValue) {
      return (
        <Box>
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
          {graphConfig.graphMax && (
            <Skeleton variant="rectangular" height={4} sx={{ mt: 1 }} />
          )}
        </Box>
      );
    }

    if (error) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertCircle size={16} color="#f44336" />
          <Typography variant="caption" color="error">
            {error}
          </Typography>
        </Box>
      );
    }

    return (
      <>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="h4" component="div">
            {displayText || '--'}
          </Typography>
          {trend && (
            <Box sx={{ ml: 'auto' }}>
              {getTrendIcon()}
            </Box>
          )}
        </Box>

        {/* Progress bar for percentage-based metrics */}
        {graphConfig.graphMax && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress
              variant="determinate"
              value={Math.min((currentValue / graphConfig.graphMax) * 100, 100)}
              color={getProgressColor()}
              sx={{ height: 6, borderRadius: 1 }}
            />
          </Box>
        )}

        {/* Statistics */}
        {showStats && stats && (
          <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Tooltip title="24h minimum">
                <Chip
                  label={`Min: ${stats.min?.displayText || '-'}`}
                  size="small"
                  variant="outlined"
                />
              </Tooltip>
              <Tooltip title="24h average">
                <Chip
                  label={`Avg: ${stats.average?.displayText || '-'}`}
                  size="small"
                  variant="outlined"
                />
              </Tooltip>
              <Tooltip title="24h maximum">
                <Chip
                  label={`Max: ${stats.max?.displayText || '-'}`}
                  size="small"
                  variant="outlined"
                />
              </Tooltip>
            </Box>
          </Box>
        )}

        {/* Last update time */}
        {lastUpdate && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 1 }}
          >
            Updated: {lastUpdate.toLocaleTimeString()}
          </Typography>
        )}
      </>
    );
  };

  return (
    <Card sx={{ height, position: 'relative' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {icon}
          <Typography variant="subtitle2" color="text.secondary">
            {title || graphConfig.displayName || metricKey}
          </Typography>
        </Box>
        
        {renderContent()}
      </CardContent>
      
      {/* Loading overlay */}
      {loading && currentValue && (
        <Box
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: 'primary.main',
              animation: 'pulse 1.5s infinite',
              '@keyframes pulse': {
                '0%': { opacity: 1 },
                '50%': { opacity: 0.3 },
                '100%': { opacity: 1 },
              },
            }}
          />
        </Box>
      )}
    </Card>
  );
};

export default MetricCard;
