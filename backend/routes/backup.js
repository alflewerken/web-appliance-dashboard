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
    // Get encryption key from environment
    const encryptionKey = process.env.SSH_KEY_ENCRYPTION_SECRET || process.env.ENCRYPTION_SECRET || 'default-insecure-key-change-this-in-production!!';
    
    // Function to encrypt password for backup
    const encryptPassword = (plainPassword) => {
      if (!plainPassword) return null;
      
      try {
        const crypto = require('crypto');
        const algorithm = 'aes-256-cbc';
        
        // Create cipher using the encryption key
        const key = crypto.createHash('sha256').update(String(encryptionKey)).digest();
        const iv = Buffer.alloc(16, 0); // Fixed IV for simplicity (in production, use random IV)
        
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(plainPassword, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return encrypted;
      } catch (error) {
        console.error('Failed to encrypt password:', error.message);
        return plainPassword; // Return plain password if encryption fails
      }
    };
    // Fetch all appliances
    const appliances = await db.select('appliances', {}, { orderBy: 'createdAt' });

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
      console.log(`✅ Fetched ${rolePermissions.length} role permissions`);
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
      console.log(
        `✅ Fetched ${userAppliancePermissions.length} user appliance permissions`
      );
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
      // Encrypt passwords in hosts
      hosts = rawHosts.map(host => ({
        ...host,
        password: encryptPassword(host.password),
        remotePassword: encryptPassword(host.remotePassword),
        rustdeskPassword: encryptPassword(host.rustdeskPassword)
      }));
      console.log(`✅ Fetched ${hosts.length} terminal hosts (passwords encrypted)`);
    } catch (error) {
      console.error('Error fetching hosts for backup:', error.message);
    }
    
    // Fetch services table
    let services = [];
    try {
      const rawServices = await db.select('services', {}, { orderBy: 'createdAt' });
      // Encrypt passwords in services
      services = rawServices.map(service => ({
        ...service,
        sshPassword: encryptPassword(service.sshPassword),
        vncPassword: encryptPassword(service.vncPassword),
        rdpPassword: encryptPassword(service.rdpPassword)
      }));
      console.log(`✅ Fetched ${services.length} proxy services (passwords encrypted)`);
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
      console.log(`✅ Fetched ${sshUploadLogs.length} SSH upload log entries`);
    } catch (error) {
      console.error('Error fetching SSH upload logs for backup:', error.message);
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
      
      console.log(
        `✅ Fetched ${users.length} users (including password hashes for backup)`
      );
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
      console.log(`✅ Fetched ${auditLogs.length} audit log entries`);
    } catch (error) {
      console.error('Error fetching audit logs for backup:', error.message);
    }

    try {
      console.log('🔍 Fetching SSH keys from database...');
      // ssh_hosts table removed - no longer backing up
      const keysResult = await db.select('ssh_keys', {}, { orderBy: 'keyName' });
      // ssh_config table removed
      sshHosts = []; // No longer used
      sshConfig = []; // No longer used

      console.log(`📊 Found ${keysResult.length} SSH keys in database`);
      
      // Debug: Log first key if exists
      if (keysResult.length > 0) {
        console.log('First SSH key:', {
          id: keysResult[0].id,
          keyName: keysResult[0].keyName,
          createdBy: keysResult[0].createdBy,
          hasPrivateKey: !!keysResult[0].privateKey,
          hasPublicKey: !!keysResult[0].publicKey
        });
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
                console.log(
                  `✅ Read private key from filesystem: ${actualPrivatePath}`
                );
                filesystemSynced = true;
              } else if (hasDbPrivateKey) {
                console.log(
                  `✅ Using private key from database for ${key.key_name || key.keyName}`
                );
                filesystemSynced = true;
              }
            } catch (readError) {
              console.warn(
                `⚠️ Could not read private key file:`,
                readError.message
              );
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
                console.log(
                  `✅ Read public key from filesystem: ${actualPublicPath}`
                );
              } else if (hasDbPublicKey) {
                console.log(
                  `✅ Using public key from database for ${key.key_name || key.keyName}`
                );
              }
            } catch (readError) {
              console.warn(
                `⚠️ Could not read public key file:`,
                readError.message
              );
              if (!filesystemError) filesystemError = readError.message;
            }

            enhancedSshKeys.push({
              ...key,
              private_key: privateKeyContent,
              public_key: publicKeyContent,
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
            console.warn(
              `⚠️ Error processing SSH key ${key.key_name}:`,
              keyError.message
            );
            // Include the key anyway, even if filesystem read failed
            enhancedSshKeys.push({
              ...key,
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

        console.log(
          `✅ Processed ${sshKeys.length} SSH keys, ${keysWithData.length} with complete data`
        );
      } else {
        console.log('ℹ️ No SSH keys found in database');
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
      console.log(`✅ Fetched ${customCommands.length} appliance commands`);
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
      console.log(
        `✅ Fetched ${serviceCommandLogs.length} service command log entries`
      );
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
      console.log(`✅ Fetched ${activeSessions.length} active sessions`);
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
          console.log(`✅ Encoded background image: ${bgImg.filename} (${fileBuffer.length} bytes -> ${base64Data.length} base64 chars)`);
        } else {
          // Include metadata without file data
          backgroundImagesWithData.push({
            ...bgImg,
            file_data: null,
            data_size: 0,
            file_missing: true,
          });
          missingImageCount++;
          console.warn(`⚠️ Background image file not found: ${filepath}`);
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
      console.log(`📸 Background images backup summary: ${encodedImageCount} encoded, ${missingImageCount} missing/failed`);
    }

    // Create comprehensive backup object
    const backupData = {
      version: '2.9.0',
      created_at: new Date().toISOString(),
      created_by: 'Web Appliance Dashboard API (Full Backup with All Tables)',
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
        backup_type: 'full_with_all_tables',
        database_version: '2.9.0',
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
          activeSessions.length,
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
    
    // Add encryption key to response (but not to the backup file)
    // We use a special format that includes timestamp
    const backupEncryptionKey = `enc_backup_${new Date().toISOString().split('T')[0]}_${encryptionKey.substring(0, 32)}`;
    
    const responseData = {
      ...backupData,
      encryption_key: backupEncryptionKey
    };

    // Log backup size information
    const backupSizeKB = Math.round(Buffer.byteLength(JSON.stringify(responseData), 'utf8') / 1024);
    console.log(`📦 Sending backup response: ${backupSizeKB} KB total`);
    console.log(`   - Background images with data: ${backgroundImagesWithData.filter(img => img.file_data).length}`);
    console.log(`   - Total background image data: ${Math.round(backgroundImagesWithData.reduce((sum, img) => sum + (img.data_size || 0), 0) / 1024)} KB`);

    // Set appropriate headers for large responses
    res.setHeader('Content-Type', 'application/json');
    
    // Send response - for very large backups, consider streaming
    if (backupSizeKB > 10240) { // If backup is larger than 10MB
      console.warn(`⚠️ Large backup detected (${backupSizeKB} KB). This may cause issues with some clients.`);
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
  try {
    const backupData = req.body;
    const decryptionKey = backupData.decryption_key || null;
    delete backupData.decryption_key; // Remove from backup data

    console.log('Starting enhanced restore process...');
    console.log('Backup version:', backupData.version);
    console.log('Backup created:', backupData.created_at);
    console.log('Decryption key provided:', !!decryptionKey);

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
      console.log(
        '⚠️ Detected older backup version. Using compatibility mode.'
      );
    }

    // Function to decrypt password if key is provided
    const decryptPassword = (encryptedPassword) => {
      if (!decryptionKey || !encryptedPassword) {
        return null;
      }
      
      try {
        const crypto = require('crypto');
        const algorithm = 'aes-256-cbc';
        
        // Create decipher using the provided key
        const key = crypto.createHash('sha256').update(String(decryptionKey)).digest();
        const iv = Buffer.alloc(16, 0); // Same IV as used in encryption
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encryptedPassword, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
      } catch (error) {
        console.error('Failed to decrypt password:', error.message);
        return null;
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
    } = backupData.data;

    // Use whichever is available (prefer new names)
    const actualSettings = user_settings || settings || [];
    const actualCommands = appliance_commands || custom_commands || [];
    const actualSessions = active_sessions || sessions || [];

    // For legacy backups without SSH keys, initialize SSH system BEFORE starting transaction
    let legacySSHInitialized = false;
    if (isOldVersion && (!ssh_keys || ssh_keys.length === 0)) {
      try {
        console.log(
          '🔑 Legacy backup detected - pre-initializing SSH system...'
        );

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
            console.log('✅ SSH system pre-initialized for legacy backup');
            legacySSHInitialized = true;
          }
        }
      } catch (sshPreInitError) {
        console.warn(
          '⚠️ SSH pre-initialization failed, will try alternative method:',
          sshPreInitError.message
        );
      }
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
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

      // Create ID mapping for appliances (old ID -> new ID)
      const applianceIdMapping = {};

      // IMPORTANT: Restore categories FIRST (before appliances) to respect foreign key constraints
      if (categories && categories.length > 0) {
        try {
          console.log(`Restoring ${categories.length} categories...`);
          // Delete ALL categories to ensure correct order restoration
          await connection.execute('DELETE FROM categories');

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
          console.log(`✅ Restored ${restoredCategories} categories`);
        } catch (error) {
          console.log('Error restoring categories:', error.message);
        }
      }

      // Before restoring appliances, ensure all required categories exist
      if (appliances && appliances.length > 0) {
        console.log('Checking for missing categories...');
        
        // Get all unique categories from appliances
        const uniqueCategories = [...new Set(appliances.map(app => app.category).filter(cat => cat))];
        console.log('Categories used in appliances:', uniqueCategories);
        
        // Get existing categories
        const [existingCats] = await connection.execute('SELECT name FROM categories');
        const existingCategoryNames = existingCats.map(cat => cat.name);
        console.log('Existing categories in database:', existingCategoryNames);
        
        // Find missing categories
        const missingCategories = uniqueCategories.filter(cat => !existingCategoryNames.includes(cat));
        console.log('Missing categories:', missingCategories);
        
        // Create missing categories
        if (missingCategories.length > 0) {
          console.log(`Creating ${missingCategories.length} missing categories...`);
          
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
              console.log(`Created missing category: ${categoryName}`);
              restoredCategories++;
            } catch (catError) {
              console.error(`Error creating category ${categoryName}:`, catError.message);
            }
          }
        }
      }

      // Restore appliances (AFTER ensuring categories exist)
      console.log('Clearing existing appliances...');
      await connection.execute('DELETE FROM appliances');
      await connection.execute('ALTER TABLE appliances AUTO_INCREMENT = 1');

      if (appliances && appliances.length > 0) {
        console.log(`Restoring ${appliances.length} appliances...`);
        
        // Process in batches to avoid overwhelming the database
        const BATCH_SIZE = 50;
        const totalBatches = Math.ceil(appliances.length / BATCH_SIZE);
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const start = batchIndex * BATCH_SIZE;
          const end = Math.min(start + BATCH_SIZE, appliances.length);
          const batch = appliances.slice(start, end);
          
          console.log(`Processing appliance batch ${batchIndex + 1}/${totalBatches} (${batch.length} items)`);

        // Debug: Log first appliance to see structure
        if (batchIndex === 0 && batch[0]) {
          console.log(
            'First appliance data structure:',
            JSON.stringify(batch[0], null, 2)
          );
        }

        for (const appliance of batch) {
          console.log(`Restoring appliance: ${appliance.name}`);
          
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
          dbAppliance.remote_password_encrypted = appliance.remotePasswordEncrypted || appliance.remote_password_encrypted || null;
          dbAppliance.remote_desktop_type = appliance.remoteDesktopType || appliance.remote_desktop_type || 'guacamole';
          
          // RustDesk settings
          dbAppliance.rustdesk_id = appliance.rustdeskId || appliance.rustdesk_id || null;
          dbAppliance.rustdesk_password_encrypted = appliance.rustdeskPasswordEncrypted || appliance.rustdesk_password_encrypted || null;
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
          
          console.log(`Service commands - start: ${dbAppliance.start_command}, stop: ${dbAppliance.stop_command}, status: ${dbAppliance.status_command}`);
          console.log(`SSH connection: ${dbAppliance.ssh_connection}`);
          console.log(`Remote desktop: ${dbAppliance.remote_desktop_enabled}, Favorites: ${dbAppliance.is_favorite}`);

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
      }

      // Restore settings
      if (actualSettings && actualSettings.length > 0) {
        try {
          console.log(`Restoring ${actualSettings.length} settings...`);
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
          console.log(`✅ Restored ${restoredSettings} settings`);
        } catch (error) {
          console.log('Error restoring settings:', error.message);
        }
      }

      // Restore background images
      if (background_images && background_images.length > 0) {
        try {
          console.log(
            `Restoring ${background_images.length} background images...`
          );

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
                console.warn(
                  `Could not delete existing background file: ${file}`
                );
              }
            }
          } catch (cleanupError) {
            console.warn(
              'Could not clean up existing background files:',
              cleanupError.message
            );
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
                console.log(
                  `✅ Restored background file: ${bgImage.filename} (${(fileBuffer.length / 1024).toFixed(1)} KB)`
                );
              } catch (fileError) {
                console.error(
                  `❌ Error restoring background file ${bgImage.filename}:`,
                  fileError.message
                );
                // Continue with database record even if file restoration fails
              }
            } else {
              console.warn(
                `⚠️ Skipping file restoration for ${bgImage.filename} (no data or error)`
              );
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
          console.log(`✅ Restored ${restoredBackgrounds} background images`);
        } catch (error) {
          console.log('Error restoring background images:', error.message);
        }
      }

      // Restore users FIRST - BEFORE hosts and other tables with foreign keys
      if (users && users.length > 0) {
        try {
          console.log(`Restoring ${users.length} users...`);
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
              console.log(
                `⚠️ User ${user.username} has no password hash in backup, using default password`
              );
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
            console.log(`✅ Restored user: ${user.username}`);
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

          console.log(
            `✅ Restored ${restoredUsers} users with password hashes`
          );
        } catch (error) {
          console.log('Error restoring users:', error.message);
        }
      }

      // Restore hosts table (SSH Terminal hosts) - AFTER users due to foreign keys
      if (hosts && hosts.length > 0) {
        try {
          console.log(`Restoring ${hosts.length} terminal hosts...`);
          console.log('First host data:', JSON.stringify(hosts[0], null, 2));
          
          await connection.execute('DELETE FROM hosts');
          await connection.execute('ALTER TABLE hosts AUTO_INCREMENT = 1');

          for (const host of hosts) {
            console.log(`Restoring host: ${host.name} (${host.hostname})`);

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
                  console.log(`Mapped createdBy from ${host.created_by || host.createdBy} to ${mappedCreatedBy} for host ${host.name}`);
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

            const hostData = {
              id: host.id,
              name: host.name,
              description: host.description || null,
              hostname: host.hostname,
              port: host.port || 22,
              username: host.username,
              icon: host.icon || 'Server',
              password: decryptPassword(host.password) || host.password || null,
              privateKey: host.private_key || host.privateKey || null,
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
              remotePassword: decryptPassword(host.remote_password || host.remotePassword) || host.remote_password || host.remotePassword || null,
              guacamolePerformanceMode: host.guacamolePerformanceMode || 'balanced',
              rustdeskId: host.rustdesk_id || host.rustdeskId || null,
              rustdeskPassword: decryptPassword(host.rustdeskPassword) || host.rustdeskPassword || null,
              isActive: host.is_active !== undefined ? host.is_active : (host.isActive !== false)
            };

            const { sql, values } = prepareInsert('hosts', hostData);
            await connection.execute(sql, values);
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

          console.log(`✅ Restored ${restoredHosts} terminal hosts`);
        } catch (error) {
          console.error('❌ Error restoring hosts:', error);
          console.error('Error details:', error.message);
          throw error; // Re-throw to rollback transaction
        }
      } else {
        console.log('ℹ️ No hosts found in backup to restore');
      }

      // Restore services table
      if (services && services.length > 0) {
        try {
          console.log(`Restoring ${services.length} proxy services...`);
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
              sshPassword: decryptPassword(service.ssh_password || service.sshPassword) || service.ssh_password || service.sshPassword || null,
              sshPrivateKey: service.ssh_private_key || service.sshPrivateKey || null,
              vncPort: service.vnc_port || service.vncPort || 5900,
              vncPassword: decryptPassword(service.vnc_password || service.vncPassword) || service.vnc_password || service.vncPassword || null,
              rdpPort: service.rdp_port || service.rdpPort || 3389,
              rdpUsername: service.rdp_username || service.rdpUsername || null,
              rdpPassword: decryptPassword(service.rdp_password || service.rdpPassword) || service.rdp_password || service.rdpPassword || null,
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

          console.log(`✅ Restored ${restoredServices} proxy services`);
        } catch (error) {
          console.log('Error restoring services:', error.message);
        }
      }

      // Users already restored above before hosts table

      // Restore SSH keys first (before hosts) - only if present in backup
      if (ssh_keys && ssh_keys.length > 0) {
        try {
          console.log(`Restoring ${ssh_keys.length} SSH keys...`);
          await connection.execute('DELETE FROM ssh_keys');

          // Ensure SSH directory exists
          const sshDir = '/root/.ssh';
          try {
            await fs.mkdir(sshDir, { recursive: true, mode: 0o700 });
            console.log('✅ SSH directory created/verified:', sshDir);
          } catch (dirError) {
            console.warn(
              'Warning: Could not create SSH directory:',
              dirError.message
            );
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

            console.log(`Restoring SSH key: ${sshKey.key_name || sshKey.keyName} (created_by: ${createdById})`);

            // Restore SSH key to database
            const sshKeyData = {
              keyName: sshKey.key_name || sshKey.keyName,
              privateKey: sshKey.private_key || sshKey.privateKey || '',
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
            if (sshKey.private_key && sshKey.key_name) {
              try {
                // Always use user-specific naming for consistency
                // This ensures SSH keys work after restore
                let keyFileName = `id_rsa_user${createdById}_${sshKey.key_name || sshKey.keyName}`;
                
                const privateKeyPath = path.join(sshDir, keyFileName);
                const publicKeyPath = path.join(sshDir, `${keyFileName}.pub`);

                // Write private key
                await fs.writeFile(privateKeyPath, sshKey.private_key, {
                  mode: 0o600,
                });
                console.log(`✅ Restored private key file: ${privateKeyPath}`);

                // Write public key (if available)
                if (sshKey.public_key) {
                  await fs.writeFile(publicKeyPath, sshKey.public_key, {
                    mode: 0o644,
                  });
                  console.log(`✅ Restored public key file: ${publicKeyPath}`);
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
                  console.warn(
                    'Warning: Could not set key ownership:',
                    chownError.message
                  );
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
            console.log('✅ Created SSH config file:', sshConfigPath);
          } catch (configError) {
            console.warn(
              'Warning: Could not create SSH config file:',
              configError.message
            );
          }

          console.log(
            `✅ Restored ${restoredSSHKeys} SSH keys (database + filesystem)`
          );
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
                console.log(`🗑️ Removed old SSH key file: ${filePath}`);
              }
            }
          } catch (cleanupError) {
            console.warn(
              'Warning: Could not clean up SSH key files:',
              cleanupError.message
            );
          }

          console.log('✅ Cleared SSH keys (none in backup)');
        } catch (error) {
          console.log('Note: Could not clear SSH keys table:', error.message);
        }
      } else {
        // Legacy backup without SSH keys - SSH was pre-initialized
        if (legacySSHInitialized) {
          console.log('✅ Using pre-initialized SSH system for legacy backup');
          // Count the SSH keys that were created during pre-initialization
          try {
            const [keyCount] = await connection.execute(
              'SELECT COUNT(*) as count FROM ssh_keys'
            );
            restoredSSHKeys = keyCount[0].count;
          } catch (countError) {
            console.warn(
              'Could not count pre-initialized SSH keys:',
              countError.message
            );
            restoredSSHKeys = 1; // Assume at least one key was created
          }
        } else {
          console.log(
            '⚠️ Legacy backup detected but SSH pre-initialization failed'
          );
        }
      }

      // SSH hosts restore removed - functionality moved to hosts table
      // Legacy backup compatibility: skip ssh_hosts if present

      // SSH config restore removed - table no longer exists

      // Restore SSH upload logs
      if (ssh_upload_logs && ssh_upload_logs.length > 0) {
        try {
          console.log(`Restoring ${ssh_upload_logs.length} SSH upload log entries...`);
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
          console.log(`✅ Restored ${restoredSSHUploadLogs} SSH upload log entries`);
        } catch (error) {
          console.log('Error restoring SSH upload logs:', error.message);
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
        console.log(`Restoring ${actualCommands.length} appliance commands...`);
        console.log(
          'Commands to restore:',
          JSON.stringify(actualCommands, null, 2)
        );

        // First, let's check which appliances exist
        const [existingAppliances] = await connection.execute(
          'SELECT id, name FROM appliances ORDER BY id'
        );
        console.log('Existing appliances after restore:', existingAppliances.map(a => `${a.id}: ${a.name}`).join(', '));

        for (const command of actualCommands) {
          try {
            // Handle both camelCase and snake_case field names from backup
            const applianceId = command.appliance_id || command.applianceId;
            const hostId = command.host_id || command.hostId || command.ssh_host_id || null;
            
            console.log(
              `Restoring command for appliance ${applianceId}: ${command.description}`
            );

            // Check if the appliance exists
            const [appliances] = await connection.execute(
              'SELECT id, name FROM appliances WHERE id = ?',
              [applianceId]
            );

            if (appliances.length > 0) {
              console.log(`✅ Found appliance: ${appliances[0].name} (ID: ${appliances[0].id})`);
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
                      console.log(
                        `Mapped host ID ${hostId} to new ID ${newHostId}`
                      );
                    } else {
                      console.warn(
                        `Could not find matching host for ${originalHost.username}@${originalHost.hostname || originalHost.host}:${originalHost.port || 22}`
                      );
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
                      console.log(
                        `Mapped legacy SSH host ID ${hostId} to new host ID ${newHostId}`
                      );
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
              console.log(
                `✅ Successfully restored command "${command.description}" for appliance ${applianceId}`
              );
            } else {
              console.warn(
                `⚠️ Skipping command "${command.description}" - appliance ${applianceId} not found in database!`
              );
              
              // Let's check if there's an appliance with a similar name in the backup
              const backupAppliances = backupData.data.appliances;
              if (backupAppliances && Array.isArray(backupAppliances)) {
                const originalAppliance = backupAppliances.find(a => (a.id === applianceId));
                if (originalAppliance) {
                  console.log(`   Original appliance in backup: "${originalAppliance.name}"`);
                  
                  // Try to find by name instead
                  const [appByName] = await connection.execute(
                    'SELECT id, name FROM appliances WHERE name = ?',
                    [originalAppliance.name]
                  );
                  if (appByName.length > 0) {
                    console.log(`   ℹ️ Found appliance by name: ${appByName[0].name} with new ID ${appByName[0].id}`);
                    console.log(`   Retrying command restore with new ID...`);
                    
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
                    console.log(
                      `✅ Successfully restored command "${command.description}" for appliance ${originalAppliance.name} (new ID: ${newApplianceId})`
                    );
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
        console.log(`✅ Restored ${restoredCustomCommands} custom commands`);

        // Set AUTO_INCREMENT for custom commands
        const [maxCmdIdResult] = await connection.execute(
          'SELECT MAX(id) as maxId FROM appliance_commands'
        );
        const maxCmdId = maxCmdIdResult[0].maxId || 0;
        await connection.execute(
          `ALTER TABLE appliance_commands AUTO_INCREMENT = ${maxCmdId + 1}`
        );
      } else {
        console.log('ℹ️ No custom commands to restore');
      }

      // Restore audit logs
      if (audit_logs && audit_logs.length > 0) {
        try {
          console.log(`Restoring ${audit_logs.length} audit log entries...`);
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
          console.log(`✅ Restored ${restoredAuditLogs} audit log entries`);
        } catch (error) {
          console.log('Error restoring audit logs:', error.message);
        }
      }

      // Restore role permissions
      if (role_permissions && role_permissions.length > 0) {
        try {
          console.log(
            `Restoring ${role_permissions.length} role permissions...`
          );
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
          console.log(
            `✅ Restored ${restoredRolePermissions} role permissions`
          );
        } catch (error) {
          console.log('Error restoring role permissions:', error.message);
        }
      }

      // Restore user appliance permissions
      if (user_appliance_permissions && user_appliance_permissions.length > 0) {
        try {
          console.log(
            `Restoring ${user_appliance_permissions.length} user appliance permissions...`
          );
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
          console.log(
            `✅ Restored ${restoredUserAppliancePermissions} user appliance permissions`
          );
        } catch (error) {
          console.log(
            'Error restoring user appliance permissions:',
            error.message
          );
        }
      }

      // Restore service command logs
      if (service_command_logs && service_command_logs.length > 0) {
        try {
          console.log(
            `Restoring ${service_command_logs.length} service command log entries...`
          );
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
          console.log(
            `✅ Restored ${restoredServiceCommandLogs} service command log entries`
          );
        } catch (error) {
          console.log('Error restoring service command logs:', error.message);
        }
      }

      // Restore sessions (Note: Only restore active sessions if needed)
      if (actualSessions && actualSessions.length > 0) {
        try {
          console.log(`Found ${actualSessions.length} sessions in backup...`);
          // We don't restore sessions by default as they are temporary
          // and should be recreated on login
          console.log('ℹ️ Sessions are not restored (temporary data)');
        } catch (error) {
          console.log('Note: Sessions restoration skipped:', error.message);
        }
      }

      // Commit transaction
      await connection.commit();

      console.log(`Enhanced restore completed:`);
      console.log(`- ${restoredAppliances} appliances`);
      console.log(`- ${restoredCategories} categories`);
      console.log(`- ${restoredSettings} settings`);
      console.log(`- ${restoredBackgrounds} background images`);
      console.log(`- ${restoredHosts} terminal hosts`);
      console.log(`- ${restoredServices} proxy services`);
      console.log(`- ${restoredSSHKeys} SSH keys`);
      console.log(`- ${restoredSSHHosts} SSH hosts`);
      console.log(`- ${restoredSSHConfig} SSH config entries`);
      console.log(`- ${restoredSSHUploadLogs} SSH upload logs`);
      console.log(`- ${restoredCustomCommands} custom commands`);
      console.log(`- ${restoredUsers} users (with password hashes)`);
      console.log(`- ${restoredAuditLogs} audit log entries`);
      console.log(`- ${restoredRolePermissions} role permissions`);
      console.log(
        `- ${restoredUserAppliancePermissions} user appliance permissions`
      );
      console.log(
        `- ${restoredServiceCommandLogs} service command log entries`
      );
      console.log(`- ${restoredSessions} sessions (skipped - temporary data)`);

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
        console.log('🔧 Regenerating SSH configuration...');
        
        // Use setTimeout to prevent hanging
        const sshRegenerationTimeout = setTimeout(() => {
          console.error('⚠️ SSH regeneration timed out after 30 seconds');
        }, 30000);
        
        try {
          const { SSHManager } = require('../utils/sshManager');
          const sshManager = new SSHManager({});

          // First sync keys to filesystem
          console.log('  📁 Syncing SSH keys to filesystem...');
          const syncPromise = sshManager.syncKeysToFilesystem();
          const syncedKeys = await Promise.race([
            syncPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
          ]);
          console.log(`  ✅ Synced ${syncedKeys} SSH keys`);
          
          // Also restore user-specific SSH keys
          console.log('  🔑 Restoring user-specific SSH keys...');
          try {
            const { restoreSSHKeys } = require('../scripts/restore-ssh-keys');
            await restoreSSHKeys();
            console.log('  ✅ User SSH keys restored');
          } catch (keyRestoreError) {
            console.error('  ⚠️ Failed to restore user SSH keys:', keyRestoreError.message);
          }

          // Then regenerate SSH config
          console.log('  📝 Regenerating SSH config...');
          const configPromise = sshManager.regenerateSSHConfig();
          await Promise.race([
            configPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
          ]);
          console.log('  ✅ SSH config regenerated');

          // Fix permissions - quick operation, no timeout needed
          console.log('  🔒 Fixing SSH permissions...');
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
          console.log('  ✅ SSH permissions fixed');
          
          clearTimeout(sshRegenerationTimeout);
        } catch (sshError) {
          clearTimeout(sshRegenerationTimeout);
          console.error('⚠️ SSH regeneration error:', sshError.message);
          // Don't fail the restore if SSH regeneration fails
        }
      }

      // ALWAYS regenerate SSH keys for all users after restore (regardless of SSH restore)
      console.log('🔑 Regenerating SSH keys for all users after restore...');
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
                
                keysGenerated++;
                console.log(`  ✓ Generated and stored SSH key for user ${user.username} (ID: ${user.id})`);
              } else {
                // Key exists in filesystem, but might not be in database - check and add if missing
                console.log(`  ℹ️ SSH key file exists for user ${user.username} (ID: ${user.id}), checking database...`);
                
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
                  
                  console.log(`  ✅ Added existing SSH key to database for user ${user.username} (ID: ${user.id})`);
                } else {
                  console.log(`  ✓ SSH key already in database for user ${user.username} (ID: ${user.id})`);
                }
              }
            } catch (error) {
              keysFailed++;
              console.log(`  ⚠️ Failed to generate SSH key for user ${user.username}: ${error.message}`);
            }
          }
          
          if (keysGenerated > 0) {
            console.log(`✅ Generated ${keysGenerated} SSH keys`);
          }
          if (keysFailed > 0) {
            console.log(`⚠️ Failed to generate ${keysFailed} SSH keys`);
          }
        }
      } catch (error) {
        console.error('❌ Error regenerating user SSH keys:', error.message);
      }

      // Run post-restore hook with timeout - DISABLED to prevent hanging
      console.log('🔧 Post-restore hook disabled to prevent hanging issues');
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
            console.log('✅ Post-restore hook completed');
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
          console.warn('⚠️ Post-restore hook not found at:', hookPath);
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
          },
          backup_version: backupData.version,
          backup_created_at: backupData.created_at,
          restored_by: req.user?.username || 'unknown',
        },
        ipAddress
      );

      res.json({
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
        backup_version: backupData.version,
        backup_date: backupData.created_at,
        compatibility_mode: isOldVersion,
        ssh_auto_initialized: sshAutoInitialized,
        ssh_ready: restoredSSHKeys > 0,
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
