// Backup Validator - Ensures backup integrity and completeness
const crypto = require('crypto');

class BackupValidator {
  constructor() {
    this.requiredTables = [
      'appliances',
      'categories',
      'user_settings',
      'background_images',
      'hosts',
      'ssh_keys',
      'appliance_commands',
      'users',
      'audit_logs',
      'role_permissions',
      'user_appliance_permissions',
      'service_command_logs',
      'sessions'
    ];
    
    this.optionalTables = [
      'guacamole_connections'
    ];
  }

  // Validate backup structure and data integrity
  validateBackup(backupData) {
    const errors = [];
    const warnings = [];

    // Check basic structure
    if (!backupData.version) {
      errors.push('Missing backup version');
    }
    if (!backupData.created_at) {
      errors.push('Missing backup creation timestamp');
    }
    if (!backupData.data) {
      errors.push('Missing backup data');
      return { valid: false, errors, warnings };
    }

    // Check for all required data sections
    for (const table of this.requiredTables) {
      if (!backupData.data[table]) {
        warnings.push(`Missing table: ${table}`);
      }
    }

    // Validate data integrity
    this.validateAppliances(backupData.data.appliances, errors, warnings);
    this.validateCategories(backupData.data.categories, errors, warnings);
    // SSH data validation removed - ssh_hosts no longer used
    this.validateUsers(backupData.data.users, errors, warnings);
    this.validateBackgroundImages(backupData.data.background_images, errors, warnings);
    this.validateGuacamoleConnections(backupData.data.guacamole_connections, errors, warnings);

    // Calculate and verify checksum if present
    if (backupData.checksum) {
      const calculatedChecksum = this.calculateChecksum(backupData.data);
      if (calculatedChecksum !== backupData.checksum) {
        errors.push('Backup checksum mismatch - data may be corrupted');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      statistics: this.generateStatistics(backupData)
    };
  }

  validateAppliances(appliances, errors, warnings) {
    if (!Array.isArray(appliances)) {
      errors.push('Appliances must be an array');
      return;
    }

    const seenIds = new Set();
    const seenNames = new Set();

    appliances.forEach((app, index) => {
      if (!app.id) {
        errors.push(`Appliance at index ${index} missing ID`);
      } else if (seenIds.has(app.id)) {
        errors.push(`Duplicate appliance ID: ${app.id}`);
      } else {
        seenIds.add(app.id);
      }

      if (!app.name) {
        errors.push(`Appliance at index ${index} missing name`);
      } else if (seenNames.has(app.name)) {
        warnings.push(`Duplicate appliance name: ${app.name}`);
      } else {
        seenNames.add(app.name);
      }

      if (!app.url) {
        errors.push(`Appliance ${app.name || index} missing URL`);
      }

      // Check service commands consistency
      if (app.start_command || app.stop_command || app.status_command) {
        if (!app.ssh_connection) {
          warnings.push(`Appliance ${app.name} has service commands but no SSH connection`);
        }
      }
      
      // Check remote desktop consistency
      if (app.remote_desktop_enabled) {
        if (!app.remote_host) {
          warnings.push(`Appliance ${app.name} has remote desktop enabled but no host`);
        }
        if (!app.remote_port) {
          warnings.push(`Appliance ${app.name} has remote desktop enabled but no port`);
        }
      }
    });
  }

  validateCategories(categories, errors, warnings) {
    if (!Array.isArray(categories)) {
      errors.push('Categories must be an array');
      return;
    }

    const seenNames = new Set();
    categories.forEach((cat, index) => {
      if (!cat.name) {
        errors.push(`Category at index ${index} missing name`);
      } else if (seenNames.has(cat.name)) {
        errors.push(`Duplicate category name: ${cat.name}`);
      } else {
        seenNames.add(cat.name);
      }
    });
  }

  // SSH data validation - only validate ssh_keys
  validateSSHData(data, errors, warnings) {
    const { ssh_keys } = data;

    // Validate SSH keys only
    if (Array.isArray(ssh_keys)) {
      ssh_keys.forEach((key, index) => {
        if (!key.key_name) {
          errors.push(`SSH key at index ${index} missing key_name`);
        }
        if (!key.private_key && !key.filesystem_error) {
          warnings.push(`SSH key ${key.key_name || index} missing private key data`);
        }
        if (!key.public_key && !key.filesystem_error) {
          warnings.push(`SSH key ${key.key_name || index} missing public key data`);
        }
      });
    }
    
    // Legacy support: skip ssh_hosts and ssh_config validation
    if (data.ssh_hosts) {
      warnings.push('Backup contains deprecated ssh_hosts data - will be skipped during restore');
    }
    if (data.ssh_config) {
      warnings.push('Backup contains deprecated ssh_config data - will be skipped during restore');
    }
  }

  validateUsers(users, errors, warnings) {
    if (!Array.isArray(users)) {
      errors.push('Users must be an array');
      return;
    }

    const seenUsernames = new Set();
    const seenEmails = new Set();

    users.forEach((user, index) => {
      if (!user.username) {
        errors.push(`User at index ${index} missing username`);
      } else if (seenUsernames.has(user.username)) {
        errors.push(`Duplicate username: ${user.username}`);
      } else {
        seenUsernames.add(user.username);
      }

      if (!user.email) {
        errors.push(`User ${user.username || index} missing email`);
      } else if (seenEmails.has(user.email)) {
        errors.push(`Duplicate email: ${user.email}`);
      } else {
        seenEmails.add(user.email);
      }

      if (!user.password_hash) {
        warnings.push(`User ${user.username || index} missing password hash`);
      }
    });
  }

  validateBackgroundImages(images, errors, warnings) {
    if (!Array.isArray(images)) {
      return;
    }

    images.forEach((img, index) => {
      if (!img.filename) {
        errors.push(`Background image at index ${index} missing filename`);
      }
      if (!img.file_data && !img.file_missing && !img.file_error) {
        warnings.push(`Background image ${img.filename || index} missing file data`);
      }
    });
  }

  validateGuacamoleConnections(connections, errors, warnings) {
    if (!connections) {
      // Guacamole connections are optional
      return;
    }
    
    if (!Array.isArray(connections)) {
      errors.push('Guacamole connections must be an array');
      return;
    }
    
    connections.forEach((conn, index) => {
      if (!conn.connection_name) {
        errors.push(`Guacamole connection at index ${index} missing connection_name`);
      }
      if (!conn.protocol) {
        errors.push(`Guacamole connection ${conn.connection_name || index} missing protocol`);
      }
      if (!['vnc', 'rdp', 'ssh', 'telnet'].includes(conn.protocol)) {
        warnings.push(`Guacamole connection ${conn.connection_name || index} has unknown protocol: ${conn.protocol}`);
      }
      if (!conn.parameters || typeof conn.parameters !== 'object') {
        warnings.push(`Guacamole connection ${conn.connection_name || index} missing parameters`);
      }
    });
  }

  calculateChecksum(data) {
    const dataString = JSON.stringify(data);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  generateStatistics(backupData) {
    const stats = {
      version: backupData.version,
      created_at: backupData.created_at,
      total_size: JSON.stringify(backupData).length,
      tables: {}
    };

    if (backupData.data) {
      Object.keys(backupData.data).forEach(table => {
        const tableData = backupData.data[table];
        stats.tables[table] = {
          count: Array.isArray(tableData) ? tableData.length : 0,
          size: JSON.stringify(tableData).length
        };
      });
    }

    return stats;
  }

  // Generate a detailed backup report
  generateReport(backupData) {
    const validation = this.validateBackup(backupData);
    const report = {
      timestamp: new Date().toISOString(),
      backup_info: {
        version: backupData.version,
        created_at: backupData.created_at,
        created_by: backupData.created_by
      },
      validation: {
        status: validation.valid ? 'VALID' : 'INVALID',
        errors: validation.errors,
        warnings: validation.warnings
      },
      statistics: validation.statistics,
      data_summary: {}
    };

    // Add detailed summaries for each data type
    if (backupData.data) {
      if (backupData.data.appliances) {
        report.data_summary.appliances = {
          total: backupData.data.appliances.length,
          with_ssh: backupData.data.appliances.filter(a => a.ssh_connection).length,
          with_services: backupData.data.appliances.filter(a => a.start_command || a.stop_command).length,
          favorites: backupData.data.appliances.filter(a => a.isFavorite).length,
          with_remote_desktop: backupData.data.appliances.filter(a => a.remote_desktop_enabled).length
        };
      }

      if (backupData.data.ssh_keys) {
        report.data_summary.ssh_keys = {
          total: backupData.data.ssh_keys.length,
          with_private_key: backupData.data.ssh_keys.filter(k => k.private_key).length,
          with_public_key: backupData.data.ssh_keys.filter(k => k.public_key).length,
          filesystem_synced: backupData.data.ssh_keys.filter(k => k.filesystem_synced).length
        };
      }

      if (backupData.data.users) {
        report.data_summary.users = {
          total: backupData.data.users.length,
          admins: backupData.data.users.filter(u => u.role === 'admin').length,
          active: backupData.data.users.filter(u => u.is_active).length,
          with_passwords: backupData.data.users.filter(u => u.password_hash).length
        };
      }

      if (backupData.data.guacamole_connections) {
        report.data_summary.guacamole_connections = {
          total: backupData.data.guacamole_connections.length,
          by_protocol: backupData.data.guacamole_connections.reduce((acc, conn) => {
            acc[conn.protocol] = (acc[conn.protocol] || 0) + 1;
            return acc;
          }, {})
        };
      }
    }

    return report;
  }
}

module.exports = BackupValidator;