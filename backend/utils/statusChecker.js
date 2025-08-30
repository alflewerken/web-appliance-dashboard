// Enhanced Service Status Checker with Host Availability Detection
// This module checks host availability before attempting service status checks

const pool = require('./database');
const { executeSSHCommand } = require('./ssh');
const { broadcast } = require('../routes/sse');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { decrypt } = require('./encryption');

class ServiceStatusChecker {
  constructor() {
    this.interval = null;
    this.checkInterval = 30000; // Default 30 seconds
    this.isRunning = false;
    this.hostAvailability = new Map(); // Track host availability
    this.lastHostCheck = new Map(); // Track when we last checked each host
    this.hostCheckInterval = 300000; // Check host availability every 5 minutes
    
    // Host ping monitoring
    this.hostPingInterval = null;
    this.hostPingCheckInterval = 30000; // Check hosts every 30 seconds
    this.hostResponseTimes = new Map(); // Track response times for hosts
  }

  async start() {
    if (this.isRunning) {

      return;
    }

    this.isRunning = true;

    // Load interval from settings
    try {
      const [settings] = await pool.execute(
        'SELECT setting_value FROM user_settings WHERE setting_key = ? OR setting_key = ?',
        ['service_status_refresh_interval', 'service_poll_interval']
      );

      if (settings.length > 0) {
        this.checkInterval = parseInt(settings[0].setting_value) * 1000;
        // Use the same interval for host ping checks
        this.hostPingCheckInterval = this.checkInterval;

      }
    } catch (error) {
      console.error('Error loading status check interval:', error);
    }

    // Initial status check
    await this.checkAllServices();
    
    // Initial host ping check
    await this.checkAllHostsPing();

    // Set up periodic checks for services
    this.interval = setInterval(async () => {
      try {
        await this.checkAllServices();
      } catch (error) {
        console.error('Error in periodic status check:', error);
      }
    }, this.checkInterval);
    
    // Set up periodic checks for host pings
    this.hostPingInterval = setInterval(async () => {
      try {
        await this.checkAllHostsPing();
      } catch (error) {
        console.error('Error in periodic host ping check:', error);
      }
    }, this.hostPingCheckInterval);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.hostPingInterval) {
      clearInterval(this.hostPingInterval);
      this.hostPingInterval = null;
    }
    this.isRunning = false;

  }

  /**
   * Get SSH private key from database and decrypt it
   * @param {number} hostId - Host ID
   * @returns {Promise<{key: string, keyPath: string}|null>} Decrypted key and temp file path
   */
  async getSSHKeyFromDatabase(hostId) {
    try {
      // Get host info and SSH key name
      const [hosts] = await pool.execute(
        'SELECT id, name, hostname, username, private_key, ssh_key_name, created_by FROM hosts WHERE id = ?',
        [hostId]
      );

      if (!hosts || hosts.length === 0) {

        return null;
      }

      const host = hosts[0];
      
      // First check if private_key exists directly in hosts table (legacy)
      if (host.private_key) {

        // Check if key is encrypted or plain text
        let decryptedKey;
        if (host.private_key.startsWith('-----BEGIN')) {
          // Key is already in plain text

          decryptedKey = host.private_key;
        } else {
          // Try to decrypt the key

          decryptedKey = decrypt(host.private_key);
          
          if (!decryptedKey) {
            console.error(`❌ Failed to decrypt private key for host ${host.name}`);
            return null;
          }
        }

        // Create temporary file for SSH key
        const tempDir = '/tmp/ssh-keys';
        await fs.mkdir(tempDir, { recursive: true, mode: 0o700 });
        
        const tempKeyPath = path.join(tempDir, `temp_key_${hostId}_${Date.now()}`);
        await fs.writeFile(tempKeyPath, decryptedKey, { mode: 0o600 });

        return {
          key: decryptedKey,
          keyPath: tempKeyPath,
          cleanup: async () => {
            try {
              await fs.unlink(tempKeyPath);
            } catch (error) {

            }
          }
        };
      }
      
      // If no direct private_key, check ssh_keys table using ssh_key_name
      if (host.ssh_key_name) {

        // Get the SSH key from ssh_keys table
        // Priority: 1. User-specific key, 2. Any key with that name
        const [sshKeys] = await pool.execute(
          `SELECT id, key_name, private_key 
           FROM ssh_keys 
           WHERE key_name = ? 
           ORDER BY (created_by = ?) DESC, id DESC
           LIMIT 1`,
          [host.ssh_key_name, host.created_by || 1]
        );
        
        if (sshKeys && sshKeys.length > 0) {
          const sshKey = sshKeys[0];

          // Check if key is encrypted or plain text
          let decryptedKey;
          if (sshKey.private_key.startsWith('-----BEGIN')) {
            // Key is already in plain text

            decryptedKey = sshKey.private_key;
          } else {
            // Try to decrypt the key

            decryptedKey = decrypt(sshKey.private_key);
            
            if (!decryptedKey) {
              console.error(`❌ Failed to decrypt SSH key '${sshKey.key_name}' from ssh_keys table`);
              return null;
            }
          }
          
          // Create temporary file for SSH key
          const tempDir = '/tmp/ssh-keys';
          await fs.mkdir(tempDir, { recursive: true, mode: 0o700 });
          
          const tempKeyPath = path.join(tempDir, `temp_key_${hostId}_${Date.now()}`);
          await fs.writeFile(tempKeyPath, decryptedKey, { mode: 0o600 });

          return {
            key: decryptedKey,
            keyPath: tempKeyPath,
            cleanup: async () => {
              try {
                await fs.unlink(tempKeyPath);
              } catch (error) {

              }
            }
          };
        } else {

        }
      }
      
      // Fallback: Check if key exists in filesystem (backward compatibility)
      if (host.ssh_key_name) {
        const fsKeyPath = `/root/.ssh/id_rsa_${host.ssh_key_name}`;
        try {
          await fs.access(fsKeyPath);

          return {
            key: null,
            keyPath: fsKeyPath,
            cleanup: async () => {} // No cleanup needed for filesystem keys
          };
        } catch (error) {

        }
      }

      return null;
    } catch (error) {
      console.error(`❌ Error getting SSH key from database: ${error.message}`);
      return null;
    }
  }

  async checkHostAvailability(hostname, host, username, port = 22, hostId = null) {
    const hostKey = `${username}@${host}:${port}`;
    const now = Date.now();

    // Check if we've recently checked this host
    const lastCheck = this.lastHostCheck.get(hostKey) || 0;
    if (now - lastCheck < this.hostCheckInterval) {
      // Use cached availability
      return this.hostAvailability.get(hostKey) !== false;
    }

    this.lastHostCheck.set(hostKey, now);

    try {

      // Get SSH key from database
      if (!hostId) {

        this.hostAvailability.set(hostKey, false);
        return false;
      }

      const sshKeyInfo = await this.getSSHKeyFromDatabase(hostId);
      if (!sshKeyInfo) {

        this.hostAvailability.set(hostKey, false);
        return false;
      }

      try {
        const testCommand = `ssh -i ${sshKeyInfo.keyPath} -o BatchMode=yes -o ConnectTimeout=3 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${username}@${host} -p ${port} "echo OK" 2>&1`;

        const result = await execAsync(testCommand, { timeout: 5000 });

        if (result.stdout.includes('OK')) {

          this.hostAvailability.set(hostKey, true);
          return true;
        } else {

          this.hostAvailability.set(hostKey, false);
          return false;
        }
      } finally {
        // Cleanup temporary SSH key file
        if (sshKeyInfo.cleanup) {
          await sshKeyInfo.cleanup();
        }
      }
    } catch (error) {
      // Check if it's an authentication error
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('too many authentication failures') || 
          errorMsg.includes('permission denied')) {

        // Return true to allow status check with potentially different command
        this.hostAvailability.set(hostKey, true);
        return true;
      } else {

        this.hostAvailability.set(hostKey, false);
        return false;
      }
    }
  }

  async checkAllServices() {
    try {
      // Get services with their SSH connection info from hosts table
      const [services] = await pool.execute(
        `SELECT a.id, a.name, a.status_command, a.service_status, a.ssh_connection,
                h.id as host_id, h.hostname, h.username, h.port, h.ssh_key_name, h.private_key
         FROM appliances a
         LEFT JOIN hosts h ON (
           a.ssh_connection = CONCAT(h.username, '@', h.hostname, ':', h.port) OR
           a.ssh_connection = CONCAT(h.username, '@', h.hostname)
         )
         WHERE a.status_command IS NOT NULL AND a.status_command != ""`
      );

      if (services.length === 0) {
        return;
      }

      // Group services by host for efficient checking
      const servicesByHost = new Map();

      for (const service of services) {
        let hostInfo = null;
        
        // First try to use SSH connection from appliance settings
        if (service.ssh_connection) {
          if (service.hostname) {
            // We have host info from the JOIN
            hostInfo = {
              hostId: service.host_id,
              hostname: service.hostname,
              host: service.hostname,
              username: service.username,
              port: service.port || 22,
              sshKeyName: service.ssh_key_name
            };
          } else {
            // Parse SSH connection string (fallback - no host_id available)
            const sshParts = service.ssh_connection.match(/^(?:([^@]+)@)?([^:]+)(?::(\d+))?$/);
            if (sshParts) {
              hostInfo = {
                hostId: null, // No host_id in fallback
                hostname: sshParts[2],
                host: sshParts[2],
                username: sshParts[1] || 'root',
                port: parseInt(sshParts[3] || '22'),
                sshKeyName: 'dashboard'
              };
            }
          }
        }
        
        // Fallback: extract from status_command if no SSH connection configured
        if (!hostInfo) {
          hostInfo = this.extractHostInfo(service.status_command);
        }
        
        if (hostInfo) {
          const hostKey = `${hostInfo.username}@${hostInfo.host}:${hostInfo.port}`;
          if (!servicesByHost.has(hostKey)) {
            servicesByHost.set(hostKey, { hostInfo, services: [] });
          }
          servicesByHost.get(hostKey).services.push({
            ...service,
            hostInfo // Store host info with service
          });
        } else {
          // Local command or unrecognized format
          servicesByHost.set('local', {
            hostInfo: null,
            services: [
              ...(servicesByHost.get('local')?.services || []),
              service,
            ],
          });
        }
      }

      // Check each host and its services
      for (const [hostKey, { hostInfo, services }] of servicesByHost) {
        if (hostKey === 'local') {
          // Check local services directly
          for (const service of services) {
            await this.checkServiceStatus(service);
          }
        } else {
          // First check if host is available
          const isAvailable = await this.checkHostAvailability(
            hostInfo.hostname || hostInfo.host,
            hostInfo.host,
            hostInfo.username,
            hostInfo.port,
            hostInfo.hostId  // Pass host_id instead of sshKeyName
          );

          if (isAvailable) {
            // Host is available, check services
            for (const service of services) {
              await this.checkServiceStatus(service);
            }
          } else {
            // Host is unavailable, mark all its services as offline
            for (const service of services) {
              if (service.service_status !== 'offline') {
                await this.updateServiceStatus(
                  service.id,
                  service.name,
                  'offline',
                  'Host unreachable'
                );
              }
            }
          }
        }

        // Small delay between hosts to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Error in checkAllServices:', error);
    }
  }

  extractHostInfo(command) {
    // Extract SSH connection details from command
    // Supports formats: "ssh user@host command", "ssh -p port user@host command", etc.
    const sshMatch = command.match(
      /ssh\s+(?:-\w\s+\S+\s+)*?(\w+)@([\w.-]+)(?:\s+-p\s+(\d+))?\s+(.+)/
    );

    if (sshMatch) {
      const [, username, host, port = '22', remoteCommand] = sshMatch;

      // Try to get hostname from ssh config
      const hostnameMatch = command.match(/ssh\s+(\w+)\s+/);
      const hostname = hostnameMatch ? hostnameMatch[1] : host;

      return {
        hostname,
        host,
        username,
        port: parseInt(port),
        command: remoteCommand,
      };
    }

    return null;
  }

  async checkServiceStatus(service) {
    try {

      let newStatus = 'unknown';
      let output = '';
      let errorOutput = '';
      let sshKeyInfo = null;

      try {
        let commandToExecute = service.status_command;
        
        // If we have SSH connection info, build the proper SSH command
        if (service.hostInfo && service.ssh_connection) {
          const { username, host, port, hostId } = service.hostInfo;
          
          // Extract just the command part (remove any ssh prefix if present)
          let baseCommand = service.status_command;
          const sshRegex = /^ssh\s+.*?\s+['"]?(.+?)['"]?$/;
          const match = baseCommand.match(sshRegex);
          if (match) {
            baseCommand = match[1];
          }
          
          // Get SSH key from database
          if (!hostId) {

            newStatus = 'error';
            errorOutput = 'No host ID configured';
          } else {
            sshKeyInfo = await this.getSSHKeyFromDatabase(hostId);
            
            if (!sshKeyInfo) {

              newStatus = 'error';
              errorOutput = 'No SSH key available for host';
            } else {
              commandToExecute = `ssh -i ${sshKeyInfo.keyPath} -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${username}@${host} -p ${port} "${baseCommand}"`;

            }
          }
        }
        
        // Execute the status command only if we have a valid command and no error
        if (newStatus !== 'error' && commandToExecute) {
          const result = await executeSSHCommand(commandToExecute, 15000);
          output = result.stdout || '';
          errorOutput = result.stderr || '';

          // Parse the output to determine status
          const outputLower = output.toLowerCase();

          if (
            outputLower.includes('running') ||
            outputLower.includes('active (running)') ||
            outputLower.includes('up ') ||
            outputLower.includes('status: running')
          ) {
            newStatus = 'running';
          } else if (
            outputLower.includes('stopped') ||
            outputLower.includes('inactive') ||
            outputLower.includes('dead') ||
            outputLower.includes('status: stopped')
          ) {
            newStatus = 'stopped';
          } else {
            // If we can't determine from output, assume running if command succeeded
            newStatus = 'running';
          }
        }
      } catch (execError) {
        console.error(
          `❌ Status command failed for "${service.name}": ${execError.message}`
        );

        // Determine if it's a connection error or command error
        const errorMsg = execError.message.toLowerCase();
        if (
          errorMsg.includes('connection refused') ||
          errorMsg.includes('connection timed out') ||
          errorMsg.includes('no route to host') ||
          errorMsg.includes('host is down') ||
          errorMsg.includes('could not resolve hostname') ||
          errorMsg.includes('too many authentication failures')
        ) {
          newStatus = 'error'; // Änderung: SSH-Auth-Fehler als 'error' statt 'offline'
          errorOutput = 'SSH authentication failed';
        } else if (errorMsg.includes('permission denied')) {
          newStatus = 'error';
          errorOutput = 'Permission denied';
        } else {
          newStatus = 'stopped';
          errorOutput = execError.message.split('\n')[0]; // First line of error
        }
      } finally {
        // Cleanup temporary SSH key file
        if (sshKeyInfo && sshKeyInfo.cleanup) {
          await sshKeyInfo.cleanup();
        }
      }

      // Update if status changed
      if (newStatus !== service.service_status) {
        await this.updateServiceStatus(
          service.id,
          service.name,
          newStatus,
          errorOutput
        );
      } else {
        // Update last check time even if status didn't change
        await pool.execute(
          'UPDATE appliances SET last_status_check = NOW() WHERE id = ?',
          [service.id]
        );
      }
    } catch (error) {
      console.error(`Error checking status for "${service.name}":`, error);
    }
  }

  async updateServiceStatus(serviceId, serviceName, status, error = null) {
    try {
      const [currentStatus] = await pool.execute(
        'SELECT service_status FROM appliances WHERE id = ?',
        [serviceId]
      );

      const previousStatus = currentStatus[0]?.service_status;

      await pool.execute(
        'UPDATE appliances SET service_status = ?, last_status_check = NOW() WHERE id = ?',
        [status, serviceId]
      );

      // Broadcast status change
      broadcast('service_status_changed', {
        id: serviceId,
        name: serviceName,
        status,
        previousStatus,
        error,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating service status:', error);
    }
  }

  // Force check all services immediately
  async forceCheck() {

    await this.checkAllServices();
  }

  // Clear host availability cache
  clearHostCache() {
    this.hostAvailability.clear();
    this.lastHostCheck.clear();

  }
  
  /**
   * Check all hosts ping status
   */
  async checkAllHostsPing() {
    try {
      const [hosts] = await pool.execute(
        'SELECT id, name, hostname FROM hosts'
      );

      if (!hosts || hosts.length === 0) {
        return;
      }

      // Check all hosts in parallel with limited concurrency
      const maxConcurrent = 10;
      for (let i = 0; i < hosts.length; i += maxConcurrent) {
        const batch = hosts.slice(i, i + maxConcurrent);
        await Promise.all(
          batch.map(host => this.checkHostPing(host))
        );
      }
    } catch (error) {
      console.error('Error checking all hosts ping:', error);
    }
  }

  /**
   * Check ping status for a single host
   * @param {Object} host - Host object with id, name, hostname
   */
  async checkHostPing(host) {
    try {
      const startTime = Date.now();
      
      // Use system ping command
      const pingCommand = process.platform === 'win32' 
        ? `ping -n 1 -w 1000 ${host.hostname}`
        : `ping -c 1 -W 1 ${host.hostname}`;
      
      try {
        const result = await execAsync(pingCommand, { timeout: 5000 });
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Parse ping output to get actual response time
        let actualResponseTime = responseTime;
        
        if (process.platform !== 'win32') {
          // Linux/Mac: Extract time from ping output
          const timeMatch = result.stdout.match(/time=(\d+\.?\d*)/);
          if (timeMatch) {
            actualResponseTime = parseFloat(timeMatch[1]);
          }
        } else {
          // Windows: Extract time from ping output
          const timeMatch = result.stdout.match(/time[<=](\d+)ms/);
          if (timeMatch) {
            actualResponseTime = parseInt(timeMatch[1]);
          }
        }
        
        // Store response time
        this.hostResponseTimes.set(host.id, actualResponseTime);
        
        // Determine status based on response time
        let status = 'online';
        let statusColor = 'green';
        
        if (actualResponseTime < 50) {
          status = 'excellent';
          statusColor = 'green';
        } else if (actualResponseTime < 150) {
          status = 'good';
          statusColor = 'yellow';
        } else if (actualResponseTime < 500) {
          status = 'fair';
          statusColor = 'orange';
        } else {
          status = 'poor';
          statusColor = 'red';
        }
        
        // Update database
        await pool.execute(
          'UPDATE hosts SET ping_status = ?, ping_response_time = ?, last_ping_check = NOW() WHERE id = ?',
          [status, actualResponseTime, host.id]
        );
        
        // Broadcast ping status via SSE
        broadcast('host_ping_status', {
          id: host.id,
          name: host.name,
          hostname: host.hostname,
          status,
          statusColor,
          responseTime: actualResponseTime,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        // Ping failed - host is offline
        this.hostResponseTimes.set(host.id, -1);
        
        await pool.execute(
          'UPDATE hosts SET ping_status = ?, ping_response_time = ?, last_ping_check = NOW() WHERE id = ?',
          ['offline', null, host.id]
        );
        
        // Broadcast offline status
        broadcast('host_ping_status', {
          id: host.id,
          name: host.name,
          hostname: host.hostname,
          status: 'offline',
          statusColor: 'red',
          responseTime: -1,
          timestamp: new Date().toISOString()
        });

      }
      
    } catch (error) {
      console.error(`Error checking ping for host "${host.name}":`, error);
    }
  }
  
  /**
   * Force check all hosts ping immediately
   */
  async forceCheckHostsPing() {

    await this.checkAllHostsPing();
  }

  /**
   * Reload settings and restart intervals if needed
   */
  async reloadSettings() {
    try {
      const [settings] = await pool.execute(
        'SELECT setting_value FROM user_settings WHERE setting_key = ? OR setting_key = ?',
        ['service_status_refresh_interval', 'service_poll_interval']
      );

      if (settings.length > 0) {
        const newInterval = parseInt(settings[0].setting_value) * 1000;
        
        // Check if interval has changed
        if (newInterval !== this.checkInterval) {

          // Store running state
          const wasRunning = this.isRunning;
          
          // Stop current intervals
          if (wasRunning) {
            this.stop();
          }
          
          // Update intervals
          this.checkInterval = newInterval;
          this.hostPingCheckInterval = newInterval;
          
          // Restart with new interval if it was running
          if (wasRunning) {
            await this.start();
          }
        }
      }
    } catch (error) {
      console.error('Error reloading settings:', error);
    }
  }
}

// Export singleton instance
module.exports = new ServiceStatusChecker();
