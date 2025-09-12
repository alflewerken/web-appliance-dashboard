const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const { authenticateToken } = require('../middleware/auth');

// Get configured metrics for a host
router.get('/:id/configured-metrics', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get configured metrics from host_metrics_logging
    const [result] = await pool.execute(
      `SELECT config, custom_names, selected_metrics, default_time_range
       FROM host_metrics_logging 
       WHERE host_id = ?`,
      [id]
    );
    
    if (result.length > 0) {
      const config = typeof result[0].config === 'string' 
        ? JSON.parse(result[0].config) 
        : result[0].config;
      const customNames = typeof result[0].custom_names === 'string'
        ? JSON.parse(result[0].custom_names)
        : result[0].custom_names;
      
      // Filter only enabled metrics and expand network interfaces
      const enabledMetrics = [];
      
      Object.keys(config).forEach(key => {
        if (!config[key]) return;
        
        // Special handling for network interfaces
        if (key.startsWith('network.interface.')) {
          // Add separate entries for bytesIn, bytesOut, errors, status
          const subMetrics = ['bytesIn', 'bytesOut', 'errors', 'status'];
          subMetrics.forEach(subKey => {
            const fullKey = `${key}.${subKey}`;
            const customName = customNames[fullKey];
            
            // Only add if it has a custom name (meaning it's properly configured)
            if (customName) {
              enabledMetrics.push({
                key: fullKey,
                name: customName,
                enabled: true
              });
            }
          });
        } else {
          // Regular metric
          enabledMetrics.push({
            key: key,
            name: customNames[key] || key,
            enabled: true
          });
        }
      });
      
      // Add saved settings if available
      const savedSettings = {};
      if (result[0].selected_metrics) {
        savedSettings.selectedMetrics = typeof result[0].selected_metrics === 'string'
          ? JSON.parse(result[0].selected_metrics)
          : result[0].selected_metrics;
      }
      if (result[0].default_time_range) {
        savedSettings.defaultTimeRange = result[0].default_time_range;
      }
      
      res.json({
        success: true,
        metrics: enabledMetrics,
        savedSettings: Object.keys(savedSettings).length > 0 ? savedSettings : null
      });
    } else {
      res.json({
        success: true,
        metrics: []
      });
    }
  } catch (error) {
    console.error('Error fetching configured metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch configured metrics'
    });
  }
});

