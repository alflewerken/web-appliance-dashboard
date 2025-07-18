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
        'SELECT setting_value FROM user_settings WHERE setting_key = ?',
        ['service_status_refresh_interval']
      );

      if (settings.length > 0) {
        this.checkInterval = parseInt(settings[0].setting_value) * 1000;
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

  async checkHostAvailability(hostname, host, username, port = 22) {
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
      const testCommand = `ssh -o BatchMode=yes -o ConnectTimeout=3 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ${username}@${host} -p ${port} "echo OK" 2>&1`;

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
      console.log(
        `❌ Host ${hostname} is unavailable: ${error.message.split('\n')[0]}`
      );
      this.hostAvailability.set(hostKey, false);
      return false;
    }
  }

  async checkAllServices() {
    try {
      const [services] = await pool.execute(
        'SELECT id, name, status_command, service_status FROM appliances WHERE status_command IS NOT NULL AND status_command != ""'
      );

      if (services.length === 0) {
        return;
      }

      console.log(`\n🔄 Checking ${services.length} services...`);

      // Group services by host for efficient checking
      const servicesByHost = new Map();

      for (const service of services) {
        const hostInfo = this.extractHostInfo(service.status_command);
        if (hostInfo) {
          const hostKey = `${hostInfo.username}@${hostInfo.host}:${hostInfo.port}`;
          if (!servicesByHost.has(hostKey)) {
            servicesByHost.set(hostKey, { hostInfo, services: [] });
          }
          servicesByHost.get(hostKey).services.push(service);
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
            hostInfo.port
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
        // Execute the status command
        const result = await executeSSHCommand(service.status_command, 15000);
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
          errorMsg.includes('could not resolve hostname')
        ) {
          newStatus = 'offline';
          errorOutput = 'Host unreachable';
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
