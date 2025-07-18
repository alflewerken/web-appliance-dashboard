// SSH Diagnostic Tool - Helps identify and fix SSH backup issues
const fs = require('fs').promises;
const path = require('path');
const pool = require('./database');

class SSHDiagnostic {
  constructor() {
    this.sshDir = '/root/.ssh';
    this.diagnosticResults = {};
  }

  // Run comprehensive SSH system diagnostic
  async runDiagnostic() {
    console.log('🔍 Starting SSH system diagnostic...');

    this.diagnosticResults = {
      timestamp: new Date().toISOString(),
      system: await this.checkSystemInfo(),
      database: await this.checkDatabase(),
      filesystem: await this.checkFilesystem(),
      permissions: await this.checkPermissions(),
      configuration: await this.checkConfiguration(),
      recommendations: [],
    };

    // Generate recommendations based on findings
    this.generateRecommendations();

    return this.diagnosticResults;
  }

  // Check basic system information
  async checkSystemInfo() {
    const systemInfo = {
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      ssh_directory: this.sshDir,
      user: process.env.USER || 'unknown',
      home: process.env.HOME || 'unknown',
    };

    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // Get more detailed OS information
      try {
        if (process.platform === 'linux') {
          try {
            const osRelease = await execAsync(
              'cat /etc/os-release 2>/dev/null || echo "ID=linux"'
            );
            const lines = osRelease.stdout.split('\n');
            const prettyName = lines.find(line =>
              line.startsWith('PRETTY_NAME=')
            );
            if (prettyName) {
              systemInfo.os = prettyName.split('=')[1].replace(/"/g, '');
            } else {
              systemInfo.os = 'Linux';
            }
          } catch {
            systemInfo.os = 'Linux';
          }
        } else if (process.platform === 'darwin') {
          systemInfo.os = 'macOS';
        } else if (process.platform === 'win32') {
          systemInfo.os = 'Windows';
        } else {
          systemInfo.os = process.platform;
        }

        // Get uptime
        try {
          const uptimeResult = await execAsync(
            'uptime 2>/dev/null || echo "Uptime: unknown"'
          );
          systemInfo.uptime = uptimeResult.stdout.trim();
        } catch {
          systemInfo.uptime = 'Unbekannt';
        }
      } catch (error) {
        systemInfo.os = process.platform;
        systemInfo.uptime = 'Unbekannt';
      }

      // Check SSH client availability
      try {
        const sshVersion = await execAsync('ssh -V 2>&1');
        const versionMatch = (sshVersion.stdout || sshVersion.stderr).match(
          /OpenSSH_([0-9]+\.[0-9]+)/
        );
        systemInfo.ssh_client = versionMatch
          ? `OpenSSH ${versionMatch[1]}`
          : 'SSH verfügbar';
        systemInfo.ssh_available = true;
      } catch (error) {
        systemInfo.ssh_client = 'Nicht verfügbar';
        systemInfo.ssh_available = false;
      }

      // Check sshpass availability
      try {
        await execAsync('which sshpass');
        systemInfo.sshpass_available = true;
      } catch {
        systemInfo.sshpass_available = false;
      }

      // Check if we're in Docker
      try {
        await fs.access('/.dockerenv');
        systemInfo.environment = 'Docker Container';
      } catch {
        systemInfo.environment = 'Native System';
      }
    } catch (error) {
      systemInfo.error = error.message;
      systemInfo.os = 'Unbekannt';
      systemInfo.uptime = 'Unbekannt';
    }

    return systemInfo;
  }

