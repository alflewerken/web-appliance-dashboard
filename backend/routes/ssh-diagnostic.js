// SSH Diagnostic API Routes
const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const { SSHManager } = require('../utils/sshManager');
const fs = require('fs').promises;
const path = require('path');

// GET /api/ssh-diagnostic/status
// Get current SSH configuration status
router.get('/status', async (req, res) => {
  try {
    const status = {
      database: {},
      filesystem: {},
      issues: [],
      recommendations: [],
    };

    // Check database
    const [keys] = await pool.execute(
      'SELECT * FROM ssh_keys ORDER BY key_name'
    );
    const [hosts] = await pool.execute(
      'SELECT * FROM ssh_hosts ORDER BY hostname'
    );

    status.database = {
      keys: keys.length,
      hosts: hosts.length,
      activeHosts: hosts.filter(h => h.is_active).length,
      keyDetails: keys.map(k => ({
        name: k.key_name,
        type: k.key_type,
        size: k.key_size,
        isDefault: k.is_default,
        hasPrivateKey: !!k.private_key,
        hasPublicKey: !!k.public_key,
      })),
      hostDetails: hosts.map(h => ({
        hostname: h.hostname,
        host: h.host,
        username: h.username,
        port: h.port,
        keyName: h.key_name,
        isActive: h.is_active,
        lastTested: h.last_tested,
        testStatus: h.test_status,
      })),
    };

    // Check filesystem
    const sshDir = '/root/.ssh';
    try {
      const files = await fs.readdir(sshDir);
      const keyFiles = files.filter(
        f => f.startsWith('id_rsa_') && !f.endsWith('.pub')
      );
      const configExists = files.includes('config');

      status.filesystem = {
        sshDirExists: true,
        keyFiles: keyFiles.length,
        configExists,
        keyFileDetails: [],
      };

      for (const file of keyFiles) {
        const keyName = file.replace('id_rsa_', '');
        const privateKeyPath = path.join(sshDir, file);
        const publicKeyPath = `${privateKeyPath}.pub`;

        try {
          const privateStats = await fs.stat(privateKeyPath);
          const publicExists = await fs
            .access(publicKeyPath)
            .then(() => true)
            .catch(() => false);

          status.filesystem.keyFileDetails.push({
            name: keyName,
            privateKeyExists: true,
            privateKeySize: privateStats.size,
            privateKeyPerms: (privateStats.mode & parseInt('777', 8)).toString(
              8
            ),
            publicKeyExists: publicExists,
          });
        } catch (error) {
          status.filesystem.keyFileDetails.push({
            name: keyName,
            error: error.message,
          });
        }
      }
    } catch (error) {
      status.filesystem = {
        sshDirExists: false,
        error: error.message,
      };
    }

    // Check for issues
    // Issue 1: Hosts referencing non-existent keys
    for (const host of hosts) {
      const keyExists = keys.some(k => k.key_name === host.key_name);
      if (!keyExists && host.is_active) {
        status.issues.push({
          type: 'missing_key',
          severity: 'high',
          message: `Host "${host.hostname}" references non-existent key "${host.key_name}"`,
          host: host.hostname,
          keyName: host.key_name,
        });
      }
    }

    // Issue 2: Keys in DB but not on filesystem
    for (const key of keys) {
      const fileExists = status.filesystem.keyFileDetails?.some(
        f => f.name === key.key_name && f.privateKeyExists
      );
      if (!fileExists) {
        status.issues.push({
          type: 'missing_file',
          severity: 'high',
          message: `Key "${key.key_name}" exists in database but not on filesystem`,
          keyName: key.key_name,
        });
      }
    }

    // Issue 3: No default key
    const hasDefaultKey = keys.some(k => k.is_default);
    if (!hasDefaultKey && keys.length > 0) {
      status.issues.push({
        type: 'no_default_key',
        severity: 'medium',
        message: 'No default SSH key is set',
        recommendation: 'Set one key as default for fallback purposes',
      });
    }

    // Issue 4: SSH config missing
    if (!status.filesystem.configExists) {
      status.issues.push({
        type: 'missing_config',
        severity: 'high',
        message: 'SSH config file is missing',
        recommendation: 'Regenerate SSH config from database',
      });
    }

    // Generate recommendations
    if (status.issues.length > 0) {
      status.recommendations.push({
        action: 'run_fix',
        description: 'Run the automatic fix to resolve these issues',
        endpoint: '/api/ssh-diagnostic/fix',
      });
    }

    // Determine overall status
    const overallStatus =
      status.issues.length === 0
        ? 'healthy'
        : status.issues.filter(i => i.severity === 'high').length > 0
          ? 'critical'
          : 'warning';

    // Calculate health score (0-100)
    const healthScore =
      status.issues.length === 0
        ? 100
        : status.issues.filter(i => i.severity === 'high').length > 0
          ? 25
          : status.issues.filter(i => i.severity === 'medium').length > 0
            ? 75
            : 90;

    res.json({
      success: true,
      status,
      summary: {
        overall_status: overallStatus,
        healthy: status.issues.length === 0,
        issueCount: status.issues.length,
        criticalIssues: status.issues.filter(i => i.severity === 'high').length,
        ssh_functional:
          status.issues.filter(i => i.severity === 'high').length === 0,
        health_score: healthScore,
      },
      diagnostic_report: {
        database: status.database,
        filesystem: status.filesystem,
        issues: status.issues,
        recommendations: status.recommendations,
        ssh_status: {
          keys_available: status.database.keys > 0,
          hosts_configured: status.database.hosts > 0,
          config_present: status.filesystem.configExists || false,
          keys_synced: status.filesystem.keyFiles === status.database.keys,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/ssh-diagnostic/fix
// Attempt to fix SSH configuration issues
router.post('/fix', async (req, res) => {
  try {
    const fixes = {
      performed: [],
      failed: [],
      summary: {},
    };

    const sshManager = new SSHManager({});

    // Step 1: Sync keys from database to filesystem
    try {
      const syncedCount = await sshManager.syncKeysToFilesystem();
      fixes.performed.push({
        action: 'sync_keys',
        description: `Synced ${syncedCount} SSH keys from database to filesystem`,
        success: true,
      });
    } catch (error) {
      fixes.failed.push({
        action: 'sync_keys',
        error: error.message,
      });
    }

    // Step 2: Fix host key references
    const [hosts] = await pool.execute(
      'SELECT * FROM ssh_hosts WHERE is_active = TRUE'
    );
    const [keys] = await pool.execute('SELECT * FROM ssh_keys');
    const defaultKey = keys.find(k => k.is_default);

    if (defaultKey) {
      for (const host of hosts) {
        const keyExists = keys.some(k => k.key_name === host.key_name);
        if (!keyExists) {
          await pool.execute('UPDATE ssh_hosts SET key_name = ? WHERE id = ?', [
            defaultKey.key_name,
            host.id,
          ]);
          fixes.performed.push({
            action: 'update_host_key',
            description: `Updated host "${host.hostname}" to use default key "${defaultKey.key_name}"`,
            success: true,
          });
        }
      }
    }

    // Step 3: Regenerate SSH config
    try {
      await sshManager.regenerateSSHConfig();
      fixes.performed.push({
        action: 'regenerate_config',
        description: 'Regenerated SSH configuration file',
        success: true,
      });
    } catch (error) {
      fixes.failed.push({
        action: 'regenerate_config',
        error: error.message,
      });
    }

    // Step 4: Fix permissions
    try {
      const sshDir = '/root/.ssh';
      await fs.chmod(sshDir, 0o700);

      const files = await fs.readdir(sshDir);
      for (const file of files) {
        const filePath = path.join(sshDir, file);
        if (file.startsWith('id_rsa_') && !file.endsWith('.pub')) {
          await fs.chmod(filePath, 0o600);
        } else if (file.endsWith('.pub')) {
          await fs.chmod(filePath, 0o644);
        } else if (file === 'config') {
          await fs.chmod(filePath, 0o600);
        }
      }

      fixes.performed.push({
        action: 'fix_permissions',
        description: 'Fixed SSH directory and file permissions',
        success: true,
      });
    } catch (error) {
      fixes.failed.push({
        action: 'fix_permissions',
        error: error.message,
      });
    }

    // Summary
    fixes.summary = {
      totalFixes: fixes.performed.length + fixes.failed.length,
      successful: fixes.performed.length,
      failed: fixes.failed.length,
      allFixed: fixes.failed.length === 0,
    };

    res.json({
      success: true,
      fixes,
      message: fixes.summary.allFixed
        ? 'All SSH configuration issues have been fixed'
        : 'Some fixes were applied, but some issues remain',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/ssh-diagnostic/test
// Test SSH connections to all active hosts
router.post('/test', async (req, res) => {
  try {
    const sshManager = new SSHManager({});
    const [hosts] = await pool.execute(
      'SELECT * FROM ssh_hosts WHERE is_active = TRUE'
    );

    const results = [];

    for (const host of hosts) {
      const testResult = await sshManager.testConnection(host);
      results.push({
        hostname: host.hostname,
        host: host.host,
        username: host.username,
        port: host.port,
        keyName: host.key_name,
        success: testResult.success,
        error: testResult.error,
        output: testResult.output,
      });

      // Update test status in database
      await pool.execute(
        'UPDATE ssh_hosts SET last_tested = NOW(), test_status = ? WHERE id = ?',
        [testResult.success ? 'success' : 'failed', host.id]
      );
    }

    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    };

    res.json({
      success: true,
      results,
      summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