// Get metrics history for a host  
router.get('/:id/metrics-history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { metric, range = '24h', aggregation = 'avg' } = req.query;

    // Parse time range
    let hoursBack = 24;
    switch (range) {
      case '1h':
        hoursBack = 1;
        break;
      case '6h':
        hoursBack = 6;
        break;
      case '24h':
        hoursBack = 24;
        break;
      case '7d':
        hoursBack = 24 * 7;
        break;
      case '30d':
        hoursBack = 24 * 30;
        break;
    }

    // Calculate the start time
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hoursBack);

    // Helper function to get metric maximum values for normalization
    const getMetricMaximum = async (metricKey, hostId) => {
      // CPU metrics are already in percentage
      if (metricKey.includes('cpu.user') || metricKey.includes('cpu.system') || metricKey.includes('cpu.idle')) {
        return 100;
      }
      
      // Memory/Disk percent is already in percentage
      if (metricKey.includes('.percent') || metricKey.includes('disk.')) {
        return 100;
      }
      
      // Network interface speed - values should be in MB/s for graph scaling
      if (metricKey.includes('.bytesIn') || metricKey.includes('.bytesOut')) {
        const match = metricKey.match(/network\.interface\.(\d+)/);
        if (match) {
          const interfaceNum = parseInt(match[1]);
          
          // Return max values in MB/s (not bytes!)
          if (interfaceNum === 5) {
            return 50; // 50 MB/s max for WiFi
          }
          if (interfaceNum === 4) {
            return 100; // 100 MB/s max for Ethernet
          }
          if (interfaceNum === 14) {
            return 50; // 50 MB/s max
          }
        }
        // Default for unknown interfaces
        return 10; // 10 MB/s
      }
      
      // Process counts - use reasonable maximum
      if (metricKey.includes('process.')) {
        return 500;
      }
      
      // Memory values - get actual total from system
      if (metricKey.includes('memory.')) {
        try {
          const [memResult] = await pool.execute(
            `SELECT SUM(max_val) as total FROM (
              SELECT metric_key, MAX(CAST(metric_value AS DECIMAL(20,0))) as max_val
              FROM snmp_metrics 
              WHERE host_id = ? 
              AND metric_key IN ('memory.used', 'memory.free')
              AND timestamp > DATE_SUB(NOW(), INTERVAL 1 DAY)
              GROUP BY metric_key
            ) as mem_values`,
            [hostId]
          );
          
          if (memResult[0].total) {
            return memResult[0].total;
          }
        } catch (err) {
          console.log('Could not get memory total:', err);
        }
        return 8589934592; // 8GB default
      }
      
      return null; // No normalization
    };

    // Check if this is a network traffic metric that needs delta calculation
    const isNetworkTrafficMetric = metric && (
      metric.includes('.bytesIn') || 
      metric.includes('.bytesOut')
    );
    
    console.log(`[METRIC-DEBUG] metric=${metric}, isTraffic=${isNetworkTrafficMetric}, range=${range}, aggregation=${aggregation}`);
    
    // Determine if we should aggregate based on time range and expected data points
    // For 10-second polling: 1h=360 points, 6h=2160 points, 24h=8640 points
    // WICHTIG: Für 1H verwenden wir jetzt auch Aggregation mit Median-Filter
    let forceAggregation = false;
    let aggregationMethod = aggregation || 'avg';
    
    if (range === '1h') {
      // Für 1H: Immer aggregieren auf Minuten-Basis mit Median für Stabilität
      forceAggregation = true;
      aggregationMethod = 'median'; // Median statt Durchschnitt für 1H
    } else if (range === '6h' || range === '24h' || range === '7d' || range === '30d') {
      forceAggregation = true; // Always aggregate for longer time ranges
    }

    // Build the query based on metric type
    let query;
    let params = [id, startTime];

    if (metric) {
      params.push(metric);
      
      // For network traffic metrics, calculate deltas
      if (isNetworkTrafficMetric) {
        // Get the maximum value for normalization
        const metricMaximum = await getMetricMaximum(metric, id);
        // Get raw data points to calculate deltas
        query = `
          SELECT 
            timestamp,
            CAST(metric_value AS DECIMAL(20,0)) as value,
            metric_name as customName
          FROM snmp_metrics
          WHERE host_id = ?
            AND timestamp >= ?
            AND metric_key = ?
          ORDER BY timestamp ASC
        `;
        
        const [rawRows] = await pool.execute(query, params);
        
        console.log(`[METRIC-DEBUG] Raw rows: ${rawRows.length}, first timestamp: ${rawRows[0]?.timestamp}`);
        
        // Calculate deltas between consecutive points
        const deltaRows = [];
        for (let i = 1; i < rawRows.length; i++) {
          const prev = rawRows[i - 1];
          const curr = rawRows[i];
          
          // Calculate time difference in seconds
          const timeDiff = (new Date(curr.timestamp) - new Date(prev.timestamp)) / 1000;
          
          // Skip if time difference is 0 or negative
          if (timeDiff <= 0) {
            continue;
          }
          
          // Calculate value difference (handle counter overflow)
          let valueDiff = curr.value - prev.value;
          if (valueDiff < 0) {
            // Possible counter overflow, skip this point
            continue;
          }
          
          // Calculate bytes per second
          const bytesPerSecond = valueDiff / timeDiff;
          
          // Normalize to percentage if we have a maximum
          const normalizedValue = metricMaximum ? (bytesPerSecond / metricMaximum) * 100 : bytesPerSecond;
          
          deltaRows.push({
            // IMPORTANT: Convert timestamp to ISO string for consistency
            timestamp: new Date(curr.timestamp).toISOString(),
            value: metricMaximum ? Math.min(100, Math.max(0, normalizedValue)) : Math.round(bytesPerSecond),
            rawValue: bytesPerSecond,
            customName: curr.customName
          });
        }
        
        // Apply aggregation based on time range, not point count
        // This ensures all metrics (traffic and non-traffic) use the same time points
        const shouldAggregate = forceAggregation || (aggregation === 'avg' && deltaRows.length > 100);
        
        console.log(`[METRIC-DEBUG] Delta rows: ${deltaRows.length}, shouldAggregate: ${shouldAggregate}, forceAggregation: ${forceAggregation}`);
        
        if (shouldAggregate) {
          const grouped = {};
          deltaRows.forEach(row => {
            // row.timestamp is already an ISO string, just slice it
            const minute = row.timestamp.slice(0, 16) + ':00';
            if (!grouped[minute]) {
              grouped[minute] = [];
            }
            grouped[minute].push({ value: row.value, rawValue: row.rawValue });
          });
          
          const aggregatedRows = [];
          for (const [minute, values] of Object.entries(grouped)) {
            let value, rawValue;
            
            // Use aggregationMethod instead of just aggregation
            switch (aggregationMethod) {
              case 'median':
                // Median filter for robust aggregation (especially for 1H)
                const sortedValues = values.map(v => v.value).sort((a, b) => a - b);
                const sortedRawValues = values.map(v => v.rawValue).sort((a, b) => a - b);
                const midIdx = Math.floor(sortedValues.length / 2);
                value = sortedValues.length % 2 === 0 
                  ? (sortedValues[midIdx - 1] + sortedValues[midIdx]) / 2
                  : sortedValues[midIdx];
                rawValue = sortedRawValues.length % 2 === 0
                  ? (sortedRawValues[midIdx - 1] + sortedRawValues[midIdx]) / 2
                  : sortedRawValues[midIdx];
                break;
              case 'avg':
                value = values.reduce((a, b) => a + b.value, 0) / values.length;
                rawValue = values.reduce((a, b) => a + b.rawValue, 0) / values.length;
                break;
              case 'max':
                value = Math.max(...values.map(v => v.value));
                rawValue = Math.max(...values.map(v => v.rawValue));
                break;
              case 'min':
                value = Math.min(...values.map(v => v.value));
                rawValue = Math.min(...values.map(v => v.rawValue));
                break;
              default:
                value = values.reduce((a, b) => a + b.value, 0) / values.length;
                rawValue = values.reduce((a, b) => a + b.rawValue, 0) / values.length;
            }
            
            aggregatedRows.push({
              timestamp: new Date(minute).toISOString(), // Convert to ISO for consistency
              value: value,
              rawValue: rawValue,
              customName: deltaRows[0]?.customName
            });
          }
          
          res.json({
            success: true,
            data: aggregatedRows,
            metric: metric,
            isTrafficMetric: true,
            isPercentage: !!metricMaximum,
            unit: metricMaximum ? '%' : 'Bps',
            aggregated: true
          });
          
          console.log('[TIMESTAMP-DEBUG] Traffic metric aggregated timestamps:', 
            aggregatedRows.slice(0, 3).map(r => ({
              ts: r.timestamp,
              value: r.value
            })));
          
          return;
        } else {
          res.json({
            success: true,
            data: deltaRows,
            metric: metric,
            isTrafficMetric: true,
            isPercentage: !!metricMaximum,
            unit: metricMaximum ? '%' : 'Bps'
          });
          return;
        }
      }
      
      // Original code for non-traffic metrics
      // Only aggregate in SQL for longer time ranges
      if (forceAggregation && aggregationMethod === 'median') {
        // Median aggregation for 1H - get raw data and aggregate in JS
        query = `
          SELECT 
            timestamp,
            CAST(metric_value AS DECIMAL(10,2)) as value,
            metric_name as customName
          FROM snmp_metrics
          WHERE host_id = ?
            AND timestamp >= ?
            AND metric_key = ?
          ORDER BY timestamp ASC
        `;
        // We'll handle median aggregation after fetching the data
      } else if (forceAggregation && aggregationMethod === 'avg') {
        query = `
          SELECT 
            FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(timestamp) / 60) * 60) as timestamp,
            AVG(CAST(metric_value AS DECIMAL(10,2))) as value,
            MAX(metric_name) as customName
          FROM snmp_metrics
          WHERE host_id = ?
            AND timestamp >= ?
            AND metric_key = ?
          GROUP BY FLOOR(UNIX_TIMESTAMP(timestamp) / 60)
          ORDER BY timestamp ASC
        `;
      } else if (forceAggregation && aggregationMethod === 'max') {
        query = `
          SELECT 
            FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(timestamp) / 60) * 60) as timestamp,
            MAX(CAST(metric_value AS DECIMAL(10,2))) as value,
            MAX(metric_name) as customName
          FROM snmp_metrics
          WHERE host_id = ?
            AND timestamp >= ?
            AND metric_key = ?
          GROUP BY FLOOR(UNIX_TIMESTAMP(timestamp) / 60)
          ORDER BY timestamp ASC
        `;
      } else if (forceAggregation && aggregationMethod === 'min') {
        query = `
          SELECT 
            FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(timestamp) / 60) * 60) as timestamp,
            MIN(CAST(metric_value AS DECIMAL(10,2))) as value,
            MAX(metric_name) as customName
          FROM snmp_metrics
          WHERE host_id = ?
            AND timestamp >= ?
            AND metric_key = ?
          GROUP BY FLOOR(UNIX_TIMESTAMP(timestamp) / 60)
          ORDER BY timestamp ASC
        `;
      } else {
        // For 1h range or when not aggregating, get raw data
        query = `
          SELECT 
            timestamp,
            CAST(metric_value AS DECIMAL(10,2)) as value,
            metric_name as customName
          FROM snmp_metrics
          WHERE host_id = ?
            AND timestamp >= ?
            AND metric_key = ?
          ORDER BY timestamp ASC
        `;
      }
    } else {
      // Get all available metrics for this host
      query = `
        SELECT DISTINCT metric_key, metric_name
        FROM snmp_metrics
        WHERE host_id = ?
          AND timestamp >= ?
        ORDER BY metric_key
      `;
    }

    if (!isNetworkTrafficMetric && metric) {
      const [rows] = await pool.execute(query, params);
      
      // Get the maximum value for normalization
      const metricMaximum = await getMetricMaximum(metric, id);
      
      // If we need median aggregation for 1H, do it here in JS
      let finalRows = rows;
      if (forceAggregation && aggregationMethod === 'median' && rows.length > 0) {
        // Group by minute
        const grouped = {};
        rows.forEach(row => {
          const minute = new Date(row.timestamp).toISOString().slice(0, 16) + ':00.000Z';
          if (!grouped[minute]) {
            grouped[minute] = [];
          }
          grouped[minute].push({
            value: parseFloat(row.value),
            customName: row.customName
          });
        });
        
        // Calculate median for each minute
        finalRows = [];
        for (const [minute, values] of Object.entries(grouped)) {
          const sortedValues = values.map(v => v.value).sort((a, b) => a - b);
          const midIdx = Math.floor(sortedValues.length / 2);
          const medianValue = sortedValues.length % 2 === 0
            ? (sortedValues[midIdx - 1] + sortedValues[midIdx]) / 2
            : sortedValues[midIdx];
          
          finalRows.push({
            timestamp: minute,
            value: medianValue,
            customName: values[0].customName
          });
        }
        
        console.log(`[MEDIAN-DEBUG] Aggregated ${rows.length} rows to ${finalRows.length} minute buckets using median`);
      }
      
      // Convert timestamps to ISO format and normalize values
      const normalizedRows = finalRows.map(row => {
        const result = {
          ...row,
          timestamp: new Date(row.timestamp).toISOString() // Ensure ISO format
        };
        
        if (metricMaximum && row.value !== undefined) {
          const percentage = (row.value / metricMaximum) * 100;
          result.rawValue = row.value;
          result.value = Math.min(100, Math.max(0, percentage));
        }
        
        return result;
      });
      
      // Debug log for first few rows
      if (normalizedRows.length > 0) {
        console.log('[TIMESTAMP-DEBUG] Non-traffic metric sample timestamps:', 
          normalizedRows.slice(0, 3).map(r => ({
            ts: r.timestamp,
            value: r.value
          })));
      }

      res.json({
        success: true,
        data: normalizedRows,
        metric: metric,
        isPercentage: !!metricMaximum,
        unit: metricMaximum ? '%' : 'value',
        range: range,
        aggregation: aggregation
      });
    } else if (!metric) {
      const [rows] = await pool.execute(query, params);
      res.json({
        success: true,
        data: rows || [],
        metric: metric,
        range: range,
        aggregation: aggregation
      });
    }
  } catch (error) {
    console.error('Error fetching metrics history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics history'
    });
  }
});

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

