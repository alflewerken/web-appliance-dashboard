const SNMPMonitor = require('./SNMPMonitor');
const SSEManager = require('./SSEManager');
const mysql = require('mysql2/promise');
const winston = require('winston');
require('dotenv').config();

// Configure logger for the polling service
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'background-polling' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

class BackgroundPollingService {
  constructor() {
    this.pool = null;
    this.snmpMonitor = null;
    this.isRunning = false;
    this.pollingIntervals = new Map(); // Store intervals per host
    this.signalCheckInterval = null; // Interval for checking reload signals
    this.defaultPollInterval = parseInt(process.env.SNMP_POLL_INTERVAL) || 60; // seconds
  }

  async initialize() {
    try {
      // Create MySQL connection pool
      this.pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'appliance_dashboard',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });

      // Create QueryBuilder-like db object for SNMPMonitor
      const db = {
        pool: this.pool,
        
        async findOne(table, conditions) {
          const where = Object.keys(conditions)
            .map(key => `${this.toSnakeCase(key)} = ?`)
            .join(' AND ');
          const values = Object.values(conditions);
          
          const [rows] = await this.pool.execute(
            `SELECT * FROM ${table} WHERE ${where} LIMIT 1`,
            values
          );
          
          return rows[0] ? this.mapDbToJs(rows[0]) : null;
        },
        
        async select(table, conditions = {}) {
          let query = `SELECT * FROM ${table}`;
          const values = [];
          
          if (Object.keys(conditions).length > 0) {
            const where = Object.keys(conditions)
              .map(key => {
                values.push(conditions[key]);
                return `${this.toSnakeCase(key)} = ?`;
              })
              .join(' AND ');
            query += ` WHERE ${where}`;
          }
          
          const [rows] = await this.pool.execute(query, values);
          return rows.map(row => this.mapDbToJs(row));
        },
        
        async insert(table, data) {
          const mappedData = this.mapJsToDb(data);
          const columns = Object.keys(mappedData);
          const values = Object.values(mappedData);
          const placeholders = columns.map(() => '?').join(', ');
          
          const [result] = await this.pool.execute(
            `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
            values
          );
          
          return { insertId: result.insertId };
        },
        
        async update(table, data, conditions) {
          const mappedData = this.mapJsToDb(data);
          const mappedConditions = this.mapJsToDb(conditions);
          
          const setClause = Object.keys(mappedData)
            .map(key => `${key} = ?`)
            .join(', ');
          
          const whereClause = Object.keys(mappedConditions)
            .map(key => `${key} = ?`)
            .join(' AND ');
          
          const values = [...Object.values(mappedData), ...Object.values(mappedConditions)];
          
          const [result] = await this.pool.execute(
            `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`,
            values
          );
          
          return result;
        },
        
        // Helper functions for field mapping
        toSnakeCase(str) {
          return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        },
        
        toCamelCase(str) {
          return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        },
        
        mapJsToDb(obj) {
          const mapped = {};
          for (const [key, value] of Object.entries(obj)) {
            mapped[this.toSnakeCase(key)] = value;
          }
          return mapped;
        },
        
        mapDbToJs(obj) {
          const mapped = {};
          for (const [key, value] of Object.entries(obj)) {
            mapped[this.toCamelCase(key)] = value;
          }
          return mapped;
        }
      };

      this.snmpMonitor = new SNMPMonitor(db);
      
      logger.info('Background Polling Service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Background Polling Service:', error);
      throw error;
    }
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Background Polling Service is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting Background Polling Service...');

    try {
      // Load all hosts with SNMP enabled
      const hosts = await this.getEnabledHosts();
      logger.info(`Found ${hosts.length} hosts with SNMP enabled`);

      // Start polling for each host
      for (const host of hosts) {
        await this.startHostPolling(host);
      }
      
      // Start checking for reload signals every 30 seconds
      this.signalCheckInterval = setInterval(async () => {
        await this.checkReloadSignals();
      }, 30000);

      logger.info('Background Polling Service started successfully');
    } catch (error) {
      logger.error('Failed to start Background Polling Service:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      logger.warn('Background Polling Service is not running');
      return;
    }

    logger.info('Stopping Background Polling Service...');
    
    // Clear signal check interval
    if (this.signalCheckInterval) {
      clearInterval(this.signalCheckInterval);
      this.signalCheckInterval = null;
    }
    
    // Clear all polling intervals
    for (const [hostId, intervalId] of this.pollingIntervals) {
      clearInterval(intervalId);
      logger.info(`Stopped polling for host ${hostId}`);
    }
    
    this.pollingIntervals.clear();
    this.isRunning = false;
    
    // Close database connections
    if (this.pool) {
      await this.pool.end();
    }
    
    logger.info('Background Polling Service stopped');
  }

  async getEnabledHosts() {
    const [hosts] = await this.pool.execute(`
      SELECT h.id, h.name, h.hostname, 
             hsc.port, hsc.version, hsc.community, hsc.poll_interval,
             hml.config as metrics_config, hml.custom_names
      FROM hosts h
      INNER JOIN host_snmp_configs hsc ON h.id = hsc.host_id
      LEFT JOIN host_metrics_logging hml ON h.id = hml.host_id
      WHERE hsc.enabled = true
    `);

    return hosts.map(host => ({
      id: host.id,
      name: host.name,
      ip: host.hostname,  // Use hostname as IP
      hostname: host.hostname,
      snmpConfig: {
        port: host.port,
        version: host.version,
        community: host.community,
        pollInterval: host.poll_interval || this.defaultPollInterval
      },
      metricsConfig: host.metrics_config ? 
        (typeof host.metrics_config === 'string' ? JSON.parse(host.metrics_config) : host.metrics_config) : 
        {},
      customNames: host.custom_names ? 
        (typeof host.custom_names === 'string' ? JSON.parse(host.custom_names) : host.custom_names) : 
        {}
    }));
  }

  async startHostPolling(host) {
    const pollInterval = host.snmpConfig.pollInterval * 1000; // Convert to milliseconds
    
    logger.info(`Starting polling for host ${host.name} (${host.ip}) every ${host.snmpConfig.pollInterval} seconds (${pollInterval}ms)`);

    // Perform initial poll
    await this.pollHost(host);
    
    // Set up recurring poll
    const intervalId = setInterval(async () => {
      const pollStart = Date.now();
      try {

        await this.pollHost(host);

      } catch (error) {
        logger.error(`Polling error for host ${host.name}:`, error);
      }
    }, pollInterval);
    
    this.pollingIntervals.set(host.id, intervalId);
  }

  async pollHost(host) {
    const startTime = Date.now();
    
    try {
      // First, update interface mappings for this host
      await this.updateInterfaceMappings(host);
      
      // Get enabled metrics for this host
      const enabledMetrics = this.getEnabledMetrics(host.metricsConfig);
      
      if (enabledMetrics.length === 0) {
        logger.debug(`No metrics enabled for host ${host.name}, skipping poll`);
        return;
      }
      
      logger.debug(`Polling ${enabledMetrics.length} metrics for host ${host.name}`);
      
      // Debug for MacbookPro
      if (host.name === 'MacbookPro') {

      }
      
      // Collect metrics via SNMP
      const metrics = await this.snmpMonitor.collectMetrics(
        host.ip,
        host.snmpConfig.port,
        host.snmpConfig.community,
        host.snmpConfig.version,
        enabledMetrics
      );
      
      // Debug collected metrics
      console.log(`Collected metrics for ${host.name}:`, Object.keys(metrics));
      console.log(`Enabled metrics:`, enabledMetrics);
      
      // Store metrics in database
      await this.storeMetrics(host.id, metrics, host.customNames);
      
      const duration = Date.now() - startTime;
      logger.debug(`Successfully polled host ${host.name} in ${duration}ms`);
      
    } catch (error) {
      // Log error to database
      await this.logError(host.id, error);
      
      logger.error(`Failed to poll host ${host.name}:`, {
        error: error.message,
        host: host.ip,
        duration: Date.now() - startTime
      });
    }
  }

  getEnabledMetrics(metricsConfig) {
    const enabledMetrics = [];
    
    if (!metricsConfig || typeof metricsConfig !== 'object') {
      return enabledMetrics;
    }
    
    // Parse the metrics configuration
    for (const [key, enabled] of Object.entries(metricsConfig)) {
      if (enabled === true) {
        enabledMetrics.push(key);
      }
    }
    
    return enabledMetrics;
  }

  async storeMetrics(hostId, metrics, customNames = {}) {
    const timestamp = new Date();
    const metricProcessor = require('./MetricProcessor');
    
    // Store previous values for delta calculation
    if (!this.previousValues) {
      this.previousValues = {};
    }
    if (!this.previousValues[hostId]) {
      this.previousValues[hostId] = {};
    }
    if (!this.previousTimestamps) {
      this.previousTimestamps = {};
    }
    
    // Store in snmp_metrics table
    for (const [metricKey, value] of Object.entries(metrics)) {
      if (value === null || value === undefined) {
        continue; // Skip null/undefined values
      }
      
      // Get custom name if defined
      const metricName = customNames[metricKey] || metricKey;
      
      try {
        let valueToStore = value;
        
        // For network interface counters, calculate delta
        if (metricKey.includes('network.interface') && 
            (metricKey.includes('.bytesIn') || metricKey.includes('.bytesOut'))) {
          
          const previousValue = this.previousValues[hostId][metricKey];
          const previousTime = this.previousTimestamps[hostId];
          
          if (previousValue !== undefined && previousTime) {
            const timeDelta = (timestamp - previousTime) / 1000; // Convert to seconds
            
            // Check for counter reset (value < previousValue)
            if (value < previousValue) {
              // Counter was reset, skip this data point
              logger.debug(`Counter reset detected for ${metricKey}: ${previousValue} -> ${value}`);
              // Update previous values for next iteration but don't store
              this.previousValues[hostId][metricKey] = value;
              continue;
            } else if (timeDelta > 0) {
              // Calculate bytes per second
              const deltaValue = value - previousValue;
              valueToStore = deltaValue / timeDelta;
              
              // Debug logging for suspicious values
              if (valueToStore > 10000) { // > 10KB/s
                logger.warn(`High network rate for ${metricKey}: ${valueToStore} B/s`);
                logger.warn(`  Raw values: current=${value}, previous=${previousValue}, delta=${deltaValue}`);
                logger.warn(`  Time delta: ${timeDelta} seconds`);
              }
              
              // Sanity check - if the rate is unreasonably high, skip this data point
              if (valueToStore > 1000000000) { // > 1GB/s is probably an error
                logger.warn(`Skipping unrealistic network rate for ${metricKey}: ${valueToStore} B/s`);
                continue;
              }
            } else {
              // No time difference, skip this point
              continue;
            }
          } else {
            // First data point, skip storing but save for next delta
            this.previousValues[hostId][metricKey] = value;
            if (!this.previousTimestamps[hostId]) {
              this.previousTimestamps[hostId] = timestamp;
            }
            continue;
          }
          
          // Update previous values for next iteration
          this.previousValues[hostId][metricKey] = value;
        }
        
        // Process metric for storage using unified processor
        const processedMetric = await metricProcessor.processForStorage(
          this.pool,
          metricKey,
          valueToStore
        );
        
        await this.pool.execute(`
          INSERT INTO snmp_metrics 
          (host_id, metric_name, metric_key, metric_value, unit, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          hostId,
          metricName,
          metricKey,
          processedMetric.value.toString(),
          processedMetric.unit,
          timestamp
        ]);
      } catch (error) {
        logger.error(`Failed to store metric ${metricKey} for host ${hostId}:`, error);
      }
    }
    
