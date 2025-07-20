// Enhanced Backup Manager - Comprehensive backup and restore functionality
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const BackupValidator = require('./backupValidator');
const GuacamoleBackupManager = require('./guacamoleBackupManager');

class BackupManager {
  constructor(pool) {
    this.pool = pool;
    this.validator = new BackupValidator();
    this.guacamoleBackup = new GuacamoleBackupManager();
    this.backupDir = path.join(__dirname, '../../', 'backups');
  }

  // Create a comprehensive backup with all data and verification
  async createFullBackup(userId = null, username = 'system') {
    const startTime = Date.now();
    const backupId = crypto.randomBytes(16).toString('hex');
    
    console.log(`🔄 Starting comprehensive backup ${backupId}...`);

    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true });

      // Collect all data
      const backupData = await this.collectAllData();
      
      // Add metadata
      backupData.id = backupId;
      backupData.version = await this.getSystemVersion();
      backupData.created_at = new Date().toISOString();
      backupData.created_by = username;
      backupData.system_info = await this.getSystemInfo();
      
      // Calculate checksum
      backupData.checksum = this.validator.calculateChecksum(backupData.data);
      
      // Validate backup
      const validation = this.validator.validateBackup(backupData);
      if (!validation.valid) {
        throw new Error(`Backup validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Save backup to file
      const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}_${backupId}.json`;
      const filepath = path.join(this.backupDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(backupData, null, 2));
      
      // Generate report
      const report = this.validator.generateReport(backupData);
      report.filename = filename;
      report.filepath = filepath;
      report.size_mb = (JSON.stringify(backupData).length / 1024 / 1024).toFixed(2);
      report.duration_ms = Date.now() - startTime;
      
      console.log(`✅ Backup completed in ${report.duration_ms}ms`);
      console.log(`📁 Saved to: ${filepath}`);
      console.log(`📊 Size: ${report.size_mb} MB`);
      
      return {
        success: true,
        backup_id: backupId,
        filename,
        report
      };
    } catch (error) {
      console.error('❌ Backup failed:', error);
      throw error;
    }
  }

  // Collect all data from database and filesystem
  async collectAllData() {
    const data = {};
    
    // Database tables to backup
    const tables = [
      'appliances',
      'categories',
      'user_settings',
      'background_images',
      'ssh_hosts',
      'ssh_keys',
      'ssh_config',
      'appliance_commands',
      'users',
      'audit_logs',
      'role_permissions',
      'user_appliance_permissions',
      'service_command_logs',
      'sessions'
    ];
    
    // Collect data from each table
    for (const table of tables) {
      try {
        console.log(`📊 Backing up table: ${table}`);
        const [rows] = await this.pool.execute(`SELECT * FROM ${table}`);
        data[table] = rows;
        console.log(`  ✓ ${rows.length} records`);
      } catch (error) {
        console.error(`  ✗ Error backing up ${table}:`, error.message);
        data[table] = [];
      }
    }
    
    // Enhance specific data types
    await this.enhanceSSHKeys(data.ssh_keys);
    await this.enhanceBackgroundImages(data.background_images);
    await this.collectFilesystemData(data);
    
    // Collect Guacamole connections if available
    if (await this.guacamoleBackup.isAvailable()) {
      try {
        data.guacamole_connections = await this.guacamoleBackup.exportConnections();
        console.log(`✅ Backed up ${data.guacamole_connections.length} Guacamole connections`);
      } catch (error) {
        console.warn('⚠️ Could not backup Guacamole connections:', error.message);
        data.guacamole_connections = [];
      }
    } else {
      console.log('ℹ️ Guacamole database not available, skipping connection backup');
      data.guacamole_connections = [];
    }
    
    return { data };
  }

  // Enhance SSH keys with filesystem data
  async enhanceSSHKeys(sshKeys) {
    if (!Array.isArray(sshKeys)) return;
    
    const sshDir = '/root/.ssh';
    
    for (const key of sshKeys) {
      try {
        const privateKeyPath = path.join(sshDir, `id_rsa_${key.key_name}`);
        const publicKeyPath = path.join(sshDir, `id_rsa_${key.key_name}.pub`);
        
        // Read private key if exists
        try {
          key.private_key = await fs.readFile(privateKeyPath, 'utf8');
          key.private_key_exists = true;
        } catch (e) {
          key.private_key_exists = false;
          key.private_key_error = e.message;
        }
        
        // Read public key if exists
        try {
          key.public_key = await fs.readFile(publicKeyPath, 'utf8');
          key.public_key_exists = true;
        } catch (e) {
          key.public_key_exists = false;
          key.public_key_error = e.message;
        }
        
        key.filesystem_checked = true;
      } catch (error) {
        key.filesystem_error = error.message;
      }
    }
  }

  // Enhance background images with file data
  async enhanceBackgroundImages(backgroundImages) {
    if (!Array.isArray(backgroundImages)) return;
    
    const backgroundsDir = path.join(__dirname, '../../uploads/backgrounds');
    
    for (const img of backgroundImages) {
      try {
        const filepath = path.join(backgroundsDir, img.filename);
        const fileBuffer = await fs.readFile(filepath);
        img.file_data = fileBuffer.toString('base64');
        img.file_exists = true;
        img.actual_size = fileBuffer.length;
      } catch (error) {
        img.file_exists = false;
        img.file_error = error.message;
      }
    }
  }

  // Collect additional filesystem data
  async collectFilesystemData(data) {
    data.filesystem = {
      ssh_config: {},
      nginx_config: {},
      env_files: {}
    };
    
    // Collect SSH config
    try {
      data.filesystem.ssh_config.content = await fs.readFile('/root/.ssh/config', 'utf8');
      data.filesystem.ssh_config.exists = true;
    } catch (e) {
      data.filesystem.ssh_config.exists = false;
      data.filesystem.ssh_config.error = e.message;
    }
    
    // Collect .env file (sanitized)
    try {
      const envContent = await fs.readFile(path.join(__dirname, '../../.env'), 'utf8');
      data.filesystem.env_files.backend = this.sanitizeEnvFile(envContent);
    } catch (e) {
      data.filesystem.env_files.backend_error = e.message;
    }
    
    // Collect nginx config
    try {
      const nginxConfPath = path.join(__dirname, '../../../nginx/default.conf');
      data.filesystem.nginx_config.content = await fs.readFile(nginxConfPath, 'utf8');
      data.filesystem.nginx_config.exists = true;
    } catch (e) {
      data.filesystem.nginx_config.exists = false;
      data.filesystem.nginx_config.error = e.message;
    }
  }

  // Sanitize .env file to remove sensitive data
  sanitizeEnvFile(content) {
    const lines = content.split('\n');
    const sanitized = lines.map(line => {
      // Keep non-sensitive settings
      if (line.includes('=') && !line.startsWith('#')) {
        const [key, value] = line.split('=', 2);
        const sensitiveKeys = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN'];
        
        if (sensitiveKeys.some(sk => key.includes(sk))) {
          return `${key}=<REDACTED>`;
        }
      }
      return line;
    });
    
    return sanitized.join('\n');
  }

  // Get system version
  async getSystemVersion() {
    try {
      const versionFile = await fs.readFile(path.join(__dirname, '../../../VERSION'), 'utf8');
      return versionFile.trim();
    } catch (e) {
      return '2.8.0'; // Fallback version
    }
  }

  // Get system information
  async getSystemInfo() {
    return {
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: {
        total_mb: Math.round(require('os').totalmem() / 1024 / 1024),
        free_mb: Math.round(require('os').freemem() / 1024 / 1024)
      },
      docker: await this.isDocker(),
      backup_timestamp: new Date().toISOString()
    };
  }

  // Check if running in Docker
  async isDocker() {
    try {
      await fs.access('/.dockerenv');
      return true;
    } catch {
      return false;
    }
  }

  // List available backups
  async listBackups() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      const files = await fs.readdir(this.backupDir);
      const backups = [];
      
      for (const file of files) {
        if (file.endsWith('.json') && file.startsWith('backup_')) {
          try {
            const filepath = path.join(this.backupDir, file);
            const stat = await fs.stat(filepath);
            const content = await fs.readFile(filepath, 'utf8');
            const data = JSON.parse(content);
            
            backups.push({
              filename: file,
              filepath,
              size_mb: (stat.size / 1024 / 1024).toFixed(2),
              created_at: data.created_at,
              created_by: data.created_by,
              version: data.version,
              id: data.id,
              valid: this.validator.validateBackup(data).valid
            });
          } catch (e) {
            console.error(`Error reading backup ${file}:`, e);
          }
        }
      }
      
      // Sort by creation date (newest first)
      backups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      return backups;
    } catch (error) {
      console.error('Error listing backups:', error);
      return [];
    }
  }

  // Load backup from file
  async loadBackup(filename) {
    const filepath = path.join(this.backupDir, filename);
    const content = await fs.readFile(filepath, 'utf8');
    return JSON.parse(content);
  }

  // Delete old backups (keep last N)
  async cleanupOldBackups(keepCount = 10) {
    const backups = await this.listBackups();
    
    if (backups.length <= keepCount) {
      return { deleted: 0, kept: backups.length };
    }
    
    const toDelete = backups.slice(keepCount);
    let deleted = 0;
    
    for (const backup of toDelete) {
      try {
        await fs.unlink(backup.filepath);
        deleted++;
        console.log(`🗑️ Deleted old backup: ${backup.filename}`);
      } catch (e) {
        console.error(`Error deleting backup ${backup.filename}:`, e);
      }
    }
    
    return { deleted, kept: keepCount };
  }
}

module.exports = BackupManager;