// Compare multiple metrics
router.post('/:id/compare', authenticateToken, async (req, res) => {
  try {
    const { id: hostId } = req.params;
    const { metrics, period = '1h' } = req.body;
    
    if (!metrics || !Array.isArray(metrics)) {
      return res.status(400).json({
        success: false,
        error: 'Metrics array is required'
      });
    }
    
    // Helper function to get color for a metric based on category and index
    const getMetricColor = (metricKey, allMetrics) => {
      const category = metricKey.split('.')[0];
      const categoryMetrics = allMetrics.filter(m => m.startsWith(category));
      const index = categoryMetrics.indexOf(metricKey);
      
      // Color palettes for each category
      const colorPalettes = {
        cpu: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'], // Blue, Red, Green, Amber, Purple
        memory: ['#06B6D4', '#14B8A6', '#0EA5E9', '#6366F1'], // Cyan variations
        disk: ['#F97316', '#FB923C', '#FCD34D', '#FBBF24'], // Orange to Yellow
        network: ['#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE'], // Purple variations (darker to lighter)
        process: ['#EC4899', '#F472B6', '#F9A8D4', '#FBCFE8'] // Pink variations
      };
      
      // Special handling for network in/out
      if (metricKey.includes('network.interface')) {
        if (metricKey.includes('bytesIn')) {
          // Brighter colors for incoming traffic
          const baseColors = ['#3B82F6', '#06B6D4', '#10B981', '#A78BFA'];
          const interfaceNum = metricKey.match(/interface\.(\d+)/)?.[1] || '0';
          return baseColors[parseInt(interfaceNum) % baseColors.length];
        } else if (metricKey.includes('bytesOut')) {
          // Darker/muted colors for outgoing traffic
          const baseColors = ['#1E40AF', '#0E7490', '#059669', '#7C3AED'];
          const interfaceNum = metricKey.match(/interface\.(\d+)/)?.[1] || '0';
          return baseColors[parseInt(interfaceNum) % baseColors.length];
        }
      }
      
      // Get palette for category or use default
      const palette = colorPalettes[category] || ['#6B7280', '#9CA3AF', '#D1D5DB'];
      
      // Return color based on index, cycling through palette if needed
      return palette[index % palette.length];
    };
    
    // Get custom names for this host
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
    const results = {};
    
    // Process each metric
    for (const metricKey of metrics) {
      // Handle network interface metrics specially
      if (metricKey.startsWith('network.interface.') && 
          !metricKey.includes('.bytes') && 
          !metricKey.includes('.errors') && 
          !metricKey.includes('.status') &&
          !metricKey.includes('.speed')) {
        // This is a base network interface metric, get all sub-metrics
        const subMetrics = [
          `${metricKey}.bytesIn`,
          `${metricKey}.bytesOut`,
          `${metricKey}.errors`,
          `${metricKey}.status`
        ];
        
        for (const subMetricKey of subMetrics) {
          const [rawData] = await pool.execute(
            `SELECT 
              metric_value as value,
              timestamp
             FROM snmp_metrics
             WHERE host_id = ? 
             AND metric_key = ?
             AND timestamp > DATE_SUB(NOW(), INTERVAL ${interval})
             ORDER BY timestamp ASC`,
            [hostId, subMetricKey]
          );
          
          if (rawData.length > 0) {
            // Sort by timestamp and convert values to numbers
            const sortedData = rawData.sort((a, b) => 
              new Date(a.timestamp) - new Date(b.timestamp)
            );
            
            // Calculate statistics inline
            let min = Number.MAX_VALUE;
            let max = Number.MIN_VALUE;
            let sum = 0;
            let count = 0;
            
            sortedData.forEach(row => {
              const val = parseFloat(row.value) || 0;
              if (val < min) min = val;
              if (val > max) max = val;
              sum += val;
              count++;
            });
            
            const avg = count > 0 ? sum / count : 0;
            
            // Helper function to format values
            const formatValue = (value, metricKey) => {
              if (value === null || value === undefined) return '-';
              if (metricKey.includes('network.interface') && metricKey.includes('bytes')) {
                const mbPerSec = value / (1024 * 1024);
                return `${mbPerSec.toFixed(2)} MB/s`;
              }
              if (metricKey.includes('cpu.load')) return value.toFixed(2);
              if (metricKey.includes('cpu') || metricKey.includes('memory')) return `${value.toFixed(1)}%`;
              if (metricKey.includes('disk')) return `${value.toFixed(1)}%`;
              if (metricKey.includes('process')) return Math.round(value).toString();
              return value.toFixed(2);
            };
            
            results[subMetricKey] = {
              data: sortedData.map(row => {
                let value = parseFloat(row.value) || 0;
                let displayValue;
                // Convert bytes/sec to MB/s for network metrics
                if (subMetricKey.includes('bytes')) {
                  value = value / (1024 * 1024); // B/s → MB/s
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
                color: getMetricColor(subMetricKey, metrics),
                displayName: customNames[subMetricKey] || subMetricKey.split('.').pop(),
                unit: subMetricKey.includes('bytes') ? 'MB/s' : 
                      (subMetricKey.includes('cpu.load') ? 'Load' :
                      (subMetricKey.includes('percent') || subMetricKey.includes('cpu') || subMetricKey.includes('memory') ? '%' : ''))
              },
              stats: {
                dataPoints: count,
                min: { value: min, displayText: formatValue(min, subMetricKey) },
                max: { value: max, displayText: formatValue(max, subMetricKey) },
                average: { value: avg, displayText: formatValue(avg, subMetricKey) },
                latest: sortedData[sortedData.length - 1]?.timestamp
              }
            };
          }
        }
      } else {
        // Regular metric handling
        const [rawData] = await pool.execute(
          `SELECT 
            metric_value as value,
            timestamp
           FROM snmp_metrics
           WHERE host_id = ? 
           AND metric_key = ?
           AND timestamp > DATE_SUB(NOW(), INTERVAL ${interval})
           ORDER BY timestamp ASC`,
          [hostId, metricKey]
        );
        
        if (rawData.length > 0) {
          // Sort by timestamp and convert values to numbers
          const sortedData = rawData.sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
          );
          
          // Calculate statistics inline
          let min = Number.MAX_VALUE;
          let max = Number.MIN_VALUE;
          let sum = 0;
          let count = 0;
          
          sortedData.forEach(row => {
            const val = parseFloat(row.value) || 0;
            if (val < min) min = val;
            if (val > max) max = val;
            sum += val;
            count++;
          });
          
          const avg = count > 0 ? sum / count : 0;
          
          // Helper function to format values
          const formatValue = (value, metricKey) => {
            if (value === null || value === undefined) return '-';
            if (metricKey.includes('network.interface') && metricKey.includes('bytes')) {
              const mbPerSec = value / (1024 * 1024);
              return `${mbPerSec.toFixed(2)} MB/s`;
            }
            if (metricKey.includes('cpu.load')) return value.toFixed(2);
            if (metricKey.includes('cpu') || metricKey.includes('memory')) return `${value.toFixed(1)}%`;
            if (metricKey.includes('disk')) return `${value.toFixed(1)}%`;
            if (metricKey.includes('process')) return Math.round(value).toString();
            return value.toFixed(2);
          };
          
          results[metricKey] = {
            data: sortedData.map(row => {
              let value = parseFloat(row.value) || 0;
              let displayValue;
              
              // Convert bytes/sec to MB/s for network metrics
              if (metricKey.includes('bytes')) {
                value = value / (1024 * 1024); // B/s → MB/s
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
              color: getMetricColor(metricKey, metrics),
              displayName: customNames[metricKey] || metricKey,
              unit: metricKey.includes('bytes') ? 'MB/s' : 
                    (metricKey.includes('cpu.load') ? 'Load' :
                    (metricKey.includes('percent') || metricKey.includes('cpu') || metricKey.includes('memory') ? '%' : ''))
            },
            stats: {
              dataPoints: count,
              min: { value: min, displayText: formatValue(min, metricKey) },
              max: { value: max, displayText: formatValue(max, metricKey) },
              average: { value: avg, displayText: formatValue(avg, metricKey) },
              latest: sortedData[sortedData.length - 1]?.timestamp
            }
          };
        }
      }
    }
    
    res.json({
      success: true,
      results
    });
    
  } catch (error) {
    console.error('Error comparing metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare metrics'
    });
  }
});

// Get statistics for a metric
router.get('/:id/:metricKey/stats', authenticateToken, async (req, res) => {
  try {
    const { id: hostId, metricKey } = req.params;
    const { period = '1h' } = req.query;
    
    const periodMap = {
      '15m': '15 MINUTE',
      '1h': '1 HOUR',
      '6h': '6 HOUR',
      '24h': '24 HOUR',
      '7d': '7 DAY',
      '30d': '30 DAY'
    };
    
    const interval = periodMap[period] || '1 HOUR';
    
    const [stats] = await pool.execute(
      `SELECT 
        COUNT(*) as count,
        MIN(CAST(metric_value AS DECIMAL(20,6))) as min,
        MAX(CAST(metric_value AS DECIMAL(20,6))) as max,
        AVG(CAST(metric_value AS DECIMAL(20,6))) as avg,
        MAX(timestamp) as latest
       FROM snmp_metrics
       WHERE host_id = ? 
       AND metric_key = ?
       AND timestamp > DATE_SUB(NOW(), INTERVAL ${interval})`,
      [hostId, metricKey]
    );
    
    // Format the stats with proper numbers and display text
    const result = stats[0] || {};
    
    // Helper function to format values based on metric type
    const formatValue = (value, metricKey) => {
      if (value === null || value === undefined) return '-';
      
      // Network metrics (values are in bytes/sec, convert to MB/s)
      if (metricKey.includes('network.interface') && metricKey.includes('bytes')) {
        // Value is in bytes/sec, convert to MB/s
        const mbPerSec = value / (1024 * 1024);
        return `${mbPerSec.toFixed(2)} MB/s`;
      }
      
      // CPU Load metrics (not percentages!)
      if (metricKey.includes('cpu.load')) {
        return value.toFixed(2); // Load average, no percentage
      }
      
      // CPU usage and memory percentage metrics
      if (metricKey.includes('cpu') || metricKey.includes('memory')) {
        return `${value.toFixed(1)}%`;
      }
      
      // Disk usage (percentage)
      if (metricKey.includes('disk')) {
        return `${value.toFixed(1)}%`;
      }
      
      // Process count
      if (metricKey.includes('process')) {
        return Math.round(value).toString();
      }
      
      // Default
      return value.toFixed(2);
    };
    
    const minValue = parseFloat(result.min) || 0;
    const maxValue = parseFloat(result.max) || 0;
    const avgValue = parseFloat(result.avg) || 0;
    
    const formattedStats = {
      dataPoints: parseInt(result.count) || 0,
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
      latest: result.latest
    };
    
    res.json({
      success: true,
      stats: formattedStats
    });
    
  } catch (error) {
    console.error('Error fetching metric stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metric statistics'
    });
  }
});

// Get disk information for a host
router.get('/:id/disk-info', authenticateToken, async (req, res) => {
  try {
    const { id: hostId } = req.params;
    
    // Get the latest monitoring data with full disk information
    const [monitoringData] = await pool.execute(
      `SELECT metrics FROM host_monitoring_data 
       WHERE host_id = ? 
       ORDER BY updated_at DESC 
       LIMIT 1`,
      [hostId]
    );
    
    if (!monitoringData.length || !monitoringData[0].metrics) {
      return res.json({
        success: true,
        disks: {}
      });
    }
    
    // Parse the metrics JSON
    let metrics;
    try {
      metrics = JSON.parse(monitoringData[0].metrics);
    } catch (parseError) {
      console.error('Failed to parse metrics JSON:', parseError);
      return res.json({
        success: true,
        disks: {}
      });
    }
    
    // Check if we have the full disk data in the metrics
    const diskData = {};
    
    // First, check if there's a 'disk' array with full data
    if (metrics.disk && Array.isArray(metrics.disk)) {
      // We have full disk data from SNMP!
      metrics.disk.forEach((disk, index) => {
        const diskKey = `disk.${index}`;
        const totalBytes = disk.total || 0;
        const usedBytes = disk.used || 0;
        const percentUsed = disk.percent || 0;
        
        // Convert bytes to GB
        const totalGB = totalBytes / (1024 * 1024 * 1024);
        const usedGB = usedBytes / (1024 * 1024 * 1024);
        const freeGB = totalGB - usedGB;
        
        diskData[diskKey] = {
          customName: disk.path || disk.device || `Disk ${index}`,
          percentUsed: percentUsed,
          usedGB: usedGB,
          freeGB: freeGB,
          totalGB: totalGB,
          displayText: `${percentUsed.toFixed(1)}% (${usedGB.toFixed(1)} GB / ${totalGB.toFixed(1)} GB)`
        };
      });
    } else {
      // Fallback: Only percentage data available (old format)
      // This should NOT use hardcoded values!
      console.warn(`No full disk data available for host ${hostId}, only percentages`);
      
      // Look for disk.X keys in metrics
      Object.keys(metrics).forEach(key => {
        if (key.startsWith('disk.')) {
          const percentUsed = parseFloat(metrics[key]) || 0;
          
          // Without total size, we can't calculate actual usage
          // Return only what we know for sure
          diskData[key] = {
            customName: `Disk ${key.split('.')[1]}`,
            percentUsed: percentUsed,
            usedGB: null,  // Unknown without total size
            freeGB: null,  // Unknown without total size
            totalGB: null, // Unknown from percentage alone
            displayText: `${percentUsed.toFixed(1)}% (size unknown)`
          };
        }
      });
    }
    
    res.json({
      success: true,
      disks: diskData
    });
    
  } catch (error) {
    console.error('Error fetching disk info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch disk information'
    });
  }
});

