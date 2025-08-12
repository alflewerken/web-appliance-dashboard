// Enhanced Backup/Restore API Routes
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const pool = require('../utils/database');
const { createAuditLog } = require('../utils/auditLogger');
const { broadcast } = require('./sse');
const BackupManager = require('../utils/backup/backupManager');
const RestoreManager = require('../utils/backup/restoreManager');

// Initialize managers
const backupManager = new BackupManager(pool);
const restoreManager = new RestoreManager(pool);

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, '../uploads/temp'),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  }
});

// Create a comprehensive backup
router.post('/backup-enhanced/create', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Create backup
    const result = await backupManager.createFullBackup(
      req.user?.id,
      req.user?.username || 'api'
    );

    // Create audit log
    const ipAddress = req.clientIp;
    await createAuditLog(
      req.user?.id || null,
      'backup_create_enhanced',
      'backup',
      result.backup_id,
      {
        filename: result.filename,
        size_mb: result.report.size_mb,
        duration_ms: result.report.duration_ms,
        statistics: result.report.statistics,
        created_by: req.user?.username || 'api'
      },
      ipAddress
    );

    // Broadcast event
    broadcast('backup_created', {
      timestamp: new Date().toISOString(),
      backup_id: result.backup_id,
      filename: result.filename,
      created_by: req.user?.username || 'api',
      size_mb: result.report.size_mb
    });

    res.json({
      success: true,
      backup_id: result.backup_id,
      filename: result.filename,
      report: result.report,
      download_url: `/api/backup-enhanced/download/${result.filename}`
    });
    
  } catch (error) {
    console.error('Error creating enhanced backup:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// List available backups
router.get('/backup-enhanced/list', async (req, res) => {
  try {
    const backups = await backupManager.listBackups();
    
    res.json({
      success: true,
      backups,
      total: backups.length
    });
    
  } catch (error) {
    console.error('Error listing backups:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Download a backup file
router.get('/backup-enhanced/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validate filename
    if (!filename.match(/^backup_[\d\-T]+_[a-f0-9]{32}\.json$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid backup filename'
      });
    }
    
    const filepath = path.join(__dirname, '../backups', filename);
    
    // Check if file exists
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'Backup file not found'
      });
    }
    
    // Set headers for download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file
    const stream = require('fs').createReadStream(filepath);
    stream.pipe(res);
    
  } catch (error) {
    console.error('Error downloading backup:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Validate a backup file
router.post('/backup-enhanced/validate', upload.single('backup'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No backup file provided'
      });
    }
    
    // Read and parse the backup file
    const content = await fs.readFile(req.file.path, 'utf8');
    const backupData = JSON.parse(content);
    
    // Validate the backup
    const validation = backupManager.validator.validateBackup(backupData);
    const report = backupManager.validator.generateReport(backupData);
    
    // Clean up temp file
    await fs.unlink(req.file.path);
    
    res.json({
      success: true,
      valid: validation.valid,
      validation,
      report
    });
    
  } catch (error) {
    console.error('Error validating backup:', error);
    
    // Clean up temp file if it exists
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Restore from backup (enhanced)
router.post('/backup-enhanced/restore', upload.single('backup'), async (req, res) => {
  try {
    let backupData;
    
    // Check if backup file was uploaded or if using existing backup
    if (req.file) {
      // Read uploaded file
      const content = await fs.readFile(req.file.path, 'utf8');
      backupData = JSON.parse(content);
      
      // Clean up temp file
      await fs.unlink(req.file.path);
    } else if (req.body.filename) {
      // Load existing backup
      backupData = await backupManager.loadBackup(req.body.filename);
    } else {
      return res.status(400).json({
        success: false,
        error: 'No backup file or filename provided'
      });
    }
    
    // Restore options
    const options = {
      force: req.body.force === true,
      backupCurrent: req.body.backupCurrent === true
    };
    
    // Perform restore
    const result = await restoreManager.restoreFromBackup(backupData, options);
    
    // Create audit log
    const ipAddress = req.clientIp;
    await createAuditLog(
      req.user?.id || null,
      'backup_restore_enhanced',
      'backup',
      backupData.id || null,
      {
        backup_version: backupData.version,
        backup_created: backupData.created_at,
        restore_results: result.results,
        duration_ms: result.duration_ms,
        restored_by: req.user?.username || 'api'
      },
      ipAddress
    );
    
    // Broadcast event
    broadcast('backup_restored', {
      timestamp: new Date().toISOString(),
      backup_id: backupData.id,
      restored_by: req.user?.username || 'api',
      results: result.results
    });
    
    res.json({
      success: true,
      message: 'Backup restored successfully',
      result
    });
    
  } catch (error) {
    console.error('Error restoring backup:', error);
    
    // Clean up temp file if it exists
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete old backups
router.post('/backup-enhanced/cleanup', async (req, res) => {
  try {
    const keepCount = req.body.keepCount || 10;
    
    const result = await backupManager.cleanupOldBackups(keepCount);
    
    // Create audit log
    const ipAddress = req.clientIp;
    await createAuditLog(
      req.user?.id || null,
      'backup_cleanup',
      'backup',
      null,
      {
        deleted: result.deleted,
        kept: result.kept,
        cleaned_by: req.user?.username || 'api'
      },
      ipAddress
    );
    
    res.json({
      success: true,
      message: `Deleted ${result.deleted} old backups, kept ${result.kept}`,
      result
    });
    
  } catch (error) {
    console.error('Error cleaning up backups:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get backup/restore status
router.get('/backup-enhanced/status', async (req, res) => {
  try {
    const backups = await backupManager.listBackups();
    
    // Get latest backup info
    const latestBackup = backups[0] || null;
    
    // Get system info
    const systemInfo = await backupManager.getSystemInfo();
    
    res.json({
      success: true,
      status: {
        total_backups: backups.length,
        latest_backup: latestBackup,
        system_info: systemInfo,
        backup_directory: path.join(__dirname, '../backups')
      }
    });
    
  } catch (error) {
    console.error('Error getting backup status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;