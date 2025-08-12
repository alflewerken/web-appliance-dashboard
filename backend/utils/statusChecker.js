// Enhanced Service Status Checker with Host Availability Detection
// This module checks host availability before attempting service status checks

const pool = require('./database');
const { executeSSHCommand } = require('./ssh');
const { broadcast } = require('../routes/sse');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class ServiceStatusChecker {
  constructor() {
    this.interval = null;
    this.checkInterval = 30000; // Default 30 seconds
    this.isRunning = false;
    this.hostAvailability = new Map(); // Track host availability
    this.lastHostCheck = new Map(); // Track when we last checked each host
    this.hostCheckInterval = 300000; // Check host availability every 5 minutes
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️  Status checker is already running');
      return;
    }

    this.isRunning = true;
    console.log('✅ Enhanced status checker started');

    // Load interval from settings
    try {
      const [settings] = await pool.execute(
        'SELECT setting_value FROM user_settings WHERE setting_key = ? OR setting_key = ?',
        ['service_status_refresh_interval', 'service_poll_interval']
      );

      if (settings.length > 0) {
        this.checkInterval = parseInt(settings[0].setting_value) * 1000;
        console.log(`📊 Service check interval set to ${settings[0].setting_value} seconds`);
      }
    } catch (error) {
      console.error('Error loading status check interval:', error);
    }

    // Initial status check
    await this.checkAllServices();

    // Set up periodic checks
    this.interval = setInterval(async () => {
      try {
        await this.checkAllServices();
      } catch (error) {
        console.error('Error in periodic status check:', error);
      }
    }, this.checkInterval);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('🛑 Status checker stopped');
  }

  async checkHostAvailability(hostname, host, username, port = 22, sshKeyName = null) {
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
      console.log(`🔍 Checking host availability: ${hostname} (${hostKey})`);

      // Try a simple SSH connection test with very short timeout
      const keyPath = sshKeyName ? `-i ~/.ssh/id_rsa_${sshKeyName}` : '-i ~/.ssh/id_rsa_dashboard';
      const testCommand = `ssh ${keyPath} -o BatchMode=yes -o ConnectTimeout=3 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${username}@${host} -p ${port} "echo OK" 2>&1`;

      const result = await execAsync(testCommand, { timeout: 5000 });

      if (result.stdout.includes('OK')) {
        console.log(`✅ Host ${hostname} is available`);
        this.hostAvailability.set(hostKey, true);
        return true;
      } else {
        console.log(`❌ Host ${hostname} is not responding correctly`);
        this.hostAvailability.set(hostKey, false);
        return false;
      }
    } catch (error) {
      // Check if it's an authentication error
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('too many authentication failures') || 
          errorMsg.includes('permission denied')) {
        console.log(
          `⚠️  Host ${hostname} has authentication issues: ${error.message.split('\n')[0]}`
        );
        // Return true to allow status check with potentially different command
        this.hostAvailability.set(hostKey, true);
        return true;
      } else {
        console.log(
          `❌ Host ${hostname} is unavailable: ${error.message.split('\n')[0]}`
        );
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
                h.hostname, h.username, h.port, h.ssh_key_name
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

      console.log(`\n🔄 Checking ${services.length} services...`);

      // Group services by host for efficient checking
      const servicesByHost = new Map();

      for (const service of services) {
        let hostInfo = null;
        
        // First try to use SSH connection from appliance settings
        if (service.ssh_connection) {
          if (service.hostname) {
            // We have host info from the JOIN
            hostInfo = {
              hostname: service.hostname,
              host: service.hostname,
              username: service.username,
              port: service.port || 22,
              sshKeyName: service.ssh_key_name
            };
          } else {
            // Parse SSH connection string
            const sshParts = service.ssh_connection.match(/^(?:([^@]+)@)?([^:]+)(?::(\d+))?$/);
            if (sshParts) {
              hostInfo = {
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
            hostInfo.sshKeyName
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
      console.log(
        `🔍 Checking status for "${service.name}" (current: ${service.service_status})`
      );

      let newStatus = 'unknown';
      let output = '';
      let errorOutput = '';

      try {
        let commandToExecute = service.status_command;
        
        // If we have SSH connection info, build the proper SSH command
        if (service.hostInfo && service.ssh_connection) {
          const { username, host, port, sshKeyName } = service.hostInfo;
          
          // Extract just the command part (remove any ssh prefix if present)
          let baseCommand = service.status_command;
          const sshRegex = /^ssh\s+.*?\s+['"]?(.+?)['"]?$/;
          const match = baseCommand.match(sshRegex);
          if (match) {
            baseCommand = match[1];
          }
          
          // Build proper SSH command with the configured connection
          const keyPath = sshKeyName ? `-i ~/.ssh/id_rsa_${sshKeyName}` : '-i ~/.ssh/id_rsa_dashboard';
          commandToExecute = `ssh ${keyPath} -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${username}@${host} -p ${port} "${baseCommand}"`;
          
          console.log(`📡 Using SSH connection from settings: ${username}@${host}:${port}`);
        }
        
        // Execute the status command
        const result = await executeSSHCommand(commandToExecute, 15000);
        output = result.stdout || '';
        errorOutput = result.stderr || '';

        console.log(
          `📋 Command output for "${service.name}": ${output.substring(0, 100).trim()}`
        );

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

      console.log(
        `📊 Updated "${serviceName}": ${previousStatus} → ${status}${error ? ` (${error})` : ''}`
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
    console.log('🔄 Force checking all services...');
    await this.checkAllServices();
  }

  // Clear host availability cache
  clearHostCache() {
    this.hostAvailability.clear();
    this.lastHostCheck.clear();
    console.log('🗑️  Host availability cache cleared');
  }
}

// Export singleton instance
module.exports = new ServiceStatusChecker();
