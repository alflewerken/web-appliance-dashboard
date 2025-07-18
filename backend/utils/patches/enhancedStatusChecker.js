// Enhanced Status Checker with Host Availability Detection
// This patch improves the status checker to handle unreachable hosts gracefully

const pool = require('../database');
const { executeSSHCommand } = require('./ssh');
const { broadcast } = require('../routes/sse');

class EnhancedServiceStatusChecker {
  constructor() {
    this.interval = null;
    this.checkInterval = 30000; // Default 30 seconds
    this.isRunning = false;
    this.unreachableHosts = new Set(); // Track unreachable hosts
    this.hostCheckInterval = 300000; // Recheck hosts every 5 minutes
    this.lastHostCheck = 0;
  }

  async checkHostAvailability() {
    const now = Date.now();
    if (now - this.lastHostCheck < this.hostCheckInterval) {
      return; // Don't check too frequently
    }

    this.lastHostCheck = now;
    console.log('🔍 Checking host availability...');

    try {
      const [hosts] = await pool.execute(
        'SELECT DISTINCT hostname, host, username, port FROM ssh_hosts WHERE is_active = 1'
      );

      for (const host of hosts) {
        try {
          // Simple connectivity test
          const testCommand = `ssh -o ConnectTimeout=3 -o BatchMode=yes ${host.username}@${host.host} -p ${host.port} echo "OK" 2>&1`;
          const { execSync } = require('child_process');

          try {
            execSync(testCommand, { timeout: 5000 });
            if (this.unreachableHosts.has(host.hostname)) {
              console.log(`✅ Host ${host.hostname} is now reachable`);
              this.unreachableHosts.delete(host.hostname);
            }
          } catch (error) {
            if (!this.unreachableHosts.has(host.hostname)) {
              console.log(`❌ Host ${host.hostname} is unreachable`);
              this.unreachableHosts.add(host.hostname);
            }
          }
        } catch (error) {
          // Ignore errors
        }
      }
    } catch (error) {
      console.error('Error checking host availability:', error);
    }
  }

  async checkServiceStatus(service) {
    try {
      // Extract hostname from SSH command if present
      let hostname = null;
      const sshMatch = service.status_command?.match(/ssh\s+(\w+)@(\w+)/);
      if (sshMatch) {
        hostname = sshMatch[2];
      }

      // Skip if host is known to be unreachable
      if (hostname && this.unreachableHosts.has(hostname)) {
        if (service.service_status !== 'offline') {
          await this.updateServiceStatus(
            service.id,
            'offline',
            'Host unreachable'
          );
          console.log(
            `⏭️  Skipping "${service.name}" - host ${hostname} is unreachable`
          );
        }
        return;
      }

      let newStatus = service.service_status || 'unknown';
      let output = '';
      let errorOutput = '';

      console.log(
        `🔍 Checking status for "${service.name}" (current: ${service.service_status})`
      );

      try {
        // Execute the status command with shorter timeout
        const result = await executeSSHCommand(service.status_command, 10000);
        output = result.stdout || '';
        errorOutput = result.stderr || '';

        console.log(
          `📋 Command output for "${service.name}": ${output.substring(0, 100)}...`
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

        // Check if it's a connection error
        if (
          execError.message.includes('Connection refused') ||
          execError.message.includes('Connection timed out') ||
          execError.message.includes('No route to host') ||
          execError.message.includes('Host is down')
        ) {
          newStatus = 'offline';
          errorOutput = 'Host unreachable';

          // Mark host as unreachable
          if (hostname) {
            this.unreachableHosts.add(hostname);
          }
        } else {
          newStatus = 'error';
          errorOutput = execError.message;
        }
      }

      // Update if status changed
      if (newStatus !== service.service_status) {
        await this.updateServiceStatus(service.id, newStatus, errorOutput);
      }
    } catch (error) {
      console.error(`Error checking status for "${service.name}":`, error);
    }
  }

  async updateServiceStatus(serviceId, status, error = null) {
    try {
      await pool.execute(
        'UPDATE appliances SET service_status = ?, last_status_check = NOW() WHERE id = ?',
        [status, serviceId]
      );

      // Get service details for broadcast
      const [rows] = await pool.execute(
        'SELECT id, name FROM appliances WHERE id = ?',
        [serviceId]
      );

      if (rows.length > 0) {
        broadcast('service_status_changed', {
          id: serviceId,
          name: rows[0].name,
          status,
          error,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error updating service status:', error);
    }
  }

  async checkAllServices() {
    try {
      // First check host availability
      await this.checkHostAvailability();

      const [services] = await pool.execute(
        'SELECT id, name, status_command, service_status FROM appliances WHERE status_command IS NOT NULL AND status_command != ""'
      );

      if (services.length === 0) {
        return;
      }

      console.log(`🔄 Checking ${services.length} services...`);

      // Process services in batches
      const batchSize = 3;
      for (let i = 0; i < services.length; i += batchSize) {
        const batch = services.slice(i, i + batchSize);

        await Promise.all(
          batch.map(service => this.checkServiceStatus(service))
        );

        // Small delay between batches
        if (i + batchSize < services.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error('Error in checkAllServices:', error);
    }
  }

  async start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    console.log('✅ Enhanced status checker started');

    // Initial check
    await this.checkAllServices();

    // Set up interval
    this.interval = setInterval(() => {
      this.checkAllServices();
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
}

// Export singleton instance
module.exports = new EnhancedServiceStatusChecker();
