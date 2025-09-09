// Backup and Restore API routes
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');
const { verifyToken } = require('../utils/auth');
const { createAuditLog } = require('../utils/auditLogger');
const { broadcast } = require('./sse');
const { mapJsToDb } = require('../utils/dbFieldMapping');
const { genericMapJsToDb, prepareInsert } = require('../utils/genericFieldMapping');
const bcrypt = require('bcryptjs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
// WICHTIG: Verwende encryptionManager für konsistente CBC-Verschlüsselung!
const { encryptionManager } = require('../utils/encryption');
// Nicht mehr benötigt - wir verwenden encryptionManager statt crypto.js
// const { encrypt: cryptoEncrypt, decrypt: cryptoDecrypt } = require('../utils/crypto');
const { v4: uuidv4 } = require('uuid');

// Import SSE progress update function (will be available when restoreProgress router is loaded)
let sendProgressUpdate = null;
let restoreSessions = null;

// Lazy load SSE functions to avoid circular dependencies
const getSSEFunctions = () => {
  if (!sendProgressUpdate) {
    try {
      const restoreProgress = require('./restoreProgress');
      sendProgressUpdate = restoreProgress.sendProgressUpdate;
      restoreSessions = restoreProgress.restoreSessions;
    } catch (e) {
      console.log('SSE progress functions not yet available');
    }
  }
  return { sendProgressUpdate, restoreSessions };
};

// Initialize QueryBuilder
const db = new QueryBuilder(pool);

// Get backup statistics
router.get('/backup/stats', verifyToken, async (req, res) => {
  try {
    // Get last backup from audit logs
    const lastBackupLogs = await db.select(
      'audit_logs',
      { action: 'backup_create' },
      { orderBy: 'createdAt', orderDir: 'DESC', limit: 1 }
    );

    // Get total backups count from audit logs
    const backupCountResult = await db.count('audit_logs', { action: 'backup_create' });
    const backupCount = backupCountResult;

    // Calculate approximate backup size based on current data
    const applianceCount = await db.count('appliances');
    const categoryCount = await db.count('categories');
    const settingsCount = await db.count('user_settings');
    
    // For background images, we need sum - use raw query
    const [bgImageCount] = await db.raw(
      'SELECT COUNT(*) as count, SUM(file_size) as total_size FROM background_images'
    );
    
    // Count active hosts
    const hostsCount = await db.count('hosts', { isActive: true });
    const sshKeyCount = await db.count('ssh_keys');

    // Estimate backup size more accurately
    const estimatedSize =
      applianceCount * 1024 + // ~1KB per appliance
      categoryCount * 512 + // ~0.5KB per category
      settingsCount * 256 + // ~0.25KB per setting
      hostsCount * 1024 + // ~1KB per host (includes remote desktop settings)
      sshKeyCount * 4096 + // ~4KB per SSH key (includes key data)
      (bgImageCount.total_size || 0); // actual size of images

    // If we have a last backup, try to get its actual size from the audit log details
    let lastBackupSize = formatBytes(estimatedSize);
    if (lastBackupLogs[0] && lastBackupLogs[0].details) {
      try {
        const details = JSON.parse(lastBackupLogs[0].details);
        if (details.backup_size) {
          lastBackupSize = formatBytes(details.backup_size);
        }
      } catch (e) {
        // Use estimated size if parsing fails
      }
    }

    const stats = {
      totalBackups: backupCount,
      lastBackupSize,
      lastBackupDate: lastBackupLogs[0]?.createdAt || null,
      nextScheduled: null, // Could be implemented if scheduled backups are added
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching backup stats:', error);
    res.status(500).json({
      error: 'Failed to fetch backup statistics',
      totalBackups: 0,
      lastBackupSize: '0 KB',
      lastBackupDate: null,
      nextScheduled: null,
    });
  }
});

// Helper function to format bytes
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 KB';
  const k = 1024;
  const sizes = ['KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return size + ' ' + (sizes[i] || 'KB');
}

// Backup endpoint - Export all data INCLUDING settings and background images
router.get('/backup', verifyToken, async (req, res) => {
  try {
    // Generate a random backup encryption key
    const crypto = require('crypto');
    const backupKey = crypto.randomBytes(32).toString('hex');

    // Function to re-encrypt password for backup
    // WICHTIG: Nutze encryptionManager (CBC) für konsistente Verschlüsselung!
    const reEncryptForBackup = (encryptedData) => {
      if (!encryptedData) return null;
      
      try {
        // Use encryptionManager's reEncrypt function
        // This handles CBC encryption properly
        const systemKey = encryptionManager.getSystemKey();
        const result = encryptionManager.reEncrypt(encryptedData, systemKey, backupKey);
        
        if (!result) {
          console.error('Failed to re-encrypt data for backup');
          return encryptedData; // Return original if re-encryption fails
        }
        
        return result;
      } catch (error) {
        console.error('Failed to re-encrypt for backup:', error.message);
        return encryptedData; // Return original if re-encryption fails
      }
    };
    // Fetch all appliances and re-encrypt passwords for backup
    const rawAppliances = await db.select('appliances', {}, { orderBy: 'createdAt' });
    
    // Re-encrypt appliance passwords (decrypt with system key, encrypt with backup key)
    const appliances = rawAppliances.map(appliance => ({
      ...appliance,
      remotePasswordEncrypted: reEncryptForBackup(appliance.remotePasswordEncrypted),
      rustdeskPasswordEncrypted: reEncryptForBackup(appliance.rustdeskPasswordEncrypted)
    }));

    // Fetch all categories
    let categories = [];
    try {
      categories = await db.select('categories', {}, { orderBy: 'orderIndex' });
    } catch (error) {
      console.error('Error fetching categories for backup:', error.message);
    }

    // Fetch all user settings
    let settings = [];
    try {
      settings = await db.select('user_settings', {}, { orderBy: 'settingKey' });
    } catch (error) {
      console.error('Error fetching settings for backup:', error.message);
    }

    // Fetch background images metadata
    let backgroundImages = [];
    try {
      backgroundImages = await db.select('background_images', {}, { orderBy: 'createdAt', orderDir: 'DESC' });
    } catch (error) {
      console.error(
        'Error fetching background images for backup:',
        error.message
      );
    }

    // Fetch role permissions
    let rolePermissions = [];
    try {
      rolePermissions = await db.raw('SELECT * FROM role_permissions ORDER BY role, permission');

    } catch (error) {
      console.error(
        'Error fetching role permissions for backup:',
        error.message
      );
    }

    // Fetch user appliance permissions
    let userAppliancePermissions = [];
    try {
      userAppliancePermissions = await db.raw('SELECT * FROM user_appliance_permissions ORDER BY user_id, appliance_id');

    } catch (error) {
      console.error(
        'Error fetching user appliance permissions for backup:',
        error.message
      );
    }

    // Fetch SSH hosts and keys with enhanced filesystem integration
    let sshHosts = [];
    let sshKeys = [];
    let sshConfig = [];
    let sshBackupSuccess = false;
    
    // Fetch hosts table (SSH Terminal hosts)
    let hosts = [];
    try {
      const rawHosts = await db.select('hosts', {}, { orderBy: 'createdAt' });
      // Re-encrypt passwords in hosts (decrypt with system key, encrypt with backup key)
      // QueryBuilder returns camelCase fields, so we need to use the correct names
      hosts = rawHosts.map(host => ({
        ...host,
        password: reEncryptForBackup(host.password),
        privateKey: reEncryptForBackup(host.privateKey), // Added: private SSH key
        remotePassword: reEncryptForBackup(host.remotePassword), // This is correct (camelCase from QueryBuilder)
        rustdeskPassword: reEncryptForBackup(host.rustdeskPassword) // This is correct (camelCase from QueryBuilder)
      }));

    } catch (error) {
      console.error('Error fetching hosts for backup:', error.message);
    }

    // Fetch Guacamole database backup
    let guacamoleBackup = null;
    const includeGuacamole = process.env.GUACAMOLE_DB_HOST && process.env.GUACAMOLE_DB_NAME;
    
    if (includeGuacamole) {
      try {

        // Use pg_dump to export Guacamole database
        const guacHost = process.env.GUACAMOLE_DB_HOST || 'appliance_guacamole_db';
        const guacPort = process.env.GUACAMOLE_DB_PORT || '5432';
        const guacDb = process.env.GUACAMOLE_DB_NAME || 'guacamole_db';
        const guacUser = process.env.GUACAMOLE_DB_USER || 'guacamole_user';
        const guacPass = process.env.GUACAMOLE_DB_PASSWORD || 'guacamole_pass123';
        
        // Create pg_dump command - use docker exec if running in container
        const pgDumpCmd = `docker exec appliance_guacamole_db pg_dump -U ${guacUser} -d ${guacDb} --clean --if-exists --no-owner --no-acl`;
        
        try {
          const { stdout, stderr } = await execAsync(pgDumpCmd, {
            maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large databases
            env: { ...process.env, PGPASSWORD: guacPass }
          });
          
          if (stderr && !stderr.includes('warning')) {

          }
          
          // Compress the SQL dump using base64 encoding
          const compressedDump = Buffer.from(stdout).toString('base64');
          
          guacamoleBackup = {
            type: 'postgresql',
            version: '1.5.5', // Guacamole version
            created_at: new Date().toISOString(),
            database_name: guacDb,
            compressed: true,
            encoding: 'base64',
            data: compressedDump,
            size_bytes: stdout.length,
            size_compressed: compressedDump.length
          };

        } catch (cmdError) {
          // Fallback: Try to connect directly if docker exec fails

          // For direct connection, we'd need pg_dump installed locally
          // This is a fallback that likely won't work in containerized environment
          const directCmd = `PGPASSWORD="${guacPass}" pg_dump -h ${guacHost} -p ${guacPort} -U ${guacUser} -d ${guacDb} --clean --if-exists --no-owner --no-acl`;
          
          try {
            const { stdout } = await execAsync(directCmd, {
              maxBuffer: 50 * 1024 * 1024
            });
            
            const compressedDump = Buffer.from(stdout).toString('base64');
            guacamoleBackup = {
              type: 'postgresql',
              version: '1.5.5',
              created_at: new Date().toISOString(),
              database_name: guacDb,
              compressed: true,
              encoding: 'base64',
              data: compressedDump,
              size_bytes: stdout.length,
              size_compressed: compressedDump.length
            };

          } catch (directError) {
            console.error('❌ Could not create Guacamole backup:', directError.message);

          }
        }
      } catch (error) {
        console.error('❌ Error creating Guacamole backup:', error.message);

      }
    } else {

    }
    
    // Fetch services table
    let services = [];
    try {
      const rawServices = await db.select('services', {}, { orderBy: 'createdAt' });
      // Re-encrypt passwords in services (decrypt with system key, encrypt with backup key)
      services = rawServices.map(service => ({
        ...service,
        sshPassword: reEncryptForBackup(service.sshPassword),
        vncPassword: reEncryptForBackup(service.vncPassword),
        rdpPassword: reEncryptForBackup(service.rdpPassword)
      }));

    } catch (error) {
      console.error('Error fetching services for backup:', error.message);
    }
    
    // Fetch SSH upload logs
    let sshUploadLogs = [];
    try {
      sshUploadLogs = await db.select(
        'ssh_upload_log', 
        {}, 
        { orderBy: 'createdAt', orderDir: 'DESC', limit: 1000 }
      );

    } catch (error) {
      console.error('Error fetching SSH upload logs for backup:', error.message);
    }

    // Fetch SNMP monitoring configurations
    let hostSnmpConfigs = [];
    try {
      hostSnmpConfigs = await db.select('host_snmp_configs', {}, { orderBy: 'hostId' });

    } catch (error) {
      console.error('Error fetching SNMP configs for backup:', error.message);
    }

    // Fetch host monitoring data (latest 1000 per host)
    let hostMonitoringData = [];
    try {
      hostMonitoringData = await db.select(
        'host_monitoring_data',
        {},
        { orderBy: 'createdAt', orderDir: 'DESC', limit: 5000 }
      );

    } catch (error) {
      console.error('Error fetching host monitoring data for backup:', error.message);
    }

    // Fetch host metrics logging configuration
    let hostMetricsLogging = [];
    try {
      hostMetricsLogging = await db.select('host_metrics_logging', {}, { orderBy: 'hostId' });

    } catch (error) {
      console.error('Error fetching host metrics logging for backup:', error.message);
    }

    // Fetch ALL SNMP metrics (complete historical data - no limit)
    let snmpMetrics = [];
    try {
      // Get total count first for logging
      const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM snmp_metrics');
      const totalMetrics = countResult[0].total;
      console.log(`📊 Backing up ${totalMetrics} SNMP metrics...`);
      
      // Fetch all metrics without limit
      const [metrics] = await pool.execute(
        'SELECT * FROM snmp_metrics ORDER BY timestamp DESC'
      );
      snmpMetrics = metrics;

    } catch (error) {
      console.error('Error fetching SNMP metrics for backup:', error.message);
    }

    // Fetch ALL SNMP interfaces data (complete history - no limit)
    let snmpInterfaces = [];
    try {
      const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM snmp_interfaces');
      const totalInterfaces = countResult[0].total;
      console.log(`📊 Backing up ${totalInterfaces} SNMP interfaces...`);
      
      const [interfaces] = await pool.execute(
        'SELECT * FROM snmp_interfaces ORDER BY collected_at DESC'
      );
      snmpInterfaces = interfaces;

    } catch (error) {
      console.error('Error fetching SNMP interfaces for backup:', error.message);
    }

    // Fetch ALL SNMP disk metrics (complete history - no limit)
    let snmpDiskMetrics = [];
    try {
      const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM snmp_disk_metrics');
      const totalDiskMetrics = countResult[0].total;
      console.log(`📊 Backing up ${totalDiskMetrics} SNMP disk metrics...`);
      
      const [diskMetrics] = await pool.execute(
        'SELECT * FROM snmp_disk_metrics ORDER BY collected_at DESC'
      );
      snmpDiskMetrics = diskMetrics;

    } catch (error) {
      console.error('Error fetching SNMP disk metrics for backup:', error.message);
    }

    // Fetch ALL SNMP errors for debugging (complete history - no limit)
    let snmpErrors = [];
    try {
      const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM snmp_errors');
      const totalErrors = countResult[0].total;
      console.log(`📊 Backing up ${totalErrors} SNMP errors...`);
      
      const [errors] = await pool.execute(
        'SELECT * FROM snmp_errors ORDER BY occurred_at DESC'
      );
      snmpErrors = errors;

    } catch (error) {
      console.error('Error fetching SNMP errors for backup:', error.message);
    }

    // Fetch SNMP thresholds
    let snmpThresholds = [];
    try {
      snmpThresholds = await db.select('snmp_thresholds', {}, { orderBy: 'hostId' });

    } catch (error) {
      console.error('Error fetching SNMP thresholds for backup:', error.message);
    }

    // Fetch host disk metrics
    let hostDiskMetrics = [];
    try {
      hostDiskMetrics = await db.select('host_disk_metrics', {}, { orderBy: 'monitoringDataId' });

    } catch (error) {
      console.error('Error fetching host disk metrics for backup:', error.message);
    }

    // Fetch host network metrics
    let hostNetworkMetrics = [];
    try {
      hostNetworkMetrics = await db.select('host_network_metrics', {}, { orderBy: 'monitoringDataId' });

    } catch (error) {
      console.error('Error fetching host network metrics for backup:', error.message);
    }

    // metric_definitions removed - was part of failed MetricProcessor implementation
    let metricDefinitions = [];

    // Fetch host disk configuration
    let hostDiskConfig = [];
    try {
      const [diskConfig] = await pool.execute('SELECT * FROM host_disk_config ORDER BY host_id');
      hostDiskConfig = diskConfig;
      console.log(`📊 Backing up ${hostDiskConfig.length} disk configurations...`);

    } catch (error) {
      console.error('Error fetching host disk config for backup:', error.message);
    }

    // Fetch SNMP latest metrics
    let snmpLatestMetrics = [];
    try {
      const [latestMetrics] = await pool.execute('SELECT * FROM snmp_latest_metrics ORDER BY host_id');
      snmpLatestMetrics = latestMetrics;
      console.log(`📊 Backing up ${snmpLatestMetrics.length} latest metrics...`);

    } catch (error) {
      console.error('Error fetching SNMP latest metrics for backup:', error.message);
    }

    // Fetch users (INCLUDING password hashes for complete backup)
    let users = [];
    try {
      users = await db.select('users', {}, { orderBy: 'createdAt' });
      
      // Manually fetch password hashes since mapDbToJsForTable removes them for security
      // But we need them for backup/restore functionality
      const [userRows] = await pool.execute(
        'SELECT id, password_hash FROM users ORDER BY id'
      );
      
      // Create a map of user id to password hash
      const passwordHashMap = {};
      userRows.forEach(row => {
        passwordHashMap[row.id] = row.password_hash;
      });
      
      // Add password hashes to users
      users = users.map(user => ({
        ...user,
        password_hash: passwordHashMap[user.id]
      }));

    } catch (error) {
      console.error('Error fetching users for backup:', error.message);
    }

    // Fetch audit logs (last 1000 entries)
    let auditLogs = [];
    try {
      const auditLogsResult = await db.select(
        'audit_logs',
        {},
        { orderBy: 'createdAt', orderDir: 'DESC', limit: 1000 }
      );
      // Reverse to have oldest first for correct restore order
      auditLogs = auditLogsResult.reverse();

    } catch (error) {
      console.error('Error fetching audit logs for backup:', error.message);
    }

    try {

      // ssh_hosts table removed - no longer backing up
      const keysResult = await db.select('ssh_keys', {}, { orderBy: 'keyName' });
      // ssh_config table removed
      sshHosts = []; // No longer used
      sshConfig = []; // No longer used

      // Debug: Log first key if exists
      if (keysResult.length > 0) {

      }

      if (keysResult.length > 0) {
        // Enhance SSH keys with actual file content from filesystem
        const enhancedSshKeys = [];
        const sshDir = '/root/.ssh';

        for (const key of keysResult) {
          try {
            // Use user-specific naming to find the correct SSH key files
            const keyFileName = `id_rsa_user${key.created_by || key.createdBy}_${key.key_name || key.keyName}`;
            const privateKeyPath = path.join(sshDir, keyFileName);
            const publicKeyPath = path.join(sshDir, `${keyFileName}.pub`);
            
            // Also try the old naming convention as fallback
            const oldPrivateKeyPath = path.join(sshDir, `id_rsa_${key.key_name || key.keyName}`);
            const oldPublicKeyPath = path.join(sshDir, `id_rsa_${key.key_name || key.keyName}.pub`);

            let privateKeyContent = key.private_key || '';
            let publicKeyContent = key.public_key || '';
            let filesystemSynced = false;
            let filesystemError = null;

            // Prioritize database content if it exists and has substantial data
            const hasDbPrivateKey =
              privateKeyContent && privateKeyContent.length > 100;
            const hasDbPublicKey =
              publicKeyContent && publicKeyContent.length > 50;

            // Try to read actual key files if they exist
            try {
              // First try user-specific path, then old path
              let privateExists = await fs
                .access(privateKeyPath)
                .then(() => true)
                .catch(() => false);
              
              let actualPrivatePath = privateKeyPath;
              if (!privateExists) {
                // Try old path
                privateExists = await fs
                  .access(oldPrivateKeyPath)
                  .then(() => true)
                  .catch(() => false);
                if (privateExists) {
                  actualPrivatePath = oldPrivateKeyPath;
                }
              }
              
              if (privateExists && !hasDbPrivateKey) {
                privateKeyContent = await fs.readFile(actualPrivatePath, 'utf8');

                filesystemSynced = true;
              } else if (hasDbPrivateKey) {

                filesystemSynced = true;
              }
            } catch (readError) {

              filesystemError = readError.message;
            }

            try {
              // First try user-specific path, then old path
              let publicExists = await fs
                .access(publicKeyPath)
                .then(() => true)
                .catch(() => false);
              
              let actualPublicPath = publicKeyPath;
              if (!publicExists) {
                // Try old path
                publicExists = await fs
                  .access(oldPublicKeyPath)
                  .then(() => true)
                  .catch(() => false);
                if (publicExists) {
                  actualPublicPath = oldPublicKeyPath;
                }
              }
              
              if (publicExists && !hasDbPublicKey) {
                publicKeyContent = await fs.readFile(actualPublicPath, 'utf8');

              } else if (hasDbPublicKey) {

              }
            } catch (readError) {

              if (!filesystemError) filesystemError = readError.message;
            }

            // SICHERHEITSKRITISCH: SSH Private Keys mit Backup-Schlüssel verschlüsseln!
            // Private key ist bereits in DB oder von Filesystem
            // Falls aus DB: erst mit System-Key entschlüsseln, dann mit Backup-Key verschlüsseln
            let processedPrivateKey = privateKeyContent;
            if (privateKeyContent) {
              // Check if it's from DB and encrypted
              if (hasDbPrivateKey && encryptionManager.isEncrypted(key.private_key || key.privateKey)) {
                // Decrypt with system key first
                const decrypted = encryptionManager.decrypt(key.private_key || key.privateKey);
                if (decrypted) {
                  processedPrivateKey = decrypted;
                }
              }
              // Now encrypt with backup key
              processedPrivateKey = encryptionManager.encrypt(processedPrivateKey, backupKey);
            }
            
            enhancedSshKeys.push({
              ...key,
              private_key: processedPrivateKey,  // VERSCHLÜSSELT mit Backup-Key!
              privateKey: processedPrivateKey,   // Both fields for compatibility
              public_key: publicKeyContent,      // Public keys bleiben unverschlüsselt (nicht sensitiv)
              publicKey: publicKeyContent,
              filesystem_synced: filesystemSynced,
              filesystem_error: filesystemError,
              backup_timestamp: new Date().toISOString(),
              key_size_bytes: privateKeyContent.length,
              has_private_key: privateKeyContent.length > 0,
              has_public_key: publicKeyContent.length > 0,
              // Ensure created_by is included (this is critical for key path reconstruction)
              created_by: key.created_by || key.createdBy || null,
              fingerprint: key.fingerprint || null,
              key_name: key.key_name || key.keyName,  // Ensure consistent field name
            });
          } catch (keyError) {

            // Include the key anyway, even if filesystem read failed
            // SICHERHEITSKRITISCH: Auch hier private Keys mit Backup-Schlüssel verschlüsseln!
            let fallbackPrivateKey = key.private_key || key.privateKey || '';
            if (fallbackPrivateKey) {
              // First decrypt with system key if encrypted
              if (encryptionManager.isEncrypted(fallbackPrivateKey)) {
                const decrypted = encryptionManager.decrypt(fallbackPrivateKey);
                if (decrypted) {
                  fallbackPrivateKey = decrypted;
                }
              }
              // Then encrypt with backup key
              fallbackPrivateKey = encryptionManager.encrypt(fallbackPrivateKey, backupKey);
            }
            
            enhancedSshKeys.push({
              ...key,
              private_key: fallbackPrivateKey,  // VERSCHLÜSSELT mit Backup-Key!
              privateKey: fallbackPrivateKey,   // Both fields for compatibility
              public_key: key.public_key || key.publicKey || '',
              publicKey: key.public_key || key.publicKey || '',
              filesystem_synced: false,
              filesystem_error: keyError.message,
              backup_timestamp: new Date().toISOString(),
              has_private_key: (key.private_key || '').length > 0,
              has_public_key: (key.public_key || '').length > 0,
              // Ensure created_by is included (this is critical for key path reconstruction)
              created_by: key.created_by || key.createdBy || null,
              fingerprint: key.fingerprint || null,
              key_name: key.key_name || key.keyName,  // Ensure consistent field name
            });
          }
        }

        sshKeys = enhancedSshKeys;

        // Check if we have successful SSH key backup
        const keysWithData = sshKeys.filter(
          key => key.has_private_key && key.has_public_key
        );
        sshBackupSuccess = keysWithData.length > 0;

      } else {

      }
    } catch (error) {
      console.error('Error fetching SSH data for backup:', error.message);
    }

    // Fetch custom commands
    let customCommands = [];
    try {
      customCommands = await db.select(
        'appliance_commands',
        {},
        { orderBy: 'applianceId' }
      );

    } catch (error) {
      console.error(
        'Error fetching custom commands for backup:',
        error.message
      );
    }

    // Fetch service command logs (last 5000 entries)
    let serviceCommandLogs = [];
    try {
      const logsResult = await db.select(
        'service_command_logs',
        {},
        { orderBy: 'executedAt', orderDir: 'DESC', limit: 5000 }
      );
      // Reverse to have oldest first for correct restore order
      serviceCommandLogs = logsResult.reverse();

    } catch (error) {
      console.error(
        'Error fetching service command logs for backup:',
        error.message
      );
    }

    // Fetch active sessions
    let activeSessions = [];
    try {
      activeSessions = await db.select(
        'active_sessions',
        {},
        { orderBy: 'createdAt', orderDir: 'DESC' }
      );

    } catch (error) {
      console.error('Error fetching sessions for backup:', error.message);
    }

    // For each background image, read the actual file and encode it as base64
    const backgroundImagesWithData = [];
    let missingImageCount = 0;
    let encodedImageCount = 0;
    
    for (const bgImg of backgroundImages) {
      try {
        const filepath = path.join(
          __dirname,
          '..',
          'uploads',
          'backgrounds',
          bgImg.filename
        );
        const fileExists = await fs
          .access(filepath)
          .then(() => true)
          .catch(() => false);

        if (fileExists) {
          const fileBuffer = await fs.readFile(filepath);
          const base64Data = fileBuffer.toString('base64');

          backgroundImagesWithData.push({
            ...bgImg,
            file_data: base64Data,
            data_size: fileBuffer.length,
          });
          encodedImageCount++;

        } else {
          // Include metadata without file data
          backgroundImagesWithData.push({
            ...bgImg,
            file_data: null,
            data_size: 0,
            file_missing: true,
          });
          missingImageCount++;

        }
      } catch (error) {
        console.error(
          `❌ Error reading background image ${bgImg.filename}:`,
          error.message
        );
        // Include metadata without file data
        backgroundImagesWithData.push({
          ...bgImg,
          file_data: null,
          data_size: 0,
          file_error: error.message,
        });
        missingImageCount++;
      }
    }
    
    // Log summary
    if (backgroundImages.length > 0) {

    }

    // Create comprehensive backup object
    const backupData = {
      version: '2.9.1',
      created_at: new Date().toISOString(),
      created_by: 'Web Appliance Dashboard API (Full Backup with All Tables + SNMP)',
      data: {
        appliances,
        categories,
        user_settings: settings,
        background_images: backgroundImagesWithData,
        hosts,
        services,
        ssh_keys: sshKeys,
        // ssh_hosts and ssh_config removed - functionality moved to hosts table
        ssh_upload_logs: sshUploadLogs,
        appliance_commands: customCommands,
        users,
        audit_logs: auditLogs,
        role_permissions: rolePermissions,
        user_appliance_permissions: userAppliancePermissions,
        service_command_logs: serviceCommandLogs,
        active_sessions: activeSessions,
        guacamole_backup: guacamoleBackup, // Add Guacamole backup
        // SNMP/Monitoring data
        host_snmp_configs: hostSnmpConfigs,
        host_monitoring_data: hostMonitoringData,
        host_metrics_logging: hostMetricsLogging,
        snmp_metrics: snmpMetrics,
        snmp_interfaces: snmpInterfaces,
        snmp_disk_metrics: snmpDiskMetrics,
        snmp_errors: snmpErrors,
        snmp_thresholds: snmpThresholds,
        host_disk_metrics: hostDiskMetrics,
        host_network_metrics: hostNetworkMetrics,
        // metric_definitions removed from backup
        host_disk_config: hostDiskConfig,
        snmp_latest_metrics: snmpLatestMetrics,
      },
      metadata: {
        appliances_count: appliances.length,
        categories_count: categories.length,
        user_settings_count: settings.length,
        background_images_count: backgroundImagesWithData.length,
        hosts_count: hosts.length,
        services_count: services.length,
        ssh_keys_count: sshKeys.length,
        // ssh_hosts_count and ssh_config_count removed
        ssh_upload_logs_count: sshUploadLogs.length,
        appliance_commands_count: customCommands.length,
        users_count: users.length,
        audit_logs_count: auditLogs.length,
        role_permissions_count: rolePermissions.length,
        user_appliance_permissions_count: userAppliancePermissions.length,
        service_command_logs_count: serviceCommandLogs.length,
        active_sessions_count: activeSessions.length,
        // SNMP/Monitoring metadata
        host_snmp_configs_count: hostSnmpConfigs.length,
        host_monitoring_data_count: hostMonitoringData.length,
        host_metrics_logging_count: hostMetricsLogging.length,
        snmp_metrics_count: snmpMetrics.length,
        snmp_interfaces_count: snmpInterfaces.length,
        snmp_disk_metrics_count: snmpDiskMetrics.length,
        snmp_errors_count: snmpErrors.length,
        snmp_thresholds_count: snmpThresholds.length,
        host_disk_metrics_count: hostDiskMetrics.length,
        host_network_metrics_count: hostNetworkMetrics.length,
        // metric_definitions removed from metadata
        host_disk_config_count: hostDiskConfig.length,
        snmp_latest_metrics_count: snmpLatestMetrics.length,
        has_guacamole_backup: !!guacamoleBackup,
        guacamole_backup_size: guacamoleBackup ? guacamoleBackup.size_bytes : 0,
        backup_type: 'full_with_all_tables_and_snmp',
        database_version: '2.9.1',
        includes_background_files: backgroundImagesWithData.some(
          bg => bg.file_data !== null
        ),
        includes_hosts: hosts.length > 0,
        includes_services: services.length > 0,
        includes_ssh_keys: sshKeys.length > 0 && sshBackupSuccess,
        includes_ssh_config: sshConfig.length > 0,
        includes_ssh_upload_logs: sshUploadLogs.length > 0,
        includes_users: users.length > 0,
        includes_audit_logs: auditLogs.length > 0,
        includes_role_permissions: rolePermissions.length > 0,
        includes_user_appliance_permissions:
          userAppliancePermissions.length > 0,
        includes_service_command_logs: serviceCommandLogs.length > 0,
        includes_active_sessions: activeSessions.length > 0,
        total_background_size_kb: Math.round(
          backgroundImagesWithData.reduce(
            (sum, bg) => sum + (bg.data_size || 0),
            0
          ) / 1024
        ),
      },
    };

    // Calculate actual backup size
    const backupDataString = JSON.stringify(backupData);
    const backupSizeBytes = Buffer.byteLength(backupDataString, 'utf8');

    // Create audit log
    const ipAddress = req.clientIp;
    await createAuditLog(
      req.user?.id || null,
      'backup_create',
      'backup',
      null,
      {
        total_items:
          appliances.length +
          categories.length +
          settings.length +
          backgroundImagesWithData.length +
          hosts.length +
          services.length +
          sshHosts.length +
          sshKeys.length +
          sshConfig.length +
          sshUploadLogs.length +
          customCommands.length +
          users.length +
          auditLogs.length +
          rolePermissions.length +
          userAppliancePermissions.length +
          serviceCommandLogs.length +
          activeSessions.length +
          hostSnmpConfigs.length +
          hostMonitoringData.length +
          hostMetricsLogging.length +
          snmpMetrics.length +
          snmpInterfaces.length +
          snmpDiskMetrics.length +
          snmpErrors.length +
          snmpThresholds.length +
          hostDiskMetrics.length +
          hostNetworkMetrics.length,
        appliances_count: appliances.length,
        categories_count: categories.length,
        user_settings_count: settings.length,
        background_images_count: backgroundImagesWithData.length,
        hosts_count: hosts.length,
        services_count: services.length,
        ssh_keys_count: sshKeys.length,
        // ssh_hosts_count and ssh_config_count removed
        ssh_upload_logs_count: sshUploadLogs.length,
        appliance_commands_count: customCommands.length,
        users_count: users.length,
        audit_logs_count: auditLogs.length,
        role_permissions_count: rolePermissions.length,
        user_appliance_permissions_count: userAppliancePermissions.length,
        service_command_logs_count: serviceCommandLogs.length,
        active_sessions_count: activeSessions.length,
        // SNMP/Monitoring counts
        host_snmp_configs_count: hostSnmpConfigs.length,
        host_monitoring_data_count: hostMonitoringData.length,
        host_metrics_logging_count: hostMetricsLogging.length,
        snmp_metrics_count: snmpMetrics.length,
        snmp_interfaces_count: snmpInterfaces.length,
        snmp_disk_metrics_count: snmpDiskMetrics.length,
        snmp_errors_count: snmpErrors.length,
        snmp_thresholds_count: snmpThresholds.length,
        host_disk_metrics_count: hostDiskMetrics.length,
        host_network_metrics_count: hostNetworkMetrics.length,
        backup_size: backupSizeBytes,
        created_by: req.user?.username || 'unknown',
      },
      ipAddress
    );

    // Broadcast backup creation event
    broadcast('backup_created', {
      timestamp: new Date().toISOString(),
      created_by: req.user?.username || 'unknown',
      size: backupSizeBytes,
      items_count: {
        appliances: appliances.length,
        categories: categories.length,
        users: users.length,
        audit_logs: auditLogs.length,
      },
    });

    // Broadcast audit log update
    broadcast('audit_log_created', {
      action: 'backup_create',
      resource_type: 'backup',
      resource_id: null,
    });
    
    // Add encryption key to response
    // The backup key is shown to the user so they can decrypt the backup later
    const responseData = {
      ...backupData,
      encryption_key: backupKey,  // Der zufällige Backup-Schlüssel
      encryption_info: {
        algorithm: 'AES-256-CBC',
        key_format: 'hex',
        message: 'Bitte bewahren Sie diesen Schlüssel sicher auf. Er wird für die Wiederherstellung benötigt.'
      }
    };

    // Log backup size information
    const backupSizeKB = Math.round(Buffer.byteLength(JSON.stringify(responseData), 'utf8') / 1024);

    // Set appropriate headers for large responses
    res.setHeader('Content-Type', 'application/json');
    
    // Send response - for very large backups, consider streaming
    if (backupSizeKB > 10240) { // If backup is larger than 10MB

    }
    
    res.json(responseData);
  } catch (error) {
    console.error('Error creating enhanced backup:', error);
    res
      .status(500)
      .json({ error: 'Failed to create backup: ' + error.message });
  }
});

// Restore endpoint - Import data from backup INCLUDING settings and background images
router.post('/restore', verifyToken, async (req, res) => {
  // Generate session ID for SSE progress tracking
  const sessionId = uuidv4();
  console.log('🔄 Starting restore with sessionId:', sessionId);
  
  const { sendProgressUpdate } = getSSEFunctions();
  
  // Initialize SSE session if available
  if (sendProgressUpdate && restoreSessions) {
    restoreSessions.set(sessionId, {
      connections: [],
      progress: 0,
      currentStep: 'initializing',
      totalItems: {},
      processedItems: {}
    });
    console.log('✅ SSE session initialized for sessionId:', sessionId);
  } else {
    console.log('⚠️ SSE functions not available - progress tracking disabled');
  }
  
  try {
    const backupData = req.body;
    
    // Extract the decryption key from the request
    const backupDecryptionKey = backupData.encryption_key || backupData.decryption_key || null;

    delete backupData.encryption_key; // Remove from backup data
    delete backupData.decryption_key; // Remove from backup data
    
    // Extract encryption info if present
    const encryptionInfo = backupData.encryption_info;
    delete backupData.encryption_info; // Remove from backup data

    if (!backupDecryptionKey) {

    }

    // Validate backup structure
    if (!backupData.data || !Array.isArray(backupData.data.appliances)) {
      return res
        .status(400)
        .json({ error: 'Invalid backup format: missing appliances data' });
    }

    // Check backup version for compatibility
    const backupVersion = backupData.version || '1.0.0';
    const isOldVersion = backupVersion.startsWith('1.');

    if (isOldVersion) {

    }

    // Function to decrypt data from backup and re-encrypt with system key
    // WICHTIG: Unterstützt beide GCM-Formate für Backward Compatibility!
    // - Neues Format (ab 18.08.2025): iv:authTag:encrypted (3 Teile, 32-char authTag)
    // Function to re-encrypt password from backup to system key
    const reEncryptFromBackup = (encryptedData) => {
      if (!encryptedData) {
        return null;
      }
      
      // Debug: Check if we have the decryption key
      if (!backupDecryptionKey) {
        console.error('❌ No backup decryption key available!');
        // Return original data if we can't decrypt it
        return encryptedData;
      }

      try {
        // Use encryptionManager's reEncrypt function to handle the conversion
        // From backup key to system key
        const systemKey = encryptionManager.getSystemKey();

        const result = encryptionManager.reEncrypt(encryptedData, backupDecryptionKey, systemKey);
        
        if (!result) {
          console.error('❌ encryptionManager.reEncrypt returned null');
          // WICHTIG: Return original data instead of null to avoid corruption
          return encryptedData;
        }
        
        // Check if the result is the same as input (re-encryption failed silently)
        if (result === encryptedData) {

          // Try to decrypt manually and re-encrypt
          const decrypted = encryptionManager.decrypt(encryptedData, backupDecryptionKey);
          if (decrypted) {

            const reEncrypted = encryptionManager.encrypt(decrypted, systemKey);
            return reEncrypted || encryptedData;
          } else {
            console.error('❌ Manual decrypt also failed - key might be wrong or data corrupted');
            // WICHTIG: KEIN Fallback-Passwort! Das wäre ein Sicherheitsrisiko
            // Stattdessen null zurückgeben, damit der Restore-Prozess weiß, dass es fehlgeschlagen ist
            return null;
          }
        } else {

        }
        
        return result;
      } catch (error) {
        console.error('Failed to re-encrypt from backup:', error.message);
        // WICHTIG: Return original data instead of null to avoid corruption
        return encryptedData;
      }
    };

    // Destructure with support for both old and new table names
    const {
      appliances,
      categories,
      settings,          // Old name
      user_settings,     // New name
      background_images,
      hosts,
      services,
      ssh_hosts,
      ssh_keys,
      ssh_config,
      ssh_upload_logs,
      custom_commands,   // Old name
      appliance_commands, // New name
      users,
      audit_logs,
      role_permissions,
      user_appliance_permissions,
      service_command_logs,
      sessions,          // Old name
      active_sessions,   // New name
      guacamole_backup,  // Guacamole database backup
      // SNMP/Monitoring tables
      host_snmp_configs,
      host_monitoring_data,
      host_metrics_logging,
      snmp_metrics,
      snmp_interfaces,
      snmp_disk_metrics,
      snmp_errors,
      snmp_thresholds,
      host_disk_metrics,
      host_network_metrics,
      // metric_definitions removed
      host_disk_config,
      snmp_latest_metrics
    } = backupData.data;

    // Use whichever is available (prefer new names)
    const actualSettings = user_settings || settings || [];
    const actualCommands = appliance_commands || custom_commands || [];
    const actualSessions = active_sessions || sessions || [];

    // For legacy backups without SSH keys, initialize SSH system BEFORE starting transaction
    let legacySSHInitialized = false;
    if (isOldVersion && (!ssh_keys || ssh_keys.length === 0)) {
      try {

        // Use the SSH API to initialize the system
        const sshInitResponse = await fetch(
          'http://localhost:3001/api/ssh/initialize',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (sshInitResponse.ok) {
          const sshInitResult = await sshInitResponse.json();
          if (sshInitResult.success) {

            legacySSHInitialized = true;
          }
        }
      } catch (sshPreInitError) {

      }
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    // Count total items for progress tracking
    const totalItemsToRestore = {
      categories: categories?.length || 0,
      appliances: appliances?.length || 0,
      settings: actualSettings?.length || 0,
      background_images: background_images?.length || 0,
      hosts: hosts?.length || 0,
      services: services?.length || 0,
      ssh_keys: ssh_keys?.length || 0,
      ssh_hosts: ssh_hosts?.length || 0,
      custom_commands: actualCommands?.length || 0,
      users: users?.length || 0,
      snmp_metrics: snmp_metrics?.length || 0,
      snmp_interfaces: snmp_interfaces?.length || 0,
      host_monitoring_data: host_monitoring_data?.length || 0,
      host_metrics_logging: host_metrics_logging?.length || 0,
      snmp_thresholds: snmp_thresholds?.length || 0,
      snmp_disk_metrics: snmp_disk_metrics?.length || 0,
    };
    
    const totalItemCount = Object.values(totalItemsToRestore).reduce((sum, count) => sum + count, 0);
    
    // Send initial SSE update with total items
    if (sendProgressUpdate) {
      sendProgressUpdate(sessionId, {
        type: 'init',
        totalItems: totalItemsToRestore,
        totalItemCount,
        message: 'Starting restore process...',
        currentStep: 'initializing'
      });
    }

    try {
      // KRITISCH: Vor dem Restore ALLE alten Daten löschen!
      // Restore muss das System in einen sauberen, definierten Zustand bringen
      console.log('🔄 Starting clean restore - removing all existing data first...');
      
      // Disable foreign key checks temporarily
      await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
      
      // DEBUG: Check current data before cleaning
      const [beforeAppliances] = await connection.execute('SELECT COUNT(*) as count FROM appliances');
      const [beforeHosts] = await connection.execute('SELECT COUNT(*) as count FROM hosts');
      const [beforeCategories] = await connection.execute('SELECT COUNT(*) as count FROM categories');
      console.log(`📊 BEFORE CLEAN - Appliances: ${beforeAppliances[0].count}, Hosts: ${beforeHosts[0].count}, Categories: ${beforeCategories[0].count}`);
      
      try {
        // Define all tables to clean in correct order (respecting dependencies)
        const tablesToClean = [
          // Service/Command logs (dependent on other tables)
          'service_command_logs',
          'ssh_upload_logs',
          'audit_logs',
          
          // Permission tables
          'user_appliance_permissions',
          'role_permissions',
          
          // Session data
          'active_sessions',
          'sessions',
          
          // SSH related
          'ssh_config',
          'ssh_keys',
          'ssh_hosts',
          
          // SNMP/Monitoring tables
          'snmp_errors',
          'snmp_thresholds',
          'host_disk_metrics',
          'host_network_metrics',
          'snmp_disk_metrics',
          'snmp_interfaces',
          'snmp_latest_metrics',
          'snmp_metrics',
          'host_metrics_logging',
          'host_monitoring_data',
          'host_snmp_configs',
          'host_disk_config',
          // 'metric_definitions', removed - table no longer exists
          'host_interface_mappings',
          
          // Services and commands
          'appliance_commands',
          'custom_commands',
          'services',
          
          // Core tables
          'hosts',
          'appliances',
          'categories',
          
          // Settings and images
          'background_images',
          'user_settings',
          'settings',
          
          // Users (keep admin user!)
          // 'users' - SPECIAL HANDLING BELOW
        ];
        
        // Clean all tables except users
        for (const table of tablesToClean) {
          try {
            // Use DELETE instead of TRUNCATE for transactional safety
            // TRUNCATE is DDL and auto-commits, DELETE is DML and works with transactions
            await connection.execute(`DELETE FROM ${table}`);
            console.log(`✅ Cleaned table: ${table}`);
          } catch (cleanError) {
            // Some tables might not exist in older databases
            if (cleanError.code === 'ER_NO_SUCH_TABLE') {
              console.log(`⚠️ Table ${table} does not exist, skipping`);
            } else {
              console.warn(`⚠️ Could not clean table ${table}:`, cleanError.message);
            }
          }
        }
        
        // Special handling for users table - keep admin user only
        try {
          await connection.execute('DELETE FROM users WHERE username != ?', ['admin']);
          console.log('✅ Cleaned users table (kept admin)');
        } catch (userCleanError) {
          console.warn('⚠️ Could not clean users table:', userCleanError.message);
        }
        
      } finally {
        // Re-enable foreign key checks
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
      }
      
      // DEBUG: Check data after cleaning
      const [afterAppliances] = await connection.execute('SELECT COUNT(*) as count FROM appliances');
      const [afterHosts] = await connection.execute('SELECT COUNT(*) as count FROM hosts');
      const [afterCategories] = await connection.execute('SELECT COUNT(*) as count FROM categories');
      console.log(`📊 AFTER CLEAN - Appliances: ${afterAppliances[0].count}, Hosts: ${afterHosts[0].count}, Categories: ${afterCategories[0].count}`);
      
      console.log('✅ Database cleaned, starting restore...');
      
      // Initialize counters
      let restoredAppliances = 0;
      let restoredCategories = 0;
      let restoredSettings = 0;
      let restoredBackgrounds = 0;
      let restoredHosts = 0;
      let restoredServices = 0;
      let restoredSSHHosts = 0;
      let restoredSSHKeys = 0;
      let restoredSSHConfig = 0;
      let restoredSSHUploadLogs = 0;
      let restoredCustomCommands = 0;
      let restoredUsers = 0;
      let restoredAuditLogs = 0;
      let restoredRolePermissions = 0;
      let restoredUserAppliancePermissions = 0;
      let restoredServiceCommandLogs = 0;
      const restoredSessions = 0;
      // SNMP/Monitoring restore counters
      let restoredHostSnmpConfigs = 0;
      let restoredHostMonitoringData = 0;
      let restoredHostMetricsLogging = 0;
      let restoredSnmpMetrics = 0;
      let restoredSnmpInterfaces = 0;
      let restoredSnmpDiskMetrics = 0;
      let restoredSnmpErrors = 0;
      let restoredSnmpThresholds = 0;
      let restoredHostDiskMetrics = 0;
      let restoredHostNetworkMetrics = 0;
      let restoredMetricDefinitions = 0;
      let restoredHostDiskConfig = 0;
      let restoredSnmpLatestMetrics = 0;

      // Create ID mapping for appliances (old ID -> new ID)
      const applianceIdMapping = {};
      
      // Create ID mapping for hosts (old ID -> new ID)
      const hostIdMapping = {};

      // IMPORTANT: Restore categories FIRST (before appliances) to respect foreign key constraints
      if (categories && categories.length > 0) {
        try {
          // Categories already cleaned above, just insert new ones

          for (const category of categories) {
            const categoryData = {
              name: category.name,
              icon: category.icon || 'folder',
              color: category.color || '#007AFF',
              description: category.description || null,
              isSystem: Boolean(category.is_system || category.isSystem),
              createdAt: category.created_at || category.createdAt || new Date(),
              orderIndex: category.order_index !== undefined ? category.order_index : 
                (category.orderIndex !== undefined ? category.orderIndex :
                  (category.order !== undefined ? category.order : 0))
            };

            // Use raw query for INSERT since we're in a transaction
            const { sql, values } = prepareInsert('categories', categoryData);
            await connection.execute(sql, values);
            restoredCategories++;
          }

        } catch (error) {

        }
      }

      // Before restoring appliances, ensure all required categories exist
      if (appliances && appliances.length > 0) {

        // Get all unique categories from appliances
        const uniqueCategories = [...new Set(appliances.map(app => app.category).filter(cat => cat))];

        // Get existing categories
        const [existingCats] = await connection.execute('SELECT name FROM categories');
        const existingCategoryNames = existingCats.map(cat => cat.name);

        // Find missing categories
        const missingCategories = uniqueCategories.filter(cat => !existingCategoryNames.includes(cat));

        // Create missing categories
        if (missingCategories.length > 0) {

          // Get the current max order_index
          const [maxOrderResult] = await connection.execute('SELECT MAX(order_index) as maxOrder FROM categories');
          let nextOrder = (maxOrderResult[0].maxOrder || 0) + 1;
          
          for (const categoryName of missingCategories) {
            try {
              // Create category with default values
              await connection.execute(
                `INSERT INTO categories (name, icon, color, description, is_system, created_at, order_index) 
                 VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
                [
                  categoryName,
                  'folder', // Default icon
                  '#007AFF', // Default color
                  `Auto-created category for ${categoryName}`, // Description
                  false, // Not a system category
                  nextOrder++
                ]
              );

              restoredCategories++;
            } catch (catError) {
              console.error(`Error creating category ${categoryName}:`, catError.message);
            }
          }
        }
      }

      // Restore appliances (AFTER ensuring categories exist)
      // Appliances already cleaned above, just insert new ones
      if (appliances && appliances.length > 0) {

        // Process in batches to avoid overwhelming the database
        const BATCH_SIZE = 50;
        const totalBatches = Math.ceil(appliances.length / BATCH_SIZE);
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const start = batchIndex * BATCH_SIZE;
          const end = Math.min(start + BATCH_SIZE, appliances.length);
          const batch = appliances.slice(start, end);

        // Debug: Log first appliance to see structure
        if (batchIndex === 0 && batch[0]) {

        }

        for (const appliance of batch) {

          // CRITICAL FIX: Handle mixed camelCase/snake_case from backup
          // The backup may contain either format, so we need to normalize
          const dbAppliance = {};
          
          // Map all fields properly, handling both camelCase and snake_case
          dbAppliance.id = appliance.id;
          dbAppliance.name = appliance.name;
          dbAppliance.category = appliance.category;
          dbAppliance.description = appliance.description;
          dbAppliance.url = appliance.url;
          dbAppliance.icon = appliance.icon;
          dbAppliance.color = appliance.color;
          
          // Handle isFavorite/is_favorite
          dbAppliance.is_favorite = appliance.isFavorite !== undefined ? 
            (appliance.isFavorite ? 1 : 0) : 
            (appliance.is_favorite !== undefined ? appliance.is_favorite : 0);
          
          // Handle lastUsed/last_used
          if (appliance.lastUsed || appliance.last_used) {
            const lastUsedValue = appliance.lastUsed || appliance.last_used;
            dbAppliance.last_used = new Date(lastUsedValue)
                .toISOString()
                .slice(0, 19)
                .replace('T', ' ');
          }
          
          // Service commands
          dbAppliance.status_command = appliance.statusCommand || appliance.status_command || null;
          dbAppliance.start_command = appliance.startCommand || appliance.start_command || null;
          dbAppliance.stop_command = appliance.stopCommand || appliance.stop_command || null;
          dbAppliance.restart_command = appliance.restartCommand || appliance.restart_command || null;
          dbAppliance.service_status = appliance.serviceStatus || appliance.service_status || 'unknown';
          
          // SSH connection
          dbAppliance.ssh_connection = appliance.sshConnection || appliance.ssh_connection || null;
          
          // Visual settings
          dbAppliance.transparency = appliance.transparency || '0.7';
          dbAppliance.blur_amount = appliance.blurAmount || appliance.blur_amount || 8;
          dbAppliance.background_image = appliance.backgroundImage || appliance.background_image || null;
          
          // Remote desktop settings
          dbAppliance.remote_desktop_enabled = appliance.remoteDesktopEnabled !== undefined ?
            (appliance.remoteDesktopEnabled ? 1 : 0) :
            (appliance.remote_desktop_enabled !== undefined ? appliance.remote_desktop_enabled : 0);
          dbAppliance.remote_protocol = appliance.remoteProtocol || appliance.remote_protocol || 'vnc';
          dbAppliance.remote_host = appliance.remoteHost || appliance.remote_host || null;
          dbAppliance.remote_port = appliance.remotePort || appliance.remote_port || null;
          dbAppliance.remote_username = appliance.remoteUsername || appliance.remote_username || null;
          
          // Re-encrypt remote password using the same function as hosts
          const remotePasswordEnc = appliance.remotePasswordEncrypted || appliance.remote_password_encrypted || null;
          if (remotePasswordEnc) {

            dbAppliance.remote_password_encrypted = reEncryptFromBackup(remotePasswordEnc);
            if (!dbAppliance.remote_password_encrypted) {
              console.error(`❌ Failed to re-encrypt password for ${appliance.name} - will be NULL in database`);
              // WICHTIG: Kein Fallback-Passwort! Benutzer muss es neu eingeben
              dbAppliance.remote_password_encrypted = null;
            }
          } else {
            dbAppliance.remote_password_encrypted = null;
          }

          dbAppliance.remote_desktop_type = appliance.remoteDesktopType || appliance.remote_desktop_type || 'guacamole';
          
          // RustDesk settings
          dbAppliance.rustdesk_id = appliance.rustdeskId || appliance.rustdesk_id || null;
          
          // Re-encrypt RustDesk password using the same function as hosts
          const rustdeskPasswordEnc = appliance.rustdeskPasswordEncrypted || appliance.rustdesk_password_encrypted || null;

          dbAppliance.rustdesk_password_encrypted = reEncryptFromBackup(rustdeskPasswordEnc);
          dbAppliance.rustdesk_installed = appliance.rustdeskInstalled !== undefined ?
            appliance.rustdeskInstalled :
            (appliance.rustdesk_installed !== undefined ? appliance.rustdesk_installed : 0);
          dbAppliance.rustdesk_installation_date = appliance.rustdeskInstallationDate || appliance.rustdesk_installation_date || null;
          
          // Other settings
          dbAppliance.auto_start = appliance.autoStart !== undefined ?
            (appliance.autoStart ? 1 : 0) :
            (appliance.auto_start !== undefined ? appliance.auto_start : 0);
          dbAppliance.open_mode_mini = appliance.openModeMini || appliance.open_mode_mini || '_self';
          dbAppliance.open_mode_mobile = appliance.openModeMobile || appliance.open_mode_mobile || '_self';
          dbAppliance.open_mode_desktop = appliance.openModeDesktop || appliance.open_mode_desktop || '_self';
          dbAppliance.order_index = appliance.orderIndex || appliance.order_index || 0;
          dbAppliance.guacamole_performance_mode = appliance.guacamolePerformanceMode || appliance.guacamole_performance_mode || 'balanced';
          
          // Handle timestamps
          // Handle timestamps
          dbAppliance.created_at = appliance.createdAt || appliance.created_at
            ? new Date(appliance.createdAt || appliance.created_at)
                .toISOString()
                .slice(0, 19)
                .replace('T', ' ')
            : new Date().toISOString().slice(0, 19).replace('T', ' ');

          dbAppliance.updated_at = appliance.updatedAt || appliance.updated_at
            ? new Date(appliance.updatedAt || appliance.updated_at)
                .toISOString()
                .slice(0, 19)
                .replace('T', ' ')
            : dbAppliance.created_at;

          // Handle lastStatusCheck
          if (appliance.lastStatusCheck || appliance.last_status_check) {
            dbAppliance.last_status_check = new Date(
              appliance.lastStatusCheck || appliance.last_status_check
            )
              .toISOString()
              .slice(0, 19)
              .replace('T', ' ');
          }
          
          // Generate field list and values from mapped object
          const fields = Object.keys(dbAppliance);
          const values = Object.values(dbAppliance);
          const placeholders = fields.map(() => '?').join(', ');

          await connection.execute(
            `INSERT INTO appliances (${fields.join(', ')}) VALUES (${placeholders})`,
            values
          );
          restoredAppliances++;
        }
        } // End of batch processing
        
        // Set AUTO_INCREMENT to the max ID + 1
        const [maxIdResult] = await connection.execute(
          'SELECT MAX(id) as maxId FROM appliances'
        );
        const maxId = maxIdResult[0].maxId || 0;
        await connection.execute(
          `ALTER TABLE appliances AUTO_INCREMENT = ${maxId + 1}`
        );
        
        // WICHTIG: Nach dem Import müssen alle Guacamole-Verbindungen für Appliances synchronisiert werden

        const { syncGuacamoleConnection } = require('../utils/guacamoleHelper');
        
        // Get all imported appliances from DB with remote desktop enabled
        const [importedAppliances] = await connection.execute(
          'SELECT * FROM appliances WHERE remote_desktop_enabled = 1'
        );
        
        for (const appliance of importedAppliances) {
          try {
            // Pass data directly as-is (snake_case from DB)
            const guacamoleData = {
              id: appliance.id,
              name: appliance.name,
              remote_desktop_enabled: appliance.remote_desktop_enabled,
              remote_host: appliance.remote_host,
              remote_protocol: appliance.remote_protocol || 'vnc',
              remote_port: appliance.remote_port,
              remote_username: appliance.remote_username,
              remote_password_encrypted: appliance.remote_password_encrypted,
              guacamole_performance_mode: appliance.guacamole_performance_mode
            };
            
            await syncGuacamoleConnection(guacamoleData);

          } catch (syncError) {
            console.error(`❌ Failed to sync Guacamole for appliance ${appliance.name}:`, syncError.message);
            // Don't throw - continue with other appliances
          }
        }
      }

      // Restore settings
      if (actualSettings && actualSettings.length > 0) {
        try {

          await connection.execute('DELETE FROM user_settings');

          for (const setting of actualSettings) {
            const settingData = {
              settingKey: setting.setting_key || setting.settingKey,
              settingValue: setting.setting_value || setting.settingValue || '',
              description: setting.description || null,
              createdAt: setting.created_at || setting.createdAt || new Date(),
              updatedAt: setting.updated_at || setting.updatedAt || new Date()
            };

            const { sql, values } = prepareInsert('user_settings', settingData);
            await connection.execute(sql, values);
            restoredSettings++;
          }

        } catch (error) {

        }
      }

      // Restore background images
      if (background_images && background_images.length > 0) {
        try {

          // Clear existing background images
          await connection.execute('DELETE FROM background_images');

          // Clean up existing background files
          try {
            const backgroundsDir = path.join(
              __dirname,
              '..',
              'uploads',
              'backgrounds'
            );
            
            // Ensure directory exists
            await fs.mkdir(backgroundsDir, { recursive: true });
            
            const existingFiles = await fs.readdir(backgroundsDir);
            for (const file of existingFiles) {
              try {
                await fs.unlink(path.join(backgroundsDir, file));
              } catch (unlinkError) {

              }
            }
          } catch (cleanupError) {

          }

          for (const bgImage of background_images) {
            // Restore file if data is available
            if (
              bgImage.file_data &&
              !bgImage.file_missing &&
              !bgImage.file_error
            ) {
              try {
                const fileBuffer = Buffer.from(bgImage.file_data, 'base64');
                const filepath = path.join(
                  __dirname,
                  '..',
                  'uploads',
                  'backgrounds',
                  bgImage.filename
                );
                
                // Ensure directory exists before writing
                const dir = path.dirname(filepath);
                await fs.mkdir(dir, { recursive: true });

                await fs.writeFile(filepath, fileBuffer);

              } catch (fileError) {
                console.error(
                  `❌ Error restoring background file ${bgImage.filename}:`,
                  fileError.message
                );
                // Continue with database record even if file restoration fails
              }
            } else {

            }

            // Restore database record
            const createdAt = bgImage.created_at
              ? new Date(bgImage.created_at)
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ')
              : new Date().toISOString().slice(0, 19).replace('T', ' ');

            const backgroundData = {
              filename: bgImage.filename,
              originalName: bgImage.original_name || bgImage.originalName || bgImage.filename,
              mimeType: bgImage.mime_type || bgImage.mimeType || 'image/jpeg',
              fileSize: bgImage.file_size || bgImage.fileSize || 0,
              width: bgImage.width || 1920,
              height: bgImage.height || 1080,
              uploadedBy: bgImage.uploaded_by || bgImage.uploadedBy || null,
              isActive: Boolean(bgImage.is_active !== undefined ? bgImage.is_active : bgImage.isActive),
              usageCount: bgImage.usage_count || bgImage.usageCount || 0,
              createdAt: bgImage.created_at || bgImage.createdAt || new Date()
            };

            const { sql, values } = prepareInsert('background_images', backgroundData);
            await connection.execute(sql, values);
            restoredBackgrounds++;
          }

        } catch (error) {

        }
      }

      // Restore users FIRST - BEFORE hosts and other tables with foreign keys
      if (users && users.length > 0) {
        try {

          // Clear existing users and restore from backup
          await connection.execute('DELETE FROM users');
          await connection.execute('ALTER TABLE users AUTO_INCREMENT = 1');

          for (const user of users) {
            const createdAt = user.created_at
              ? new Date(user.created_at)
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ')
              : new Date().toISOString().slice(0, 19).replace('T', ' ');

            const updatedAt = user.updated_at
              ? new Date(user.updated_at)
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ')
              : createdAt;

            const lastLogin = user.last_login
              ? new Date(user.last_login)
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ')
              : null;

            // Use password hash from backup, or create default if missing
            let passwordHash = user.password_hash;
            if (!passwordHash) {
              // Only create default password if no hash exists in backup
              const bcrypt = require('bcryptjs');
              passwordHash = await bcrypt.hash('changeme123', 10);

            }

            await connection.execute(
              `INSERT INTO users 
               (id, username, email, password_hash, role, is_active, last_login, created_at, updated_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                user.id,
                user.username,
                user.email,
                passwordHash,
                user.role || 'user',
                user.is_active !== false,
                lastLogin,
                createdAt,
                updatedAt,
              ]
            );

            restoredUsers++;
          }

          // Set AUTO_INCREMENT to the max ID + 1
          const [maxIdResult] = await connection.execute(
            'SELECT MAX(id) as maxId FROM users'
          );
          const maxId = maxIdResult[0].maxId || 0;
          await connection.execute(
            `ALTER TABLE users AUTO_INCREMENT = ${maxId + 1}`
          );

        } catch (error) {

        }
      }

      // Restore hosts table (SSH Terminal hosts) - AFTER users due to foreign keys
      if (hosts && hosts.length > 0) {
        try {

          await connection.execute('DELETE FROM hosts');
          await connection.execute('ALTER TABLE hosts AUTO_INCREMENT = 1');

          for (const host of hosts) {

            // Map user ID for createdBy field if users were restored
            let mappedCreatedBy = host.created_by || host.createdBy || null;
            if (mappedCreatedBy && users) {
              const originalUser = users.find(u => u.id === mappedCreatedBy);
              if (originalUser) {
                const [userResult] = await connection.execute(
                  'SELECT id FROM users WHERE username = ? OR email = ?',
                  [originalUser.username, originalUser.email]
                );
                if (userResult.length > 0) {
                  mappedCreatedBy = userResult[0].id;

                }
              }
            }
            
            // Map user ID for updatedBy field if users were restored
            let mappedUpdatedBy = host.updated_by || host.updatedBy || null;
            if (mappedUpdatedBy && users) {
              const originalUser = users.find(u => u.id === mappedUpdatedBy);
              if (originalUser) {
                const [userResult] = await connection.execute(
                  'SELECT id FROM users WHERE username = ? OR email = ?',
                  [originalUser.username, originalUser.email]
                );
                if (userResult.length > 0) {
                  mappedUpdatedBy = userResult[0].id;
                }
              }
            }

            // Debug: Check what we have from backup

            const hostData = {
              name: host.name,
              description: host.description || null,
              hostname: host.hostname,
              port: host.port || 22,
              username: host.username,
              icon: host.icon || 'Server',
              password: reEncryptFromBackup(host.password),
              privateKey: reEncryptFromBackup(host.private_key || host.privateKey), // Re-encrypt private key
              color: host.color || '#007AFF',
              transparency: host.transparency !== undefined ? host.transparency : 0.10,
              blur: host.blur !== undefined ? host.blur : 0,
              createdAt: host.created_at || host.createdAt || new Date(),
              updatedAt: host.updated_at || host.updatedAt || new Date(),
              createdBy: mappedCreatedBy,  // Use mapped user ID
              updatedBy: mappedUpdatedBy,  // Use mapped user ID
              sshKeyName: host.sshKeyName || host.ssh_key_name || null,  // Handle both formats
              remoteDesktopEnabled: host.remote_desktop_enabled !== undefined ? host.remote_desktop_enabled : (host.remoteDesktopEnabled || false),
              remoteDesktopType: host.remote_desktop_type || host.remoteDesktopType || 'guacamole',
              remoteProtocol: host.remote_protocol || host.remoteProtocol || null,
              remotePort: host.remote_port || host.remotePort || null,
              remoteUsername: host.remote_username || host.remoteUsername || null,
              // WICHTIG: In der hosts-Tabelle heißt das Feld "remote_password", nicht "remote_password_encrypted"!
              remote_password: reEncryptFromBackup(host.remote_password || host.remotePassword),
              guacamolePerformanceMode: host.guacamole_performance_mode || host.guacamolePerformanceMode || 'balanced',
              rustdeskId: host.rustdesk_id || host.rustdeskId || null,
              rustdeskPassword: reEncryptFromBackup(host.rustdesk_password || host.rustdeskPassword),
              isActive: host.is_active !== undefined ? host.is_active : (host.isActive !== false)
            };
            
            // Debug: Check what we're writing to DB

            const { sql, values } = prepareInsert('hosts', hostData);
            const [result] = await connection.execute(sql, values);
            
            // Capture the new host ID for mapping
            const newHostId = result.insertId;
            const oldHostId = host.id;
            hostIdMapping[oldHostId] = newHostId;
            console.log(`📌 Host ID mapping: ${oldHostId} -> ${newHostId} (${host.name})`);
            
            restoredHosts++;
          }

          // Set AUTO_INCREMENT to the max ID + 1
          const [maxIdResult] = await connection.execute(
            'SELECT MAX(id) as maxId FROM hosts'
          );
          const maxId = maxIdResult[0].maxId || 0;
          await connection.execute(
            `ALTER TABLE hosts AUTO_INCREMENT = ${maxId + 1}`
          );

          // WICHTIG: Nach dem Import müssen alle Guacamole-Verbindungen synchronisiert werden

          const { syncGuacamoleConnection } = require('../utils/guacamoleHelper');
          
          // Get all imported hosts from DB (need to fetch them again to get the encrypted passwords)
          const [importedHosts] = await connection.execute(
            'SELECT * FROM hosts WHERE remote_desktop_enabled = 1'
          );
          
          for (const host of importedHosts) {
            try {
              // Debug: Check what we read from DB

              // Convert snake_case to camelCase for syncGuacamoleConnection
              const guacamoleData = {
                id: host.id,
                name: host.name,
                remote_desktop_enabled: host.remote_desktop_enabled,
                remote_host: host.hostname,
                remote_protocol: host.remote_protocol || 'vnc',
                remote_port: host.remote_port,
                remote_username: host.remote_username,
                // WICHTIG: Die DB-Spalte heißt "remote_password", aber guacamoleHelper erwartet "remote_password_encrypted"
                remote_password_encrypted: host.remote_password,  // Pass the encrypted password from DB
                remotePassword: host.remote_password,  // Also provide in camelCase for compatibility
                guacamole_performance_mode: host.guacamole_performance_mode,
                // SSH credentials for SFTP
                sshHostname: host.hostname,
                sshUsername: host.username,
                sshPassword: host.password  // SSH password (encrypted)
              };
              
              // Debug: Check what we pass to Guacamole

              await syncGuacamoleConnection(guacamoleData);

            } catch (syncError) {
              console.error(`❌ Failed to sync Guacamole for host ${host.name}:`, syncError.message);
              // Don't throw - continue with other hosts
            }
          }

        } catch (error) {
          console.error('❌ Error restoring hosts:', error);
          console.error('Error details:', error.message);
          throw error; // Re-throw to rollback transaction
        }
      } else {

      }

      // Restore services table
      if (services && services.length > 0) {
        try {

          await connection.execute('DELETE FROM services');
          await connection.execute('ALTER TABLE services AUTO_INCREMENT = 1');

          for (const service of services) {
            const serviceData = {
              id: service.id,
              name: service.name,
              type: service.type,
              ipAddress: service.ip_address || service.ipAddress,
              port: service.port || null,
              useHttps: Boolean(service.use_https !== undefined ? service.use_https : service.useHttps),
              status: service.status || 'active',
              description: service.description || null,
              sshHost: service.ssh_host || service.sshHost || null,
              sshPort: service.ssh_port || service.sshPort || 22,
              sshUsername: service.ssh_username || service.sshUsername || null,
              sshPassword: reEncryptFromBackup(service.ssh_password || service.sshPassword),
              sshPrivateKey: service.ssh_private_key || service.sshPrivateKey || null,
              vncPort: service.vnc_port || service.vncPort || 5900,
              vncPassword: reEncryptFromBackup(service.vnc_password || service.vncPassword),
              rdpPort: service.rdp_port || service.rdpPort || 3389,
              rdpUsername: service.rdp_username || service.rdpUsername || null,
              rdpPassword: reEncryptFromBackup(service.rdp_password || service.rdpPassword),
              createdAt: service.created_at || service.createdAt || new Date(),
              updatedAt: service.updated_at || service.updatedAt || new Date()
            };

            const { sql, values } = prepareInsert('services', serviceData);
            await connection.execute(sql, values);
            restoredServices++;
          }

          // Set AUTO_INCREMENT to the max ID + 1
          const [maxIdResult] = await connection.execute(
            'SELECT MAX(id) as maxId FROM services'
          );
          const maxId = maxIdResult[0].maxId || 0;
          await connection.execute(
            `ALTER TABLE services AUTO_INCREMENT = ${maxId + 1}`
          );

        } catch (error) {

        }
      }

      // Users already restored above before hosts table

      // Restore SSH keys first (before hosts) - only if present in backup
      if (ssh_keys && ssh_keys.length > 0) {
        try {

          await connection.execute('DELETE FROM ssh_keys');

          // Ensure SSH directory exists
          const sshDir = '/root/.ssh';
          try {
            await fs.mkdir(sshDir, { recursive: true, mode: 0o700 });

          } catch (dirError) {

          }

          for (const sshKey of ssh_keys) {
            const createdAt = sshKey.created_at
              ? new Date(sshKey.created_at)
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ')
              : new Date().toISOString().slice(0, 19).replace('T', ' ');

            const updatedAt = sshKey.updated_at
              ? new Date(sshKey.updated_at)
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ')
              : createdAt;

            // Find the user ID for created_by field
            let createdById = sshKey.created_by || null;
            if (!createdById && users && users.length > 0) {
              // If no created_by in backup, use the first admin user or first user
              const adminUser = users.find(u => u.role === 'Administrator' || u.role === 'admin');
              if (adminUser) {
                createdById = adminUser.id;
              } else if (users[0]) {
                createdById = users[0].id;
              }
            }
            
            // Map old user ID to new user ID if users were restored
            if (createdById && users) {
              const originalUser = users.find(u => u.id === createdById);
              if (originalUser) {
                const [userResult] = await connection.execute(
                  'SELECT id FROM users WHERE username = ? OR email = ?',
                  [originalUser.username, originalUser.email]
                );
                if (userResult.length > 0) {
                  createdById = userResult[0].id;
                }
              }
            }

            // If still no created_by, use the current user or default to 1
            if (!createdById) {
              createdById = req.user?.id || 1;
            }

            // SICHERHEITSKRITISCH: Private Key mit Backup-Schlüssel entschlüsseln und mit System-Key neu verschlüsseln
            let restoredPrivateKey = sshKey.private_key || sshKey.privateKey || '';
            
            // Prüfen ob der Key verschlüsselt ist (Format: iv:encrypted)
            if (restoredPrivateKey && encryptionManager.isEncrypted(restoredPrivateKey)) {

              // First try with backup key if provided
              if (backupDecryptionKey) {
                const decrypted = encryptionManager.decrypt(restoredPrivateKey, backupDecryptionKey);
                if (decrypted) {
                  restoredPrivateKey = decrypted;

                } else {

                  // Fallback to system key
                  const systemDecrypted = encryptionManager.decrypt(restoredPrivateKey);
                  if (systemDecrypted) {
                    restoredPrivateKey = systemDecrypted;
                  } else {
                    console.error(`❌ Failed to decrypt private key for ${sshKey.key_name || sshKey.keyName}`);
                  }
                }
              } else {
                // No backup key provided, try system key
                const decrypted = encryptionManager.decrypt(restoredPrivateKey);
                if (decrypted) {
                  restoredPrivateKey = decrypted;
                } else {
                  console.error(`❌ Failed to decrypt private key with system key`);
                }
              }
            }

            // Restore SSH key to database
            const sshKeyData = {
              keyName: sshKey.key_name || sshKey.keyName,
              privateKey: restoredPrivateKey,  // KLARTEXT - wird von DB automatisch mit System-Key verschlüsselt
              publicKey: sshKey.public_key || sshKey.publicKey || '',
              keyType: sshKey.key_type || sshKey.keyType || 'rsa',
              keySize: sshKey.key_size || sshKey.keySize || 2048,
              comment: sshKey.comment || '',
              fingerprint: sshKey.fingerprint || null,
              passphraseHash: sshKey.passphrase_hash || sshKey.passphraseHash || null,
              isDefault: Boolean(sshKey.is_default !== undefined ? sshKey.is_default : sshKey.isDefault),
              createdBy: createdById,
              createdAt: sshKey.created_at || sshKey.createdAt || new Date(),
              updatedAt: sshKey.updated_at || sshKey.updatedAt || new Date()
            };

            const { sql, values } = prepareInsert('ssh_keys', sshKeyData);
            await connection.execute(sql, values);

            // Restore SSH key files to filesystem
            if (restoredPrivateKey && sshKey.key_name) {
              try {
                // Always use user-specific naming for consistency
                // This ensures SSH keys work after restore
                let keyFileName = `id_rsa_user${createdById}_${sshKey.key_name || sshKey.keyName}`;
                
                const privateKeyPath = path.join(sshDir, keyFileName);
                const publicKeyPath = path.join(sshDir, `${keyFileName}.pub`);

                // Write private key (KLARTEXT!)
                await fs.writeFile(privateKeyPath, restoredPrivateKey, {
                  mode: 0o600,
                });

                // Write public key (if available)
                if (sshKey.public_key) {
                  await fs.writeFile(publicKeyPath, sshKey.public_key, {
                    mode: 0o644,
                  });

                }

                // Set proper ownership (root:root)
                try {
                  const { spawn } = require('child_process');
                  const chown = spawn('chown', ['root:root', privateKeyPath]);
                  if (sshKey.public_key) {
                    const chownPub = spawn('chown', [
                      'root:root',
                      publicKeyPath,
                    ]);
                  }
                } catch (chownError) {

                }
              } catch (keyFileError) {
                console.error(
                  `❌ Error restoring key files for ${sshKey.key_name}:`,
                  keyFileError.message
                );
                // Continue with database restore even if file restore fails
              }
            }

            restoredSSHKeys++;
          }

          // Create SSH config file for better key management
          try {
            const sshConfigPath = path.join(sshDir, 'config');
            const sshConfigContent = `# SSH Config auto-generated by Web Appliance Dashboard
# This file is automatically managed - manual changes may be overwritten

Host *
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    LogLevel QUIET
    ConnectTimeout 10
    ServerAliveInterval 30
    ServerAliveCountMax 3
    PasswordAuthentication no
    PubkeyAuthentication yes
    IdentitiesOnly yes

# Default configuration for dashboard keys
${ssh_keys.map(key => `# ${key.key_name} key configuration`).join('\n')}
`;

            await fs.writeFile(sshConfigPath, sshConfigContent, {
              mode: 0o600,
            });

          } catch (configError) {

          }

        } catch (error) {
          console.error('❌ Error restoring SSH keys:', error);
          console.error('Error details:', error.message);
          // Don't throw here to allow partial restore, but log the error
        }
      } else if (!isOldVersion) {
        // Only clear SSH keys for newer backups that should have SSH data
        try {
          await connection.execute('DELETE FROM ssh_keys');

          // Also clean up SSH key files
          const sshDir = '/root/.ssh';
          try {
            const files = await fs.readdir(sshDir);
            for (const file of files) {
              if (file.startsWith('id_rsa_')) {
                const filePath = path.join(sshDir, file);
                await fs.unlink(filePath);

              }
            }
          } catch (cleanupError) {

          }

        } catch (error) {

        }
      } else {
        // Legacy backup without SSH keys - SSH was pre-initialized
        if (legacySSHInitialized) {

          // Count the SSH keys that were created during pre-initialization
          try {
            const [keyCount] = await connection.execute(
              'SELECT COUNT(*) as count FROM ssh_keys'
            );
            restoredSSHKeys = keyCount[0].count;
          } catch (countError) {

            restoredSSHKeys = 1; // Assume at least one key was created
          }
        } else {

        }
      }

      // SSH hosts restore removed - functionality moved to hosts table
      // Legacy backup compatibility: skip ssh_hosts if present

      // SSH config restore removed - table no longer exists

      // Restore SSH upload logs
      if (ssh_upload_logs && ssh_upload_logs.length > 0) {
        try {

          // Don't delete existing logs, just add the ones from backup
          
          for (const uploadLog of ssh_upload_logs) {
            // Find the new host ID for this upload log
            let newHostId = uploadLog.host_id;
            
            // If SSH hosts were remapped, find the new ID
            if (ssh_hosts && ssh_hosts.length > 0) {
              const originalHost = ssh_hosts.find(h => h.id === uploadLog.host_id);
              if (originalHost) {
                const [matchingHosts] = await connection.execute(
                  'SELECT id FROM ssh_hosts WHERE host = ? AND username = ? AND port = ?',
                  [originalHost.host, originalHost.username, originalHost.port]
                );
                if (matchingHosts.length > 0) {
                  newHostId = matchingHosts[0].id;
                }
              }
            }

            // Legacy support: try to map from old ssh_hosts if present
            // Otherwise assume host_id refers to hosts table
            const [hostExists] = await connection.execute(
              'SELECT id FROM hosts WHERE id = ?',
              [newHostId]
            );

            if (hostExists.length > 0) {
              const createdAt = uploadLog.created_at
                ? new Date(uploadLog.created_at)
                    .toISOString()
                    .slice(0, 19)
                    .replace('T', ' ')
                : new Date().toISOString().slice(0, 19).replace('T', ' ');

              // Find the corresponding user ID if present
              let newUserId = null;
              if (uploadLog.user_id && users) {
                const originalUser = users.find(u => u.id === uploadLog.user_id);
                if (originalUser) {
                  const [userResult] = await connection.execute(
                    'SELECT id FROM users WHERE username = ? OR email = ?',
                    [originalUser.username, originalUser.email]
                  );
                  if (userResult.length > 0) {
                    newUserId = userResult[0].id;
                  }
                }
              }

              await connection.execute(
                `INSERT INTO ssh_upload_log 
                 (host_id, filename, file_size, target_path, status, error_message, created_at, user_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  newHostId,
                  uploadLog.filename,
                  uploadLog.file_size,
                  uploadLog.target_path,
                  uploadLog.status,
                  uploadLog.error_message || null,
                  createdAt,
                  newUserId,
                ]
              );
              restoredSSHUploadLogs++;
            }
          }

        } catch (error) {

        }
      }

      // Restore custom commands
      // Note: Commands were already deleted via CASCADE when appliances were deleted
      // But let's ensure the table is clean and AUTO_INCREMENT is reset
      await connection.execute('DELETE FROM appliance_commands');
      await connection.execute(
        'ALTER TABLE appliance_commands AUTO_INCREMENT = 1'
      );

      if (actualCommands && actualCommands.length > 0) {

        // First, let's check which appliances exist
        const [existingAppliances] = await connection.execute(
          'SELECT id, name FROM appliances ORDER BY id'
        );

        for (const command of actualCommands) {
          try {
            // Handle both camelCase and snake_case field names from backup
            const applianceId = command.appliance_id || command.applianceId;
            const hostId = command.host_id || command.hostId || command.ssh_host_id || null;

            // Check if the appliance exists
            const [appliances] = await connection.execute(
              'SELECT id, name FROM appliances WHERE id = ?',
              [applianceId]
            );

            if (appliances.length > 0) {

              const createdAt = command.created_at || command.createdAt
                ? new Date(command.created_at || command.createdAt)
                    .toISOString()
                    .slice(0, 19)
                    .replace('T', ' ')
                : new Date().toISOString().slice(0, 19).replace('T', ' ');

              const updatedAt = command.updated_at || command.updatedAt
                ? new Date(command.updated_at || command.updatedAt)
                    .toISOString()
                    .slice(0, 19)
                    .replace('T', ' ')
                : createdAt;

              // Handle host ID mapping - now using hosts table instead of ssh_hosts
              let newHostId = null;
              if (hostId) {
                // For new backups with hosts table
                if (hosts && hosts.length > 0) {
                  // Try to find the original host from the backup
                  const originalHost = hosts.find(h => h.id === hostId);
                  if (originalHost) {
                    // Try to find the matching host in the database
                    const [matchingHosts] = await connection.execute(
                      'SELECT id FROM hosts WHERE hostname = ? AND username = ? AND port = ?',
                      [
                        originalHost.hostname || originalHost.host,
                        originalHost.username,
                        originalHost.port || 22,
                      ]
                    );
                    if (matchingHosts.length > 0) {
                      newHostId = matchingHosts[0].id;

                    } else {

                    }
                  }
                }
                // For old backups with ssh_hosts table (legacy support)
                else if (ssh_hosts && ssh_hosts.length > 0) {
                  const originalHost = ssh_hosts.find(h => h.id === hostId);
                  if (originalHost) {
                    // Try to find the matching host in the new hosts table
                    const [matchingHosts] = await connection.execute(
                      'SELECT id FROM hosts WHERE hostname = ? AND username = ? AND port = ?',
                      [
                        originalHost.host || originalHost.hostname,
                        originalHost.username,
                        originalHost.port || 22,
                      ]
                    );
                    if (matchingHosts.length > 0) {
                      newHostId = matchingHosts[0].id;

                    }
                  }
                }
              }

              // Don't preserve the original ID to avoid conflicts
              const commandData = {
                applianceId: applianceId,
                description: command.description,
                command: command.command,
                hostId: newHostId,
                createdAt: createdAt,
                updatedAt: updatedAt
              };

              const { sql, values } = prepareInsert('appliance_commands', commandData);
              await connection.execute(sql, values);
              restoredCustomCommands++;

            } else {

              // Let's check if there's an appliance with a similar name in the backup
              const backupAppliances = backupData.data.appliances;
              if (backupAppliances && Array.isArray(backupAppliances)) {
                const originalAppliance = backupAppliances.find(a => (a.id === applianceId));
                if (originalAppliance) {

                  // Try to find by name instead
                  const [appByName] = await connection.execute(
                    'SELECT id, name FROM appliances WHERE name = ?',
                    [originalAppliance.name]
                  );
                  if (appByName.length > 0) {

                    // Retry with the new ID
                    const newApplianceId = appByName[0].id;
                    const createdAt = command.created_at || command.createdAt
                      ? new Date(command.created_at || command.createdAt)
                          .toISOString()
                          .slice(0, 19)
                          .replace('T', ' ')
                      : new Date().toISOString().slice(0, 19).replace('T', ' ');

                    const updatedAt = command.updated_at || command.updatedAt
                      ? new Date(command.updated_at || command.updatedAt)
                          .toISOString()
                          .slice(0, 19)
                          .replace('T', ' ')
                      : createdAt;

                    // Handle host ID mapping
                    let newHostId = null;
                    if (hostId) {
                      if (hosts && hosts.length > 0) {
                        const originalHost = hosts.find(h => h.id === hostId);
                        if (originalHost) {
                          const [matchingHosts] = await connection.execute(
                            'SELECT id FROM hosts WHERE hostname = ? AND username = ? AND port = ?',
                            [
                              originalHost.hostname || originalHost.host,
                              originalHost.username,
                              originalHost.port || 22,
                            ]
                          );
                          if (matchingHosts.length > 0) {
                            newHostId = matchingHosts[0].id;
                          }
                        }
                      }
                    }

                    const commandData = {
                      applianceId: newApplianceId,  // Use the new ID
                      description: command.description,
                      command: command.command,
                      hostId: newHostId,
                      createdAt: createdAt,
                      updatedAt: updatedAt
                    };

                    const { sql, values } = prepareInsert('appliance_commands', commandData);
                    await connection.execute(sql, values);
                    restoredCustomCommands++;

                  }
                }
              }
            }
          } catch (error) {
            console.error(
              `❌ Error restoring command "${command.description}":`,
              error.message
            );
            console.error('Full error:', error);
          }
        }

        // Set AUTO_INCREMENT for custom commands
        const [maxCmdIdResult] = await connection.execute(
          'SELECT MAX(id) as maxId FROM appliance_commands'
        );
        const maxCmdId = maxCmdIdResult[0].maxId || 0;
        await connection.execute(
          `ALTER TABLE appliance_commands AUTO_INCREMENT = ${maxCmdId + 1}`
        );
      } else {

      }

      // Restore audit logs
      if (audit_logs && audit_logs.length > 0) {
        try {

          // Don't delete existing audit logs, just add the ones from backup

          for (const auditLog of audit_logs) {
            const createdAt = auditLog.created_at
              ? new Date(auditLog.created_at)
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ')
              : new Date().toISOString().slice(0, 19).replace('T', ' ');

            // Find the corresponding user ID in the restored system
            let newUserId = null;
            if (auditLog.user_id && users) {
              const originalUser = users.find(u => u.id === auditLog.user_id);
              if (originalUser) {
                const [userResult] = await connection.execute(
                  'SELECT id FROM users WHERE username = ? OR email = ?',
                  [originalUser.username, originalUser.email]
                );
                if (userResult.length > 0) {
                  newUserId = userResult[0].id;
                }
              }
            }

            // Handle details - check if it's already a string (from backup) or an object
            let detailsValue = null;
            if (auditLog.details) {
              if (typeof auditLog.details === 'string') {
                // Already a JSON string from backup, use as-is
                detailsValue = auditLog.details;
              } else {
                // Object, needs to be stringified
                detailsValue = JSON.stringify(auditLog.details);
              }
            }

            await connection.execute(
              `INSERT INTO audit_logs 
               (user_id, action, resource_type, resource_id, details, ip_address, created_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                newUserId,
                auditLog.action,
                auditLog.resource_type || null,
                auditLog.resource_id || null,
                detailsValue,
                auditLog.ip_address || null,
                createdAt,
              ]
            );
            restoredAuditLogs++;
          }

        } catch (error) {

        }
      }

      // Restore role permissions
      if (role_permissions && role_permissions.length > 0) {
        try {

          // Clear existing role permissions
          await connection.execute('DELETE FROM role_permissions');

          for (const rolePerm of role_permissions) {
            const createdAt = rolePerm.created_at
              ? new Date(rolePerm.created_at)
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ')
              : new Date().toISOString().slice(0, 19).replace('T', ' ');

            await connection.execute(
              `INSERT INTO role_permissions 
               (role, permission, created_at) 
               VALUES (?, ?, ?)`,
              [rolePerm.role, rolePerm.permission, createdAt]
            );
            restoredRolePermissions++;
          }

        } catch (error) {

        }
      }

      // Restore user appliance permissions
      if (user_appliance_permissions && user_appliance_permissions.length > 0) {
        try {

          // Clear existing user appliance permissions
          await connection.execute('DELETE FROM user_appliance_permissions');

          for (const userAppPerm of user_appliance_permissions) {
            // Find the corresponding user ID in the restored system
            let newUserId = null;
            if (userAppPerm.user_id && users) {
              const originalUser = users.find(
                u => u.id === userAppPerm.user_id
              );
              if (originalUser) {
                const [userResult] = await connection.execute(
                  'SELECT id FROM users WHERE username = ? OR email = ?',
                  [originalUser.username, originalUser.email]
                );
                if (userResult.length > 0) {
                  newUserId = userResult[0].id;
                }
              }
            }

            // Only restore if both user and appliance exist
            if (newUserId) {
              const [applianceExists] = await connection.execute(
                'SELECT id FROM appliances WHERE id = ?',
                [userAppPerm.appliance_id]
              );

              if (applianceExists.length > 0) {
                const createdAt = userAppPerm.created_at
                  ? new Date(userAppPerm.created_at)
                      .toISOString()
                      .slice(0, 19)
                      .replace('T', ' ')
                  : new Date().toISOString().slice(0, 19).replace('T', ' ');

                const updatedAt = userAppPerm.updated_at
                  ? new Date(userAppPerm.updated_at)
                      .toISOString()
                      .slice(0, 19)
                      .replace('T', ' ')
                  : createdAt;

                await connection.execute(
                  `INSERT INTO user_appliance_permissions 
                   (user_id, appliance_id, can_view, can_control, can_edit, can_delete, created_at, updated_at) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    newUserId,
                    userAppPerm.appliance_id,
                    userAppPerm.can_view || false,
                    userAppPerm.can_control || false,
                    userAppPerm.can_edit || false,
                    userAppPerm.can_delete || false,
                    createdAt,
                    updatedAt,
                  ]
                );
                restoredUserAppliancePermissions++;
              }
            }
          }

        } catch (error) {

        }
      }

      // Restore service command logs
      if (service_command_logs && service_command_logs.length > 0) {
        try {

          // Don't delete existing logs, just add the ones from backup

          for (const logEntry of service_command_logs) {
            // Check if the appliance still exists
            const [applianceExists] = await connection.execute(
              'SELECT id FROM appliances WHERE id = ?',
              [logEntry.appliance_id]
            );

            if (applianceExists.length > 0) {
              const executedAt = logEntry.executed_at
                ? new Date(logEntry.executed_at)
                    .toISOString()
                    .slice(0, 19)
                    .replace('T', ' ')
                : new Date().toISOString().slice(0, 19).replace('T', ' ');

              await connection.execute(
                `INSERT INTO service_command_logs 
                 (appliance_id, command_type, command, exit_code, stdout, stderr, execution_time_ms, executed_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  logEntry.appliance_id,
                  logEntry.command_type,
                  logEntry.command,
                  logEntry.exit_code || null,
                  logEntry.stdout || null,
                  logEntry.stderr || null,
                  logEntry.execution_time_ms || null,
                  executedAt,
                ]
              );
              restoredServiceCommandLogs++;
            }
          }

        } catch (error) {

        }
      }

      // Restore sessions (Note: Only restore active sessions if needed)
      if (actualSessions && actualSessions.length > 0) {
        try {

          // We don't restore sessions by default as they are temporary
          // and should be recreated on login

        } catch (error) {

        }
      }

      // Restore SNMP/Monitoring configurations

      // Restore host_snmp_configs
      if (host_snmp_configs && host_snmp_configs.length > 0) {
        try {
          console.log(`📊 Restoring SNMP configs with host ID mapping...`);
          await connection.execute('DELETE FROM host_snmp_configs');
          
          for (const config of host_snmp_configs) {
            // Map old host ID to new host ID
            const oldHostId = config.host_id || config.hostId;
            const newHostId = hostIdMapping[oldHostId] || oldHostId;
            
            // Check if the host exists
            const [hostExists] = await connection.execute(
              'SELECT id FROM hosts WHERE id = ?',
              [newHostId]
            );
            
            if (hostExists.length > 0) {
              const configData = {
                hostId: newHostId,  // Use mapped host ID
                enabled: Boolean(config.enabled),
                version: config.version || '2c',
                community: config.community || 'public',
                port: config.port || 161,
                username: config.username || null,
                authProtocol: config.auth_protocol || config.authProtocol || null,
                authPassword: config.auth_password || config.authPassword || null,
                privProtocol: config.priv_protocol || config.privProtocol || null,
                privPassword: config.priv_password || config.privPassword || null,
                pollInterval: config.poll_interval || config.pollInterval || 60,
                createdAt: config.created_at || config.createdAt || new Date(),
                updatedAt: config.updated_at || config.updatedAt || new Date()
              };
              
              const { sql, values } = prepareInsert('host_snmp_configs', configData);
              await connection.execute(sql, values);
              restoredHostSnmpConfigs++;
            }
          }

        } catch (error) {
          console.error('❌ Error restoring SNMP configs:', error.message);
        }
      }

      // Restore host_metrics_logging
      if (host_metrics_logging && host_metrics_logging.length > 0) {
        try {
          console.log(`📊 Restoring metrics logging config with host ID mapping...`);
          await connection.execute('DELETE FROM host_metrics_logging');
          
          for (const logging of host_metrics_logging) {
            // Map old host ID to new host ID
            const oldHostId = logging.host_id || logging.hostId;
            const newHostId = hostIdMapping[oldHostId] || oldHostId;
            
            // Check if the host exists
            const [hostExists] = await connection.execute(
              'SELECT id FROM hosts WHERE id = ?',
              [newHostId]
            );
            
            if (hostExists.length > 0) {
              const loggingData = {
                hostId: newHostId,  // Use mapped host ID
                config: typeof logging.config === 'string' ? logging.config : JSON.stringify(logging.config || {}),
                customNames: typeof logging.custom_names === 'string' ? logging.custom_names : 
                  (typeof logging.customNames === 'string' ? logging.customNames : 
                    JSON.stringify(logging.custom_names || logging.customNames || {})),
                selectedMetrics: typeof logging.selected_metrics === 'string' ? logging.selected_metrics :
                  (typeof logging.selectedMetrics === 'string' ? logging.selectedMetrics :
                    JSON.stringify(logging.selected_metrics || logging.selectedMetrics || null)),
                defaultTimeRange: logging.default_time_range || logging.defaultTimeRange || '15m',
                createdAt: logging.created_at || logging.createdAt || new Date(),
                updatedAt: logging.updated_at || logging.updatedAt || new Date()
              };
              
              const { sql, values } = prepareInsert('host_metrics_logging', loggingData);
              await connection.execute(sql, values);
              restoredHostMetricsLogging++;
            }
          }

        } catch (error) {
          console.error('❌ Error restoring metrics logging:', error.message);
        }
      }

      // Restore host_monitoring_data
      if (host_monitoring_data && host_monitoring_data.length > 0) {
        try {

          // Don't delete existing monitoring data - just add from backup
          
          for (const data of host_monitoring_data) {
            // Check if the host exists
            const [hostExists] = await connection.execute(
              'SELECT id FROM hosts WHERE id = ?',
              [data.host_id || data.hostId]
            );
            
            if (hostExists.length > 0) {
              const monitoringData = {
                hostId: data.host_id || data.hostId,
                status: data.status || 'offline',
                lastUpdate: data.last_update || data.lastUpdate || new Date(),
                cpuUsage: data.cpu_usage || data.cpuUsage || null,
                memoryUsed: data.memory_used || data.memoryUsed || null,
                memoryTotal: data.memory_total || data.memoryTotal || null,
                memoryPercent: data.memory_percent || data.memoryPercent || null,
                temperature: data.temperature || null,
                uptimeSeconds: data.uptime_seconds || data.uptimeSeconds || null,
                createdAt: data.created_at || data.createdAt || new Date()
              };
              
              const { sql, values } = prepareInsert('host_monitoring_data', monitoringData);
              await connection.execute(sql, values);
              restoredHostMonitoringData++;
            }
          }

        } catch (error) {
          console.error('❌ Error restoring monitoring data:', error.message);
        }
      }

      // Restore snmp_thresholds
      if (snmp_thresholds && snmp_thresholds.length > 0) {
        try {

          await connection.execute('DELETE FROM snmp_thresholds');
          
          for (const threshold of snmp_thresholds) {
            const thresholdData = {
              hostId: threshold.host_id || threshold.hostId || null,
              metricName: threshold.metric_name || threshold.metricName,
              warningValue: threshold.warning_value || threshold.warningValue || null,
              criticalValue: threshold.critical_value || threshold.criticalValue || null,
              enabled: Boolean(threshold.enabled !== false),
              createdAt: threshold.created_at || threshold.createdAt || new Date(),
              updatedAt: threshold.updated_at || threshold.updatedAt || new Date()
            };
            
            const { sql, values } = prepareInsert('snmp_thresholds', thresholdData);
            await connection.execute(sql, values);
            restoredSnmpThresholds++;
          }

        } catch (error) {
          console.error('❌ Error restoring SNMP thresholds:', error.message);
        }
      }

      // metric_definitions restore removed - table no longer exists

      // Restore host disk configurations
      if (host_disk_config && host_disk_config.length > 0) {
        try {
          console.log(`📊 Restoring ${host_disk_config.length} disk configurations with host ID mapping...`);
          await connection.execute('DELETE FROM host_disk_config');
          
          for (const diskConfig of host_disk_config) {
            // Map old host ID to new host ID
            const oldHostId = diskConfig.host_id || diskConfig.hostId;
            const newHostId = hostIdMapping[oldHostId] || oldHostId;
            
            const configData = {
              hostId: newHostId,  // Use mapped host ID
              diskIndex: diskConfig.disk_index || diskConfig.diskIndex,
              diskName: diskConfig.disk_name || diskConfig.diskName || null,
              totalSizeGb: diskConfig.total_size_gb || diskConfig.totalSizeGb,
              createdAt: diskConfig.created_at || diskConfig.createdAt || new Date(),
              updatedAt: diskConfig.updated_at || diskConfig.updatedAt || new Date()
            };
            
            const { sql, values } = prepareInsert('host_disk_config', configData);
            await connection.execute(sql, values);
          }
          console.log(`✅ Restored ${host_disk_config.length} disk configurations`);

        } catch (error) {
          console.error('❌ Error restoring host disk config:', error.message);
        }
      }

      // Restore ALL SNMP metrics (complete history)
      if (snmp_metrics && snmp_metrics.length > 0) {
        try {
          console.log(`📊 Restoring ${snmp_metrics.length} SNMP metrics (this may take a while)...`);
          console.log(`📌 Using host ID mapping:`, hostIdMapping);
          
          // Send SSE update for SNMP metrics start
          if (sendProgressUpdate) {
            sendProgressUpdate(sessionId, {
              type: 'step',
              currentStep: 'snmp_metrics',
              message: `Restoring ${snmp_metrics.length.toLocaleString()} SNMP metrics...`,
              totalItems: { snmp_metrics: snmp_metrics.length }
            });
          }
          
          await connection.execute('DELETE FROM snmp_metrics');
          
          // Batch insert for better performance
          const batchSize = 1000;
          let skippedMetrics = 0;
          let processedMetrics = 0;
          
          for (let i = 0; i < snmp_metrics.length; i += batchSize) {
            const batch = snmp_metrics.slice(i, i + batchSize);
            
            for (const metric of batch) {
              // Map old host ID to new host ID
              const oldHostId = metric.host_id || metric.hostId;
              const newHostId = hostIdMapping[oldHostId] || oldHostId; // Fallback to original if no mapping
              
              // Skip metrics for hosts that don't exist
              if (!newHostId) {
                skippedMetrics++;
                continue;
              }
              
              const metricData = {
                hostId: newHostId,  // Use mapped host ID
                metricKey: metric.metric_key || metric.metricKey,
                metricValue: metric.metric_value || metric.metricValue,
                metricName: metric.metric_name || metric.metricName || null,
                timestamp: metric.timestamp || new Date()
              };
              
              const { sql, values } = prepareInsert('snmp_metrics', metricData);
              await connection.execute(sql, values);
              processedMetrics++;
            }
            
            const currentProcessed = Math.min(i + batchSize, snmp_metrics.length);
            console.log(`  Processed ${currentProcessed} of ${snmp_metrics.length} metrics...`);
            
            // Send SSE progress update every batch
            if (sendProgressUpdate) {
              const progressPercent = Math.round((currentProcessed / snmp_metrics.length) * 100);
              sendProgressUpdate(sessionId, {
                type: 'progress',
                progress: progressPercent,
                currentStep: 'snmp_metrics',
                processedItems: { snmp_metrics: currentProcessed },
                message: `Processed ${currentProcessed.toLocaleString()} of ${snmp_metrics.length.toLocaleString()} metrics`,
                detail: `Batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(snmp_metrics.length / batchSize)}`
              });
            }
          }
          
          restoredSnmpMetrics = snmp_metrics.length - skippedMetrics;
          console.log(`✅ Restored ${restoredSnmpMetrics} SNMP metrics (${skippedMetrics} skipped)`);
          
          // Send completion update for SNMP metrics
          if (sendProgressUpdate) {
            sendProgressUpdate(sessionId, {
              type: 'step_complete',
              currentStep: 'snmp_metrics',
              message: `✅ Restored ${restoredSnmpMetrics} SNMP metrics`,
              processedItems: { snmp_metrics: restoredSnmpMetrics }
            });
          }

        } catch (error) {
          console.error('❌ Error restoring SNMP metrics:', error.message);
          
          // Send error update
          if (sendProgressUpdate) {
            sendProgressUpdate(sessionId, {
              type: 'step_error',
              currentStep: 'snmp_metrics',
              message: `Error restoring SNMP metrics: ${error.message}`
            });
          }
        }
      }

      // Restore SNMP interfaces
      if (snmp_interfaces && snmp_interfaces.length > 0) {
        try {
          console.log(`📊 Restoring ${snmp_interfaces.length} SNMP interfaces with host ID mapping...`);
          await connection.execute('DELETE FROM snmp_interfaces');
          
          // Batch insert
          const batchSize = 500;
          let skippedInterfaces = 0;
          
          for (let i = 0; i < snmp_interfaces.length; i += batchSize) {
            const batch = snmp_interfaces.slice(i, i + batchSize);
            
            for (const iface of batch) {
              // Map old host ID to new host ID
              const oldHostId = iface.host_id || iface.hostId;
              const newHostId = hostIdMapping[oldHostId] || oldHostId;
              
              // Skip interfaces for hosts that don't exist
              if (!newHostId) {
                skippedInterfaces++;
                continue;
              }
              
              const ifaceData = {
                hostId: newHostId,  // Use mapped host ID
                interfaceIndex: iface.interface_index || iface.interfaceIndex,
                interfaceName: iface.interface_name || iface.interfaceName,
                interfaceDescription: iface.interface_description || iface.interfaceDescription || null,
                interfaceType: iface.interface_type || iface.interfaceType || null,
                interfaceSpeed: iface.interface_speed || iface.interfaceSpeed || null,
                adminStatus: iface.admin_status || iface.adminStatus || null,
                operStatus: iface.oper_status || iface.operStatus || null,
                inOctets: iface.in_octets || iface.inOctets || 0,
                outOctets: iface.out_octets || iface.outOctets || 0,
                inErrors: iface.in_errors || iface.inErrors || 0,
                outErrors: iface.out_errors || iface.outErrors || 0,
                collectedAt: iface.collected_at || iface.collectedAt || new Date()
              };
              
              const { sql, values } = prepareInsert('snmp_interfaces', ifaceData);
              await connection.execute(sql, values);
            }
          }
          
          restoredSnmpInterfaces = snmp_interfaces.length - skippedInterfaces;
          console.log(`✅ Restored ${restoredSnmpInterfaces} SNMP interfaces (${skippedInterfaces} skipped)`);

        } catch (error) {
          console.error('❌ Error restoring SNMP interfaces:', error.message);
        }
      }

      // Restore SNMP disk metrics
      if (snmp_disk_metrics && snmp_disk_metrics.length > 0) {
        try {
          console.log(`📊 Restoring ${snmp_disk_metrics.length} SNMP disk metrics with host ID mapping...`);
          await connection.execute('DELETE FROM snmp_disk_metrics');
          
          for (const diskMetric of snmp_disk_metrics) {
            // Map old host ID to new host ID
            const oldHostId = diskMetric.host_id || diskMetric.hostId;
            const newHostId = hostIdMapping[oldHostId] || oldHostId;
            
            await connection.execute(
              `INSERT INTO snmp_disk_metrics 
               (host_id, disk_index, disk_path, total_size, used_space, available_space, 
                use_percent, collected_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                newHostId,  // Use mapped host ID
                diskMetric.disk_index || diskMetric.diskIndex,
                diskMetric.disk_path || diskMetric.diskPath || '/',
                diskMetric.total_size || diskMetric.totalSize || 0,
                diskMetric.used_space || diskMetric.usedSpace || 0,
                diskMetric.available_space || diskMetric.availableSpace || 0,
                diskMetric.use_percent || diskMetric.usePercent || 0,
                diskMetric.collected_at || diskMetric.collectedAt || new Date()
              ]
            );
          }
          console.log(`✅ Restored ${snmp_disk_metrics.length} SNMP disk metrics`);

        } catch (error) {
          console.error('❌ Error restoring SNMP disk metrics:', error.message);
        }
      }

      // Restore SNMP errors (for debugging)
      if (snmp_errors && snmp_errors.length > 0) {
        try {
          console.log(`📊 Restoring ${snmp_errors.length} SNMP errors with host ID mapping...`);
          await connection.execute('DELETE FROM snmp_errors');
          
          for (const error of snmp_errors) {
            // Map old host ID to new host ID
            const oldHostId = error.host_id || error.hostId;
            const newHostId = hostIdMapping[oldHostId] || oldHostId;
            
            await connection.execute(
              `INSERT INTO snmp_errors 
               (host_id, error_type, error_message, error_details, occurred_at) 
               VALUES (?, ?, ?, ?, ?)`,
              [
                newHostId,  // Use mapped host ID
                error.error_type || error.errorType || 'unknown',
                error.error_message || error.errorMessage || '',
                error.error_details || error.errorDetails || null,
                error.occurred_at || error.occurredAt || new Date()
              ]
            );
          }
          console.log(`✅ Restored ${snmp_errors.length} SNMP errors`);

        } catch (error) {
          console.error('❌ Error restoring SNMP errors:', error.message);
        }
      }

      // Restore SNMP latest metrics
      if (snmp_latest_metrics && snmp_latest_metrics.length > 0) {
        try {
          console.log(`📊 Restoring ${snmp_latest_metrics.length} latest metrics with host ID mapping...`);
          await connection.execute('DELETE FROM snmp_latest_metrics');
          
          for (const latest of snmp_latest_metrics) {
            // Map old host ID to new host ID
            const oldHostId = latest.host_id || latest.hostId;
            const newHostId = hostIdMapping[oldHostId] || oldHostId;
            
            const latestData = {
              hostId: newHostId,  // Use mapped host ID
              metricKey: latest.metric_key || latest.metricKey,
              metricValue: latest.metric_value || latest.metricValue,
              metricName: latest.metric_name || latest.metricName || null,
              updatedAt: latest.updated_at || latest.updatedAt || new Date()
            };
            
            const { sql, values } = prepareInsert('snmp_latest_metrics', latestData);
            await connection.execute(sql, values);
          }
          console.log(`✅ Restored ${snmp_latest_metrics.length} latest metrics`);

        } catch (error) {
          console.error('❌ Error restoring SNMP latest metrics:', error.message);
        }
      }

      // Commit transaction
      await connection.commit();
      
      // DEBUG: Final check after commit
      const [finalAppliances] = await connection.execute('SELECT COUNT(*) as count FROM appliances');
      const [finalHosts] = await connection.execute('SELECT COUNT(*) as count FROM hosts');
      const [finalCategories] = await connection.execute('SELECT COUNT(*) as count FROM categories');
      console.log(`📊 AFTER COMMIT - Appliances: ${finalAppliances[0].count}, Hosts: ${finalHosts[0].count}, Categories: ${finalCategories[0].count}`);

      let responseMessage;
      let sshAutoInitialized = false;

      if (isOldVersion) {
        if (restoredSSHKeys > 0 || legacySSHInitialized) {
          responseMessage =
            'Legacy backup restored successfully with SSH system auto-initialized';
          sshAutoInitialized = true;
        } else {
          responseMessage =
            'Legacy backup restored successfully (SSH initialization failed - may need manual setup)';
        }
      } else {
        responseMessage = 'SSH-Enhanced backup restored successfully';
      }

      // Regenerate SSH config directly after restore - with timeout protection
      if (restoredSSHKeys > 0 || restoredSSHHosts > 0) {

        // Use setTimeout to prevent hanging
        const sshRegenerationTimeout = setTimeout(() => {
          console.error('⚠️ SSH regeneration timed out after 30 seconds');
        }, 30000);
        
        try {
          const { SSHManager } = require('../utils/sshManager');
          const sshManager = new SSHManager({});

          // First sync keys to filesystem

          const syncPromise = sshManager.syncKeysToFilesystem();
          const syncedKeys = await Promise.race([
            syncPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
          ]);

          // Also restore user-specific SSH keys

          try {
            const { restoreSSHKeys } = require('../scripts/restore-ssh-keys');
            await restoreSSHKeys();

          } catch (keyRestoreError) {
            console.error('  ⚠️ Failed to restore user SSH keys:', keyRestoreError.message);
          }

          // Then regenerate SSH config

          const configPromise = sshManager.regenerateSSHConfig();
          await Promise.race([
            configPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
          ]);

          // Fix permissions - quick operation, no timeout needed

          const fs = require('fs').promises;
          const sshDir = '/root/.ssh';
          await fs.chmod(sshDir, 0o700).catch(() => {});

          const files = await fs.readdir(sshDir).catch(() => []);
          for (const file of files) {
            const filePath = path.join(sshDir, file);
            if (file.startsWith('id_rsa_') && !file.endsWith('.pub')) {
              await fs.chmod(filePath, 0o600).catch(() => {});
            } else if (file.endsWith('.pub')) {
              await fs.chmod(filePath, 0o644).catch(() => {});
            } else if (file === 'config') {
              await fs.chmod(filePath, 0o600).catch(() => {});
            }
          }

          clearTimeout(sshRegenerationTimeout);
        } catch (sshError) {
          clearTimeout(sshRegenerationTimeout);
          console.error('⚠️ SSH regeneration error:', sshError.message);
          // Don't fail the restore if SSH regeneration fails
        }
      }

      // ALWAYS regenerate SSH keys for all users after restore (regardless of SSH restore)

      try {
        const [users] = await connection.execute('SELECT id, username FROM users');
        
        if (users.length > 0) {
          const { exec } = require('child_process');
          const { promisify } = require('util');
          const execAsync = promisify(exec);
          const fs = require('fs').promises;
          const sshDir = '/root/.ssh';
          
          // Ensure SSH directory exists
          await fs.mkdir(sshDir, { recursive: true });
          await fs.chmod(sshDir, 0o700);
          
          let keysGenerated = 0;
          let keysFailed = 0;
          
          for (const user of users) {
            try {
              const privateKeyPath = path.join(sshDir, `id_rsa_user${user.id}_dashboard`);
              const publicKeyPath = `${privateKeyPath}.pub`;
              
              // Check if key already exists
              const keyExists = await fs.access(privateKeyPath).then(() => true).catch(() => false);
              
              if (!keyExists) {
                // Generate new key
                const keygenCmd = `ssh-keygen -t rsa -b 2048 -f "${privateKeyPath}" -N "" -C "dashboard@${user.username}"`;
                await execAsync(keygenCmd, { timeout: 10000 });
                
                // Set proper permissions
                await fs.chmod(privateKeyPath, 0o600);
                await fs.chmod(publicKeyPath, 0o644);
                
                // Read the generated keys
                const privateKey = await fs.readFile(privateKeyPath, 'utf8');
                const publicKey = await fs.readFile(publicKeyPath, 'utf8');
                
                // Get fingerprint
                const { stdout: fingerprint } = await execAsync(
                  `ssh-keygen -lf "${publicKeyPath}" | awk '{print $2}'`,
                  { timeout: 5000 }
                );
                
                // IMPORTANT: Store in database so it's included in future backups!
                await connection.execute(
                  `INSERT INTO ssh_keys (key_name, key_type, key_size, comment, public_key, private_key, fingerprint, created_by, created_at, updated_at) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                  [
                    'dashboard',  // All user keys are named 'dashboard' in the DB
                    'rsa',
                    2048,
                    `dashboard@${user.username}`,
                    publicKey.trim(),
                    privateKey,
                    fingerprint.trim(),
                    user.id
                  ]
                );

      // Restore Guacamole database if included in backup
      if (guacamole_backup) {

        try {
          const guacBackup = guacamole_backup;
          
          if (guacBackup.encoding === 'base64' && guacBackup.data) {
            // Decode base64 SQL dump
            const sqlDump = Buffer.from(guacBackup.data, 'base64').toString('utf8');

            // Write to temporary file
            const tempFile = `/tmp/guacamole_restore_${Date.now()}.sql`;
            await fs.writeFile(tempFile, sqlDump);
            
            // Restore using psql
            const guacUser = process.env.GUACAMOLE_DB_USER || 'guacamole_user';
            const guacDb = process.env.GUACAMOLE_DB_NAME || 'guacamole_db';
            const guacPass = process.env.GUACAMOLE_DB_PASSWORD || 'guacamole_pass123';
            
            // Use docker exec to restore
            const restoreCmd = `docker exec -i appliance_guacamole_db psql -U ${guacUser} -d ${guacDb} < ${tempFile}`;
            
            try {
              await execAsync(restoreCmd, {
                maxBuffer: 50 * 1024 * 1024,
                env: { ...process.env, PGPASSWORD: guacPass }
              });

              // Clean up temp file
              await fs.unlink(tempFile).catch(() => {});
              
              // Restart Guacamole to apply changes

              await execAsync('docker restart appliance_guacamole', { timeout: 30000 });

            } catch (restoreError) {
              console.error('  ❌ Failed to restore Guacamole database:', restoreError.message);
              // Clean up temp file
              await fs.unlink(tempFile).catch(() => {});
              
              // Try alternative restore method

              try {
                // Write SQL to stdin of psql command
                const { stdin } = require('child_process').spawn(
                  'docker',
                  ['exec', '-i', 'appliance_guacamole_db', 'psql', '-U', guacUser, '-d', guacDb],
                  { env: { ...process.env, PGPASSWORD: guacPass } }
                );
                stdin.write(sqlDump);
                stdin.end();
                
                // Wait a bit for the restore to complete
                await new Promise(resolve => setTimeout(resolve, 5000));

              } catch (altError) {
                console.error('  ❌ Alternative restore also failed:', altError.message);
                restorationSummary.warnings.push('Guacamole database restore failed');
              }
            }
          } else {

            restorationSummary.warnings.push('Guacamole backup format not supported');
          }
        } catch (guacError) {
          console.error('❌ Guacamole restore error:', guacError.message);
          restorationSummary.warnings.push(`Guacamole restore failed: ${guacError.message}`);
        }
      } else {

      }
                
                keysGenerated++;

              } else {
                // Key exists in filesystem, but might not be in database - check and add if missing

                // Check if key is in database
                const [dbKeys] = await connection.execute(
                  'SELECT id FROM ssh_keys WHERE key_name = ? AND created_by = ?',
                  ['dashboard', user.id]
                );
                
                if (dbKeys.length === 0) {
                  // Key not in database, add it
                  const privateKey = await fs.readFile(privateKeyPath, 'utf8');
                  const publicKey = await fs.readFile(publicKeyPath, 'utf8');
                  
                  // Get fingerprint
                  const { stdout: fingerprint } = await execAsync(
                    `ssh-keygen -lf "${publicKeyPath}" | awk '{print $2}'`,
                    { timeout: 5000 }
                  );
                  
                  await connection.execute(
                    `INSERT INTO ssh_keys (key_name, key_type, key_size, comment, public_key, private_key, fingerprint, created_by, created_at, updated_at) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                    [
                      'dashboard',
                      'rsa',
                      2048,
                      `dashboard@${user.username}`,
                      publicKey.trim(),
                      privateKey,
                      fingerprint.trim(),
                      user.id
                    ]
                  );

                } else {

                }
              }
            } catch (error) {
              keysFailed++;

            }
          }
          
          if (keysGenerated > 0) {

          }
          if (keysFailed > 0) {

          }
        }
      } catch (error) {
        console.error('❌ Error regenerating user SSH keys:', error.message);
      }

      // Run post-restore hook with timeout - DISABLED to prevent hanging

      // WICHTIG: Recreate Guacamole connections nach Restore

      try {
        const { recreateGuacamoleConnections } = require('../utils/recreateGuacamoleConnections');
        await recreateGuacamoleConnections();

      } catch (guacError) {
        console.error('⚠️ Failed to recreate Guacamole connections:', guacError.message);
        // Don't fail the restore if this fails
      }
      
      // WICHTIG: Restart SNMP Background Polling Service nach Restore
      if (restoredHostSnmpConfigs > 0 || restoredSnmpMetrics > 0) {
        console.log('🔄 Signaling SNMP Background Polling Service to reload hosts...');
        try {
          // Get all enabled SNMP hosts from the restored data
          const [snmpHosts] = await connection.execute(
            `SELECT h.id FROM hosts h 
             JOIN host_snmp_configs hsc ON h.id = hsc.host_id 
             WHERE hsc.enabled = 1`
          );
          
          if (snmpHosts.length > 0) {
            console.log(`  Sending reload signals for ${snmpHosts.length} SNMP hosts...`);
            
            // Insert reload signals for all SNMP-enabled hosts
            for (const host of snmpHosts) {
              await connection.execute(
                `INSERT INTO snmp_reload_signals (host_id, signal_type) 
                 VALUES (?, 'add') 
                 ON DUPLICATE KEY UPDATE signal_type = 'add', processed_at = NULL`,
                [host.id]
              );
            }
            
            console.log('✅ SNMP Polling Service will automatically reload all hosts');
            console.log('  The polling service checks for signals every 10 seconds');
          }
        } catch (error) {
          console.error('⚠️ Failed to signal SNMP Polling Service:', error.message);
          // Don't fail the restore if signaling fails
        }
      }
      
      // WICHTIG: Restart Status Checker Service nach Restore
      console.log('🔄 Restarting Status Checker Service for host ping and service monitoring...');
      try {
        const statusChecker = require('../utils/statusChecker');
        
        // Stop if running
        if (statusChecker.isRunning) {
          console.log('  Stopping existing status checker...');
          statusChecker.stop();
        }
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Start again
        console.log('  Starting status checker...');
        await statusChecker.start();
        console.log('✅ Status Checker Service restarted successfully');
        console.log(`  Check interval: ${statusChecker.checkInterval / 1000} seconds`);
        console.log(`  Monitoring: Host pings and service status commands`);
        
      } catch (error) {
        console.error('⚠️ Failed to restart Status Checker:', error.message);
        // Don't fail the restore if status checker restart fails
      }
      
      // The SSH regeneration is already done above, so the hook is redundant
      /*
      try {
        const { execSync } = require('child_process');
        const hookPath = path.join(__dirname, '..', 'post-restore-hook.sh');

        // Check if hook exists
        const fs = require('fs');
        if (fs.existsSync(hookPath)) {
          // Run the hook with a 60-second timeout
          try {
            const output = execSync(`timeout 60s bash ${hookPath}`, {
              encoding: 'utf8',
              cwd: path.dirname(hookPath),
              stdio: 'pipe', // Capture output instead of inherit
            });

            if (output) {
              console.log('Hook output:', output.substring(0, 500)); // Log first 500 chars
            }
          } catch (execError) {
            if (execError.code === 124) {
              console.error('⚠️ Post-restore hook timed out after 60 seconds');
            } else {
              console.error('⚠️ Post-restore hook failed:', execError.message);
            }
            // Don't fail the restore if hook fails
          }
        } else {

        }
      } catch (hookError) {
        console.error('⚠️ Post-restore hook error:', hookError.message);
        // Don't fail the restore if hook fails
      }
      */

      // Create audit log
      const ipAddress = req.clientIp;
      await createAuditLog(
        req.user?.id || null,
        'backup_restore',
        'backup',
        null,
        {
          restored_items: {
            appliances: restoredAppliances,
            categories: restoredCategories,
            settings: restoredSettings,
            background_images: restoredBackgrounds,
            hosts: restoredHosts,
            services: restoredServices,
            ssh_keys: restoredSSHKeys,
            ssh_hosts: restoredSSHHosts,
            ssh_config: restoredSSHConfig,
            ssh_upload_logs: restoredSSHUploadLogs,
            custom_commands: restoredCustomCommands,
            users: restoredUsers,
            audit_logs: restoredAuditLogs,
            role_permissions: restoredRolePermissions,
            user_appliance_permissions: restoredUserAppliancePermissions,
            service_command_logs: restoredServiceCommandLogs,
            // SNMP/Monitoring items
            host_snmp_configs: restoredHostSnmpConfigs,
            host_monitoring_data: restoredHostMonitoringData,
            host_metrics_logging: restoredHostMetricsLogging,
            snmp_thresholds: restoredSnmpThresholds,
            snmp_metrics: restoredSnmpMetrics,
            snmp_interfaces: restoredSnmpInterfaces,
            snmp_disk_metrics: restoredSnmpDiskMetrics,
            snmp_errors: restoredSnmpErrors,
            host_disk_metrics: restoredHostDiskMetrics,
            host_network_metrics: restoredHostNetworkMetrics,
            metric_definitions: restoredMetricDefinitions,
            host_disk_config: restoredHostDiskConfig,
            snmp_latest_metrics: restoredSnmpLatestMetrics,
          },
          backup_version: backupData.version,
          backup_created_at: backupData.created_at,
          restored_by: req.user?.username || 'unknown',
        },
        ipAddress
      );

      console.log('✅ Restore completed successfully, sending response with sessionId:', sessionId);
      
      res.json({
        sessionId, // Include session ID for SSE progress tracking
        message: responseMessage,
        restored_appliances: restoredAppliances,
        restored_categories: restoredCategories,
        restored_settings: restoredSettings,
        restored_background_images: restoredBackgrounds,
        restored_hosts: restoredHosts,
        restored_services: restoredServices,
        restored_ssh_keys: restoredSSHKeys,
        restored_ssh_hosts: restoredSSHHosts,
        restored_ssh_config: restoredSSHConfig,
        restored_ssh_upload_logs: restoredSSHUploadLogs,
        restored_custom_commands: restoredCustomCommands,
        restored_users: restoredUsers,
        restored_audit_logs: restoredAuditLogs,
        restored_role_permissions: restoredRolePermissions,
        restored_user_appliance_permissions: restoredUserAppliancePermissions,
        restored_service_command_logs: restoredServiceCommandLogs,
        // SNMP/Monitoring restored counts
        restored_host_snmp_configs: restoredHostSnmpConfigs,
        restored_host_monitoring_data: restoredHostMonitoringData,
        restored_host_metrics_logging: restoredHostMetricsLogging,
        restored_snmp_thresholds: restoredSnmpThresholds,
        restored_snmp_metrics: restoredSnmpMetrics,
        restored_snmp_interfaces: restoredSnmpInterfaces,
        restored_snmp_disk_metrics: restoredSnmpDiskMetrics,
        restored_snmp_errors: restoredSnmpErrors,
        restored_host_disk_metrics: restoredHostDiskMetrics,
        restored_host_network_metrics: restoredHostNetworkMetrics,
        restored_metric_definitions: restoredMetricDefinitions,
        restored_host_disk_config: restoredHostDiskConfig,
        restored_snmp_latest_metrics: restoredSnmpLatestMetrics,
        backup_version: backupData.version,
        backup_date: backupData.created_at,
        compatibility_mode: isOldVersion,
        ssh_auto_initialized: sshAutoInitialized,
        ssh_ready: restoredSSHKeys > 0,
        snmp_ready: restoredHostSnmpConfigs > 0,
        next_steps:
          isOldVersion && restoredSSHKeys > 0
            ? [
                'SSH system has been automatically initialized',
                'You can now add SSH hosts via Settings → SSH Management',
                'Configure SSH connections for your appliances',
                'SSH functionality is ready to use',
              ]
            : restoredUsers > 0
              ? [
                  `${restoredUsers} user(s) restored with their original passwords`,
                  'All user accounts including passwords have been fully restored',
                ]
              : [],
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error during enhanced restore:', error);
    res.status(500).json({
      error: 'Failed to restore backup: ' + error.message,
    });
  }
});

module.exports = router;