  // Check database SSH data
  async checkDatabase() {
    const dbInfo = {
      connection_ok: false,
      ssh_hosts_count: 0,
      ssh_keys_count: 0,
      keys_with_data: 0,
      hosts: [],
      keys: [],
    };

    try {
      // Test database connection
      const [testResult] = await pool.execute('SELECT 1');
      dbInfo.connection_ok = true;

      // Check SSH hosts
      const [hosts] = await pool.execute(
        'SELECT * FROM ssh_hosts ORDER BY hostname'
      );
      dbInfo.ssh_hosts_count = hosts.length;
      dbInfo.hosts = hosts.map(host => ({
        hostname: host.hostname,
        host: host.host,
        username: host.username,
        port: host.port,
        key_name: host.key_name,
        is_active: host.is_active,
        test_status: host.test_status,
      }));

      // Check SSH keys
      const [keys] = await pool.execute(
        'SELECT * FROM ssh_keys ORDER BY key_name'
      );
      dbInfo.ssh_keys_count = keys.length;
      dbInfo.keys_with_data = keys.filter(
        key => key.private_key && key.private_key.length > 100
      ).length;

      dbInfo.keys = keys.map(key => ({
        key_name: key.key_name,
        key_type: key.key_type,
        key_size: key.key_size,
        has_private_key: (key.private_key || '').length > 100,
        has_public_key: (key.public_key || '').length > 50,
        is_default: key.is_default,
        private_key_length: (key.private_key || '').length,
        public_key_length: (key.public_key || '').length,
      }));
    } catch (error) {
      dbInfo.error = error.message;
    }

    return dbInfo;
  }

  // Check SSH filesystem
  async checkFilesystem() {
    const fsInfo = {
      ssh_directory_exists: false,
      ssh_directory_accessible: false,
      key_files: [],
      config_file_exists: false,
      total_key_files: 0,
    };

    try {
      // Check if SSH directory exists
      await fs.access(this.sshDir);
      fsInfo.ssh_directory_exists = true;
      fsInfo.ssh_directory_accessible = true;

      // List SSH key files
      const files = await fs.readdir(this.sshDir);
      const keyFiles = files.filter(
        file =>
          file.startsWith('id_rsa_') ||
          file.startsWith('id_ed25519_') ||
          file.startsWith('id_ecdsa_')
      );

      fsInfo.total_key_files = keyFiles.length;

      for (const file of keyFiles) {
        const filePath = path.join(this.sshDir, file);
        try {
          const stats = await fs.stat(filePath);
          const content = await fs.readFile(filePath, 'utf8');

          fsInfo.key_files.push({
            filename: file,
            size: stats.size,
            mode: stats.mode.toString(8),
            is_private: !file.endsWith('.pub'),
            content_length: content.length,
            looks_valid: file.endsWith('.pub')
              ? content.startsWith('ssh-')
              : content.includes('-----BEGIN') && content.includes('-----END'),
          });
        } catch (error) {
          fsInfo.key_files.push({
            filename: file,
            error: error.message,
          });
        }
      }

      // Check SSH config file
      try {
        await fs.access(path.join(this.sshDir, 'config'));
        fsInfo.config_file_exists = true;
      } catch {
        fsInfo.config_file_exists = false;
      }
    } catch (error) {
      fsInfo.error = error.message;
      if (error.code === 'ENOENT') {
        fsInfo.ssh_directory_exists = false;
      } else if (error.code === 'EACCES') {
        fsInfo.ssh_directory_exists = true;
        fsInfo.ssh_directory_accessible = false;
      }
    }

    return fsInfo;
  }

  // Check SSH permissions
  async checkPermissions() {
    const permInfo = {
      ssh_directory_permissions: null,
      key_file_permissions: [],
      issues: [],
    };

    try {
      // Check SSH directory permissions
      const sshDirStats = await fs.stat(this.sshDir);
      permInfo.ssh_directory_permissions = sshDirStats.mode.toString(8);

      if ((sshDirStats.mode & 0o077) !== 0) {
        permInfo.issues.push('SSH directory has overly permissive permissions');
      }

      // Check key file permissions
      const files = await fs.readdir(this.sshDir);
      for (const file of files) {
        if (file.startsWith('id_') && !file.endsWith('.pub')) {
          const filePath = path.join(this.sshDir, file);
          try {
            const stats = await fs.stat(filePath);
            const perms = stats.mode.toString(8);

            permInfo.key_file_permissions.push({
              filename: file,
              permissions: perms,
              is_secure: (stats.mode & 0o077) === 0,
            });

            if ((stats.mode & 0o077) !== 0) {
              permInfo.issues.push(
                `Private key ${file} has insecure permissions`
              );
            }
          } catch (error) {
            permInfo.key_file_permissions.push({
              filename: file,
              error: error.message,
            });
          }
        }
      }
    } catch (error) {
      permInfo.error = error.message;
    }

    return permInfo;
  }

