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
      
      // Filter only enabled metrics
      const enabledMetrics = Object.keys(config)
        .filter(key => config[key])
        .map(key => ({
          key: key,
          name: customNames[key] || key,
          enabled: true
        }));
      
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

    // Build the query based on aggregation
    let query;
    let params = [id, startTime];

    if (metric) {
      params.push(metric);
      
      // Get specific metric with aggregation
      if (aggregation === 'avg') {
        query = `
          SELECT 
            DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:00') as timestamp,
            AVG(CAST(metric_value AS DECIMAL(10,2))) as value,
            metric_name as customName
          FROM snmp_metrics
          WHERE host_id = ?
            AND timestamp >= ?
            AND metric_key = ?
          GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:00'), metric_name
          ORDER BY timestamp ASC
        `;
      } else if (aggregation === 'max') {
        query = `
          SELECT 
            DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:00') as timestamp,
            MAX(CAST(metric_value AS DECIMAL(10,2))) as value,
            metric_name as customName
          FROM snmp_metrics
          WHERE host_id = ?
            AND timestamp >= ?
            AND metric_key = ?
          GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:00'), metric_name
          ORDER BY timestamp ASC
        `;
      } else if (aggregation === 'min') {
        query = `
          SELECT 
            DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:00') as timestamp,
            MIN(CAST(metric_value AS DECIMAL(10,2))) as value,
            metric_name as customName
          FROM snmp_metrics
          WHERE host_id = ?
            AND timestamp >= ?
            AND metric_key = ?
          GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:00'), metric_name
          ORDER BY timestamp ASC
        `;
      } else {
        // Raw data, no aggregation
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
          LIMIT 1000
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

    console.log('Executing metrics query:', query, 'with params:', params);
    
    const [rows] = await pool.execute(query, params);

    // Get available metrics
    const [availableMetrics] = await pool.execute(
      `SELECT DISTINCT metric_key, metric_name, unit
       FROM snmp_metrics
       WHERE host_id = ?
         AND timestamp >= ?
       ORDER BY metric_key`,
      [id, startTime]
    );

    // Format response
    res.json({
      success: true,
      data: rows || [],
      availableMetrics: availableMetrics || [],
      timeRange: range,
      aggregation: aggregation,
      metric: metric
    });

  } catch (error) {
    console.error('Error fetching metrics history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics history',
      details: error.message
    });
  }
});

// Get aggregated statistics for a metric
router.get('/:id/metrics-stats', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { metric, range = '24h' } = req.query;

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

    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hoursBack);

    // Get statistics
    const [stats] = await pool.execute(
      `SELECT 
        MIN(CAST(metric_value AS DECIMAL(10,2))) as min_value,
        MAX(CAST(metric_value AS DECIMAL(10,2))) as max_value,
        AVG(CAST(metric_value AS DECIMAL(10,2))) as avg_value,
        COUNT(*) as data_points,
        (SELECT CAST(metric_value AS DECIMAL(10,2)) 
         FROM snmp_metrics 
         WHERE host_id = ? AND metric_key = ?
         ORDER BY timestamp DESC LIMIT 1) as current_value
       FROM snmp_metrics
       WHERE host_id = ?
         AND timestamp >= ?
         AND metric_key = ?`,
      [id, metric, id, startTime, metric]
    );

    res.json({
      success: true,
      stats: stats[0] || {},
      timeRange: range,
      metric: metric
    });

  } catch (error) {
    console.error('Error fetching metrics stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics statistics',
      details: error.message
    });
  }
});

module.exports = router;
