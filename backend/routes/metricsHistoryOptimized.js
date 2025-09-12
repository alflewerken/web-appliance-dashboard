const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const { authenticateToken } = require('../middleware/auth');

// OPTIMIZED Compare metrics route - loads all data in 2 queries instead of N queries
router.post('/:id/compare-optimized', authenticateToken, async (req, res) => {
  try {
    const { id: hostId } = req.params;
    const { metrics, period = '1h' } = req.body;
    
    if (!metrics || !Array.isArray(metrics)) {
      return res.status(400).json({
        success: false,
        error: 'Metrics array is required'
      });
    }
    
    console.log(`[OPTIMIZED] Loading ${metrics.length} metrics for host ${hostId}`);
    const startTime = Date.now();
    
    // Helper function to get color for a metric
    const getMetricColor = (metricKey, allMetrics) => {
      const category = metricKey.split('.')[0];
      const categoryMetrics = allMetrics.filter(m => m.startsWith(category));
      const index = categoryMetrics.indexOf(metricKey);
      
      const colorPalettes = {
        cpu: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'],
        memory: ['#06B6D4', '#14B8A6', '#0EA5E9', '#6366F1'],
        disk: ['#F97316', '#FB923C', '#FCD34D', '#FBBF24'],
        network: ['#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE'],
        process: ['#EC4899', '#F472B6', '#F9A8D4', '#FBCFE8']
      };
      
      if (metricKey.includes('network.interface')) {
        if (metricKey.includes('bytesIn')) {
          const baseColors = ['#3B82F6', '#06B6D4', '#10B981', '#A78BFA'];
          const interfaceNum = metricKey.match(/interface\.(\d+)/)?.[1] || '0';
          return baseColors[parseInt(interfaceNum) % baseColors.length];
        } else if (metricKey.includes('bytesOut')) {
          const baseColors = ['#1E40AF', '#0E7490', '#059669', '#7C3AED'];
          const interfaceNum = metricKey.match(/interface\.(\d+)/)?.[1] || '0';
          return baseColors[parseInt(interfaceNum) % baseColors.length];
        }
      }
      
      const palette = colorPalettes[category] || ['#6B7280', '#9CA3AF', '#D1D5DB'];
      return palette[index % palette.length];
    };
    
    // Get custom names
    let customNames = {};
    try {
      const [configResult] = await pool.execute(
        'SELECT custom_names FROM host_metrics_logging WHERE host_id = ?',
        [hostId]
      );
      if (configResult.length > 0 && configResult[0].custom_names) {
        customNames = typeof configResult[0].custom_names === 'string' 
          ? JSON.parse(configResult[0].custom_names) 
          : configResult[0].custom_names;
      }
    } catch (error) {
      console.error('Error fetching custom names:', error);
    }
    
    // Calculate time range
    const periodMap = {
      '15m': '15 MINUTE',
      '1h': '1 HOUR',
      '6h': '6 HOUR',
      '24h': '24 HOUR',
      '7d': '7 DAY',
      '30d': '30 DAY'
    };
    
    const interval = periodMap[period] || '1 HOUR';
    
    // Expand network interface metrics
    const expandedMetrics = [];
    for (const metricKey of metrics) {
      if (metricKey.startsWith('network.interface.') && 
          !metricKey.includes('.bytes') && 
          !metricKey.includes('.errors') && 
          !metricKey.includes('.status') &&
          !metricKey.includes('.speed')) {
        expandedMetrics.push(
          `${metricKey}.bytesIn`,
          `${metricKey}.bytesOut`,
          `${metricKey}.errors`,
          `${metricKey}.status`
        );
      } else {
        expandedMetrics.push(metricKey);
      }
    }
    
    console.log(`[OPTIMIZED] Fetching data for ${expandedMetrics.length} expanded metrics`);
    
    // OPTIMIZATION: Fetch ALL data in ONE query
    const placeholders = expandedMetrics.map(() => '?').join(',');
    const dataQueryStart = Date.now();
    
    const [allData] = await pool.execute(
      `SELECT 
        metric_key,
        metric_value as value,
        timestamp
       FROM snmp_metrics
       WHERE host_id = ? 
       AND metric_key IN (${placeholders})
       AND timestamp > DATE_SUB(NOW(), INTERVAL ${interval})
       ORDER BY metric_key, timestamp ASC`,
      [hostId, ...expandedMetrics]
    );
    
    console.log(`[OPTIMIZED] Data query took ${Date.now() - dataQueryStart}ms, returned ${allData.length} rows`);
    
    // OPTIMIZATION: Fetch ALL statistics in ONE query
    const statsQueryStart = Date.now();
    
    const [allStats] = await pool.execute(
      `SELECT 
        metric_key,
        COUNT(*) as count,
        MIN(CAST(metric_value AS DECIMAL(20,6))) as min,
        MAX(CAST(metric_value AS DECIMAL(20,6))) as max,
        AVG(CAST(metric_value AS DECIMAL(20,6))) as avg,
        MAX(timestamp) as latest
       FROM snmp_metrics
       WHERE host_id = ? 
       AND metric_key IN (${placeholders})
       AND timestamp > DATE_SUB(NOW(), INTERVAL ${interval})
       GROUP BY metric_key`,
      [hostId, ...expandedMetrics]
    );
    
    console.log(`[OPTIMIZED] Stats query took ${Date.now() - statsQueryStart}ms`);
    
    // Create a map for quick stats lookup
    const statsMap = {};
    allStats.forEach(stat => {
      statsMap[stat.metric_key] = stat;
    });
    
    // Helper function to format values
    const formatValue = (value, metricKey) => {
      if (value === null || value === undefined) return '-';
      
      if (metricKey.includes('network.interface') && metricKey.includes('bytes')) {
        const mbPerSec = value / (1024 * 1024);
        return `${mbPerSec.toFixed(2)} MB/s`;
      }
      
      if (metricKey.includes('cpu.load')) {
        return value.toFixed(2);
      }
      
      if (metricKey.includes('cpu') || metricKey.includes('memory')) {
        return `${value.toFixed(1)}%`;
      }
      
      if (metricKey.includes('disk')) {
        return `${value.toFixed(1)}%`;
      }
      
      if (metricKey.includes('process')) {
        return Math.round(value).toString();
      }
      
      return value.toFixed(2);
    };
    
    // Group data by metric_key
    const groupedData = {};
    allData.forEach(row => {
      if (!groupedData[row.metric_key]) {
        groupedData[row.metric_key] = [];
      }
      groupedData[row.metric_key].push(row);
    });
    
    // Build results
    const results = {};
    for (const metricKey of expandedMetrics) {
      const metricData = groupedData[metricKey] || [];
      const statsData = statsMap[metricKey] || {};
      
      if (metricData.length > 0) {
        const minValue = parseFloat(statsData.min) || 0;
        const maxValue = parseFloat(statsData.max) || 0;
        const avgValue = parseFloat(statsData.avg) || 0;
        
        results[metricKey] = {
          data: metricData.map(row => {
            let value = parseFloat(row.value) || 0;
            let displayValue;
            
            if (metricKey.includes('bytes')) {
              value = value / (1024 * 1024);
              displayValue = `${value.toFixed(2)} MB/s`;
            } else {
              displayValue = value.toFixed(2);
            }
            
            return {
              timestamp: new Date(row.timestamp).toISOString(),
              value: value,
              displayValue: displayValue
            };
          }),
          graphConfig: {
            color: getMetricColor(metricKey, expandedMetrics),
            displayName: customNames[metricKey] || 
                        (metricKey.includes('network.interface') ? metricKey.split('.').pop() : metricKey),
            unit: metricKey.includes('bytes') ? 'MB/s' : 
                  (metricKey.includes('cpu.load') ? 'Load' :
                  (metricKey.includes('percent') || metricKey.includes('cpu') || metricKey.includes('memory') ? '%' : ''))
          },
          stats: {
            dataPoints: parseInt(statsData.count) || 0,
            min: {
              value: minValue,
              displayText: formatValue(minValue, metricKey)
            },
            max: {
              value: maxValue,
              displayText: formatValue(maxValue, metricKey)
            },
            average: {
              value: avgValue,
              displayText: formatValue(avgValue, metricKey)
            },
            latest: statsData.latest
          }
        };
      }
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`[OPTIMIZED] Total processing time: ${totalTime}ms`);
    
    res.json({
      success: true,
      results,
      performance: {
        totalTime: totalTime,
        dataRows: allData.length,
        metrics: expandedMetrics.length
      }
    });
    
  } catch (error) {
    console.error('Error in optimized compare:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare metrics'
    });
  }
});

module.exports = router;