  // Check SSH configuration
  async checkConfiguration() {
    const configInfo = {
      config_file_exists: false,
      config_content: null,
      host_entries: 0,
      valid_config: false,
    };

    try {
      const configPath = path.join(this.sshDir, 'config');
      await fs.access(configPath);
      configInfo.config_file_exists = true;

      const configContent = await fs.readFile(configPath, 'utf8');
      configInfo.config_content = configContent;

      const hostMatches = configContent.match(/^Host\s+/gm);
      configInfo.host_entries = hostMatches ? hostMatches.length : 0;
      configInfo.valid_config =
        configContent.length > 0 && configContent.includes('Host');
    } catch (error) {
      configInfo.error = error.message;
    }

    return configInfo;
  }

  // Generate recommendations based on diagnostic results
  generateRecommendations() {
    const recommendations = [];

    // Database recommendations
    if (!this.diagnosticResults.database.connection_ok) {
      recommendations.push({
        type: 'critical',
        category: 'database',
        message: 'Database connection failed',
        action: 'Check database configuration and connectivity',
      });
    } else if (this.diagnosticResults.database.ssh_keys_count === 0) {
      recommendations.push({
        type: 'warning',
        category: 'database',
        message: 'No SSH keys found in database',
        action: 'Initialize SSH system or import existing keys',
      });
    } else if (this.diagnosticResults.database.keys_with_data === 0) {
      recommendations.push({
        type: 'critical',
        category: 'database',
        message: 'SSH keys exist but have no key data',
        action: 'SSH keys need to be regenerated or imported from filesystem',
      });
    }

    // Filesystem recommendations
    if (!this.diagnosticResults.filesystem.ssh_directory_exists) {
      recommendations.push({
        type: 'critical',
        category: 'filesystem',
        message: 'SSH directory does not exist',
        action: 'Create SSH directory with proper permissions',
      });
    } else if (!this.diagnosticResults.filesystem.ssh_directory_accessible) {
      recommendations.push({
        type: 'critical',
        category: 'filesystem',
        message: 'SSH directory is not accessible',
        action: 'Check directory permissions and ownership',
      });
    } else if (this.diagnosticResults.filesystem.total_key_files === 0) {
      recommendations.push({
        type: 'warning',
        category: 'filesystem',
        message: 'No SSH key files found on filesystem',
        action: 'Generate SSH keys or restore from backup',
      });
    }

    // Permission recommendations
    if (this.diagnosticResults.permissions.issues.length > 0) {
      recommendations.push({
        type: 'security',
        category: 'permissions',
        message: 'SSH permission issues detected',
        action: 'Fix file and directory permissions for security',
        details: this.diagnosticResults.permissions.issues,
      });
    }

    // Configuration recommendations
    if (!this.diagnosticResults.configuration.config_file_exists) {
      recommendations.push({
        type: 'info',
        category: 'configuration',
        message: 'SSH config file not found',
        action: 'Generate SSH config file for better management',
      });
    }

    // Data consistency recommendations
    const dbKeys = this.diagnosticResults.database.ssh_keys_count;
    const fsKeys = Math.floor(
      this.diagnosticResults.filesystem.total_key_files / 2
    ); // Private + public = 1 key

    if (dbKeys > 0 && fsKeys === 0) {
      recommendations.push({
        type: 'warning',
        category: 'consistency',
        message: 'SSH keys exist in database but not on filesystem',
        action: 'Sync database keys to filesystem',
      });
    } else if (dbKeys === 0 && fsKeys > 0) {
      recommendations.push({
        type: 'warning',
        category: 'consistency',
        message: 'SSH keys exist on filesystem but not in database',
        action: 'Import filesystem keys to database',
      });
    } else if (dbKeys !== fsKeys && dbKeys > 0 && fsKeys > 0) {
      recommendations.push({
        type: 'info',
        category: 'consistency',
        message: 'Mismatch between database and filesystem key counts',
        action: 'Verify key synchronization',
      });
    }

    this.diagnosticResults.recommendations = recommendations;
  }

