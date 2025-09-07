// Unified metric processing service
// Handles all metric transformations consistently
const mysql = require('mysql2/promise');

class MetricProcessor {
  constructor() {
    this.metricDefinitions = new Map();
    this.lastCacheUpdate = 0;
    this.cacheTimeout = 60000; // 1 minute cache
  }

  // Load metric definitions from database
  async loadDefinitions(pool) {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          metric_key,
          display_name,
          category,
          unit,
          data_type,
          storage_unit,
          storage_multiplier,
          display_unit,
          display_format,
          decimal_places,
          normalization_type,
          normalization_max,
          normalization_base,
          graph_min,
          graph_max,
          graph_color,
          graph_type
        FROM metric_definitions
        WHERE is_active = true
      `);

      this.metricDefinitions.clear();
      for (const row of rows) {
        this.metricDefinitions.set(row.metric_key, row);
      }
      
      this.lastCacheUpdate = Date.now();
      console.log(`Loaded ${rows.length} metric definitions`);
      
      return this.metricDefinitions;
    } catch (error) {
      console.error('Error loading metric definitions:', error);
      throw error;
    }
  }

  // Get metric definition with cache
  async getDefinition(pool, metricKey) {
    // Refresh cache if expired
    if (Date.now() - this.lastCacheUpdate > this.cacheTimeout) {
      await this.loadDefinitions(pool);
    }

    // Check for exact match first
    if (this.metricDefinitions.has(metricKey)) {
      return this.metricDefinitions.get(metricKey);
    }

    // Check for pattern match (for dynamic metrics like network.eth0.in)
    for (const [key, definition] of this.metricDefinitions) {
      // Handle network metrics pattern
      if (metricKey.startsWith('network.') && key.includes('network.')) {
        const basePattern = key.replace(/eth0/, '.*');
        const regex = new RegExp(basePattern.replace(/\./g, '\\.'));
        if (regex.test(metricKey)) {
          // Create a copy with the actual metric key
          return { ...definition, metric_key: metricKey };
        }
      }
      
      // Handle disk metrics pattern
      if (metricKey.startsWith('disk.') && key.includes('disk.')) {
        const basePattern = key.replace(/\//, '.*');
        const regex = new RegExp(basePattern.replace(/\./g, '\\.'));
        if (regex.test(metricKey)) {
          return { ...definition, metric_key: metricKey };
        }
      }
    }

    // Return default definition if not found
    return this.getDefaultDefinition(metricKey);
  }

  // Default definition for unknown metrics
  getDefaultDefinition(metricKey) {
    const category = metricKey.split('.')[0];
    return {
      metric_key: metricKey,
      display_name: metricKey,
      category: category,
      unit: 'value',
      data_type: 'gauge',
      storage_unit: 'value',
      storage_multiplier: 1,
      display_unit: '',
      display_format: '{value}',
      decimal_places: 2,
      normalization_type: 'none',
      normalization_max: null,
      normalization_base: null,
      graph_min: 0,
      graph_max: 100,
      graph_color: '#6B7280',
      graph_type: 'line'
    };
  }

  // Process raw metric value for storage
  async processForStorage(pool, metricKey, rawValue) {
    const definition = await this.getDefinition(pool, metricKey);
    
    // Apply storage multiplier if defined
    let processedValue = parseFloat(rawValue) || 0;
    if (definition.storage_multiplier && definition.storage_multiplier !== 1) {
      processedValue = processedValue * definition.storage_multiplier;
    }

    return {
      value: processedValue,
      unit: definition.storage_unit,
      dataType: definition.data_type
    };
  }

  // Process stored metric value for display
  async processForDisplay(pool, metricKey, storedValue, additionalData = {}) {
    const definition = await this.getDefinition(pool, metricKey);
    let displayValue = parseFloat(storedValue) || 0;

    // Apply normalization based on type
    switch (definition.normalization_type) {
      case 'percentage':
        // Special handling for memory metrics that need total memory
        if (metricKey.startsWith('memory.') && definition.normalization_base) {
          // Get the total memory from recent metrics
          const hostId = additionalData.hostId;
          if (hostId) {
            try {
              const [result] = await pool.execute(
                `SELECT metric_value FROM snmp_metrics 
                 WHERE host_id = ? AND metric_key = ?
                 AND timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)
                 ORDER BY timestamp DESC LIMIT 1`,
                [hostId, definition.normalization_base]
              );
              
              if (result.length > 0) {
                const totalValue = parseFloat(result[0].metric_value);
                if (totalValue > 0) {
                  displayValue = (displayValue / totalValue) * 100;
                }
              }
            } catch (error) {
              console.error('Error getting normalization base:', error);
            }
          }
        } else if (definition.normalization_max) {
          displayValue = (displayValue / definition.normalization_max) * 100;
        }
        break;
        
      case 'ratio':
        if (definition.normalization_max) {
          displayValue = displayValue / definition.normalization_max;
        }
        break;
        
      case 'delta':
        // For counter types, calculate rate of change
        if (additionalData.previousValue !== undefined && additionalData.timeDelta) {
          displayValue = (displayValue - additionalData.previousValue) / additionalData.timeDelta;
        }
        break;
        
      case 'none':
      default:
        // No normalization needed
        break;
    }

    // Convert units if needed
    displayValue = this.convertUnits(
      displayValue,
      definition.storage_unit,
      definition.display_unit
    );

    // Format the value
    const formattedValue = displayValue.toFixed(definition.decimal_places);
    
    // Apply display format
    const displayText = definition.display_format
      .replace('{value}', formattedValue)
      .replace('{unit}', definition.display_unit);

    return {
      value: displayValue,
      formattedValue: formattedValue,
      displayText: displayText,
      unit: definition.display_unit,
      color: definition.graph_color,
      graphMin: definition.graph_min,
      graphMax: definition.graph_max,
      graphType: definition.graph_type
    };
  }

  // Convert between units
  convertUnits(value, fromUnit, toUnit) {
    // Handle byte conversions
    if (fromUnit === 'bytes') {
      switch (toUnit) {
        case 'KB': return value / 1024;
        case 'MB': return value / (1024 * 1024);
        case 'GB': return value / (1024 * 1024 * 1024);
        case 'TB': return value / (1024 * 1024 * 1024 * 1024);
        case 'MB/s': return value / (1024 * 1024); // For network speeds
        default: return value;
      }
    }

    // Handle time conversions
    if (fromUnit === 'seconds') {
      switch (toUnit) {
        case 'minutes': return value / 60;
        case 'hours': return value / 3600;
        case 'days': return value / 86400;
        default: return value;
      }
    }

    // No conversion needed
    return value;
  }

  // Process batch of metrics
  async processBatch(pool, metrics) {
    const processed = [];
    
    for (const metric of metrics) {
      const displayData = await this.processForDisplay(
        pool,
        metric.metric_key,
        metric.metric_value,
        {
          previousValue: metric.previous_value,
          timeDelta: metric.time_delta,
          hostId: metric.hostId  // Pass hostId for normalization
        }
      );

      processed.push({
        ...metric,
        ...displayData
      });
    }

    return processed;
  }

  // Get graph configuration for a metric
  async getGraphConfig(pool, metricKey) {
    const definition = await this.getDefinition(pool, metricKey);
    
    return {
      color: definition.graph_color,
      min: definition.graph_min,
      max: definition.graph_max,
      type: definition.graph_type,
      unit: definition.display_unit,
      displayName: definition.display_name
    };
  }
}

// Create singleton instance
const metricProcessor = new MetricProcessor();

module.exports = metricProcessor;
