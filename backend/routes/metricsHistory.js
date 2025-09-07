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
      `SELECT config, custom_names 
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
      
      res.json({
        success: true,
        metrics: enabledMetrics
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
      
      // Network interface speed - use realistic values for better visualization
      if (metricKey.includes('.bytesIn') || metricKey.includes('.bytesOut')) {
        const match = metricKey.match(/network\.interface\.(\d+)/);
        if (match) {
          const interfaceNum = parseInt(match[1]);
          
          // Use realistic speeds for better visualization
          // Instead of theoretical maximum, use typical usage speeds
          // This makes low traffic visible on the graph
          
          // Interface 5 (en0 - WiFi): Use 5 MB/s as 100% (typical usage)
          // instead of 38 MB/s (theoretical max 304 Mbps)
          if (interfaceNum === 5) {
            return 5 * 1000000; // 5 MB/s for typical WiFi usage
          }
          // Interface 4 (en5 - Ethernet): Use 10 MB/s as 100%
          // instead of 125 MB/s (theoretical max 1000 Mbps)
          if (interfaceNum === 4) {
            return 10 * 1000000; // 10 MB/s for typical Ethernet usage
          }
          // Interface 14 (en0 alternative): 5 MB/s
          if (interfaceNum === 14) {
            return 5 * 1000000; // 5 MB/s
          }
        }
        // Default for unknown interfaces: 1 MB/s
        return 1 * 1000000; // 1 MB/s
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

module.exports = router;
