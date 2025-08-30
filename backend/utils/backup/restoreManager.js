// Enhanced Restore Manager - Comprehensive restore functionality
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const BackupValidator = require('./backupValidator');
const GuacamoleBackupManager = require('./guacamoleBackupManager');
const EnvironmentRestorer = require('./environmentRestorer');

class RestoreManager {
  constructor(pool) {
    this.pool = pool;
    this.validator = new BackupValidator();
    this.guacamoleBackup = new GuacamoleBackupManager();
    this.environmentRestorer = new EnvironmentRestorer();
    this.restoreLog = [];
  }

  // Main restore function with transaction support
  async restoreFromBackup(backupData, options = {}) {
    const startTime = Date.now();
    
    this.restoreLog = [];
    this.log('info', '🔄 Starting comprehensive restore process...');
    
    // STEP 1: Configure environment BEFORE database operations (OPTIONAL - log errors but continue)
    try {
      this.log('info', '🔧 Checking environment configuration...');
      
      // Only configure if environmentRestorer is available
      if (this.environmentRestorer) {
        // Create recovery point
        const recoveryDir = await this.environmentRestorer.createRecoveryPoint();
        if (recoveryDir) {
          this.log('info', `📸 Recovery point created at: ${recoveryDir}`);
        }
        
        // Configure encryption key from backup
        const encryptionConfigured = await this.environmentRestorer.configureEncryptionKey(backupData);
        if (!encryptionConfigured) {
          this.log('warn', '⚠️  Encryption key not configured - encrypted data may not work');
        }
        
        // Skip container restart during restore to avoid connection issues
        this.log('info', '⏭️  Skipping container restart during restore');
      }
      
    } catch (envError) {
      this.log('error', `❌ Environment configuration failed: ${envError.message}`);
      // Continue anyway, but warn user
    }
    
    // STEP 2: Proceed with database restore
    const connection = await this.pool.getConnection();
    
    try {
      // Validate backup first
      const validation = this.validator.validateBackup(backupData);
      if (!validation.valid && !options.force) {
        throw new Error(`Backup validation failed: ${validation.errors.join(', ')}`);
      }
      
      if (validation.warnings.length > 0) {
        this.log('warn', `⚠️ Validation warnings: ${validation.warnings.join(', ')}`);
      }

      // Start transaction
      await connection.beginTransaction();
      this.log('info', '📝 Transaction started');

      // Pre-restore tasks
      await this.preRestoreTasks(connection, options);

      // Restore data in correct order
      const restoreOrder = [
        'users',              // Users first (no dependencies)
        'categories',         // Categories before appliances
        'appliances',         // Appliances (depends on categories)
        'ssh_keys',          // SSH keys only
        'hosts',             // Hosts table for SSH and remote connections
        'appliance_commands', // Commands (depends on appliances and hosts)
        'user_settings',     // Settings
        'background_images', // Background images
        'role_permissions',  // Role permissions
        'user_appliance_permissions', // User permissions (depends on users and appliances)
        'audit_logs',        // Audit logs
        'service_command_logs', // Service logs (depends on appliances)
        'active_sessions'    // Active sessions (depends on users)
      ];

      const results = {};
      
      for (const table of restoreOrder) {
        if (backupData.data && backupData.data[table]) {
          results[table] = await this.restoreTable(
            connection, 
            table, 
            backupData.data[table],
            backupData.data
          );
        } else {
          this.log('warn', `⚠️ No data found for table: ${table}`);
          results[table] = { restored: 0, errors: 0 };
        }
      }

      // Restore filesystem data
      if (backupData.data.filesystem) {
        await this.restoreFilesystemData(backupData.data.filesystem);
      }

      // Restore Guacamole connections if available
      if (backupData.data.guacamole_connections && await this.guacamoleBackup.isAvailable()) {
        try {
          const guacResult = await this.guacamoleBackup.importConnections(
            backupData.data.guacamole_connections
          );
          results.guacamole_connections = guacResult;
          this.log('info', `✅ Restored ${guacResult.imported} Guacamole connections`);
        } catch (error) {
          this.log('error', `❌ Failed to restore Guacamole connections: ${error.message}`);
          results.guacamole_connections = { imported: 0, errors: 1 };
        }
      } else if (backupData.data.guacamole_connections) {
        this.log('warn', '⚠️ Guacamole database not available, skipping connection restore');
        results.guacamole_connections = { imported: 0, errors: 0 };
      }

      // Post-restore tasks
      await this.postRestoreTasks(connection, results);

      // Commit transaction
      await connection.commit();
      this.log('info', '✅ Transaction committed successfully');
      
      // STEP 3: Verify system functionality (only if environmentRestorer available)
      if (this.environmentRestorer) {
        try {
          const systemChecks = await this.environmentRestorer.verifySystemFunctionality();
          this.log('info', '🔍 System verification results:', systemChecks);
        } catch (verifyError) {
          this.log('warn', `⚠️  System verification failed: ${verifyError.message}`);
        }
      }
      
      // STEP 4: Trigger status check for all services
      try {
        this.log('info', '🔄 Triggering service status check...');
        const statusChecker = require('../../utils/statusChecker');
        statusChecker.clearHostCache();
        // Don't await to avoid timeout
        statusChecker.forceCheck().catch(err => {
          this.log('warn', `⚠️  Status check error: ${err.message}`);
        });
        this.log('info', '✅ Service status check initiated');
      } catch (statusError) {
        this.log('warn', `⚠️  Could not trigger status check: ${statusError.message}`);
      }

      const duration = Date.now() - startTime;
      
      const summary = {
        success: true,
        duration_ms: duration,
        results,
        restore_log: this.restoreLog,
        timestamp: new Date().toISOString()
      };

      return summary;

    } catch (error) {
      await connection.rollback();
      this.log('error', `❌ Restore failed: ${error.message}`);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Log restore operations
  log(level, message, details = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      details
    };
    this.restoreLog.push(entry);

    if (details) {

    }
  }

  // Pre-restore tasks
  async preRestoreTasks(connection, options) {
    this.log('info', '🔧 Running pre-restore tasks...');

    // Backup current data if requested
    if (options.backupCurrent) {
      this.log('info', '📸 Creating backup of current data...');
      // Implementation would go here
    }

    // Disable foreign key checks temporarily
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    this.log('info', '🔓 Foreign key checks disabled');
  }

  // Restore a single table
  async restoreTable(connection, tableName, data, allData) {
    this.log('info', `📊 Restoring table: ${tableName} (${data.length} records)`);
    
    let restored = 0;
    let errors = 0;

    try {
      // Clear existing data
      await connection.execute(`DELETE FROM ${tableName}`);
      
      // Reset auto-increment
      await connection.execute(`ALTER TABLE ${tableName} AUTO_INCREMENT = 1`);

      // Special handling for each table type
      switch (tableName) {
        case 'ssh_keys':
          ({ restored, errors } = await this.restoreSSHKeys(connection, data));
          break;
        // ssh_hosts case removed - no longer needed
        case 'background_images':
          ({ restored, errors } = await this.restoreBackgroundImages(connection, data));
          break;
        case 'appliance_commands':
          ({ restored, errors } = await this.restoreApplianceCommands(connection, data, allData));
          break;
        default:
          ({ restored, errors } = await this.restoreGenericTable(connection, tableName, data));
      }

      this.log('info', `  ✓ Restored ${restored} records, ${errors} errors`);

    } catch (error) {
      this.log('error', `  ✗ Error restoring ${tableName}: ${error.message}`);
      throw error;
    }

    return { restored, errors };
  }

  // Generic table restore
  async restoreGenericTable(connection, tableName, data) {
    let restored = 0;
    let errors = 0;

    for (const record of data) {
      try {
        // Special handling for appliances table to ensure all fields are included
        if (tableName === 'appliances') {
          const fields = [
            'id', 'name', 'url', 'description', 'icon', 'color', 'category',
            'isFavorite', 'lastUsed', 'created_at', 'updated_at',
            'start_command', 'stop_command', 'status_command', 'auto_start',
            'service_status', 'last_status_check', 'ssh_connection',
            'transparency', 'blur_amount', 'open_mode_mini', 'open_mode_mobile',
            'open_mode_desktop', 'remote_desktop_enabled', 'remote_protocol',
            'remote_host', 'remote_port', 'remote_username', 'remote_password_encrypted'
          ];
          
          const values = fields.map(field => {
            // Handle different field name formats
            if (field === 'remote_desktop_enabled') {
              return record[field] !== undefined ? record[field] : 
                     record.remoteDesktopEnabled !== undefined ? record.remoteDesktopEnabled : false;
            }
            if (field === 'remote_protocol') {
              return record[field] || record.remoteProtocol || 'vnc';
            }
            if (field === 'remote_host') {
              return record[field] || record.remoteHost || null;
            }
            if (field === 'remote_port') {
              return record[field] || record.remotePort || null;
            }
            if (field === 'remote_username') {
              return record[field] || record.remoteUsername || null;
            }
            if (field === 'remote_password_encrypted') {
              return record[field] || record.remotePasswordEncrypted || null;
            }
            // Default handling for other fields
            return record[field] !== undefined ? record[field] : null;
          });
          
          const placeholders = fields.map(() => '?').join(', ');
          
          await connection.execute(
            `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`,
            values
          );
        } else {
          // Regular handling for other tables
          const fields = Object.keys(record);
          const values = fields.map(f => record[f]);
          const placeholders = fields.map(() => '?').join(', ');
          
          await connection.execute(
            `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`,
            values
          );
        }
        
        restored++;
      } catch (error) {
        errors++;
        this.log('warn', `  ⚠️ Failed to restore record in ${tableName}:`, error.message);
      }
    }

    return { restored, errors };
  }

  // Restore SSH keys with filesystem sync
  async restoreSSHKeys(connection, data) {
    let restored = 0;
    let errors = 0;
    const sshDir = '/root/.ssh';

    // Ensure SSH directory exists
    await fs.mkdir(sshDir, { recursive: true, mode: 0o700 });

    for (const key of data) {
      try {
        // Insert into database
        await connection.execute(
          `INSERT INTO ssh_keys 
           (key_name, private_key, public_key, key_type, key_size, comment, passphrase_hash, is_default, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            key.key_name,
            key.private_key || '',
            key.public_key || '',
            key.key_type || 'rsa',
            key.key_size || 2048,
            key.comment || '',
            key.passphrase_hash || null,
            Boolean(key.is_default),
            key.created_at || new Date().toISOString(),
            key.updated_at || key.created_at || new Date().toISOString()
          ]
        );

        // Write to filesystem
        if (key.private_key) {
          const privateKeyPath = path.join(sshDir, `id_rsa_${key.key_name}`);
          await fs.writeFile(privateKeyPath, key.private_key, { mode: 0o600 });
          
          if (key.public_key) {
            const publicKeyPath = path.join(sshDir, `id_rsa_${key.key_name}.pub`);
            await fs.writeFile(publicKeyPath, key.public_key, { mode: 0o644 });
          }
        }

        restored++;
      } catch (error) {
        errors++;
        this.log('warn', `  ⚠️ Failed to restore SSH key ${key.key_name}:`, error.message);
      }
    }

    return { restored, errors };
  }

  // Restore SSH hosts
  async restoreSSHHosts(connection, data, allData) {
    let restored = 0;
    let errors = 0;

    for (const host of data) {
      try {
        await connection.execute(
          `INSERT INTO ssh_hosts 
           (hostname, host, username, port, key_name, is_active, last_tested, test_status, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            host.hostname,
            host.host,
            host.username,
            host.port || 22,
            host.key_name || 'dashboard',
            host.is_active !== false,
            host.last_tested || null,
            host.test_status || 'unknown',
            host.created_at || new Date().toISOString(),
            host.updated_at || host.created_at || new Date().toISOString()
          ]
        );
        restored++;
      } catch (error) {
        errors++;
        this.log('warn', `  ⚠️ Failed to restore SSH host ${host.hostname}:`, error.message);
      }
    }

    return { restored, errors };
  }
  // Restore background images with file data
  async restoreBackgroundImages(connection, data) {
    let restored = 0;
    let errors = 0;
    const backgroundsDir = path.join(__dirname, '../../uploads/backgrounds');

    // Ensure directory exists
    await fs.mkdir(backgroundsDir, { recursive: true });

    // Clear existing files
    try {
      const existingFiles = await fs.readdir(backgroundsDir);
      for (const file of existingFiles) {
        await fs.unlink(path.join(backgroundsDir, file));
      }
    } catch (e) {
      this.log('warn', '  ⚠️ Could not clear existing background files');
    }

    for (const img of data) {
      try {
        // Restore file if data exists
        if (img.file_data && !img.file_missing) {
          const filepath = path.join(backgroundsDir, img.filename);
          const fileBuffer = Buffer.from(img.file_data, 'base64');
          await fs.writeFile(filepath, fileBuffer);
        }

        // Insert database record
        await connection.execute(
          `INSERT INTO background_images 
           (filename, original_name, mime_type, file_size, width, height, is_active, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            img.filename,
            img.original_name || img.filename,
            img.mime_type || 'image/jpeg',
            img.file_size || 0,
            img.width || 1920,
            img.height || 1080,
            Boolean(img.is_active),
            img.created_at || new Date().toISOString()
          ]
        );
        restored++;
      } catch (error) {
        errors++;
        this.log('warn', `  ⚠️ Failed to restore background image ${img.filename}:`, error.message);
      }
    }

    return { restored, errors };
  }

  // Restore appliance commands with proper ID mapping
  async restoreApplianceCommands(connection, data, allData) {
    let restored = 0;
    let errors = 0;

    // Get SSH host mapping
    const sshHostMap = new Map();
    if (allData.ssh_hosts) {
      const [currentHosts] = await connection.execute('SELECT id, hostname, host, username FROM ssh_hosts');
      for (const host of currentHosts) {
        const key = `${host.hostname}:${host.host}:${host.username}`;
        sshHostMap.set(key, host.id);
      }
    }

    for (const command of data) {
      try {
        // Find the correct SSH host ID
        let sshHostId = null;
        if (command.ssh_host_id && allData.ssh_hosts) {
          const originalHost = allData.ssh_hosts.find(h => h.id === command.ssh_host_id);
          if (originalHost) {
            const key = `${originalHost.hostname}:${originalHost.host}:${originalHost.username}`;
            sshHostId = sshHostMap.get(key) || null;
          }
        }

        await connection.execute(
          `INSERT INTO appliance_commands 
           (id, appliance_id, description, command, ssh_host_id, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            command.id,
            command.appliance_id,
            command.description,
            command.command,
            sshHostId,
            command.created_at || new Date().toISOString(),
            command.updated_at || command.created_at || new Date().toISOString()
          ]
        );
        restored++;
      } catch (error) {
        errors++;
        this.log('warn', `  ⚠️ Failed to restore command ${command.description}:`, error.message);
      }
    }

    return { restored, errors };
  }

  // Restore filesystem data
  async restoreFilesystemData(filesystemData) {
    this.log('info', '📁 Restoring filesystem data...');

    // Restore SSH config
    if (filesystemData.ssh_config && filesystemData.ssh_config.content) {
      try {
        await fs.writeFile('/root/.ssh/config', filesystemData.ssh_config.content, { mode: 0o600 });
        this.log('info', '  ✓ SSH config restored');
      } catch (e) {
        this.log('warn', '  ⚠️ Could not restore SSH config:', e.message);
      }
    }

    // Note: We don't restore .env files or nginx config automatically for security
    this.log('info', '  ℹ️ Environment and nginx configs not restored (security)');
  }

  // Post-restore tasks
  async postRestoreTasks(connection, results) {
    this.log('info', '🔧 Running post-restore tasks...');

    // Re-enable foreign key checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    this.log('info', '🔒 Foreign key checks re-enabled');

    // Update auto-increment values
    const tables = ['appliances', 'categories', 'users', 'appliance_commands'];
    for (const table of tables) {
      try {
        const [maxId] = await connection.execute(`SELECT MAX(id) as maxId FROM ${table}`);
        if (maxId[0].maxId) {
          await connection.execute(`ALTER TABLE ${table} AUTO_INCREMENT = ?`, [maxId[0].maxId + 1]);
        }
      } catch (e) {
        this.log('warn', `  ⚠️ Could not update auto-increment for ${table}`);
      }
    }

    // Fix terminal connections (SSH keys and config)
    await this.fixTerminalConnections(connection);

    // Recreate Guacamole connections for remote desktop
    await this.recreateGuacamoleConnections();

    // Run post-restore hook
    await this.runPostRestoreHook();

    this.log('info', '✅ Post-restore tasks completed');
  }

  // Fix SSH directory and file permissions
  async fixSSHPermissions() {
    try {
      const sshDir = '/root/.ssh';
      await fs.chmod(sshDir, 0o700);

      const files = await fs.readdir(sshDir);
      for (const file of files) {
        const filepath = path.join(sshDir, file);
        const stat = await fs.stat(filepath);
        
        if (stat.isFile()) {
          if (file.startsWith('id_') && !file.endsWith('.pub')) {
            await fs.chmod(filepath, 0o600); // Private keys
          } else if (file.endsWith('.pub')) {
            await fs.chmod(filepath, 0o644); // Public keys
          } else if (file === 'config') {
            await fs.chmod(filepath, 0o600); // SSH config
          }
        }
      }

      this.log('info', '  ✓ SSH permissions fixed');
    } catch (error) {
      this.log('warn', '  ⚠️ Could not fix SSH permissions:', error.message);
    }
  }

  // Fix terminal connections - comprehensive SSH restoration
  async fixTerminalConnections(connection) {
    try {
      this.log('info', '🔧 Fixing terminal connections after restore...');
      
      const sshDir = '/root/.ssh';
      const sshConfigPath = '/root/.ssh/config';
      
      // 1. Ensure SSH directory exists with correct permissions
      await fs.mkdir(sshDir, { recursive: true, mode: 0o700 });
      await fs.chmod(sshDir, 0o700);
      this.log('info', '  ✓ SSH directory setup complete');
      
      // 2. Restore SSH keys from database to filesystem
      const [sshKeys] = await connection.execute(`
        SELECT id, key_name, private_key, public_key, created_by
        FROM ssh_keys
        WHERE private_key IS NOT NULL
      `);
      
      this.log('info', `  🔑 Restoring ${sshKeys.length} SSH keys from database...`);
      
      for (const key of sshKeys) {
        try {
          // Determine filename
          let filename;
          if (key.created_by && key.created_by !== 1) {
            filename = `id_rsa_user${key.created_by}_${key.key_name}`;
          } else {
            filename = `id_rsa_${key.key_name}`;
          }
          
          const privateKeyPath = path.join(sshDir, filename);
          const publicKeyPath = path.join(sshDir, `${filename}.pub`);
          
          // Write private key
          await fs.writeFile(privateKeyPath, key.private_key, { mode: 0o600 });
          
          // Write public key if available
          if (key.public_key) {
            await fs.writeFile(publicKeyPath, key.public_key, { mode: 0o644 });
          }
          
          this.log('info', `    ✓ Restored: ${filename}`);
        } catch (error) {
          this.log('warn', `    ⚠️ Failed to restore key "${key.key_name}": ${error.message}`);
        }
      }
      
      // 3. Generate SSH config
      this.log('info', '  📄 Generating SSH config...');
      
      const baseConfig = `# SSH Config auto-generated by Web Appliance Dashboard
# Generated after restore

Host *
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    LogLevel QUIET
    ConnectTimeout 10
    ServerAliveInterval 30
    ServerAliveCountMax 3
    PasswordAuthentication no
    PubkeyAuthentication yes
    IdentitiesOnly yes`;

      const configs = [baseConfig];
      
      // Get all hosts with SSH configuration
      const [hosts] = await connection.execute(`
        SELECT id, name, hostname, port, username, ssh_key_name
        FROM hosts 
        WHERE is_active = 1 
          AND ssh_key_name IS NOT NULL 
          AND ssh_key_name != ''
        ORDER BY name
      `);
      
      this.log('info', `  📋 Found ${hosts.length} hosts with SSH configuration`);
      
      for (const host of hosts) {
        const hostConfig = `
# ${host.name}
Host ${host.hostname}
    HostName ${host.hostname}
    Port ${host.port || 22}
    User ${host.username}
    IdentityFile ${sshDir}/id_rsa_${host.ssh_key_name}`;
        
        configs.push(hostConfig);
        this.log('info', `    ✓ Added config for: ${host.name} (${host.hostname})`);
      }
      
      // Write SSH config
      const configContent = configs.join('\n');
      await fs.writeFile(sshConfigPath, configContent, { mode: 0o600 });
      this.log('info', '  ✓ SSH config written successfully');
      
      // 4. Verify hosts have proper SSH keys
      const [hostsWithoutKeys] = await connection.execute(`
        SELECT id, name, hostname 
        FROM hosts 
        WHERE is_active = 1 
          AND (ssh_key_name IS NULL OR ssh_key_name = '')
      `);
      
      if (hostsWithoutKeys.length > 0) {
        this.log('warn', `  ⚠️ Found ${hostsWithoutKeys.length} hosts without SSH keys`);
        
        // Try to assign dashboard key if available
        const dashboardKeyPath = path.join(sshDir, 'id_rsa_dashboard');
        const dashboardKeyExists = await fs.access(dashboardKeyPath).then(() => true).catch(() => false);
        
        if (dashboardKeyExists) {
          for (const host of hostsWithoutKeys) {
            await connection.execute(
              `UPDATE hosts SET ssh_key_name = 'dashboard' WHERE id = ?`,
              [host.id]
            );
            this.log('info', `    ✓ Assigned 'dashboard' key to ${host.name}`);
          }
        }
      }
      
      // 5. Fix permissions on all SSH files
      const files = await fs.readdir(sshDir);
      for (const file of files) {
        const filePath = path.join(sshDir, file);
        
        if (file === 'config') {
          await fs.chmod(filePath, 0o600);
        } else if (file.startsWith('id_rsa') && !file.endsWith('.pub')) {
          await fs.chmod(filePath, 0o600);
        } else if (file.endsWith('.pub')) {
          await fs.chmod(filePath, 0o644);
        }
      }
      
      this.log('info', '  ✓ SSH file permissions corrected');
      this.log('info', '✅ Terminal connections fixed successfully');
      
    } catch (error) {
      this.log('error', `❌ Error fixing terminal connections: ${error.message}`);
      // Don't throw - allow restore to continue even if SSH fix fails
    }
  }

  // Recreate Guacamole connections
  async recreateGuacamoleConnections() {
    try {
      const { recreateGuacamoleConnections } = require('../recreateGuacamoleConnections');
      const result = await recreateGuacamoleConnections();
      
      if (result.skipped) {
        this.log('info', '  ℹ️ Guacamole not available, skipped connection recreation');
      } else {
        this.log('info', `  ✓ Recreated ${result.recreated} Guacamole connections`);
        if (result.errors > 0) {
          this.log('warn', `  ⚠️ Failed to recreate ${result.errors} connections`);
        }
      }
    } catch (error) {
      this.log('warn', '  ⚠️ Could not recreate Guacamole connections:', error.message);
    }
  }

  // Run post-restore hook
  async runPostRestoreHook() {
    try {
      const hookPath = path.join(__dirname, '../../post-restore-hook.sh');
      const hookExists = await fs.access(hookPath).then(() => true).catch(() => false);
      
      if (hookExists) {
        execSync(`bash ${hookPath}`, { timeout: 60000 });
        this.log('info', '  ✓ Post-restore hook executed');
      } else {
        this.log('info', '  ℹ️ No post-restore hook found');
      }
    } catch (error) {
      this.log('warn', '  ⚠️ Post-restore hook failed:', error.message);
    }
  }

  // Verify restore integrity
  async verifyRestore(connection, backupData) {
    this.log('info', '🔍 Verifying restore integrity...');
    
    const verification = {
      tables: {},
      issues: []
    };

    for (const table in backupData.data) {
      if (Array.isArray(backupData.data[table])) {
        const expectedCount = backupData.data[table].length;
        const [result] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
        const actualCount = result[0].count;
        
        verification.tables[table] = {
          expected: expectedCount,
          actual: actualCount,
          match: expectedCount === actualCount
        };

        if (!verification.tables[table].match) {
          verification.issues.push(`Table ${table}: expected ${expectedCount}, got ${actualCount}`);
        }
      }
    }

    return verification;
  }
}

module.exports = RestoreManager;