    // Update timestamp for this host
    this.previousTimestamps[hostId] = timestamp;
    
    // Send SSE event to connected clients
    SSEManager.sendMetricsUpdate(hostId, metrics);
    
    // Also update host_monitoring_data for real-time display
    try {
      const monitoringData = {
        hostId: hostId,
        timestamp: timestamp,
        metrics: JSON.stringify(metrics),  // Changed from 'data' to 'metrics'
        status: 'success'
      };
      
      // Check if record exists
      const [existing] = await this.pool.execute(
        'SELECT id FROM host_monitoring_data WHERE host_id = ? LIMIT 1',
        [hostId]
      );
      
      if (existing.length > 0) {
        // Update existing record
        await this.pool.execute(`
          UPDATE host_monitoring_data 
          SET metrics = ?, status = ?, updated_at = ?
          WHERE host_id = ?
        `, [monitoringData.metrics, monitoringData.status, timestamp, hostId]);
      } else {
        // Insert new record
        await this.pool.execute(`
          INSERT INTO host_monitoring_data 
          (host_id, last_update, metrics, status)
          VALUES (?, ?, ?, ?)
        `, [hostId, timestamp, monitoringData.metrics, monitoringData.status]);
      }
    } catch (error) {
      logger.error(`Failed to update monitoring data for host ${hostId}:`, error);
    }
  }

  formatMetricValue(value) {
    if (typeof value === 'number') {
      return value.toString();
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  getMetricUnit(metricKey) {
    // Define units for known metrics
    const units = {
      'cpu.user': '%',
      'cpu.system': '%',
      'cpu.idle': '%',
      'cpu.load1': 'load',
      'cpu.load5': 'load',
      'cpu.load15': 'load',
      'memory.total': 'bytes',
      'memory.used': '%',
      'memory.free': '%',
      'memory.percent': '%',
      'memory.available': 'bytes',
      'memory.buffers': 'bytes',
      'memory.cached': 'bytes',
      'swap.total': 'KB',
      'swap.used': 'KB',
      'swap.free': 'KB',
      'disk.total': 'KB',
      'disk.used': 'KB',
      'disk.free': 'KB',
      'disk.percent': '%',
      'disk.free': 'KB',
      'disk.percent': '%',
      'network.bytesIn': 'bytes',
      'network.bytesOut': 'bytes',
      'network.packetsIn': 'packets',
      'network.packetsOut': 'packets',
      'system.uptime': 'seconds',
      'processes.count': 'count',
      'processes.running': 'count'
    };
    
    // Special handling for disk.N where N is a number (disk index)
    if (metricKey.match(/^disk\.\d+$/)) {
      return '%';  // disk.0, disk.1, etc. are percentages
    }
    
    // Check for pattern matches
    for (const [pattern, unit] of Object.entries(units)) {
      if (metricKey.startsWith(pattern.split('.')[0])) {
        const suffix = pattern.split('.')[1];
        if (suffix && metricKey.includes(suffix)) {
          return unit;
        }
      }
    }
    
    return units[metricKey] || 'value';
  }

  async updateInterfaceMappings(host) {
    try {
      const snmp = require('net-snmp');
      const session = snmp.createSession(host.ip, host.snmpConfig.community);
      
      // OIDs for interface information
      const oids = {
        ifIndex: '1.3.6.1.2.1.2.2.1.1',     // Interface index
        ifDescr: '1.3.6.1.2.1.2.2.1.2',     // Interface description/name
        ifType: '1.3.6.1.2.1.2.2.1.3',      // Interface type
        ifSpeed: '1.3.6.1.2.1.2.2.1.5',     // Interface speed
      };
      
      // Collect all interface information
      const interfaces = new Map();
      
      // Helper function to walk SNMP table
      const walkOid = (oid) => {
        return new Promise((resolve, reject) => {
          const results = [];
          session.subtree(oid, 20, (varbinds) => {
            varbinds.forEach(vb => {
              if (!snmp.isVarbindError(vb)) {
                const index = vb.oid.split('.').pop();
                results.push({ index: parseInt(index), value: vb.value });
              }
            });
          }, (error) => {
            if (error) reject(error);
            else resolve(results);
          });
        });
      };
      
      // Get interface descriptions
      const descriptions = await walkOid(oids.ifDescr);
      
      for (const desc of descriptions) {
        if (!interfaces.has(desc.index)) {
          interfaces.set(desc.index, {});
        }
        interfaces.get(desc.index).name = desc.value.toString();
        interfaces.get(desc.index).descr = desc.value.toString();
      }
      
      // Store mappings in database
      for (const [index, iface] of interfaces) {
        await this.pool.execute(`
          INSERT INTO host_interface_mappings 
          (host_id, interface_index, interface_name, interface_descr, last_seen)
          VALUES (?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            interface_name = VALUES(interface_name),
            interface_descr = VALUES(interface_descr),
            last_seen = NOW()
        `, [host.id, index, iface.name, iface.descr]);
      }
      
      session.close();
      logger.debug(`Updated interface mappings for host ${host.name}: ${interfaces.size} interfaces`);
      
    } catch (error) {
      logger.error(`Failed to update interface mappings for host ${host.name}:`, error);
    }
  }

  async logError(hostId, error) {
    try {
      await this.pool.execute(`
        INSERT INTO snmp_errors 
        (host_id, error_type, error_message, error_details, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `, [
        hostId,
        error.code || 'POLL_ERROR',
        error.message,
        JSON.stringify({
          stack: error.stack,
          details: error.details || {}
        }),
        new Date()
      ]);
    } catch (dbError) {
      logger.error('Failed to log error to database:', dbError);
    }
  }

  // Methods for dynamic management
  
  async addHost(hostId) {
    if (this.pollingIntervals.has(hostId)) {
      logger.warn(`Host ${hostId} is already being polled`);
      return;
    }
    
    const [hosts] = await this.pool.execute(`
      SELECT h.id, h.name, h.hostname, 
             hsc.port, hsc.version, hsc.community, hsc.poll_interval,
             hml.config as metrics_config, hml.custom_names
      FROM hosts h
      INNER JOIN host_snmp_configs hsc ON h.id = hsc.host_id
      LEFT JOIN host_metrics_logging hml ON h.id = hml.host_id
      WHERE hsc.enabled = true
        AND h.id = ?
    `, [hostId]);
    
    if (hosts.length === 0) {
      logger.warn(`Host ${hostId} not found or SNMP not enabled`);
      return;
    }
    
    const host = {
      id: hosts[0].id,
      name: hosts[0].name,
      ip: hosts[0].hostname,  // Use hostname as IP
      hostname: hosts[0].hostname,
      snmpConfig: {
        port: hosts[0].port,
        version: hosts[0].version,
        community: hosts[0].community,
        pollInterval: hosts[0].poll_interval || this.defaultPollInterval
      },
      metricsConfig: hosts[0].metrics_config ? 
        (typeof hosts[0].metrics_config === 'string' ? JSON.parse(hosts[0].metrics_config) : hosts[0].metrics_config) : 
        {},
      customNames: hosts[0].custom_names ? 
        (typeof hosts[0].custom_names === 'string' ? JSON.parse(hosts[0].custom_names) : hosts[0].custom_names) : 
        {}
    };
    
    await this.startHostPolling(host);
    logger.info(`Added host ${hostId} to polling`);
  }

  async removeHost(hostId) {
    const intervalId = this.pollingIntervals.get(hostId);
    if (intervalId) {
      clearInterval(intervalId);
      this.pollingIntervals.delete(hostId);
      logger.info(`Removed host ${hostId} from polling`);
    }
  }

  async updateHost(hostId) {
    // Remove and re-add to update configuration
    await this.removeHost(hostId);
    await this.addHost(hostId);
    logger.info(`Updated polling configuration for host ${hostId}`);
  }

  // Status methods
  
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeHosts: Array.from(this.pollingIntervals.keys()),
      hostCount: this.pollingIntervals.size,
      defaultPollInterval: this.defaultPollInterval
    };
  }

  isHostActive(hostId) {
    return this.pollingIntervals.has(hostId);
  }
  
  async checkReloadSignals() {
    try {
      // Create table if it doesn't exist
      await this.pool.execute(`
        CREATE TABLE IF NOT EXISTS snmp_reload_signals (
          host_id INT PRIMARY KEY,
          signal_type ENUM('reload', 'stop', 'add') DEFAULT 'reload',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processed_at TIMESTAMP NULL,
          FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
        )
      `);
      
      // Get unprocessed signals
      const [signals] = await this.pool.execute(`
        SELECT host_id, signal_type 
        FROM snmp_reload_signals 
        WHERE processed_at IS NULL
      `);
      
      if (signals.length > 0) {
        logger.info(`Processing ${signals.length} reload signals`);
        
        for (const signal of signals) {
          try {
            switch (signal.signal_type) {
              case 'reload':
                logger.info(`Reloading SNMP configuration for host ${signal.host_id}`);
                await this.updateHost(signal.host_id);
                break;
                
              case 'stop':
                logger.info(`Stopping SNMP polling for host ${signal.host_id}`);
                await this.removeHost(signal.host_id);
                break;
                
              case 'add':
                logger.info(`Adding SNMP polling for host ${signal.host_id}`);
                await this.addHost(signal.host_id);
                break;
            }
            
            // Mark signal as processed
            await this.pool.execute(`
              UPDATE snmp_reload_signals 
              SET processed_at = NOW() 
              WHERE host_id = ?
            `, [signal.host_id]);
            
          } catch (error) {
            logger.error(`Failed to process signal for host ${signal.host_id}:`, error);
          }
        }
        
        // Clean up old processed signals (older than 1 day)
        await this.pool.execute(`
          DELETE FROM snmp_reload_signals 
          WHERE processed_at IS NOT NULL 
          AND processed_at < DATE_SUB(NOW(), INTERVAL 1 DAY)
        `);
      }
    } catch (error) {
      logger.error('Error checking reload signals:', error);
    }
  }
}

// Export singleton instance
const pollingService = new BackgroundPollingService();

module.exports = pollingService;
