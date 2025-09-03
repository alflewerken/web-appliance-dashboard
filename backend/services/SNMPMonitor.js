const snmp = require('net-snmp');

class SNMPMonitor {
  constructor(db) {
    this.db = db;
    this.sessions = new Map();
    this.errorCounts = new Map(); // Track errors per host
    this.maxRetries = 3;
    
    // Standard OIDs die fast überall funktionieren (RFC1213-MIB)
    this.standardOIDs = {
      // System Info (MIB-2 System Group - RFC1213)
      sysDescr: '1.3.6.1.2.1.1.1.0',
      sysObjectID: '1.3.6.1.2.1.1.2.0',
      sysUpTime: '1.3.6.1.2.1.1.3.0',
      sysContact: '1.3.6.1.2.1.1.4.0',
      sysName: '1.3.6.1.2.1.1.5.0',
      sysLocation: '1.3.6.1.2.1.1.6.0',
      sysServices: '1.3.6.1.2.1.1.7.0',
      
      // CPU/Load (UCD-SNMP-MIB für Linux/Unix)
      load1min: '1.3.6.1.4.1.2021.10.1.3.1',
      load5min: '1.3.6.1.4.1.2021.10.1.3.2', 
      load15min: '1.3.6.1.4.1.2021.10.1.3.3',
      
      // CPU Utilization (Alternative OIDs)
      cpuUser: '1.3.6.1.4.1.2021.11.50.0',    // User CPU time
      cpuSystem: '1.3.6.1.4.1.2021.11.52.0',  // System CPU time
      cpuIdle: '1.3.6.1.4.1.2021.11.53.0',    // Idle CPU time
      
      // Memory (UCD-SNMP-MIB)
      memTotalReal: '1.3.6.1.4.1.2021.4.5.0',
      memAvailReal: '1.3.6.1.4.1.2021.4.6.0',
      memBuffer: '1.3.6.1.4.1.2021.4.14.0',
      memCached: '1.3.6.1.4.1.2021.4.15.0',
      memTotalSwap: '1.3.6.1.4.1.2021.4.3.0',
      memAvailSwap: '1.3.6.1.4.1.2021.4.4.0',
      
      // Disk (UCD-SNMP-MIB)
      diskTotal: '1.3.6.1.4.1.2021.9.1.6.1',
      diskUsed: '1.3.6.1.4.1.2021.9.1.8.1',
      diskPercent: '1.3.6.1.4.1.2021.9.1.9.1',
      diskDevice: '1.3.6.1.4.1.2021.9.1.3.1',
      
      // Process count (HOST-RESOURCES-MIB)
      processCount: '1.3.6.1.2.1.25.1.6.0',
      runningProcesses: '1.3.6.1.2.1.25.4.2.1.7',
      
      // Network Interfaces (Standard MIB-2)
      ifNumber: '1.3.6.1.2.1.2.1.0',
      ifTable: '1.3.6.1.2.1.2.2.1',
      
      // Temperature Sensors (wenn verfügbar - LM-SENSORS-MIB)
      tempSensors: '1.3.6.1.4.1.2021.13.16.2.1.3'
    };

    // Windows-spezifische OIDs (HOST-RESOURCES-MIB)
    this.windowsOIDs = {
      cpuLoad: '1.3.6.1.2.1.25.3.3.1.2',      // Processor Load
      physicalMemory: '1.3.6.1.2.1.25.2.2.0',
      virtualMemory: '1.3.6.1.2.1.25.2.3.1.6.1',
      storageTable: '1.3.6.1.2.1.25.2.3.1',    // Storage devices
      processTable: '1.3.6.1.2.1.25.4.2.1'     // Process table
    };
    
    // Network Device OIDs (Cisco, Juniper, etc.)
    this.networkDeviceOIDs = {
      // Cisco specific
      ciscoMemoryUsed: '1.3.6.1.4.1.9.9.48.1.1.1.5.1',
      ciscoCpuAvg5min: '1.3.6.1.4.1.9.9.109.1.1.1.1.8.1',
      
      // Generic network device
      sysUptime: '1.3.6.1.2.1.1.3.0',
      ifOperStatus: '1.3.6.1.2.1.2.2.1.8'      // Interface operational status
    };
    
    // Error types for better handling
    this.errorTypes = {
      TIMEOUT: 'TIMEOUT',
      NO_RESPONSE: 'NO_RESPONSE',
      AUTH_FAILED: 'AUTH_FAILED',
      NO_SUCH_OBJECT: 'NO_SUCH_OBJECT',
      NETWORK_ERROR: 'NETWORK_ERROR',
      PARSE_ERROR: 'PARSE_ERROR',
      UNKNOWN: 'UNKNOWN'
    };
  }