  // Auto-fix common SSH issues
  async autoFix() {
    const fixResults = {
      timestamp: new Date().toISOString(),
      fixes_applied: [],
      errors: [],
    };

    try {
      // Fix 1: Create SSH directory if missing
      if (!this.diagnosticResults.filesystem.ssh_directory_exists) {
        try {
          await fs.mkdir(this.sshDir, { recursive: true, mode: 0o700 });
          fixResults.fixes_applied.push(
            'Created SSH directory with proper permissions'
          );
        } catch (error) {
          fixResults.errors.push(
            `Failed to create SSH directory: ${error.message}`
          );
        }
      }

      // Fix 2: Fix SSH directory permissions
      if (this.diagnosticResults.filesystem.ssh_directory_exists) {
        try {
          await fs.chmod(this.sshDir, 0o700);
          fixResults.fixes_applied.push('Fixed SSH directory permissions');
        } catch (error) {
          fixResults.errors.push(
            `Failed to fix SSH directory permissions: ${error.message}`
          );
        }
      }

      // Fix 3: Sync database keys to filesystem
      if (this.diagnosticResults.database.keys_with_data > 0) {
        try {
          const [keys] = await pool.execute(
            'SELECT * FROM ssh_keys WHERE private_key IS NOT NULL AND private_key != ""'
          );

          for (const key of keys) {
            if (key.private_key && key.private_key.length > 100) {
              const privateKeyPath = path.join(
                this.sshDir,
                `id_rsa_${key.key_name}`
              );
              const publicKeyPath = path.join(
                this.sshDir,
                `id_rsa_${key.key_name}.pub`
              );

              await fs.writeFile(privateKeyPath, key.private_key, {
                mode: 0o600,
              });
              if (key.public_key) {
                await fs.writeFile(publicKeyPath, key.public_key, {
                  mode: 0o644,
                });
              }

              fixResults.fixes_applied.push(
                `Restored SSH key files for ${key.key_name}`
              );
            }
          }
        } catch (error) {
          fixResults.errors.push(
            `Failed to sync database keys to filesystem: ${error.message}`
          );
        }
      }
    } catch (error) {
      fixResults.errors.push(`Auto-fix failed: ${error.message}`);
    }

    return fixResults;
  }

  // Generate a comprehensive report
  generateReport() {
    const report = {
      summary: {
        overall_status: this.getOverallStatus(),
        critical_issues: this.diagnosticResults.recommendations.filter(
          r => r.type === 'critical'
        ).length,
        warnings: this.diagnosticResults.recommendations.filter(
          r => r.type === 'warning'
        ).length,
        ssh_functional: this.isSSHFunctional(),
      },
      diagnostic_results: this.diagnosticResults,
      next_steps: this.getNextSteps(),
    };

    return report;
  }

  // Determine overall SSH system status
  getOverallStatus() {
    const criticalIssues = this.diagnosticResults.recommendations.filter(
      r => r.type === 'critical'
    ).length;
    const warnings = this.diagnosticResults.recommendations.filter(
      r => r.type === 'warning'
    ).length;

    if (criticalIssues > 0) return 'critical';
    if (warnings > 0) return 'warning';
    return 'healthy';
  }

  // Check if SSH system is functional
  isSSHFunctional() {
    return (
      this.diagnosticResults.database.connection_ok &&
      this.diagnosticResults.database.keys_with_data > 0 &&
      this.diagnosticResults.filesystem.ssh_directory_accessible &&
      this.diagnosticResults.filesystem.total_key_files > 0
    );
  }

  // Get prioritized next steps
  getNextSteps() {
    const criticalRecs = this.diagnosticResults.recommendations.filter(
      r => r.type === 'critical'
    );
    const warningRecs = this.diagnosticResults.recommendations.filter(
      r => r.type === 'warning'
    );

    const steps = [];

    if (criticalRecs.length > 0) {
      steps.push({
        priority: 'high',
        title: 'Fix Critical Issues',
        actions: criticalRecs.map(r => r.action),
      });
    }

    if (warningRecs.length > 0) {
      steps.push({
        priority: 'medium',
        title: 'Address Warnings',
        actions: warningRecs.map(r => r.action),
      });
    }

    if (steps.length === 0) {
      steps.push({
        priority: 'low',
        title: 'System Healthy',
        actions: [
          'SSH system is functioning correctly',
          'Consider regular backup verification',
        ],
      });
    }

    return steps;
  }
}

module.exports = SSHDiagnostic;