// Save user's metric selection settings
router.post('/:id/save-settings', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { selectedMetrics, defaultTimeRange } = req.body;
    
    // Update the settings in host_metrics_logging table
    const [result] = await pool.execute(
      `UPDATE host_metrics_logging 
       SET selected_metrics = ?, 
           default_time_range = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE host_id = ?`,
      [
        JSON.stringify(selectedMetrics),
        defaultTimeRange || '15m',
        id
      ]
    );
    
    if (result.affectedRows > 0) {
      res.json({
        success: true,
        message: 'Settings saved successfully'
      });
    } else {
      // If no existing record, we might need to create one
      // But this should rarely happen as host_metrics_logging is created when metrics are configured
      res.status(404).json({
        success: false,
        error: 'No metrics configuration found for this host'
      });
    }
  } catch (error) {
    console.error('Error saving metric settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save settings'
    });
  }
});

// Update disk configuration for a host
router.post('/:id/disk-config', authenticateToken, async (req, res) => {
  try {
    const { id: hostId } = req.params;
    const { diskIndex, diskName, totalSizeGB } = req.body;
    
    if (!diskIndex || !totalSizeGB) {
      return res.status(400).json({
        success: false,
        error: 'diskIndex and totalSizeGB are required'
      });
    }
    
    // Insert or update disk configuration
    await pool.execute(
      `INSERT INTO host_disk_config (host_id, disk_index, disk_name, total_size_gb) 
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         disk_name = VALUES(disk_name),
         total_size_gb = VALUES(total_size_gb),
         updated_at = CURRENT_TIMESTAMP`,
      [hostId, diskIndex, diskName || null, totalSizeGB]
    );
    
    res.json({
      success: true,
      message: 'Disk configuration updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating disk config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update disk configuration'
    });
  }
});

module.exports = router;
