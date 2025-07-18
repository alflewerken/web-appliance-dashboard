// Backup and Restore API routes
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const pool = require('../utils/database');
const { createAuditLog } = require('../utils/auth');
const { broadcast } = require('./sse');

// Get backup statistics
router.get('/backup/stats', async (req, res) => {
  try {
    // Get last backup from audit logs
    const [lastBackupLogs] = await pool.execute(
      `SELECT * FROM audit_logs 
       WHERE action = 'backup_create' 
       ORDER BY created_at DESC 
       LIMIT 1`
    );

    // Get total backups count from audit logs
    const [backupCount] = await pool.execute(
      `SELECT COUNT(*) as count FROM audit_logs 
       WHERE action = 'backup_create'`
    );

    // Calculate approximate backup size based on current data
    const [applianceCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM appliances'
    );
    const [categoryCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM categories'
    );
    const [settingsCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM user_settings'
    );
    const [bgImageCount] = await pool.execute(
      'SELECT COUNT(*) as count, SUM(file_size) as total_size FROM background_images'
    );
    const [sshHostCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM ssh_hosts'
    );
    const [sshKeyCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM ssh_keys'
    );

    // Estimate backup size more accurately
    const estimatedSize =
      applianceCount[0].count * 1024 + // ~1KB per appliance
      categoryCount[0].count * 512 + // ~0.5KB per category
      settingsCount[0].count * 256 + // ~0.25KB per setting
      sshHostCount[0].count * 512 + // ~0.5KB per SSH host
      sshKeyCount[0].count * 4096 + // ~4KB per SSH key (includes key data)
      (bgImageCount[0].total_size || 0); // actual size of images

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
      totalBackups: parseInt(backupCount[0].count),
      lastBackupSize,
      lastBackupDate: lastBackupLogs[0]?.created_at || null,
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
router.get('/backup', async (req, res) => {
  try {
    // Fetch all appliances
    const [appliances] = await pool.execute(
      'SELECT * FROM appliances ORDER BY created_at'
    );

    // Fetch all categories
    let categories = [];
    try {
      const [categoriesResult] = await pool.execute(
        'SELECT * FROM categories ORDER BY `order_index` ASC'
      );
      categories = categoriesResult;
    } catch (error) {
      console.error('Error fetching categories for backup:', error.message);
    }

    // Fetch all user settings
    let settings = [];
    try {
      const [settingsResult] = await pool.execute(
        'SELECT * FROM user_settings ORDER BY setting_key'
      );
      settings = settingsResult;
    } catch (error) {
      console.error('Error fetching settings for backup:', error.message);
    }

    // Fetch background images metadata
    let backgroundImages = [];
    try {
      const [backgroundResult] = await pool.execute(
        'SELECT * FROM background_images ORDER BY created_at DESC'
      );
      backgroundImages = backgroundResult;
    } catch (error) {
      console.error(
        'Error fetching background images for backup:',
        error.message
      );
    }

    // Fetch role permissions
    let rolePermissions = [];
    try {
      const [rolePermissionsResult] = await pool.execute(
        'SELECT * FROM role_permissions ORDER BY role, permission'
      );
      rolePermissions = rolePermissionsResult;
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
      const [userAppliancePermissionsResult] = await pool.execute(
        'SELECT * FROM user_appliance_permissions ORDER BY user_id, appliance_id'
      );
      userAppliancePermissions = userAppliancePermissionsResult;
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

    // Fetch users (INCLUDING password hashes for complete backup)
    let users = [];
    try {
      const [usersResult] = await pool.execute(
        'SELECT * FROM users ORDER BY created_at'
      );
      users = usersResult;
      console.log(
        `✅ Fetched ${users.length} users (including password hashes)`
      );
    } catch (error) {
      console.error('Error fetching users for backup:', error.message);
    }

    // Fetch audit logs (last 1000 entries)
    let auditLogs = [];
    try {
      const [auditLogsResult] = await pool.execute(
        'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 1000'
      );
      // Reverse to have oldest first for correct restore order
      auditLogs = auditLogsResult.reverse();
      console.log(`✅ Fetched ${auditLogs.length} audit log entries`);
    } catch (error) {
      console.error('Error fetching audit logs for backup:', error.message);
    }

    try {
      console.log('🔍 Fetching SSH data from database...');
      const [hostsResult] = await pool.execute(
        'SELECT * FROM ssh_hosts ORDER BY hostname'
      );
      const [keysResult] = await pool.execute(
        'SELECT * FROM ssh_keys ORDER BY key_name'
      );
      const [configResult] = await pool.execute(
        'SELECT * FROM ssh_config ORDER BY host_id, config_key'
      );
      sshHosts = hostsResult;
      sshConfig = configResult;

      console.log(`📊 Found ${keysResult.length} SSH keys in database`);
      console.log(`📊 Found ${sshConfig.length} SSH config entries in database`);

      if (keysResult.length > 0) {
        // Enhance SSH keys with actual file content from filesystem
        const enhancedSshKeys = [];
        const sshDir = '/root/.ssh';

        for (const key of keysResult) {
          try {
            const privateKeyPath = path.join(sshDir, `id_rsa_${key.key_name}`);
            const publicKeyPath = path.join(
              sshDir,
              `id_rsa_${key.key_name}.pub`
            );

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
              const privateExists = await fs
                .access(privateKeyPath)
                .then(() => true)
                .catch(() => false);
              if (privateExists && !hasDbPrivateKey) {
                privateKeyContent = await fs.readFile(privateKeyPath, 'utf8');
                console.log(
                  `✅ Read private key from filesystem: ${privateKeyPath}`
                );
                filesystemSynced = true;
              } else if (hasDbPrivateKey) {
                console.log(
                  `✅ Using private key from database for ${key.key_name}`
                );
                filesystemSynced = true;
              }
            } catch (readError) {
              console.warn(
                `⚠️ Could not read private key file ${privateKeyPath}:`,
                readError.message
              );
              filesystemError = readError.message;
            }

            try {
              const publicExists = await fs
                .access(publicKeyPath)
                .then(() => true)
                .catch(() => false);
              if (publicExists && !hasDbPublicKey) {
                publicKeyContent = await fs.readFile(publicKeyPath, 'utf8');
                console.log(
                  `✅ Read public key from filesystem: ${publicKeyPath}`
                );
              } else if (hasDbPublicKey) {
                console.log(
                  `✅ Using public key from database for ${key.key_name}`
                );
              }
            } catch (readError) {
              console.warn(
                `⚠️ Could not read public key file ${publicKeyPath}:`,
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
      const [commandsResult] = await pool.execute(
        'SELECT * FROM appliance_commands ORDER BY appliance_id, created_at'
      );
      customCommands = commandsResult;
      console.log(`✅ Fetched ${customCommands.length} custom commands`);
    } catch (error) {
      console.error(
        'Error fetching custom commands for backup:',
        error.message
      );
    }

    // Fetch service command logs (last 5000 entries)
    let serviceCommandLogs = [];
    try {
      const [logsResult] = await pool.execute(
        'SELECT * FROM service_command_logs ORDER BY executed_at DESC LIMIT 5000'
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
      const [sessionsResult] = await pool.execute(
        'SELECT * FROM sessions WHERE is_active = 1 ORDER BY created_at DESC'
      );
      activeSessions = sessionsResult;
      console.log(`✅ Fetched ${activeSessions.length} active sessions`);
    } catch (error) {
      console.error('Error fetching sessions for backup:', error.message);
    }

    // For each background image, read the actual file and encode it as base64
    const backgroundImagesWithData = [];
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
        } else {
          // Include metadata without file data
          backgroundImagesWithData.push({
            ...bgImg,
            file_data: null,
            data_size: 0,
            file_missing: true,
          });
        }
      } catch (error) {
        console.error(
          `Error reading background image ${bgImg.filename}:`,
          error.message
        );
        // Include metadata without file data
        backgroundImagesWithData.push({
          ...bgImg,
          file_data: null,
          data_size: 0,
          file_error: error.message,
        });
      }
    }

    // Create comprehensive backup object
    const backupData = {
      version: '2.8.0',
      created_at: new Date().toISOString(),
      created_by: 'Web Appliance Dashboard API (Full Backup with Passwords)',
      data: {
        appliances,
        categories,
        settings,
        background_images: backgroundImagesWithData,
        ssh_hosts: sshHosts,
        ssh_keys: sshKeys,
        ssh_config: sshConfig,
        custom_commands: customCommands,
        users,
        audit_logs: auditLogs,
        role_permissions: rolePermissions,
        user_appliance_permissions: userAppliancePermissions,
        service_command_logs: serviceCommandLogs,
        sessions: activeSessions,
      },
      metadata: {
        appliances_count: appliances.length,
        categories_count: categories.length,
        settings_count: settings.length,
        background_images_count: backgroundImagesWithData.length,
        ssh_hosts_count: sshHosts.length,
        ssh_keys_count: sshKeys.length,
        ssh_config_count: sshConfig.length,
        custom_commands_count: customCommands.length,
        users_count: users.length,
        audit_logs_count: auditLogs.length,
        role_permissions_count: rolePermissions.length,
        user_appliance_permissions_count: userAppliancePermissions.length,
        service_command_logs_count: serviceCommandLogs.length,
        sessions_count: activeSessions.length,
        backup_type: 'full_with_passwords_and_all_data',
        database_version: '2.8.0',
        includes_background_files: backgroundImagesWithData.some(
          bg => bg.file_data !== null
        ),
        includes_ssh_keys: sshKeys.length > 0 && sshBackupSuccess,
        includes_ssh_config: sshConfig.length > 0,
        includes_users: users.length > 0,
        includes_audit_logs: auditLogs.length > 0,
        includes_role_permissions: rolePermissions.length > 0,
        includes_user_appliance_permissions:
          userAppliancePermissions.length > 0,
        includes_service_command_logs: serviceCommandLogs.length > 0,
        includes_sessions: activeSessions.length > 0,
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
          sshHosts.length +
          sshKeys.length +
          sshConfig.length +
          customCommands.length +
          users.length +
          auditLogs.length +
          rolePermissions.length +
          userAppliancePermissions.length +
          serviceCommandLogs.length +
          activeSessions.length,
        appliances_count: appliances.length,
        categories_count: categories.length,
        settings_count: settings.length,
        background_images_count: backgroundImagesWithData.length,
        ssh_hosts_count: sshHosts.length,
        ssh_keys_count: sshKeys.length,
        ssh_config_count: sshConfig.length,
        custom_commands_count: customCommands.length,
        users_count: users.length,
        audit_logs_count: auditLogs.length,
        role_permissions_count: rolePermissions.length,
        user_appliance_permissions_count: userAppliancePermissions.length,
        service_command_logs_count: serviceCommandLogs.length,
        sessions_count: activeSessions.length,
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

    res.json(backupData);
  } catch (error) {
    console.error('Error creating enhanced backup:', error);
    res
      .status(500)
      .json({ error: 'Failed to create backup: ' + error.message });
  }
});

// Restore endpoint - Import data from backup INCLUDING settings and background images
router.post('/restore', async (req, res) => {
  try {
    const backupData = req.body;

    console.log('Starting enhanced restore process...');
    console.log('Backup version:', backupData.version);
    console.log('Backup created:', backupData.created_at);

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

    const {
      appliances,
      categories,
      settings,
      background_images,
      ssh_hosts,
      ssh_keys,
      ssh_config,
      custom_commands,
      users,
      audit_logs,
      role_permissions,
      user_appliance_permissions,
      service_command_logs,
      sessions,
    } = backupData.data;

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
      let restoredSSHHosts = 0;
      let restoredSSHKeys = 0;
      let restoredSSHConfig = 0;
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
            const createdAt = category.created_at
              ? new Date(category.created_at)
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ')
              : new Date().toISOString().slice(0, 19).replace('T', ' ');

            await connection.execute(
              `INSERT INTO categories 
               (name, icon, color, description, is_system, created_at, order_index) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                category.name,
                category.icon || 'folder',
                category.color || '#007AFF',
                category.description || null,
                Boolean(category.is_system),
                createdAt,
                category.order_index !== undefined ? category.order_index : 
                  (category.order !== undefined ? category.order : 0),
              ]
            );
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

        // Debug: Log first appliance to see structure
        if (appliances[0]) {
          console.log(
            'First appliance data structure:',
            JSON.stringify(appliances[0], null, 2)
          );
        }

        for (const appliance of appliances) {
          const createdAt = appliance.created_at
            ? new Date(appliance.created_at)
                .toISOString()
                .slice(0, 19)
                .replace('T', ' ')
            : new Date().toISOString().slice(0, 19).replace('T', ' ');

          const updatedAt = appliance.updated_at
            ? new Date(appliance.updated_at)
                .toISOString()
                .slice(0, 19)
                .replace('T', ' ')
            : createdAt;

          const lastUsed = appliance.lastUsed
            ? new Date(appliance.lastUsed)
                .toISOString()
                .slice(0, 19)
                .replace('T', ' ')
            : createdAt;

          // FIXED: Include ALL fields, not just those with hasOwnProperty
          // This ensures service commands, SSH connection etc. are always restored
          const fields = [
            'id',
            'name',
            'url',
            'description',
            'icon',
            'color',
            'category',
            'isFavorite',
            'lastUsed',
            'created_at',
            'updated_at',
            'start_command',
            'stop_command',
            'status_command',
            'auto_start',
            'service_status',
            'last_status_check',
            'ssh_connection',
            'transparency',
            'blur_amount',
            'open_mode_mini',
            'open_mode_mobile',
            'open_mode_desktop',
          ];

          const values = [
            appliance.id,
            appliance.name,
            appliance.url,
            appliance.description || null,
            appliance.icon || 'Server',
            appliance.color || '#007AFF',
            appliance.category || 'productivity',
            Boolean(appliance.isFavorite),
            lastUsed,
            createdAt,
            updatedAt,
            // Service control values - check both snake_case and camelCase
            appliance.start_command || appliance.startCommand || null,
            appliance.stop_command || appliance.stopCommand || null,
            appliance.status_command || appliance.statusCommand || null,
            Boolean(
              appliance.auto_start !== undefined
                ? appliance.auto_start
                : appliance.autoStart
            ),
            appliance.service_status || appliance.serviceStatus || 'unknown',
            appliance.last_status_check || appliance.lastStatusCheck
              ? new Date(
                  appliance.last_status_check || appliance.lastStatusCheck
                )
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ')
              : null,
            appliance.ssh_connection || appliance.sshConnection || null,
            appliance.transparency !== undefined ? appliance.transparency : 0.7,
            appliance.blur_amount !== undefined
              ? appliance.blur_amount
              : appliance.blur !== undefined
                ? appliance.blur
                : 8,
            appliance.open_mode_mini || appliance.openModeMini || 'browser_tab',
            appliance.open_mode_mobile ||
              appliance.openModeMobile ||
              'browser_tab',
            appliance.open_mode_desktop ||
              appliance.openModeDesktop ||
              'browser_tab',
          ];

          const placeholders = fields.map(() => '?').join(', ');
          const fieldsList = fields.join(', ');

          // Debug: Log the SQL query and important fields
          console.log(`Restoring appliance: ${appliance.name}`);
          console.log(
            `Service commands - start: ${appliance.start_command}, stop: ${appliance.stop_command}, status: ${appliance.status_command}`
          );
          console.log(`SSH connection: ${appliance.ssh_connection}`);

          await connection.execute(
            `INSERT INTO appliances (${fieldsList}) VALUES (${placeholders})`,
            values
          );
          restoredAppliances++;
        }

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
      if (settings && settings.length > 0) {
        try {
          console.log(`Restoring ${settings.length} settings...`);
          await connection.execute('DELETE FROM user_settings');

          for (const setting of settings) {
            const createdAt = setting.created_at
              ? new Date(setting.created_at)
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ')
              : new Date().toISOString().slice(0, 19).replace('T', ' ');

            const updatedAt = setting.updated_at
              ? new Date(setting.updated_at)
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ')
              : createdAt;

            await connection.execute(
              `INSERT INTO user_settings 
               (setting_key, setting_value, description, created_at, updated_at) 
               VALUES (?, ?, ?, ?, ?)`,
              [
                setting.setting_key,
                setting.setting_value || '',
                setting.description || null,
                createdAt,
                updatedAt,
              ]
            );
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

            await connection.execute(
              `INSERT INTO background_images 
               (filename, original_name, mime_type, file_size, width, height, is_active, created_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                bgImage.filename,
                bgImage.original_name || bgImage.filename,
                bgImage.mime_type || 'image/jpeg',
                bgImage.file_size || 0,
                bgImage.width || 1920,
                bgImage.height || 1080,
                Boolean(bgImage.is_active),
                createdAt,
              ]
            );
            restoredBackgrounds++;
          }
          console.log(`✅ Restored ${restoredBackgrounds} background images`);
        } catch (error) {
          console.log('Error restoring background images:', error.message);
        }
      }

      // Restore users - INCLUDING password hashes from backup
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

            // Restore SSH key to database
            await connection.execute(
              `INSERT INTO ssh_keys 
               (key_name, private_key, public_key, key_type, key_size, comment, passphrase_hash, is_default, created_at, updated_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                sshKey.key_name,
                sshKey.private_key || '',
                sshKey.public_key || '',
                sshKey.key_type || 'rsa',
                sshKey.key_size || 2048,
                sshKey.comment || '',
                sshKey.passphrase_hash || null,
                Boolean(sshKey.is_default),
                createdAt,
                updatedAt,
              ]
            );

            // Restore SSH key files to filesystem
            if (sshKey.private_key && sshKey.key_name) {
              try {
                const privateKeyPath = path.join(
                  sshDir,
                  `id_rsa_${sshKey.key_name}`
                );
                const publicKeyPath = path.join(
                  sshDir,
                  `id_rsa_${sshKey.key_name}.pub`
                );

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
          console.log('Error restoring SSH keys:', error.message);
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

      // Restore SSH hosts - only if present in backup
      if (ssh_hosts && ssh_hosts.length > 0) {
        try {
          console.log(`Restoring ${ssh_hosts.length} SSH hosts...`);
          await connection.execute('DELETE FROM ssh_hosts');

          for (const sshHost of ssh_hosts) {
            const createdAt = sshHost.created_at
              ? new Date(sshHost.created_at)
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ')
              : new Date().toISOString().slice(0, 19).replace('T', ' ');

            const updatedAt = sshHost.updated_at
              ? new Date(sshHost.updated_at)
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ')
              : createdAt;

            const lastTested = sshHost.last_tested
              ? new Date(sshHost.last_tested)
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ')
              : null;

            await connection.execute(
              `INSERT INTO ssh_hosts 
               (hostname, host, username, port, key_name, is_active, last_tested, test_status, created_at, updated_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                sshHost.hostname,
                sshHost.host,
                sshHost.username,
                sshHost.port || 22,
                sshHost.key_name || 'dashboard',
                Boolean(sshHost.is_active !== false), // Default to true if not specified
                lastTested,
                sshHost.test_status || 'unknown',
                createdAt,
                updatedAt,
              ]
            );
            restoredSSHHosts++;
          }
          console.log(`✅ Restored ${restoredSSHHosts} SSH hosts`);
        } catch (error) {
          console.log('Error restoring SSH hosts:', error.message);
        }
      } else if (!isOldVersion) {
        // Only clear SSH hosts for newer backups that should have SSH data
        try {
          await connection.execute('DELETE FROM ssh_hosts');
          console.log('✅ Cleared SSH hosts (none in backup)');
        } catch (error) {
          console.log('Note: Could not clear SSH hosts table:', error.message);
        }
      }

      // Restore SSH config - only if present in backup
      if (ssh_config && ssh_config.length > 0) {
        try {
          console.log(`Restoring ${ssh_config.length} SSH config entries...`);
          await connection.execute('DELETE FROM ssh_config');

          for (const config of ssh_config) {
            // Find the new host ID for this config entry
            let newHostId = config.host_id;
            
            // If SSH hosts were remapped (e.g., due to auto-increment changes), find the new ID
            if (ssh_hosts && ssh_hosts.length > 0) {
              const originalHost = ssh_hosts.find(h => h.id === config.host_id);
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

            const createdAt = config.created_at
              ? new Date(config.created_at)
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ')
              : new Date().toISOString().slice(0, 19).replace('T', ' ');

            const updatedAt = config.updated_at
              ? new Date(config.updated_at)
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ')
              : createdAt;

            await connection.execute(
              `INSERT INTO ssh_config 
               (host_id, config_key, config_value, created_at, updated_at) 
               VALUES (?, ?, ?, ?, ?)`,
              [
                newHostId,
                config.config_key,
                config.config_value,
                createdAt,
                updatedAt,
              ]
            );
            restoredSSHConfig++;
          }
          console.log(`✅ Restored ${restoredSSHConfig} SSH config entries`);
        } catch (error) {
          console.log('Error restoring SSH config:', error.message);
        }
      } else if (!isOldVersion) {
        // Only clear SSH config for newer backups that should have SSH data
        try {
          await connection.execute('DELETE FROM ssh_config');
          console.log('✅ Cleared SSH config (none in backup)');
        } catch (error) {
          console.log('Note: Could not clear SSH config table:', error.message);
        }
      }

      // Restore custom commands
      // Note: Commands were already deleted via CASCADE when appliances were deleted
      // But let's ensure the table is clean and AUTO_INCREMENT is reset
      await connection.execute('DELETE FROM appliance_commands');
      await connection.execute(
        'ALTER TABLE appliance_commands AUTO_INCREMENT = 1'
      );

      if (custom_commands && custom_commands.length > 0) {
        console.log(`Restoring ${custom_commands.length} custom commands...`);
        console.log(
          'Commands to restore:',
          JSON.stringify(custom_commands, null, 2)
        );

        for (const command of custom_commands) {
          try {
            console.log(
              `Restoring command for appliance ${command.appliance_id}: ${command.description}`
            );

            // Check if the appliance exists
            const [appliances] = await connection.execute(
              'SELECT id FROM appliances WHERE id = ?',
              [command.appliance_id]
            );

            if (appliances.length > 0) {
              const createdAt = command.created_at
                ? new Date(command.created_at)
                    .toISOString()
                    .slice(0, 19)
                    .replace('T', ' ')
                : new Date().toISOString().slice(0, 19).replace('T', ' ');

              const updatedAt = command.updated_at
                ? new Date(command.updated_at)
                    .toISOString()
                    .slice(0, 19)
                    .replace('T', ' ')
                : createdAt;

              // Handle SSH host ID - try to find the SSH host by connection string
              let newSshHostId = null;
              if (command.ssh_host_id) {
                // Find the original SSH host from the backup
                const originalHost = ssh_hosts?.find(
                  h => h.id === command.ssh_host_id
                );
                if (originalHost) {
                  // Try to find the matching SSH host in the database by connection string
                  const [matchingHosts] = await connection.execute(
                    'SELECT id FROM ssh_hosts WHERE host = ? AND username = ? AND port = ?',
                    [
                      originalHost.host,
                      originalHost.username,
                      originalHost.port,
                    ]
                  );
                  if (matchingHosts.length > 0) {
                    newSshHostId = matchingHosts[0].id;
                    console.log(
                      `Mapped SSH host ID ${command.ssh_host_id} to new ID ${newSshHostId}`
                    );
                  } else {
                    console.warn(
                      `Could not find matching SSH host for ${originalHost.username}@${originalHost.host}:${originalHost.port}`
                    );
                  }
                }
              }

              await connection.execute(
                'INSERT INTO appliance_commands (id, appliance_id, description, command, ssh_host_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                  command.id,
                  command.appliance_id,
                  command.description,
                  command.command,
                  newSshHostId,
                  createdAt,
                  updatedAt,
                ]
              );
              restoredCustomCommands++;
              console.log(
                `✅ Successfully restored command "${command.description}" for appliance ${command.appliance_id}`
              );
            } else {
              console.warn(
                `⚠️ Skipping command "${command.description}" - appliance ${command.appliance_id} not found`
              );
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
      if (sessions && sessions.length > 0) {
        try {
          console.log(`Found ${sessions.length} sessions in backup...`);
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
      console.log(`- ${restoredSSHKeys} SSH keys`);
      console.log(`- ${restoredSSHHosts} SSH hosts`);
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

      // Regenerate SSH config directly after restore
      if (restoredSSHKeys > 0 || restoredSSHHosts > 0) {
        console.log('🔧 Regenerating SSH configuration...');
        try {
          const { SSHManager } = require('../utils/sshManager');
          const sshManager = new SSHManager({});

          // First sync keys to filesystem
          console.log('  📁 Syncing SSH keys to filesystem...');
          const syncedKeys = await sshManager.syncKeysToFilesystem();
          console.log(`  ✅ Synced ${syncedKeys} SSH keys`);

          // Then regenerate SSH config
          console.log('  📝 Regenerating SSH config...');
          await sshManager.regenerateSSHConfig();
          console.log('  ✅ SSH config regenerated');

          // Fix permissions
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
        } catch (sshError) {
          console.error('⚠️ SSH regeneration error:', sshError.message);
          // Don't fail the restore if SSH regeneration fails
        }
      }

      // Run post-restore hook with timeout
      console.log('🔧 Running post-restore hook...');
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
            ssh_keys: restoredSSHKeys,
            ssh_hosts: restoredSSHHosts,
            ssh_config: restoredSSHConfig,
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
        restored_ssh_keys: restoredSSHKeys,
        restored_ssh_hosts: restoredSSHHosts,
        restored_ssh_config: restoredSSHConfig,
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
