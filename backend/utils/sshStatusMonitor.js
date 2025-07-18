// SSH Status Monitor - Periodically checks SSH host connectivity
const { exec } = require('child_process');
const sseManager = require('./sseManager');

class SSHStatusMonitor {
  constructor(pool) {
    this.pool = pool;
    this.checkInterval = 30000; // 30 seconds
    this.isRunning = false;
    this.intervalId = null;
  }

  async start() {
    if (this.isRunning) {
      console.log('SSH Status Monitor is already running');
      return;
    }

    console.log('Starting SSH Status Monitor...');
    this.isRunning = true;

    // Initial check
    await this.checkAllHosts();

    // Schedule periodic checks
    this.intervalId = setInterval(async () => {
      await this.checkAllHosts();
    }, this.checkInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('SSH Status Monitor stopped');
  }

  async checkAllHosts() {
    try {
      const [hosts] = await this.pool.execute(
        'SELECT * FROM ssh_hosts WHERE is_active = TRUE AND deleted_at IS NULL'
      );

      console.log(`Checking status of ${hosts.length} SSH hosts...`);

      for (const host of hosts) {
        await this.checkHost(host);
      }
    } catch (error) {
      console.error('Error checking SSH hosts:', error);
    }
  }

  async checkHost(host) {
    return new Promise(async (resolve) => {
      const sshCommand = `ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no -i ~/.ssh/id_rsa_${host.key_name} ${host.username}@${host.host} -p ${host.port} "echo 'OK'"`;
      
      exec(sshCommand, async (error, stdout, stderr) => {
        const oldStatus = host.test_status;
        let newStatus = 'failed';
        
        if (!error && stdout.trim() === 'OK') {
          newStatus = 'success';
        }

        // Only update if status changed
        if (oldStatus !== newStatus) {
          try {
            await this.pool.execute(
              'UPDATE ssh_hosts SET test_status = ?, last_tested = NOW() WHERE id = ?',
              [newStatus, host.id]
            );

            console.log(`SSH host ${host.hostname} status changed: ${oldStatus} -> ${newStatus}`);

            // Send SSE event
            sseManager.broadcast({
              type: 'ssh_host_status_changed',
              data: {
                id: host.id,
                hostname: host.hostname,
                oldStatus,
                newStatus,
                timestamp: new Date().toISOString()
              }
            });
          } catch (dbError) {
            console.error(`Error updating status for host ${host.hostname}:`, dbError);
          }
        }

        resolve();
      });
    });
  }

  async testSingleHost(hostId) {
    try {
      const [hosts] = await this.pool.execute(
        'SELECT * FROM ssh_hosts WHERE id = ? AND deleted_at IS NULL',
        [hostId]
      );

      if (hosts.length > 0) {
        await this.checkHost(hosts[0]);
      }
    } catch (error) {
      console.error('Error testing single host:', error);
    }
  }
}

module.exports = SSHStatusMonitor;
