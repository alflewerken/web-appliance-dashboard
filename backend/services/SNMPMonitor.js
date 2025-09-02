const snmp = require('net-snmp');

class SNMPMonitor {
  constructor(db) {
    this.db = db;
    this.sessions = new Map();
    
    // Standard OIDs die fast überall funktionieren
    this.standardOIDs = {
      // System Info
      sysDescr: '1.3.6.1.2.1.1.1.0',
      sysUpTime: '1.3.6.1.2.1.1.3.0',
      sysName: '1.3.6.1.2.1.1.5.0',
      sysLocation: '1.3.6.1.2.1.1.6.0',
      
      // CPU/Load (Linux)
      load1min: '1.3.6.1.4.1.2021.10.1.3.1',
      load5min: '1.3.6.1.4.1.2021.10.1.3.2', 
      load15min: '1.3.6.1.4.1.2021.10.1.3.3',
      
      // Memory (Linux)
      memTotalReal: '1.3.6.1.4.1.2021.4.5.0',
      memAvailReal: '1.3.6.1.4.1.2021.4.6.0',
      memBuffer: '1.3.6.1.4.1.2021.4.14.0',
      memCached: '1.3.6.1.4.1.2021.4.15.0',
      
      // Disk
      diskTotal: '1.3.6.1.4.1.2021.9.1.6.1',
      diskUsed: '1.3.6.1.4.1.2021.9.1.8.1',
      diskPercent: '1.3.6.1.4.1.2021.9.1.9.1',
      
      // Process count
      processCount: '1.3.6.1.2.1.25.1.6.0',
      
      // Network Interfaces (Standard MIB-2)
      ifNumber: '1.3.6.1.2.1.2.1.0',
      ifTable: '1.3.6.1.2.1.2.2.1'
    };

    // Windows-spezifische OIDs
    this.windowsOIDs = {
      cpuLoad: '1.3.6.1.2.1.25.3.3.1.2.1',
      physicalMemory: '1.3.6.1.2.1.25.2.2.0',
      virtualMemory: '1.3.6.1.2.1.25.2.3.1.6.1'
    };
  }

  async pollHost(host) {
    try {
      const session = this.getSession(host);
      
      // Basis-Metriken abrufen
      const basicMetrics = await this.getBasicMetrics(session, host);
      
      // Interface-Statistiken (optional)
      const interfaces = await this.getInterfaceStats(session).catch(() => []);
      
      // In DB speichern
      await this.saveMetrics(host, basicMetrics, interfaces);
      
      return { 
        success: true, 
        host: host.name,
        metrics: basicMetrics, 
        interfaces 
      };
      
    } catch (error) {
      console.error(`SNMP failed for ${host.name}:`, error.message);
      
      // Fehler in DB protokollieren
      await this.saveError(host, error);
      
      return { 
        success: false, 
        host: host.name,
        error: error.message 
      };
    }
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

  async getBasicMetrics(session, host) {
    // OIDs basierend auf OS-Typ auswählen
    const isWindows = host.osType === 'windows';
    
    const oids = [
      this.standardOIDs.sysUpTime,
      this.standardOIDs.sysName,
      isWindows ? this.windowsOIDs.cpuLoad : this.standardOIDs.load1min,
      this.standardOIDs.memTotalReal,
      this.standardOIDs.memAvailReal,
      this.standardOIDs.processCount
    ];
    
    return new Promise((resolve, reject) => {
      session.get(oids, (error, varbinds) => {
        if (error) {
          reject(error);
        } else {
          try {
            const metrics = this.parseMetrics(varbinds, isWindows);
            resolve(metrics);
          } catch (parseError) {
            reject(parseError);
          }
        }
      });
    });
  }

  parseMetrics(varbinds, isWindows = false) {
    // Sicheres Parsing mit Fallbacks
    const safeValue = (varbind, defaultValue = 0) => {
      if (!varbind || varbind.type === snmp.ErrorStatus.NoSuchObject) {
        return defaultValue;
      }
      return varbind.value;
    };

    const uptime = safeValue(varbinds[0], 0);
    const sysName = safeValue(varbinds[1], 'Unknown');
    const cpuLoad = safeValue(varbinds[2], 0);
    const memTotal = safeValue(varbinds[3], 0);
    const memAvail = safeValue(varbinds[4], memTotal);
    const processCount = safeValue(varbinds[5], 0);
    
    // Memory in KB umrechnen
    const memTotalBytes = memTotal * 1024;
    const memAvailBytes = memAvail * 1024;
    const memUsedBytes = memTotalBytes - memAvailBytes;
    const memUsedPercent = memTotal > 0 ? 
      ((memUsedBytes / memTotalBytes) * 100) : 0;
    
    return {
      uptime: this.parseUptime(uptime),
      sysName: sysName.toString(),
      cpu: {
        load: isWindows ? cpuLoad : (cpuLoad / 100), // Load average normalisieren
        percent: isWindows ? cpuLoad : Math.min((cpuLoad / 100) * 20, 100) // Approximation
      },
      memory: {
        total: memTotalBytes,
        available: memAvailBytes,
        used: memUsedBytes,
        usedPercent: parseFloat(memUsedPercent.toFixed(2))
      },
      processes: processCount,
      timestamp: new Date().toISOString(),
      collectedAt: Date.now()
    };
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

  async saveMetrics(host, metrics, interfaces) {
    // Metriken in Datenbank speichern
    await this.db.insert('snmp_metrics', {
      hostId: host.id,
      uptime: metrics.uptime.totalSeconds,
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
      const interfaceData = interfaces.map(iface => ({
        hostId: host.id,
        interfaceName: iface.name,
        status: iface.status,
        bytesIn: iface.bytesIn,
        bytesOut: iface.bytesOut,
        collectedAt: new Date()
      }));
      
      await this.db.batchInsert('snmp_interfaces', interfaceData);
    }

    // Host-Status aktualisieren
    await this.db.update('hosts', 
      { id: host.id },
      { 
        lastSnmpCheck: new Date(),
        snmpStatus: 'online',
        lastMetrics: JSON.stringify(metrics)
      }
    );
  }

  async saveError(host, error) {
    // Fehler protokollieren
    await this.db.insert('snmp_errors', {
      hostId: host.id,
      errorMessage: error.message,
      errorType: error.code || 'UNKNOWN',
      occurredAt: new Date()
    });

    // Host-Status aktualisieren
    await this.db.update('hosts',
      { id: host.id },
      {
        lastSnmpCheck: new Date(),
        snmpStatus: 'offline',
        lastSnmpError: error.message
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