  // Enhanced error classification
  classifyError(error) {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code?.toUpperCase() || '';
    
    if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout')) {
      return this.errorTypes.TIMEOUT;
    }
    if (errorCode === 'ENOTFOUND' || errorCode === 'EHOSTUNREACH') {
      return this.errorTypes.NETWORK_ERROR;
    }
    if (errorMessage.includes('authentication') || errorMessage.includes('auth')) {
      return this.errorTypes.AUTH_FAILED;
    }
    if (errorMessage.includes('no such object') || errorMessage.includes('nosuchobject')) {
      return this.errorTypes.NO_SUCH_OBJECT;
    }
    if (errorMessage.includes('no response')) {
      return this.errorTypes.NO_RESPONSE;
    }
    
    return this.errorTypes.UNKNOWN;
  }

  // Get appropriate OIDs based on device type
  getDeviceOIDs(host) {
    const osType = host.osType?.toLowerCase() || 'linux';
    const deviceType = host.deviceType?.toLowerCase() || 'server';
    
    let oidSet = { ...this.standardOIDs };
    
    if (osType === 'windows') {
      oidSet = { ...oidSet, ...this.windowsOIDs };
    } else if (deviceType === 'network' || deviceType === 'router' || deviceType === 'switch') {
      oidSet = { ...oidSet, ...this.networkDeviceOIDs };
    }
    
    return oidSet;
  }

  async pollHost(host) {
    let retryCount = 0;
    const hostKey = `${host.ip}:${host.snmpPort || 161}`;
    
    while (retryCount < this.maxRetries) {
      try {
        const session = this.getSession(host);
        
        // Reset error count on successful connection
        this.errorCounts.set(hostKey, 0);
        
        // Get device-specific OIDs
        const oidSet = this.getDeviceOIDs(host);
        
        // Basis-Metriken abrufen mit Fallback-Mechanismus
        const basicMetrics = await this.getBasicMetrics(session, host, oidSet);
        
        // Interface-Statistiken (optional)
        const interfaces = await this.getInterfaceStats(session).catch(() => []);
        
        // Disk metrics (optional)
        const diskMetrics = await this.getDiskMetrics(session, oidSet).catch(() => []);
        
        // In DB speichern
        await this.saveMetrics(host, basicMetrics, interfaces, diskMetrics);
        
        return { 
          success: true, 
          host: host.name || host.hostname,
          metrics: basicMetrics, 
          interfaces,
          diskMetrics,
          retryCount
        };
        
      } catch (error) {
        retryCount++;
        
        // Track error frequency
        const errorCount = (this.errorCounts.get(hostKey) || 0) + 1;
        this.errorCounts.set(hostKey, errorCount);
        
        const errorType = this.classifyError(error);
        console.error(`SNMP failed for ${host.name || host.hostname} (attempt ${retryCount}/${this.maxRetries}):`, 
                      `Type: ${errorType}, Message: ${error.message}`);
        
        // Don't retry on auth failures
        if (errorType === this.errorTypes.AUTH_FAILED) {
          await this.saveError(host, error, errorType);
          return { 
            success: false, 
            host: host.name || host.hostname,
            error: error.message,
            errorType,
            permanent: true
          };
        }
        
        // Wait before retry (exponential backoff)
        if (retryCount < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        }
      }
    }
    
    // All retries failed
    const finalError = new Error(`Failed after ${this.maxRetries} retries`);
    await this.saveError(host, finalError, this.errorTypes.NO_RESPONSE);
    
    return { 
      success: false, 
      host: host.name || host.hostname,
      error: finalError.message,
      errorType: this.errorTypes.NO_RESPONSE,
      retriesExhausted: true
    };
  }

  async pollAllHosts() {
    // Alle SNMP-fähigen Hosts abrufen
    const hosts = await this.db.select('hosts', { snmp_enabled: 1 });
    
    if (hosts.length === 0) {
      return { message: 'No SNMP-enabled hosts found', results: [] };
    }
    
    // Batch-Processing mit Limit
    const batchSize = 10;
    const results = [];
    
    for (let i = 0; i < hosts.length; i += batchSize) {
      const batch = hosts.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(host => this.pollHost(host))
      );
      
      results.push(...batchResults.map(r => 
        r.status === 'fulfilled' ? r.value : { 
          success: false, 
          error: r.reason?.message || 'Unknown error' 
        }
      ));
    }
    
    return { 
      total: hosts.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results 
    };
  }

  getSession(host) {
    const key = `${host.ip}:${host.snmpPort || 161}`;
    
    if (!this.sessions.has(key)) {
      // SNMPv2c für Einfachheit (später v3 für Sicherheit)
      const session = snmp.createSession(
        host.ip, 
        host.snmpCommunity || 'public',
        {
          port: host.snmpPort || 161,
          retries: 1,
          timeout: 5000,
          version: snmp.Version2c,
          transport: 'udp4'
        }
      );
      
      // Session Error Handler
      session.on('error', (error) => {
        console.error(`SNMP Session error for ${host.ip}:`, error);
        this.sessions.delete(key);
      });
      
      this.sessions.set(key, session);
    }
    
    return this.sessions.get(key);
  }

  async getBasicMetrics(session, host, oidSet) {
    const isWindows = host.osType === 'windows';
    
    // Build OID list based on availability
    const oids = [];
    const oidMap = {};
    
    // Always try system OIDs
    if (oidSet.sysUpTime) {
      oids.push(oidSet.sysUpTime);
      oidMap[oidSet.sysUpTime] = 'sysUpTime';
    }
    if (oidSet.sysName) {
      oids.push(oidSet.sysName);
      oidMap[oidSet.sysName] = 'sysName';
    }
    
    // CPU metrics - get ALL load averages and CPU counters
    if (isWindows && oidSet.cpuLoad) {
      oids.push(oidSet.cpuLoad);
      oidMap[oidSet.cpuLoad] = 'cpuLoad';
    } else {
      // Load averages
      if (oidSet.load1min) {
        oids.push(oidSet.load1min);
        oidMap[oidSet.load1min] = 'load1min';
      }
      if (oidSet.load5min) {
        oids.push(oidSet.load5min);
        oidMap[oidSet.load5min] = 'load5min';
      }
      if (oidSet.load15min) {
        oids.push(oidSet.load15min);
        oidMap[oidSet.load15min] = 'load15min';
      }
      // CPU counters for detailed calculation
      if (oidSet.cpuUser) {
        oids.push(oidSet.cpuUser);
        oidMap[oidSet.cpuUser] = 'cpuUser';
      }
      if (oidSet.cpuSystem) {
        oids.push(oidSet.cpuSystem);
        oidMap[oidSet.cpuSystem] = 'cpuSystem';
      }
      if (oidSet.cpuIdle) {
        oids.push(oidSet.cpuIdle);
        oidMap[oidSet.cpuIdle] = 'cpuIdle';
      }
    }
    
    // Memory metrics - get ALL memory info
    if (oidSet.memTotalReal) {
      oids.push(oidSet.memTotalReal);
      oidMap[oidSet.memTotalReal] = 'memTotalReal';
    }
    if (oidSet.memAvailReal) {
      oids.push(oidSet.memAvailReal);
      oidMap[oidSet.memAvailReal] = 'memAvailReal';
    }
    if (oidSet.memBuffer) {
      oids.push(oidSet.memBuffer);
      oidMap[oidSet.memBuffer] = 'memBuffer';
    }
    if (oidSet.memCached) {
      oids.push(oidSet.memCached);
      oidMap[oidSet.memCached] = 'memCached';
    }
    if (oidSet.memTotalSwap) {
      oids.push(oidSet.memTotalSwap);
      oidMap[oidSet.memTotalSwap] = 'memTotalSwap';
    }
    if (oidSet.memAvailSwap) {
      oids.push(oidSet.memAvailSwap);
      oidMap[oidSet.memAvailSwap] = 'memAvailSwap';
    }
    
    // Process count
    if (oidSet.processCount) {
      oids.push(oidSet.processCount);
      oidMap[oidSet.processCount] = 'processCount';
    }
    
    return new Promise((resolve, reject) => {
      session.get(oids, (error, varbinds) => {
        if (error) {
          reject(error);
        } else {
          try {
            const metrics = this.parseMetrics(varbinds, oidMap, isWindows);
            resolve(metrics);
          } catch (parseError) {
            reject(parseError);
          }
        }
      });
    });
  }

  parseMetrics(varbinds, oidMap, isWindows = false) {
    // Sicheres Parsing mit Fallbacks und OID-Mapping
    const metrics = {
      uptime: null,
      sysName: 'Unknown',
      cpu: {
        load1: 0,
        load5: 0,
        load15: 0,
        percent: 0,
        idle: null,
        user: null,
        system: null
      },
      memory: {
        total: 0,
        available: 0,
        used: 0,
        usedPercent: 0,
        buffer: 0,
        cached: 0,
        swapTotal: 0,
        swapAvailable: 0,
        swapUsed: 0,
        swapPercent: 0
      },
      disk: [],
      network: {
        interfaceCount: 0,
        interfaces: []
      },
      processes: 0,
      timestamp: new Date().toISOString(),
      collectedAt: Date.now()
    };
    
    // Parse each varbind based on OID mapping
    varbinds.forEach(varbind => {
      const oidName = oidMap[varbind.oid];
      
      if (!oidName || varbind.type === snmp.ErrorStatus.NoSuchObject) {
        return;
      }
      
      switch (oidName) {
        case 'sysUpTime':
          metrics.uptime = this.parseUptime(varbind.value);
          break;
        case 'sysName':
          metrics.sysName = varbind.value.toString();
          break;
        case 'cpuLoad':
          metrics.cpu.load = varbind.value;
          metrics.cpu.percent = varbind.value;
          break;
        case 'load1min':
          // Load average is already a decimal (e.g., 1.26)
          // It comes as a Buffer from SNMP, needs to be converted to string first
          console.log('load1min raw value:', varbind.value, 'type:', typeof varbind.value);
          
          let loadValue;
          if (Buffer.isBuffer(varbind.value)) {
            // Convert Buffer to string, then parse
            const loadString = varbind.value.toString('utf8');
            console.log('Converted Buffer to string:', loadString);
            loadValue = parseFloat(loadString);
          } else if (typeof varbind.value === 'string') {
            loadValue = parseFloat(varbind.value);
          } else {
            // Fallback for numeric values
            loadValue = varbind.value / 100;
          }
          
          console.log('Parsed load value:', loadValue);
          metrics.cpu.load1 = loadValue;
          // Rough approximation: 1.0 load = ~25% on a 4-core system
          // Adjust based on actual core count if available
          metrics.cpu.percent = Math.min(Math.round(loadValue * 25), 100);
          console.log('CPU percent calculated:', metrics.cpu.percent);
          break;
        
        case 'load5min':
          if (Buffer.isBuffer(varbind.value)) {
            metrics.cpu.load5 = parseFloat(varbind.value.toString('utf8'));
          } else if (typeof varbind.value === 'string') {
            metrics.cpu.load5 = parseFloat(varbind.value);
          } else {
            metrics.cpu.load5 = varbind.value / 100;
          }
          break;
          
        case 'load15min':
          if (Buffer.isBuffer(varbind.value)) {
            metrics.cpu.load15 = parseFloat(varbind.value.toString('utf8'));
          } else if (typeof varbind.value === 'string') {
            metrics.cpu.load15 = parseFloat(varbind.value);
          } else {
            metrics.cpu.load15 = varbind.value / 100;
          }
          break;
        
        case 'cpuUser':
          metrics.cpu.user = varbind.value;
          break;
          
        case 'cpuSystem':
          metrics.cpu.system = varbind.value;
          break;
        case 'cpuIdle':
          metrics.cpu.idle = varbind.value;
          if (metrics.cpu.idle > 0) {
            metrics.cpu.percent = Math.max(0, 100 - metrics.cpu.idle);
          }
          break;
        case 'memTotalReal':
          metrics.memory.total = varbind.value * 1024;
          break;
        case 'memAvailReal':
          metrics.memory.available = varbind.value * 1024;
          break;
        case 'memBuffer':
          metrics.memory.buffer = varbind.value * 1024;
          break;
        case 'memCached':
          metrics.memory.cached = varbind.value * 1024;
          break;
        case 'memTotalSwap':
          metrics.memory.swapTotal = varbind.value * 1024;
          break;
        case 'memAvailSwap':
          metrics.memory.swapAvailable = varbind.value * 1024;
          break;
        case 'processCount':
          metrics.processes = varbind.value;
          break;
        case 'ifNumber':
          metrics.network.interfaceCount = varbind.value;
          break;
      }
    });
    
    // Calculate derived values
    if (metrics.memory.total > 0) {
      metrics.memory.used = metrics.memory.total - metrics.memory.available;
      metrics.memory.usedPercent = parseFloat(
        ((metrics.memory.used / metrics.memory.total) * 100).toFixed(2)
      );
      
      // Calculate effective memory (includes buffer/cache)
      if (metrics.memory.buffer > 0 || metrics.memory.cached > 0) {
        metrics.memory.effectiveAvailable = metrics.memory.available + 
          metrics.memory.buffer + metrics.memory.cached;
        metrics.memory.effectiveUsed = metrics.memory.total - metrics.memory.effectiveAvailable;
        metrics.memory.effectivePercent = parseFloat(
          ((metrics.memory.effectiveUsed / metrics.memory.total) * 100).toFixed(2)
        );
      }
    }
    
    // Calculate swap usage if available
    if (metrics.memory.swapTotal > 0) {
      metrics.memory.swapUsed = metrics.memory.swapTotal - metrics.memory.swapAvailable;
      metrics.memory.swapPercent = parseFloat(
        ((metrics.memory.swapUsed / metrics.memory.swapTotal) * 100).toFixed(2)
      );
    }
    
    // macOS workaround: If CPU is 0, try to use load average
    if (metrics.cpu.percent === 0 || metrics.cpu.percent === null) {
      if (metrics.cpu.load1 && metrics.cpu.load1 > 0) {
        metrics.cpu.percent = Math.min(Math.round(metrics.cpu.load1 * 25), 100);
      }
    }
    
    return metrics;
  }

  parseUptime(timeticks) {
    // Timeticks sind in 1/100 Sekunden
    const totalSeconds = Math.floor(timeticks / 100);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return {
      ticks: timeticks,
      totalSeconds,
      days,
      hours,
      minutes,
      seconds,
      formatted: `${days}d ${hours}h ${minutes}m ${seconds}s`
    };
  }

  async getDiskMetrics(session, oidSet) {
    if (!oidSet.diskDevice) {
      return [];
    }
    
    return new Promise((resolve) => {
      const diskMetrics = [];
      
      session.subtree('1.3.6.1.4.1.2021.9.1', (varbinds) => {
        varbinds.forEach(varbind => {
          const oidParts = varbind.oid.split('.');
          const column = parseInt(oidParts[oidParts.length - 2]);
          const index = parseInt(oidParts[oidParts.length - 1]);
          
          if (!diskMetrics[index]) {
            diskMetrics[index] = { index };
          }
          
          switch (column) {
            case 3: // Device
              diskMetrics[index].device = varbind.value.toString();
              break;
            case 6: // Total size (KB)
              diskMetrics[index].total = varbind.value * 1024;
              break;
            case 8: // Used (KB)
              diskMetrics[index].used = varbind.value * 1024;
              break;
            case 9: // Percent used
              diskMetrics[index].percentUsed = varbind.value;
              break;
          }
        });
      }, () => {
        const filtered = diskMetrics
          .filter(disk => disk && disk.device && disk.total > 0)
          .map(disk => ({
            device: disk.device,
            total: disk.total || 0,
            used: disk.used || 0,
            free: (disk.total || 0) - (disk.used || 0),
            percentUsed: disk.percentUsed || 0
          }));
        
        resolve(filtered);
      });
      
      // Timeout fallback
      setTimeout(() => resolve([]), 5000);
    });
  }

  async getInterfaceStats(session) {
    // Interface-Tabelle abrufen
    const baseOid = '1.3.6.1.2.1.2.2.1';
    const columns = {
      index: 1,
      descr: 2,
      type: 3,
      speed: 5,
      adminStatus: 7,
      operStatus: 8,
      inOctets: 10,
      outOctets: 16
    };

    return new Promise((resolve) => {
      const interfaces = [];
      
      session.subtree(baseOid, (varbinds) => {
        // Parse interface data
        varbinds.forEach(varbind => {
          const oidParts = varbind.oid.split('.');
          const column = parseInt(oidParts[oidParts.length - 2]);
          const index = parseInt(oidParts[oidParts.length - 1]);
          
          if (!interfaces[index]) {
            interfaces[index] = { index };
          }
          
          // Map column to property
          Object.entries(columns).forEach(([key, col]) => {
            if (column === col) {
              interfaces[index][key] = varbind.value;
            }
          });
        });
      }, () => {
        // Done callback - Filter und formatieren
        const filtered = interfaces
          .filter(iface => iface && iface.descr && iface.operStatus === 1)
          .map(iface => ({
            name: iface.descr.toString(),
            status: iface.operStatus === 1 ? 'up' : 'down',
            speed: iface.speed || 0,
            bytesIn: iface.inOctets || 0,
            bytesOut: iface.outOctets || 0
          }));
        
        resolve(filtered);
      });
      
      // Timeout fallback
      setTimeout(() => resolve([]), 10000);
    });
  }

  async saveMetrics(host, metrics, interfaces, diskMetrics) {
    // Skip database operations for test hosts
    if (!host.id || host.id === 0 || host.id === 'test') {
      console.log(`SNMP test metrics for ${host.name}: CPU ${metrics.cpu.percent}%, Memory ${metrics.memory.usedPercent}%`);
      return;
    }
    
    // Metriken in Datenbank speichern mit Error Handling
    try {
      await this.db.insert('snmp_metrics', {
        hostId: host.id,
        uptime: metrics.uptime?.totalSeconds || 0,
        cpuLoad: metrics.cpu.load,
        cpuPercent: metrics.cpu.percent,
        memoryTotal: metrics.memory.total,
        memoryUsed: metrics.memory.used,
        memoryPercent: metrics.memory.usedPercent,
        processCount: metrics.processes,
        collectedAt: new Date()
      });

      // Interface-Daten speichern (falls vorhanden)
      if (interfaces && interfaces.length > 0) {
        // Insert each interface separately (QueryBuilder has no batchInsert)
        for (const iface of interfaces) {
          await this.db.insert('snmp_interfaces', {
            hostId: host.id,
            interfaceName: iface.name,
            status: iface.status,
            bytesIn: iface.bytesIn,
            bytesOut: iface.bytesOut,
            collectedAt: new Date()
          });
        }
      }
      
      // Disk metrics speichern (falls vorhanden)
      if (diskMetrics && diskMetrics.length > 0) {
        for (const disk of diskMetrics) {
          await this.db.insert('snmp_disk_metrics', {
            hostId: host.id,
            device: disk.device,
            totalBytes: disk.total,
            usedBytes: disk.used,
            freeBytes: disk.free,
            percentUsed: disk.percentUsed,
            collectedAt: new Date()
          });
        }
      }

      // Host-Status aktualisieren
      await this.db.update('hosts', 
        { 
          lastSnmpCheck: new Date(),
          snmpStatus: 'online',
          lastMetrics: JSON.stringify(metrics)
        },
        { id: host.id }
      );
    } catch (dbError) {
      console.error(`Failed to save metrics for host ${host.id}:`, dbError);
      throw dbError;
    }
  }

  async saveError(host, error, errorType = null) {
    // Skip database operations for test hosts
    if (!host.id || host.id === 0 || host.id === 'test') {
      console.log(`SNMP test error for ${host.name}: ${error.message}`);
      return;
    }
    
    const classifiedErrorType = errorType || this.classifyError(error);
    
    // Fehler protokollieren
    await this.db.insert('snmp_errors', {
      hostId: host.id,
      errorMessage: error.message,
      errorType: classifiedErrorType,
      occurredAt: new Date()
    });

    // Host-Status basierend auf Fehlertyp aktualisieren
    let snmpStatus = 'offline';
    if (classifiedErrorType === this.errorTypes.AUTH_FAILED) {
      snmpStatus = 'auth_failed';
    } else if (classifiedErrorType === this.errorTypes.TIMEOUT) {
      snmpStatus = 'timeout';
    } else if (classifiedErrorType === this.errorTypes.NETWORK_ERROR) {
      snmpStatus = 'unreachable';
    }

    await this.db.update('hosts',
      { id: host.id },
      {
        lastSnmpCheck: new Date(),
        snmpStatus: snmpStatus,
        lastSnmpError: `[${classifiedErrorType}] ${error.message}`
      }
    );
  }

  async getHistoricalData(hostId, hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const metrics = await this.db.raw(`
      SELECT 
        collected_at as timestamp,
        cpu_percent as cpu,
        memory_percent as memory,
        process_count as processes
      FROM snmp_metrics
      WHERE host_id = ? AND collected_at >= ?
      ORDER BY collected_at ASC
    `, [hostId, since]);
    
    return metrics;
  }

  // Cleanup
  closeAllSessions() {
    this.sessions.forEach(session => {
      try {
        session.close();
      } catch (e) {
        console.error('Error closing SNMP session:', e);
      }
    });
    this.sessions.clear();
  }
}

module.exports = SNMPMonitor;