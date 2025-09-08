const snmp = require('net-snmp');

class SNMPMonitor {
  constructor(db) {
    this.db = db;
    this.sessions = new Map();
    this.errorCounts = new Map();
    this.maxRetries = 3;
    
    // Store previous CPU counter values for delta calculation
    this.previousCpuValues = new Map();
    
    // Comprehensive OID definitions for all metrics
    this.oidDefinitions = {
      // System Information (RFC1213-MIB)
      system: {
        sysDescr: '1.3.6.1.2.1.1.1.0',
        sysObjectID: '1.3.6.1.2.1.1.2.0',
        sysUpTime: '1.3.6.1.2.1.1.3.0',
        sysContact: '1.3.6.1.2.1.1.4.0',
        sysName: '1.3.6.1.2.1.1.5.0',
        sysLocation: '1.3.6.1.2.1.1.6.0',
        sysServices: '1.3.6.1.2.1.1.7.0',
        hrSystemUptime: '1.3.6.1.2.1.25.1.1.0'  // HOST-RESOURCES-MIB: Real system uptime
      },
      
      // CPU Metrics (UCD-SNMP-MIB)
      cpu: {
        // Load averages
        load1min: '1.3.6.1.4.1.2021.10.1.3.1',
        load5min: '1.3.6.1.4.1.2021.10.1.3.2',
        load15min: '1.3.6.1.4.1.2021.10.1.3.3',
        
        // CPU time counters (for accurate CPU% calculation)
        ssCpuRawUser: '1.3.6.1.4.1.2021.11.50.0',     // User CPU ticks
        ssCpuRawNice: '1.3.6.1.4.1.2021.11.51.0',     // Nice CPU ticks
        ssCpuRawSystem: '1.3.6.1.4.1.2021.11.52.0',   // System CPU ticks
        ssCpuRawIdle: '1.3.6.1.4.1.2021.11.53.0',     // Idle CPU ticks
        ssCpuRawWait: '1.3.6.1.4.1.2021.11.54.0',     // IO Wait ticks
        ssCpuRawKernel: '1.3.6.1.4.1.2021.11.55.0',   // Kernel ticks
        ssCpuRawInterrupt: '1.3.6.1.4.1.2021.11.56.0', // Interrupt ticks
        
        // Percentage values (if available)
        cpuUser: '1.3.6.1.4.1.2021.11.9.0',           // User CPU %
        cpuSystem: '1.3.6.1.4.1.2021.11.10.0',        // System CPU %
        cpuIdle: '1.3.6.1.4.1.2021.11.11.0',          // Idle CPU %
        
        // Core count (HOST-RESOURCES-MIB)
        hrProcessorCount: '1.3.6.1.2.1.25.3.3.1.0'
      },
      
      // Memory Metrics (UCD-SNMP-MIB)
      memory: {
        memTotalReal: '1.3.6.1.4.1.2021.4.5.0',       // Total RAM in KB
        memAvailReal: '1.3.6.1.4.1.2021.4.6.0',       // Available RAM in KB
        memTotalFree: '1.3.6.1.4.1.2021.4.11.0',      // Total Free in KB
        memShared: '1.3.6.1.4.1.2021.4.13.0',         // Shared Memory in KB
        memBuffer: '1.3.6.1.4.1.2021.4.14.0',         // Buffer Memory in KB
        memCached: '1.3.6.1.4.1.2021.4.15.0',         // Cached Memory in KB
        memTotalSwap: '1.3.6.1.4.1.2021.4.3.0',       // Total Swap in KB
        memAvailSwap: '1.3.6.1.4.1.2021.4.4.0',       // Available Swap in KB
        
        // HOST-RESOURCES-MIB alternative
        hrMemorySize: '1.3.6.1.2.1.25.2.2.0',         // Physical memory
        hrStorageTable: '1.3.6.1.2.1.25.2.3.1'        // Storage table
      },
      
      // Disk Metrics (UCD-SNMP-MIB)
      disk: {
        dskTable: '1.3.6.1.4.1.2021.9.1',             // Disk table
        dskPath: '1.3.6.1.4.1.2021.9.1.2',            // Mount path
        dskDevice: '1.3.6.1.4.1.2021.9.1.3',          // Device name
        dskTotal: '1.3.6.1.4.1.2021.9.1.6',           // Total size (KB)
        dskAvail: '1.3.6.1.4.1.2021.9.1.7',           // Available (KB)
        dskUsed: '1.3.6.1.4.1.2021.9.1.8',            // Used (KB)
        dskPercent: '1.3.6.1.4.1.2021.9.1.9',         // Used percentage
        
        // HOST-RESOURCES-MIB storage
        hrStorageDescr: '1.3.6.1.2.1.25.2.3.1.3',     // Storage description
        hrStorageSize: '1.3.6.1.2.1.25.2.3.1.5',      // Storage size
        hrStorageUsed: '1.3.6.1.2.1.25.2.3.1.6'       // Storage used
      },
      
      // Network Metrics (IF-MIB)
      network: {
        ifNumber: '1.3.6.1.2.1.2.1.0',                // Number of interfaces
        ifTable: '1.3.6.1.2.1.2.2.1',                 // Interface table
        ifDescr: '1.3.6.1.2.1.2.2.1.2',               // Interface description
        ifType: '1.3.6.1.2.1.2.2.1.3',                // Interface type
        ifSpeed: '1.3.6.1.2.1.2.2.1.5',               // Interface speed
        ifPhysAddress: '1.3.6.1.2.1.2.2.1.6',         // MAC address
        ifOperStatus: '1.3.6.1.2.1.2.2.1.8',          // Operational status
        ifInOctets: '1.3.6.1.2.1.2.2.1.10',           // Bytes received
        ifOutOctets: '1.3.6.1.2.1.2.2.1.16',          // Bytes sent
        ifInErrors: '1.3.6.1.2.1.2.2.1.14',           // Input errors
        ifOutErrors: '1.3.6.1.2.1.2.2.1.20',          // Output errors
        
        // 64-bit counters (IF-MIB)
        ifHCInOctets: '1.3.6.1.2.1.31.1.1.1.6',       // 64-bit bytes in
        ifHCOutOctets: '1.3.6.1.2.1.31.1.1.1.10'      // 64-bit bytes out
      },
      
      // Process Metrics (HOST-RESOURCES-MIB)
      process: {
        hrSystemProcesses: '1.3.6.1.2.1.25.1.6.0',    // Number of processes
        hrSWRunTable: '1.3.6.1.2.1.25.4.2.1',         // Running software table
        hrSWRunName: '1.3.6.1.2.1.25.4.2.1.2',        // Process name
        hrSWRunPath: '1.3.6.1.2.1.25.4.2.1.4',        // Process path
        hrSWRunStatus: '1.3.6.1.2.1.25.4.2.1.7',      // Process status
        hrSWRunPerfCPU: '1.3.6.1.2.1.25.4.2.1.5',     // CPU used by process
        hrSWRunPerfMem: '1.3.6.1.2.1.25.4.2.1.6',     // Memory used by process
        
        // UCD-SNMP-MIB process monitoring
        prTable: '1.3.6.1.4.1.2021.2.1',              // Process table
        prCount: '1.3.6.1.4.1.2021.2.1.5'             // Process count
      },
      
      // Temperature sensors (LM-SENSORS-MIB - if available)
      sensors: {
        lmTempSensorsTable: '1.3.6.1.4.1.2021.13.16.2.1',
        lmTempSensorsDevice: '1.3.6.1.4.1.2021.13.16.2.1.2',
        lmTempSensorsValue: '1.3.6.1.4.1.2021.13.16.2.1.3'
      }
    };
    
    // Error types for classification
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

  // Create or get SNMP session
  getSession(config) {
    // Check if this is the local Docker host
    let targetIP = config.ip;
    const os = require('os');
    const localIPs = [];
    
    // Collect all local IP addresses
    const networkInterfaces = os.networkInterfaces();
    Object.values(networkInterfaces).forEach(interfaces => {
      interfaces.forEach(iface => {
        if (!iface.internal && iface.family === 'IPv4') {
          localIPs.push(iface.address);
        }
      });
    });
    
    // If the target IP is one of our local IPs, use host.docker.internal instead
    if (localIPs.includes(config.ip)) {
      console.log(`🔄 Detected local host IP ${config.ip}, using host.docker.internal for Docker compatibility`);
      targetIP = 'host.docker.internal';
    }
    
    const sessionKey = `${targetIP}:${config.port}:${config.community}`;
    
    if (!this.sessions.has(sessionKey)) {
      const options = {
        port: config.port || 161,
        retries: this.maxRetries,
        timeout: config.timeout || 5000,
        version: config.version === 'v1' ? snmp.Version1 : snmp.Version2c
      };
      
      console.log('🔐 Creating SNMP session:', {
        target: targetIP,
        originalIP: config.ip,
        port: options.port,
        community: config.community || 'public',
        version: config.version,
        timeout: options.timeout,
        sessionKey: sessionKey,
        isLocalHost: targetIP === 'host.docker.internal'
      });
      
      const session = snmp.createSession(targetIP, config.community || 'public', options);
      this.sessions.set(sessionKey, session);
    }
    
    return this.sessions.get(sessionKey);
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

  // Get comprehensive error details with recommendations
  getErrorDetails(error, config) {
    const errorType = this.classifyError(error);
    const details = {
      type: errorType,
      message: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      config: {
        ip: config.ip,
        port: config.port,
        version: config.version,
        community: config.community ? '***' : undefined
      },
      recommendations: []
    };

    // Add specific recommendations based on error type
    switch (errorType) {
      case this.errorTypes.TIMEOUT:
        details.recommendations = [
          'Check if SNMP service is running on the target host',
          'Verify firewall settings allow SNMP traffic',
          'Ensure the correct SNMP port is configured',
          'Try increasing the timeout value'
        ];
        break;
      case this.errorTypes.AUTH_FAILED:
        details.recommendations = [
          'Verify the SNMP community string is correct',
          'Check SNMP version compatibility',
          'Ensure SNMP access control allows queries from this IP'
        ];
        break;
      case this.errorTypes.NETWORK_ERROR:
        details.recommendations = [
          'Verify the host IP address is correct',
          'Check network connectivity to the target host',
          'Ensure no network devices are blocking SNMP traffic'
        ];
        break;
      case this.errorTypes.NO_SUCH_OBJECT:
        details.recommendations = [
          'The requested OID may not be supported by this device',
          'Try using a different SNMP MIB for this device type',
          'Check if the SNMP agent supports this metric'
        ];
        break;
    }
    
    return details;
  }

  // Calculate CPU percentage from counter deltas
  calculateCpuPercentage(currentValues, hostId) {
    const prevKey = `cpu_${hostId}`;
    const previous = this.previousCpuValues.get(prevKey);
    
    if (!previous) {
      // Store for next calculation
      this.previousCpuValues.set(prevKey, {
        values: currentValues,
        timestamp: Date.now()
      });
      return null;
    }
    
    const timeDiff = (Date.now() - previous.timestamp) / 1000; // Convert to seconds
    
    // Calculate deltas
    const userDelta = (currentValues.user || 0) - (previous.values.user || 0);
    const niceDelta = (currentValues.nice || 0) - (previous.values.nice || 0);
    const systemDelta = (currentValues.system || 0) - (previous.values.system || 0);
    const idleDelta = (currentValues.idle || 0) - (previous.values.idle || 0);
    const waitDelta = (currentValues.wait || 0) - (previous.values.wait || 0);
    const kernelDelta = (currentValues.kernel || 0) - (previous.values.kernel || 0);
    const interruptDelta = (currentValues.interrupt || 0) - (previous.values.interrupt || 0);
    
    const totalDelta = userDelta + niceDelta + systemDelta + idleDelta + 
                      waitDelta + kernelDelta + interruptDelta;
    
    // Store current values for next calculation
    this.previousCpuValues.set(prevKey, {
      values: currentValues,
      timestamp: Date.now()
    });
    
    if (totalDelta === 0) {
      return {
        total: 0,
        user: 0,
        system: 0,
        idle: 100,
        wait: 0,
        nice: 0
      };
    }
    
    // Calculate percentages
    return {
      total: Math.round(((totalDelta - idleDelta) / totalDelta) * 100),
      user: Math.round((userDelta / totalDelta) * 100),
      system: Math.round((systemDelta / totalDelta) * 100),
      idle: Math.round((idleDelta / totalDelta) * 100),
      wait: Math.round((waitDelta / totalDelta) * 100),
      nice: Math.round((niceDelta / totalDelta) * 100),
      kernel: Math.round((kernelDelta / totalDelta) * 100),
      interrupt: Math.round((interruptDelta / totalDelta) * 100)
    };
  }

  // Get all metrics with table walks for complete data
  async getAllMetrics(session, hostId) {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {},
      cpu: {},
      memory: {},
      disk: [],
      network: [],
      processes: {},
      sensors: []
    };

    try {
      // Get basic system info
      const systemOids = Object.values(this.oidDefinitions.system);
      const systemData = await this.getOidValues(session, systemOids);
      metrics.system = this.parseSystemInfo(systemData);

      // Get CPU metrics
      const cpuOids = Object.values(this.oidDefinitions.cpu).filter(oid => !oid.includes('25.3.3'));
      const cpuData = await this.getOidValues(session, cpuOids);
      
      // Count processor cores by walking the processor table
      let processorCount = 1; // Default to 1 if not available
      try {
        // Try HOST-RESOURCES-MIB processor table first
        // Walk hrProcessorFrwID to count processors (works on macOS)
        const processorTable = await this.walkOid(session, '1.3.6.1.2.1.25.3.3.1.1');
        if (processorTable && Object.keys(processorTable).length > 0) {
          processorCount = Object.keys(processorTable).length;

        }
      } catch (e) {

        // Try UCD-SNMP-MIB for number of CPUs (Linux)
        try {
          const ssCpuNumCpus = await this.getOidValues(session, ['1.3.6.1.4.1.2021.13.16.6.0']);
          if (ssCpuNumCpus && ssCpuNumCpus['1.3.6.1.4.1.2021.13.16.6.0']) {
            processorCount = parseInt(ssCpuNumCpus['1.3.6.1.4.1.2021.13.16.6.0']);

          }
        } catch (e2) {
          // Try to detect from system description for macOS
          if (metrics.system && metrics.system.description) {
            const desc = metrics.system.description.toLowerCase();
            
            // Try to extract from macOS sysDescr
            const macCpuMatch = desc.match(/(\d+)-core/i);
            if (macCpuMatch) {
              processorCount = parseInt(macCpuMatch[1]);

            } else {
              // Check for specific processor models
              if (desc.includes('m1') || desc.includes('m2') || desc.includes('m3')) {
                // Apple Silicon detection
                if (desc.includes('pro')) processorCount = 10; // M1/M2 Pro typical
                else if (desc.includes('max')) processorCount = 12; // M1/M2 Max typical
                else if (desc.includes('ultra')) processorCount = 20; // M1/M2 Ultra typical
                else processorCount = 8; // Base M1/M2/M3

              }
            }
          }

        }
      }
      
      metrics.cpu = await this.parseCpuInfo(cpuData, hostId);
      metrics.cpu.cores = processorCount;

      // Calculate CPU percentages (for Apple Silicon compatibility)
      const cpuPercentages = await this.calculateCpuPercentages(session, hostId);
      if (cpuPercentages) {
        metrics.cpu.user = cpuPercentages.user;
        metrics.cpu.system = cpuPercentages.system;
        metrics.cpu.idle = cpuPercentages.idle;
      }

      // Get memory metrics
      const memoryOids = Object.values(this.oidDefinitions.memory);
      const memoryData = await this.getOidValues(session, memoryOids);
      metrics.memory = this.parseMemoryInfo(memoryData);

      // Walk disk table for all mounted filesystems
      metrics.disk = await this.walkDiskTable(session);

      // Walk network interfaces
      metrics.network = await this.walkNetworkInterfaces(session);

      // Get process information
      metrics.processes = await this.getProcessInfo(session);

      // Try to get temperature sensors (may not be available)
      try {
        metrics.sensors = await this.walkSensorTable(session);
      } catch (e) {
        // Sensors not available, ignore

      }

    } catch (error) {
      console.error('Error getting metrics:', error);
      throw error;
    }

    return metrics;
  }

  // Get values for specific OIDs
  getOidValues(session, oids) {
    return new Promise((resolve, reject) => {
      session.get(oids, (error, varbinds) => {
        if (error) {
          reject(error);
        } else {
          const result = {};
          varbinds.forEach(varbind => {
            if (varbind.type !== snmp.ErrorStatus.NoSuchObject) {
              result[varbind.oid] = varbind.value;
            }
          });
          resolve(result);
        }
      });
    });
  }

  // Walk a specific OID and return key-value pairs
  walkOid(session, oid) {
    return new Promise((resolve, reject) => {
      const results = {};
      
      session.walk(oid, (error, varbinds) => {
        if (error) {
          // Don't reject, just return empty object

          resolve({});
        } else {
          varbinds.forEach(varbind => {
            if (varbind.type !== snmp.ErrorStatus.NoSuchObject) {
              // Extract the index from the OID
              const index = varbind.oid.substring(oid.length + 1);
              results[index] = varbind.value;
            }
          });
        }
      }, () => {
        // Done callback
        resolve(results);
      });
    });
  }

  // Walk an SNMP table
  walkTable(session, tableOid) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      session.tableColumns(tableOid, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], (error, table) => {
        if (error) {
          // Try simple walk if tableColumns fails
          const walkResults = [];
          session.walk(tableOid, (error, varbinds) => {
            if (error) {
              reject(error);
            } else {
              varbinds.forEach(varbind => {
                if (varbind.type !== snmp.ErrorStatus.NoSuchObject) {
                  walkResults.push({
                    oid: varbind.oid,
                    value: varbind.value
                  });
                }
              });
            }
          }, () => {
            resolve(walkResults);
          });
        } else {
          // Convert table to array
          for (let index in table) {
            results.push(table[index]);
          }
          resolve(results);
        }
      });
    });
  }

  // Parse system information
  parseSystemInfo(data) {
    const info = {
      description: '',
      name: '',
      uptime: 0,
      agentUptime: 0,
      contact: '',
      location: '',
      osType: '',
      osVersion: '',
      osDetails: ''
    };

    Object.keys(data).forEach(oid => {
      const value = data[oid];
      
      if (oid === this.oidDefinitions.system.sysDescr) {
        info.description = this.parseStringValue(value);
        
        // Parse OS type and version from description with improved detection
        const desc = info.description.toLowerCase();
        const originalDesc = info.description;
        
        if (desc.includes('darwin')) {
          info.osType = 'macOS';
          // Extract macOS version from Darwin kernel version
          const match = desc.match(/darwin kernel version (\d+\.\d+)/);
          if (match) {
            const darwinVersion = parseFloat(match[1]);
            // Updated Darwin to macOS version mapping for 2025
            if (darwinVersion >= 24) {
              info.osVersion = 'Sequoia';  // macOS 15
            } else if (darwinVersion >= 23) {
              info.osVersion = 'Sonoma';    // macOS 14
            } else if (darwinVersion >= 22) {
              info.osVersion = 'Ventura';   // macOS 13
            } else if (darwinVersion >= 21) {
              info.osVersion = 'Monterey';  // macOS 12
            } else if (darwinVersion >= 20) {
              info.osVersion = 'Big Sur';   // macOS 11
            } else if (darwinVersion >= 19) {
              info.osVersion = 'Catalina';  // macOS 10.15
            } else if (darwinVersion >= 18) {
              info.osVersion = 'Mojave';    // macOS 10.14
            } else if (darwinVersion >= 17) {
              info.osVersion = 'High Sierra'; // macOS 10.13
            } else {
              info.osVersion = `Darwin ${darwinVersion}`;
            }
            
            // Extract build number
            const buildMatch = originalDesc.match(/(\d+[A-Z]\d+[a-z]?)/);
            if (buildMatch) {
              info.osDetails = `Build ${buildMatch[1]}`;
            }
          }
        } else if (desc.includes('linux')) {
          info.osType = 'Linux';
          
          // Enhanced Linux distribution detection with version extraction
          if (desc.includes('ubuntu')) {
            const ubuntuMatch = originalDesc.match(/ubuntu[^\d]*([\d.]+)/i);
            if (ubuntuMatch) {
              const version = ubuntuMatch[1];
              // Map Ubuntu version numbers to codenames
              if (version.startsWith('24.04')) info.osVersion = 'Ubuntu 24.04 LTS (Noble Numbat)';
              else if (version.startsWith('23.10')) info.osVersion = 'Ubuntu 23.10 (Mantic Minotaur)';
              else if (version.startsWith('22.04')) info.osVersion = 'Ubuntu 22.04 LTS (Jammy Jellyfish)';
              else if (version.startsWith('20.04')) info.osVersion = 'Ubuntu 20.04 LTS (Focal Fossa)';
              else info.osVersion = `Ubuntu ${version}`;
            } else {
              info.osVersion = 'Ubuntu';
            }
          } else if (desc.includes('debian')) {
            const debianMatch = originalDesc.match(/debian[^\d]*([\d.]+)/i);
            if (debianMatch) {
              const version = debianMatch[1];
              // Map Debian version numbers to codenames
              if (version === '12') info.osVersion = 'Debian 12 (Bookworm)';
              else if (version === '11') info.osVersion = 'Debian 11 (Bullseye)';
              else if (version === '10') info.osVersion = 'Debian 10 (Buster)';
              else info.osVersion = `Debian ${version}`;
            } else {
              info.osVersion = 'Debian';
            }
          } else if (desc.includes('centos')) {
            const centosMatch = originalDesc.match(/centos[^\d]*([\d.]+)/i);
            info.osVersion = centosMatch ? `CentOS ${centosMatch[1]}` : 'CentOS';
          } else if (desc.includes('rocky')) {
            const rockyMatch = originalDesc.match(/rocky[^\d]*([\d.]+)/i);
            info.osVersion = rockyMatch ? `Rocky Linux ${rockyMatch[1]}` : 'Rocky Linux';
          } else if (desc.includes('alma')) {
            const almaMatch = originalDesc.match(/alma[^\d]*([\d.]+)/i);
            info.osVersion = almaMatch ? `AlmaLinux ${almaMatch[1]}` : 'AlmaLinux';
          } else if (desc.includes('fedora')) {
            const fedoraMatch = originalDesc.match(/fedora[^\d]*([\d.]+)/i);
            info.osVersion = fedoraMatch ? `Fedora ${fedoraMatch[1]}` : 'Fedora';
          } else if (desc.includes('red hat') || desc.includes('redhat') || desc.includes('rhel')) {
            const rhelMatch = originalDesc.match(/(?:red hat|redhat|rhel)[^\d]*([\d.]+)/i);
            info.osVersion = rhelMatch ? `RHEL ${rhelMatch[1]}` : 'Red Hat Enterprise Linux';
          } else if (desc.includes('suse')) {
            const suseMatch = originalDesc.match(/suse[^\d]*([\d.]+)/i);
            info.osVersion = suseMatch ? `SUSE ${suseMatch[1]}` : 'SUSE Linux';
          } else if (desc.includes('opensuse')) {
            const opensuseMatch = originalDesc.match(/opensuse[^\d]*([\d.]+|leap|tumbleweed)/i);
            if (opensuseMatch) {
              const variant = opensuseMatch[1];
              if (variant.toLowerCase() === 'tumbleweed') info.osVersion = 'openSUSE Tumbleweed';
              else if (variant.toLowerCase() === 'leap') info.osVersion = 'openSUSE Leap';
              else info.osVersion = `openSUSE ${variant}`;
            } else {
              info.osVersion = 'openSUSE';
            }
          } else if (desc.includes('arch')) {
            info.osVersion = 'Arch Linux';
          } else if (desc.includes('alpine')) {
            const alpineMatch = originalDesc.match(/alpine[^\d]*([\d.]+)/i);
            info.osVersion = alpineMatch ? `Alpine ${alpineMatch[1]}` : 'Alpine Linux';
          } else if (desc.includes('gentoo')) {
            info.osVersion = 'Gentoo Linux';
          } else if (desc.includes('manjaro')) {
            info.osVersion = 'Manjaro Linux';
          } else if (desc.includes('mint')) {
            const mintMatch = originalDesc.match(/mint[^\d]*([\d.]+)/i);
            if (mintMatch) {
              const version = mintMatch[1];
              // Map Linux Mint versions to codenames
              if (version === '21') info.osVersion = 'Linux Mint 21 (Vanessa)';
              else if (version === '20') info.osVersion = 'Linux Mint 20 (Ulyana)';
              else info.osVersion = `Linux Mint ${version}`;
            } else {
              info.osVersion = 'Linux Mint';
            }
          } else if (desc.includes('elementary')) {
            const elementaryMatch = originalDesc.match(/elementary[^\d]*([\d.]+)/i);
            info.osVersion = elementaryMatch ? `elementary OS ${elementaryMatch[1]}` : 'elementary OS';
          } else if (desc.includes('kali')) {
            const kaliMatch = originalDesc.match(/kali[^\d]*([\d.]+)/i);
            info.osVersion = kaliMatch ? `Kali Linux ${kaliMatch[1]}` : 'Kali Linux';
          } else if (desc.includes('raspbian')) {
            const raspbianMatch = originalDesc.match(/raspbian[^\d]*([\d.]+)/i);
            info.osVersion = raspbianMatch ? `Raspbian ${raspbianMatch[1]}` : 'Raspbian';
          } else if (desc.includes('raspberry pi os')) {
            info.osVersion = 'Raspberry Pi OS';
          } else {
            // Try to extract kernel version as fallback
            const kernelMatch = originalDesc.match(/linux[^\d]*([\d.]+[\d.-]+)/i);
            info.osVersion = kernelMatch ? `Linux (Kernel ${kernelMatch[1]})` : 'Linux';
          }
          
          // Extract kernel version as additional detail
          const kernelMatch = originalDesc.match(/(\d+\.\d+\.\d+[\d.-]*)/);
          if (kernelMatch && !info.osDetails) {
            info.osDetails = `Kernel ${kernelMatch[1]}`;
          }
        } else if (desc.includes('windows')) {
          info.osType = 'Windows';
          // Enhanced Windows version detection
          if (desc.includes('windows 11')) info.osVersion = 'Windows 11';
          else if (desc.includes('windows 10')) info.osVersion = 'Windows 10';
          else if (desc.includes('server 2022')) info.osVersion = 'Server 2022';
          else if (desc.includes('server 2019')) info.osVersion = 'Server 2019';
          else if (desc.includes('server 2016')) info.osVersion = 'Server 2016';
          else if (desc.includes('server 2012')) info.osVersion = 'Server 2012';
          else {
            const winMatch = originalDesc.match(/windows[^\d]*(\S+)/i);
            if (winMatch) info.osVersion = `Windows ${winMatch[1]}`;
            else info.osVersion = 'Windows';
          }
          
          // Extract build number if available
          const buildMatch = originalDesc.match(/build[^\d]*([\d.]+)/i);
          if (buildMatch) {
            info.osDetails = `Build ${buildMatch[1]}`;
          }
        } else if (desc.includes('freebsd')) {
          info.osType = 'FreeBSD';
          const bsdMatch = originalDesc.match(/freebsd[^\d]*([\d.]+)/i);
          info.osVersion = bsdMatch ? `FreeBSD ${bsdMatch[1]}` : 'FreeBSD';
        } else if (desc.includes('openbsd')) {
          info.osType = 'OpenBSD';
          const bsdMatch = originalDesc.match(/openbsd[^\d]*([\d.]+)/i);
          info.osVersion = bsdMatch ? `OpenBSD ${bsdMatch[1]}` : 'OpenBSD';
        } else if (desc.includes('netbsd')) {
          info.osType = 'NetBSD';
          const bsdMatch = originalDesc.match(/netbsd[^\d]*([\d.]+)/i);
          info.osVersion = bsdMatch ? `NetBSD ${bsdMatch[1]}` : 'NetBSD';
        } else {
          // Unknown OS - try to extract some info
          info.osType = 'Unknown';
          info.osVersion = originalDesc.substring(0, 50);
        }
      } else if (oid === this.oidDefinitions.system.sysName) {
        info.name = this.parseStringValue(value);
      } else if (oid === this.oidDefinitions.system.sysUpTime) {
        info.agentUptime = this.parseUptime(value);
      } else if (oid === this.oidDefinitions.system.hrSystemUptime) {
        info.uptime = this.parseUptime(value);
      } else if (oid === this.oidDefinitions.system.sysContact) {
        info.contact = this.parseStringValue(value);
      } else if (oid === this.oidDefinitions.system.sysLocation) {
        info.location = this.parseStringValue(value);
      }
    });

    // If hrSystemUptime is not available, fall back to sysUpTime
    if (!info.uptime && info.agentUptime) {
      info.uptime = info.agentUptime;
    }

    return info;
  }

  // Parse CPU information with proper counter calculation
  async parseCpuInfo(data, hostId) {
    const cpuInfo = {
      load1: 0,
      load5: 0,
      load15: 0,
      cores: 1,
      usage: {},
      raw: {}
    };

    // Parse load averages
    Object.keys(data).forEach(oid => {
      const value = data[oid];
      
      if (oid === this.oidDefinitions.cpu.load1min) {
        cpuInfo.load1 = this.parseLoadValue(value);
      } else if (oid === this.oidDefinitions.cpu.load5min) {
        cpuInfo.load5 = this.parseLoadValue(value);
      } else if (oid === this.oidDefinitions.cpu.load15min) {
        cpuInfo.load15 = this.parseLoadValue(value);
      } else if (oid === this.oidDefinitions.cpu.hrProcessorCount) {
        cpuInfo.cores = parseInt(value) || 1;
      }
      
      // Raw CPU counters
      else if (oid === this.oidDefinitions.cpu.ssCpuRawUser) {
        cpuInfo.raw.user = parseInt(value) || 0;
      } else if (oid === this.oidDefinitions.cpu.ssCpuRawNice) {
        cpuInfo.raw.nice = parseInt(value) || 0;
      } else if (oid === this.oidDefinitions.cpu.ssCpuRawSystem) {
        cpuInfo.raw.system = parseInt(value) || 0;
      } else if (oid === this.oidDefinitions.cpu.ssCpuRawIdle) {
        cpuInfo.raw.idle = parseInt(value) || 0;
      } else if (oid === this.oidDefinitions.cpu.ssCpuRawWait) {
        cpuInfo.raw.wait = parseInt(value) || 0;
      } else if (oid === this.oidDefinitions.cpu.ssCpuRawKernel) {
        cpuInfo.raw.kernel = parseInt(value) || 0;
      } else if (oid === this.oidDefinitions.cpu.ssCpuRawInterrupt) {
        cpuInfo.raw.interrupt = parseInt(value) || 0;
      }
    });

    // Calculate CPU percentages from raw counters
    if (Object.keys(cpuInfo.raw).length > 0) {
      cpuInfo.usage = this.calculateCpuPercentage(cpuInfo.raw, hostId) || {
        total: Math.min(Math.round(cpuInfo.load1 * 100 / cpuInfo.cores), 100)
      };
    } else {
      // Fallback: estimate from load average
      cpuInfo.usage = {
        total: Math.min(Math.round(cpuInfo.load1 * 100 / cpuInfo.cores), 100)
      };
    }

    return cpuInfo;
  }

  // Parse memory information
  parseMemoryInfo(data) {
    const memory = {
      totalRam: 0,
      availableRam: 0,
      usedRam: 0,
      percentRam: 0,
      buffer: 0,
      cache: 0,
      shared: 0,
      totalSwap: 0,
      availableSwap: 0,
      usedSwap: 0,
      percentSwap: 0
    };

    Object.keys(data).forEach(oid => {
      const value = parseInt(data[oid]) || 0;
      
      if (oid === this.oidDefinitions.memory.memTotalReal) {
        memory.totalRam = value * 1024; // Convert KB to bytes
      } else if (oid === this.oidDefinitions.memory.memAvailReal) {
        memory.availableRam = value * 1024;
      } else if (oid === this.oidDefinitions.memory.memBuffer) {
        memory.buffer = value * 1024;
      } else if (oid === this.oidDefinitions.memory.memCached) {
        memory.cache = value * 1024;
      } else if (oid === this.oidDefinitions.memory.memShared) {
        memory.shared = value * 1024;
      } else if (oid === this.oidDefinitions.memory.memTotalSwap) {
        memory.totalSwap = value * 1024;
      } else if (oid === this.oidDefinitions.memory.memAvailSwap) {
        memory.availableSwap = value * 1024;
      }
    });

    // Calculate used and percentages
    memory.usedRam = memory.totalRam - memory.availableRam - memory.buffer - memory.cache;
    memory.percentRam = memory.totalRam > 0 ? 
      Math.round((memory.usedRam / memory.totalRam) * 100) : 0;
    
    memory.usedSwap = memory.totalSwap - memory.availableSwap;
    memory.percentSwap = memory.totalSwap > 0 ? 
      Math.round((memory.usedSwap / memory.totalSwap) * 100) : 0;

    return memory;
  }

  // Walk disk table for all mounted filesystems
  async walkDiskTable(session) {
    const disks = [];
    
    try {
      // Try UCD-SNMP-MIB disk table first
      const diskPaths = await this.walkOid(session, this.oidDefinitions.disk.dskPath);
      const diskDevices = await this.walkOid(session, this.oidDefinitions.disk.dskDevice);
      const diskTotals = await this.walkOid(session, this.oidDefinitions.disk.dskTotal);
      const diskUsed = await this.walkOid(session, this.oidDefinitions.disk.dskUsed);
      const diskAvail = await this.walkOid(session, this.oidDefinitions.disk.dskAvail);
      const diskPercent = await this.walkOid(session, this.oidDefinitions.disk.dskPercent);
      
      // For large disks (>2TB), we need the 64-bit values
      const diskTotalLow = await this.walkOid(session, '1.3.6.1.4.1.2021.9.1.11'); // dskTotalLow
      const diskTotalHigh = await this.walkOid(session, '1.3.6.1.4.1.2021.9.1.12'); // dskTotalHigh
      const diskUsedLow = await this.walkOid(session, '1.3.6.1.4.1.2021.9.1.15'); // dskUsedLow
      const diskUsedHigh = await this.walkOid(session, '1.3.6.1.4.1.2021.9.1.16'); // dskUsedHigh
      const diskAvailLow = await this.walkOid(session, '1.3.6.1.4.1.2021.9.1.13'); // dskAvailLow
      const diskAvailHigh = await this.walkOid(session, '1.3.6.1.4.1.2021.9.1.14'); // dskAvailHigh
      
      // Combine results by index
      const indexes = new Set([
        ...Object.keys(diskPaths),
        ...Object.keys(diskTotals)
      ]);
      
      indexes.forEach(index => {
        if (diskPaths[index]) {
          // Check if we have 64-bit values (for large disks)
          let totalBytes, usedBytes, availBytes;
          
          const totalValue = parseInt(diskTotals[index] || 0);
          if (totalValue === 2147483647 && diskTotalLow[index]) {
            // Integer overflow detected, use 64-bit values
            const low = parseInt(diskTotalLow[index] || 0);
            const high = parseInt(diskTotalHigh[index] || 0);
            totalBytes = (high * 4294967296 + low) * 1024; // Convert KB to bytes
            
            const usedLow = parseInt(diskUsedLow[index] || 0);
            const usedHigh = parseInt(diskUsedHigh[index] || 0);
            usedBytes = (usedHigh * 4294967296 + usedLow) * 1024;
            
            const availLow = parseInt(diskAvailLow[index] || 0);
            const availHigh = parseInt(diskAvailHigh[index] || 0);
            availBytes = (availHigh * 4294967296 + availLow) * 1024;

          } else {
            // Normal 32-bit values
            totalBytes = totalValue * 1024; // Convert KB to bytes
            usedBytes = parseInt(diskUsed[index] || 0) * 1024;
            availBytes = parseInt(diskAvail[index] || 0) * 1024;
          }
          
          disks.push({
            path: this.parseStringValue(diskPaths[index]),
            device: this.parseStringValue(diskDevices[index] || 'unknown'),
            total: totalBytes,
            used: usedBytes,
            available: availBytes,
            percent: parseInt(diskPercent[index] || 0)
          });
        }
      });
    } catch (error) {

      // Fallback to HOST-RESOURCES-MIB
      try {
        const storageDescr = await this.walkOid(session, this.oidDefinitions.disk.hrStorageDescr);
        const storageSize = await this.walkOid(session, this.oidDefinitions.disk.hrStorageSize);
        const storageUsed = await this.walkOid(session, this.oidDefinitions.disk.hrStorageUsed);
        
        Object.keys(storageDescr).forEach(index => {
          const descr = this.parseStringValue(storageDescr[index]);
          // Filter out non-disk entries
          if (!descr.includes('Memory') && !descr.includes('Swap')) {
            const total = parseInt(storageSize[index] || 0) * 4096; // Usually 4KB blocks
            const used = parseInt(storageUsed[index] || 0) * 4096;
            
            disks.push({
              path: descr,
              device: descr,
              total: total,
              used: used,
              available: total - used,
              percent: total > 0 ? Math.round((used / total) * 100) : 0
            });
          }
        });
      } catch (e) {

      }
    }
    
    return disks;
  }

  // Walk network interfaces
  async walkNetworkInterfaces(session) {
    const interfaces = [];
    
    try {
      // Get interface descriptions
      const ifDescr = await this.walkOid(session, this.oidDefinitions.network.ifDescr);
      const ifType = await this.walkOid(session, this.oidDefinitions.network.ifType);
      const ifSpeed = await this.walkOid(session, this.oidDefinitions.network.ifSpeed);
      const ifOperStatus = await this.walkOid(session, this.oidDefinitions.network.ifOperStatus);
      const ifInOctets = await this.walkOid(session, this.oidDefinitions.network.ifInOctets);
      const ifOutOctets = await this.walkOid(session, this.oidDefinitions.network.ifOutOctets);
      const ifInErrors = await this.walkOid(session, this.oidDefinitions.network.ifInErrors);
      const ifOutErrors = await this.walkOid(session, this.oidDefinitions.network.ifOutErrors);
      const ifPhysAddress = await this.walkOid(session, this.oidDefinitions.network.ifPhysAddress);
      
      // Try to get 64-bit counters if available (preferred for high-speed interfaces)
      const ifHCInOctets = await this.walkOid(session, this.oidDefinitions.network.ifHCInOctets).catch(() => ({}));
      const ifHCOutOctets = await this.walkOid(session, this.oidDefinitions.network.ifHCOutOctets).catch(() => ({}));
      
      Object.keys(ifDescr).forEach(index => {
        // Use 32-bit counters primarily (they work on macOS)
        // 64-bit counters come as Buffer and need special parsing
        let bytesIn = parseInt(ifInOctets[index]) || 0;
        let bytesOut = parseInt(ifOutOctets[index]) || 0;
        
        interfaces.push({
          index: parseInt(index),
          name: this.parseStringValue(ifDescr[index]),
          type: this.getInterfaceType(parseInt(ifType[index] || 0)),
          speed: parseInt(ifSpeed[index] || 0),
          status: this.getOperStatus(parseInt(ifOperStatus[index] || 0)),
          mac: this.parseMacAddress(ifPhysAddress[index]),
          // Map statistics to flat structure for easier access
          bytesIn: bytesIn,
          bytesOut: bytesOut,
          errorsIn: parseInt(ifInErrors[index] || 0),
          errorsOut: parseInt(ifOutErrors[index] || 0),
          statistics: {
            bytesReceived: bytesIn,
            bytesSent: bytesOut,
            errorsIn: parseInt(ifInErrors[index] || 0),
            errorsOut: parseInt(ifOutErrors[index] || 0)
          }
        });
      });
    } catch (error) {
      console.error('[SNMP] Error walking network interfaces:', error);
    }
    
    return interfaces;
  }

  // Get process information
  async getProcessInfo(session) {
    const processInfo = {
      count: 0,
      running: 0,
      sleeping: 0,
      stopped: 0,
      zombie: 0,
      user: 0,
      system: 0,
      top: []
    };
    
    try {
      // Get total process count
      const processCount = await this.getOidValues(session, [this.oidDefinitions.process.hrSystemProcesses]);
      processInfo.count = parseInt(processCount[this.oidDefinitions.process.hrSystemProcesses] || 0);

      // Try to get process details
      const swRunName = await this.walkOid(session, this.oidDefinitions.process.hrSWRunName);
      const swRunPath = await this.walkOid(session, this.oidDefinitions.process.hrSWRunPath);
      const swRunStatus = await this.walkOid(session, this.oidDefinitions.process.hrSWRunStatus);
      const swRunPerfCPU = await this.walkOid(session, this.oidDefinitions.process.hrSWRunPerfCPU);
      const swRunPerfMem = await this.walkOid(session, this.oidDefinitions.process.hrSWRunPerfMem);

      // Count process states and get top processes
      const processes = [];
      Object.keys(swRunName).forEach(index => {
        const name = this.parseStringValue(swRunName[index]);
        const path = swRunPath[index] ? this.parseStringValue(swRunPath[index]) : '';
        const status = parseInt(swRunStatus[index] || 1);
        
        // Try to categorize user vs system processes
        // Since paths are often empty on macOS, categorize by name
        if (name) {
          const lowerName = name.toLowerCase();
          // System processes typically include these patterns
          if (lowerName.includes('kernel') || 
              lowerName.includes('daemon') || 
              lowerName.includes('systemd') || 
              lowerName.startsWith('k') ||
              lowerName.includes('syslog') || 
              lowerName.includes('launchd') ||
              lowerName === 'logd' ||
              lowerName === 'smd' ||
              lowerName.includes('agent') ||
              lowerName.includes('helper') ||
              lowerName.includes('service') ||
              lowerName.startsWith('com.apple') ||
              lowerName.startsWith('com.docker') ||
              lowerName.includes('coreaudio') ||
              lowerName.includes('mdns') ||
              lowerName.includes('spotlight') ||
              lowerName.includes('windowserver') ||
              lowerName.includes('loginwindow') ||
              lowerName.includes('cfprefsd') ||
              lowerName.includes('coreservices') ||
              lowerName.includes('distnoted') ||
              lowerName.includes('usereventagent')) {
            processInfo.system++;
          } else {
            processInfo.user++;
          }
        }
        
        // Status: 1=running, 2=runnable, 3=notRunnable, 4=invalid
        switch (status) {
          case 1:
          case 2:
            processInfo.running++;
            break;
          case 3:
            processInfo.sleeping++;
            break;
          case 4:
            processInfo.stopped++;
            break;
        }
        
        processes.push({
          name: name,
          path: path,
          cpu: parseInt(swRunPerfCPU[index] || 0),
          memory: parseInt(swRunPerfMem[index] || 0) * 1024 // Convert to bytes
        });
      });
      
      // Get top 10 processes by CPU usage
      processInfo.top = processes
        .sort((a, b) => b.cpu - a.cpu)
        .slice(0, 10);

    } catch (error) {

    }
    
    return processInfo;
  }

  // Calculate CPU percentages with Apple Silicon fallback
  async calculateCpuPercentages(session, hostId) {
    try {
      // First, try to get the raw CPU counters
      const rawOids = [
        this.oidDefinitions.cpu.ssCpuRawUser,
        this.oidDefinitions.cpu.ssCpuRawSystem,
        this.oidDefinitions.cpu.ssCpuRawIdle,
        this.oidDefinitions.cpu.ssCpuRawNice
      ];
      
      const rawResults = await this.getOidValues(session, rawOids);
      
      const currentUser = parseInt(rawResults[this.oidDefinitions.cpu.ssCpuRawUser] || 0);
      const currentSystem = parseInt(rawResults[this.oidDefinitions.cpu.ssCpuRawSystem] || 0);
      const currentIdle = parseInt(rawResults[this.oidDefinitions.cpu.ssCpuRawIdle] || 0);
      const currentNice = parseInt(rawResults[this.oidDefinitions.cpu.ssCpuRawNice] || 0);
      
      // Debug logging
      console.log(`[CPU Debug] Host ${hostId}: user=${currentUser}, system=${currentSystem}, idle=${currentIdle}, nice=${currentNice}`);
      
      // Check if we're on Apple Silicon (all counters are 0)
      const isAppleSilicon = currentUser === 0 && currentSystem === 0 && currentIdle === 0;
      console.log(`[CPU Debug] Host ${hostId}: isAppleSilicon=${isAppleSilicon}`);
      
      if (isAppleSilicon) {
        // Fallback for Apple Silicon: Use load average as proxy

        // Get load average and processor count
        const loadOids = [
          this.oidDefinitions.cpu.load1min,
          this.oidDefinitions.cpu.load5min,
          this.oidDefinitions.cpu.load15min
        ];
        
        const loadResults = await this.getOidValues(session, loadOids);
        const load1 = parseFloat(this.parseStringValue(loadResults[this.oidDefinitions.cpu.load1min]) || '0');
        
        // Get processor count (try different methods)
        let processorCount = 1;
        try {
          // Try hrProcessorTable first
          const processorTable = await this.walkOid(session, '1.3.6.1.2.1.25.3.3.1.2');
          processorCount = Object.keys(processorTable).length || 1;
        } catch (e) {
          // Default to 10 for Apple Silicon Macs (your machine has 10 cores)
          processorCount = 10;
        }
        
        // Estimate CPU usage from load average
        // This is an approximation: if load == cores, then CPU is ~100% utilized
        const utilizationRatio = Math.min(load1 / processorCount, 1.0);
        const totalUtilization = utilizationRatio * 100;
        
        // Estimate distribution (rough approximation)
        // Typically system usage is about 20-30% of total on macOS
        const systemRatio = 0.25;
        const userRatio = 0.75;
        
        return {
          user: Math.round(totalUtilization * userRatio * 10) / 10,
          system: Math.round(totalUtilization * systemRatio * 10) / 10,
          idle: Math.round((100 - totalUtilization) * 10) / 10
        };
      } else {
        // Intel Mac or Linux: Use delta calculation with raw counters
        const previousValues = this.previousCpuValues.get(hostId);
        const now = Date.now();
        
        if (!previousValues) {
          // First reading - store and return null
          this.previousCpuValues.set(hostId, {
            user: currentUser,
            nice: currentNice,
            system: currentSystem,
            idle: currentIdle,
            timestamp: now
          });
          return null;
        }
        
        // Calculate deltas
        const deltaUser = currentUser - previousValues.user;
        const deltaNice = currentNice - previousValues.nice;
        const deltaSystem = currentSystem - previousValues.system;
        const deltaIdle = currentIdle - previousValues.idle;
        
        const totalDelta = deltaUser + deltaNice + deltaSystem + deltaIdle;
        
        if (totalDelta === 0) {
          // No change - return previous calculated values or defaults
          return {
            user: 0,
            system: 0,
            idle: 100
          };
        }
        
        // Calculate percentages
        const percentUser = Math.round(((deltaUser + deltaNice) / totalDelta) * 1000) / 10;
        const percentSystem = Math.round((deltaSystem / totalDelta) * 1000) / 10;
        const percentIdle = Math.round((deltaIdle / totalDelta) * 1000) / 10;
        
        // Store current values for next calculation
        this.previousCpuValues.set(hostId, {
          user: currentUser,
          nice: currentNice,
          system: currentSystem,
          idle: currentIdle,
          timestamp: now
        });
        
        return {
          user: percentUser,
          system: percentSystem,
          idle: percentIdle
        };
      }
    } catch (error) {
      console.error('Error calculating CPU percentages:', error);
      return null;
    }
  }

  // Walk temperature sensor table
  async walkSensorTable(session) {
    const sensors = [];
    
    try {
      const sensorDevices = await this.walkOid(session, this.oidDefinitions.sensors.lmTempSensorsDevice);
      const sensorValues = await this.walkOid(session, this.oidDefinitions.sensors.lmTempSensorsValue);
      
      Object.keys(sensorDevices).forEach(index => {
        const value = parseInt(sensorValues[index] || 0);
        if (value > 0) {
          sensors.push({
            name: this.parseStringValue(sensorDevices[index]),
            temperature: value / 1000 // Usually in millidegrees
          });
        }
      });
    } catch (error) {
      // Sensors not available
    }
    
    return sensors;
  }

  // Walk a specific OID and return indexed results
  walkOid(session, oidBase) {
    return new Promise((resolve, reject) => {
      const results = {};
      
      session.subtree(oidBase, (varbinds) => {
        varbinds.forEach(varbind => {
          if (varbind.type !== snmp.ErrorStatus.NoSuchObject) {
            // Extract index from OID
            const index = varbind.oid.replace(oidBase + '.', '');
            results[index] = varbind.value;
          }
        });
      }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
  }

  // Helper functions for parsing values
  parseStringValue(value) {
    if (Buffer.isBuffer(value)) {
      return value.toString('utf8').trim();
    }
    return String(value || '').trim();
  }

  parseLoadValue(value) {
    if (Buffer.isBuffer(value)) {
      const str = value.toString('utf8');
      return parseFloat(str) || 0;
    }
    if (typeof value === 'string') {
      return parseFloat(value) || 0;
    }
    return value || 0;
  }

  parseUptime(value) {
    // SNMP uptime is in hundredths of seconds
    return Math.floor((parseInt(value) || 0) / 100);
  }

  parseMacAddress(value) {
    if (Buffer.isBuffer(value)) {
      return Array.from(value)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join(':')
        .toUpperCase();
    }
    return '';
  }

  getInterfaceType(type) {
    const types = {
      1: 'other',
      6: 'ethernet',
      24: 'loopback',
      53: 'virtual',
      131: 'tunnel'
    };
    return types[type] || `type-${type}`;
  }

  getOperStatus(status) {
    const statuses = {
      1: 'up',
      2: 'down',
      3: 'testing',
      4: 'unknown',
      5: 'dormant',
      6: 'notPresent',
      7: 'lowerLayerDown'
    };
    return statuses[status] || 'unknown';
  }

  // Main poll function
  async pollHost(config) {
    const session = this.getSession(config);
    const hostId = config.hostId || config.ip;
    
    try {
      const metrics = await this.getAllMetrics(session, hostId);
      
      // Store metrics in database if needed
      if (this.db && config.storeMetrics) {
        await this.storeMetrics(hostId, metrics);
      }
      
      return {
        success: true,
        metrics: metrics,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const errorDetails = this.getErrorDetails(error, config);
      
      // Track error count
      const errorCount = (this.errorCounts.get(hostId) || 0) + 1;
      this.errorCounts.set(hostId, errorCount);
      
      return {
        success: false,
        error: errorDetails,
        errorCount: errorCount
      };
    }
  }

  // Store metrics in database
  async storeMetrics(hostId, metrics) {
    try {
      await this.db.insert('snmp_metrics', {
        hostId: hostId,
        timestamp: new Date(),
        cpuPercent: metrics.cpu.usage?.total || 0,
        memoryPercent: metrics.memory.percentRam || 0,
        swapPercent: metrics.memory.percentSwap || 0,
        diskUsage: JSON.stringify(metrics.disk),
        networkStats: JSON.stringify(metrics.network),
        processCount: metrics.processes.total || 0,
        rawMetrics: JSON.stringify(metrics)
      });
    } catch (error) {
      console.error('Error storing metrics:', error);
    }
  }

  // Test SNMP connection
  async testConnection(config) {
    // DEBUG: Log connection attempt
    console.log('🔌 SNMP testConnection called with:', {
      ip: config.ip,
      port: config.port,
      community: config.community,
      version: config.version
    });
    
    const session = this.getSession(config);
    
    try {
      // Try to get system name as a simple test
      const testOid = [this.oidDefinitions.system.sysName];
      const result = await this.getOidValues(session, testOid);
      
      if (result[this.oidDefinitions.system.sysName]) {
        return {
          success: true,
          message: `Connected to: ${this.parseStringValue(result[this.oidDefinitions.system.sysName])}`,
          systemName: this.parseStringValue(result[this.oidDefinitions.system.sysName])
        };
      } else {
        throw new Error('No response from SNMP agent');
      }
    } catch (error) {
      return {
        success: false,
        error: this.getErrorDetails(error, config)
      };
    }
  }

  // Cleanup sessions
  cleanup() {
    this.sessions.forEach(session => {
      session.close();
    });
    this.sessions.clear();
    this.previousCpuValues.clear();
    this.errorCounts.clear();
  }

  // Collect specific metrics for background polling
  async collectMetrics(ip, port, community, version, enabledMetrics, numericHostId = null) {
    const config = {
      ip,
      port,
      community,
      version
    };
    
    const session = this.getSession(config);
    const hostId = numericHostId || ip; // Use numeric ID if provided, otherwise IP for CPU delta tracking
    const collectedMetrics = {};
    
    try {
      // Build list of OIDs to query based on enabled metrics
      const oidsToQuery = [];
      const metricMapping = {};
      
      for (const metric of enabledMetrics) {
        const [category, name] = metric.split('.');
        
        // Special handling for CPU load metrics - map naming convention
        if (category === 'cpu' && name.startsWith('load')) {
          let oidName = name;
          if (name === 'load1') oidName = 'load1min';
          else if (name === 'load5') oidName = 'load5min';
          else if (name === 'load15') oidName = 'load15min';
          
          if (this.oidDefinitions[category] && this.oidDefinitions[category][oidName]) {
            const oid = this.oidDefinitions[category][oidName];
            oidsToQuery.push(oid);
            metricMapping[oid] = metric;
          }
        } else if (this.oidDefinitions[category] && this.oidDefinitions[category][name]) {
          const oid = this.oidDefinitions[category][name];
          oidsToQuery.push(oid);
          metricMapping[oid] = metric;
        } else if (metric.includes('disk.') || metric.includes('network.')) {
          // Handle table-based metrics separately
          continue;
        }
      }
      
      // Get simple OID values
      if (oidsToQuery.length > 0) {
        const results = await this.getOidValues(session, oidsToQuery);
        
        for (const [oid, value] of Object.entries(results)) {
          const metricKey = metricMapping[oid];
          if (metricKey && value !== null) {
            let parsedValue = this.parseMetricValue(metricKey, value);
            
            // Convert load average to percentage based on CPU cores
            if (metricKey.includes('cpu.load')) {
              // Get CPU core count for this host
              let cpuCores = 1;
              const hostIdStr = String(hostId);
              
              if (hostIdStr === '6' || hostIdStr.includes('host.docker.internal')) {
                cpuCores = 10; // MacbookPro
              } else if (hostIdStr === '8' || hostIdStr.includes('192.168.178.29')) {
                cpuCores = 8; // Macbook
              } else {
                cpuCores = 4; // Default
              }
              
              // Convert load average to percentage (load / cores * 100)
              parsedValue = Math.round((parsedValue / cpuCores) * 100 * 100) / 100;
              console.log(`[collectMetrics] Load average ${metricKey}: raw=${this.parseMetricValue(metricKey, value)}, cores=${cpuCores}, percent=${parsedValue}%`);
            }
            
            collectedMetrics[metricKey] = parsedValue;
          }
        }
      }
      
      // Handle CPU percentage calculation if CPU metrics are enabled
      const cpuMetrics = enabledMetrics.filter(m => m.startsWith('cpu.'));
      if (cpuMetrics.some(m => ['cpu.user', 'cpu.system', 'cpu.idle'].includes(m))) {
        const cpuPercentages = await this.calculateCpuPercentages(session, hostId);
        if (cpuPercentages) {
          if (enabledMetrics.includes('cpu.user')) {
            collectedMetrics['cpu.user'] = cpuPercentages.user;
          }
          if (enabledMetrics.includes('cpu.system')) {
            collectedMetrics['cpu.system'] = cpuPercentages.system;
          }
          if (enabledMetrics.includes('cpu.idle')) {
            collectedMetrics['cpu.idle'] = cpuPercentages.idle;
          }
        }
      }
      
      // Handle memory calculations if enabled
      const memoryMetrics = enabledMetrics.filter(m => m.startsWith('memory.'));
      if (memoryMetrics.length > 0) {
        const memoryData = await this.getMemoryMetrics(session);
        
        for (const metric of memoryMetrics) {
          const name = metric.split('.')[1];
          // Return raw values - MetricProcessor will handle normalization
          if (name === 'free' || name === 'available') {
            // Return available memory in bytes
            collectedMetrics[metric] = memoryData.available || 0;
          } else if (name === 'used') {
            // Return used memory in bytes
            collectedMetrics[metric] = memoryData.used || 0;
          } else if (name === 'total') {
            // Return total memory in bytes
            collectedMetrics[metric] = memoryData.total || 0;
          } else if (name === 'percent') {
            // Percentage is already calculated
            collectedMetrics[metric] = memoryData.percentUsed || 0;
          } else if (memoryData[name] !== undefined) {
            collectedMetrics[metric] = memoryData[name];
          }
        }
      }
      
      // Handle disk metrics if enabled
      const diskMetrics = enabledMetrics.filter(m => m.startsWith('disk.'));
      if (diskMetrics.length > 0) {
        const disks = await this.getDiskMetrics(session);
        for (const metric of diskMetrics) {
          const diskIndex = parseInt(metric.split('.')[1]);
          if (disks[diskIndex]) {
            // Store disk usage percentage - use 'percent' not 'percentUsed'
            collectedMetrics[metric] = disks[diskIndex].percent || 0;
          }
        }
      }
      
      // Handle network metrics if enabled
      const networkMetrics = enabledMetrics.filter(m => m.startsWith('network.'));
      if (networkMetrics.length > 0) {
        const interfaces = await this.getNetworkInterfaces(session);
        for (const metric of networkMetrics) {
          // Parse metric format: network.interface.13 or network.interface.13.bytesIn
          const parts = metric.split('.');
          if (parts.length >= 3 && parts[1] === 'interface') {
            const ifName = parts[2]; // z.B. "en0" oder "en5"
            const metricType = parts[3]; // Optional: 'bytesIn', 'bytesOut', etc.
            
            // Find interface by name (nicht mehr by index!)
            const iface = interfaces.find(i => i.name === ifName);
            if (iface) {
              if (metricType) {
                // Specific metric requested
                collectedMetrics[metric] = iface[metricType] || 0;
              } else {
                // All metrics for this interface
                collectedMetrics[`${metric}.bytesIn`] = iface.bytesIn || 0;
                collectedMetrics[`${metric}.bytesOut`] = iface.bytesOut || 0;
                collectedMetrics[`${metric}.errors`] = (iface.errorsIn || 0) + (iface.errorsOut || 0);
                collectedMetrics[`${metric}.status`] = iface.status || 'unknown';
                // Add interface speed as a metric (in bits per second)
                collectedMetrics[`${metric}.speed`] = iface.speed || 0;
              }
            }
          }
        }
      }
      
      // Handle process metrics if enabled
      const processMetrics = enabledMetrics.filter(m => m.startsWith('process.'));
      if (processMetrics.length > 0) {
        const processInfo = await this.getProcessInfo(session);
        for (const metric of processMetrics) {
          const name = metric.split('.')[1]; // e.g., 'user', 'system', 'count'
          if (name === 'user') {
            // Return user process count
            collectedMetrics[metric] = processInfo.user || 0;
          } else if (name === 'system') {
            // Return system process count
            collectedMetrics[metric] = processInfo.system || 0;
          } else if (processInfo[name] !== undefined) {
            collectedMetrics[metric] = processInfo[name];
          }
        }
      }
      
      return collectedMetrics;
      
    } catch (error) {
      console.error('Error collecting metrics:', error);
      throw error;
    }
  }
  
  // Parse metric value based on type
  parseMetricValue(metricKey, value) {
    if (metricKey.includes('load')) {
      return this.parseLoadValue(value);
    }
    if (metricKey.includes('uptime')) {
      return this.parseUptime(value);
    }
    if (metricKey.includes('memory') || metricKey.includes('swap')) {
      // Memory values are in KB
      return parseInt(value) || 0;
    }
    if (metricKey.includes('process')) {
      return parseInt(value) || 0;
    }
    if (Buffer.isBuffer(value)) {
      return this.parseStringValue(value);
    }
    return value;
  }
  
  // Calculate CPU percentages using delta calculation
  async calculateCpuPercentages(session, hostId) {
    console.log(`[calculateCpuPercentages] Called for hostId: ${hostId}`);
    
    // Get CPU core count first (needed for Apple Silicon fallback)
    let cpuCores = 1;
    
    // Convert hostId to string for reliable comparison
    const hostIdStr = String(hostId);
    
    // For known hosts, use hardcoded values directly
    // Don't rely on SNMP for CPU core count as it's unreliable on macOS
    if (hostIdStr === '6' || hostIdStr.includes('host.docker.internal')) {
      cpuCores = 10; // MacbookPro - confirmed with sysctl -n hw.ncpu
      console.log(`Using known CPU core count: ${cpuCores} for MacbookPro (host ${hostId})`);
    } else if (hostIdStr === '8' || hostIdStr.includes('192.168.178.29')) {
      cpuCores = 8; // Macbook
      console.log(`Using known CPU core count: ${cpuCores} for Macbook (host ${hostId})`);
    } else {
      // Try to get processor count via SNMP for other hosts
      try {
        const processorTable = await this.walkOid(session, '1.3.6.1.2.1.25.3.3.1.2');
        const detectedCores = Object.keys(processorTable).length;
        if (detectedCores > 0) {
          cpuCores = detectedCores;
          console.log(`Detected ${cpuCores} CPU cores via SNMP for host ${hostId}`);
        } else {
          cpuCores = 4; // Default fallback
          console.log(`No CPU cores detected via SNMP, using default: ${cpuCores} for host ${hostId}`);
        }
      } catch (e) {
        cpuCores = 4; // Default fallback
        console.log(`SNMP error detecting CPU cores, using default: ${cpuCores} for host ${hostId}`);
      }
    }
    
    const cpuOids = [
      this.oidDefinitions.cpu.ssCpuRawUser,
      this.oidDefinitions.cpu.ssCpuRawSystem,
      this.oidDefinitions.cpu.ssCpuRawIdle,
      this.oidDefinitions.cpu.ssCpuRawNice,
      this.oidDefinitions.cpu.ssCpuRawWait
    ];
    
    const results = await this.getOidValues(session, cpuOids);
    
    const currentUser = parseInt(results[this.oidDefinitions.cpu.ssCpuRawUser]) || 0;
    const currentSystem = parseInt(results[this.oidDefinitions.cpu.ssCpuRawSystem]) || 0;
    const currentIdle = parseInt(results[this.oidDefinitions.cpu.ssCpuRawIdle]) || 0;
    const currentNice = parseInt(results[this.oidDefinitions.cpu.ssCpuRawNice]) || 0;
    const currentWait = parseInt(results[this.oidDefinitions.cpu.ssCpuRawWait]) || 0;
    
    console.log(`[calculateCpuPercentages] Current CPU values for host ${hostId}: user=${currentUser}, system=${currentSystem}, idle=${currentIdle}, nice=${currentNice}, wait=${currentWait}`);
    
    // Check if we're on Apple Silicon (all counters are 0)
    const isAppleSilicon = currentUser === 0 && currentSystem === 0 && currentIdle === 0;
    
    if (isAppleSilicon) {
      console.log(`[calculateCpuPercentages] Apple Silicon detected for host ${hostId}, using load average fallback`);
      
      // Fallback for Apple Silicon: Use load average as proxy
      const loadOids = [
        this.oidDefinitions.cpu.load1min,
        this.oidDefinitions.cpu.load5min,
        this.oidDefinitions.cpu.load15min
      ];
      
      const loadResults = await this.getOidValues(session, loadOids);
      const load1 = parseFloat(this.parseStringValue(loadResults[this.oidDefinitions.cpu.load1min]) || '0');
      
      // Use the known CPU core count
      const utilizationRatio = Math.min(load1 / cpuCores, 1.0);
      const totalUtilization = utilizationRatio * 100;
      
      // Estimate distribution (rough approximation)
      // Typically system usage is about 20-30% of total on macOS
      const systemRatio = 0.25;
      const userRatio = 0.75;
      
      const percentUser = Math.round(totalUtilization * userRatio * 10) / 10;
      const percentSystem = Math.round(totalUtilization * systemRatio * 10) / 10;
      const percentIdle = Math.round((100 - totalUtilization) * 10) / 10;
      
      console.log(`[calculateCpuPercentages] Apple Silicon fallback returning:`, {
        user: percentUser,
        system: percentSystem,
        idle: percentIdle
      });
      
      return {
        user: percentUser,
        system: percentSystem,
        idle: percentIdle
      };
    }
    
    const currentTotal = currentUser + currentSystem + currentIdle + currentNice + currentWait;
    
    // Get previous values
    const previous = this.previousCpuValues.get(hostId);
    console.log(`[calculateCpuPercentages] Previous values for host ${hostId}:`, previous ? 'EXISTS' : 'NULL');
    
    if (previous) {
      const deltaUser = currentUser - previous.user;
      const deltaSystem = currentSystem - previous.system;
      const deltaIdle = currentIdle - previous.idle;
      const deltaNice = currentNice - previous.nice;
      const deltaWait = currentWait - previous.wait;
      let deltaTotal = deltaUser + deltaSystem + deltaIdle + deltaNice + deltaWait;
      
      // CPU ticks are accumulated across all cores
      // To get accurate percentages, we divide each component by the number of cores
      
      if (deltaTotal > 0) {
        // Normalize deltas by dividing by CPU cores
        const normalizedUser = deltaUser / cpuCores;
        const normalizedSystem = deltaSystem / cpuCores;
        const normalizedIdle = deltaIdle / cpuCores;
        const normalizedNice = deltaNice / cpuCores;
        const normalizedWait = deltaWait / cpuCores;
        const normalizedTotal = normalizedUser + normalizedSystem + normalizedIdle + normalizedNice + normalizedWait;
        
        // Calculate percentages from normalized values
        const percentUser = Math.round((normalizedUser / normalizedTotal) * 100 * 100) / 100;
        const percentSystem = Math.round((normalizedSystem / normalizedTotal) * 100 * 100) / 100;
        const percentIdle = Math.round((normalizedIdle / normalizedTotal) * 100 * 100) / 100;
        
        // Store current values for next calculation
        this.previousCpuValues.set(hostId, {
          user: currentUser,
          system: currentSystem,
          idle: currentIdle,
          nice: currentNice,
          wait: currentWait,
          timestamp: Date.now()
        });
        
        console.log(`[calculateCpuPercentages] Returning CPU percentages for host ${hostId}:`, {
          user: percentUser,
          system: percentSystem,
          idle: percentIdle
        });
        
        return {
          user: percentUser,
          system: percentSystem,
          idle: percentIdle
        };
      }
    }
    
    // Store initial values
    this.previousCpuValues.set(hostId, {
      user: currentUser,
      system: currentSystem,
      idle: currentIdle,
      nice: currentNice,
      wait: currentWait,
      timestamp: Date.now()
    });
    
    console.log(`[calculateCpuPercentages] No previous values for host ${hostId}, storing initial values`);
    return null; // No delta available yet
  }
  
  // Get memory metrics for collectMetrics
  async getMemoryMetrics(session) {
    const memoryOids = [
      this.oidDefinitions.memory.memTotalReal,
      this.oidDefinitions.memory.memAvailReal,
      this.oidDefinitions.memory.memBuffer,
      this.oidDefinitions.memory.memCached,
      this.oidDefinitions.memory.memShared,
      this.oidDefinitions.memory.memTotalSwap,
      this.oidDefinitions.memory.memAvailSwap
    ];
    
    const data = await this.getOidValues(session, memoryOids);
    const memoryInfo = this.parseMemoryInfo(data);
    
    return {
      total: memoryInfo.totalRam,
      available: memoryInfo.availableRam,
      used: memoryInfo.usedRam,
      percentUsed: memoryInfo.percentRam,
      buffer: memoryInfo.buffer,
      cached: memoryInfo.cache,
      shared: memoryInfo.shared,
      swapTotal: memoryInfo.totalSwap,
      swapUsed: memoryInfo.usedSwap,
      swapPercent: memoryInfo.percentSwap
    };
  }

  // Get disk metrics for collectMetrics
  async getDiskMetrics(session) {
    return await this.walkDiskTable(session);
  }

  // Get network interfaces for collectMetrics  
  async getNetworkInterfaces(session) {
    const interfaces = await this.walkNetworkInterfaces(session);
    // Map to the expected structure for metrics collection
    return interfaces.map(iface => ({
      index: iface.index,
      name: iface.name,
      status: iface.status,
      bytesIn: iface.statistics.bytesReceived,
      bytesOut: iface.statistics.bytesSent,
      errorsIn: iface.statistics.errorsIn,
      errorsOut: iface.statistics.errorsOut,
      speed: iface.speed,
      // Also include original structure for compatibility
      statistics: iface.statistics
    }));
  }
}

module.exports = SNMPMonitor;