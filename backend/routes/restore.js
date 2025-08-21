const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../utils/auth');
const { createAuditLog } = require('../utils/auditLogger');
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');
const db = new QueryBuilder(pool);
const { logger } = require('../utils/logger');
const bcrypt = require('bcryptjs');
const sseManager = require('../utils/sseManager');
const { getClientIp } = require('../utils/getClientIp');

/**
 * Restore a deleted host from audit log
 */
router.post('/host/:auditLogId', verifyToken, async (req, res) => {
  try {
    // Get the audit log entry
    const auditLog = await db.select('audit_logs', 
      { 
        id: req.params.auditLogId,
        action: 'host_deleted'
      },
      { limit: 1 }
    );

    if (auditLog.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Audit log entry not found or is not a host deletion'
      });
    }

    const logEntry = auditLog[0];
    const details = JSON.parse(logEntry.details);

    // Check if user has permission to restore
    if (logEntry.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to restore this host'
      });
    }

    // Extract host data from audit log
    const hostData = {
      name: details.name,
      description: details.description,
      hostname: details.hostname,
      port: details.port,
      username: details.username,
      password: details.password, // Already encrypted
      private_key: details.private_key,
      sshKeyName: details.sshKeyName,
      icon: details.icon,
      color: details.color,
      transparency: details.transparency,
      blur: details.blur,
      remote_desktop_enabled: details.remote_desktop_enabled,
      remote_desktop_type: details.remote_desktop_type,
      remote_protocol: details.remote_protocol,
      remote_port: details.remote_port,
      remote_username: details.remote_username,
      remote_password: details.remote_password, // Already encrypted
      guacamolePerformanceMode: details.guacamolePerformanceMode,
      rustdeskId: details.rustdeskId,
      rustdeskPassword: details.rustdeskPassword, // Already encrypted
      created_by: req.user.id,
      updated_by: req.user.id
    };

    // Insert the host back into the database
    const result = await db.insert('hosts', {
      name: hostData.name,
      description: hostData.description,
      hostname: hostData.hostname,
      port: hostData.port,
      username: hostData.username,
      password: hostData.password,
      privateKey: hostData.private_key,
      sshKeyName: hostData.sshKeyName,
      icon: hostData.icon,
      color: hostData.color,
      transparency: hostData.transparency,
      blur: hostData.blur,
      remoteDesktopEnabled: hostData.remote_desktop_enabled ? 1 : 0,
      remoteDesktopType: hostData.remote_desktop_type,
      remoteProtocol: hostData.remote_protocol,
      remotePort: hostData.remote_port,
      remoteUsername: hostData.remote_username,
      remotePassword: hostData.remote_password,
      guacamolePerformanceMode: hostData.guacamolePerformanceMode,
      rustdeskId: hostData.rustdeskId,
      rustdeskPassword: hostData.rustdeskPassword,
      createdBy: hostData.created_by,
      updatedBy: hostData.updated_by
    });

    // Create audit log for restoration
    await createAuditLog(
      req.user.id,
      'host_restored',
      'host',
      result.insertId,
      {
        name: hostData.name,
        original_audit_log_id: req.params.auditLogId,
        restored_from_deletion_by: details.deleted_by,
        restored_by: req.user.username
      },
      getClientIp(req),
      hostData.name
    );

    // Create Guacamole connection if remote desktop is enabled
    if (hostData.remote_desktop_enabled) {
      const guacamoleService = require('../services/guacamoleService');
      guacamoleService.updateHostConnection(result.insertId).catch(err => {
        logger.error('Failed to create Guacamole connection during restore:', err);
      });
    }

    // Send SSE event
    sseManager.broadcast({
      type: 'host_restored',
      data: {
        id: result.insertId,
        name: hostData.name
      }
    });

    logger.info(`Host restored: ${hostData.name} by user ${req.user.username}`);

    res.json({
      success: true,
      message: 'Host successfully restored',
      hostId: result.insertId
    });

  } catch (error) {
    logger.error('Error restoring host:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore host'
    });
  }
});

/**
 * Revert host changes from audit log
 */
router.post('/host/:hostId/revert/:auditLogId', verifyToken, async (req, res) => {
  try {
    const { hostId, auditLogId } = req.params;

    // Get the audit log entry
    const auditLog = await db.select('audit_logs', 
      { 
        id: auditLogId,
        action: 'host_updated',
        resourceId: hostId
      },
      { limit: 1 }
    );

    if (auditLog.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Audit log entry not found or does not match the host'
      });
    }

    const logEntry = auditLog[0];
    const details = JSON.parse(logEntry.details);

    // Check if user has permission
    const currentHost = await db.select('hosts', 
      { 
        id: hostId,
        createdBy: req.user.id
      },
      { limit: 1 }
    );

    if (currentHost.length === 0 && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to revert this host'
      });
    }

    // Build update query from old values
    const updates = [];
    const values = [];
    
    if (details.oldValues) {
      const fieldMapping = {
        name: 'name',
        description: 'description',
        hostname: 'hostname',
        port: 'port',
        username: 'username',
        privateKey: 'private_key',
        sshKeyName: 'sshKeyName',
        icon: 'icon',
        color: 'color',
        transparency: 'transparency',
        blur: 'blur',
        remoteDesktopEnabled: 'remote_desktop_enabled',
        remoteDesktopType: 'remote_desktop_type',
        remoteProtocol: 'remote_protocol',
        remotePort: 'remote_port',
        remoteUsername: 'remote_username'
      };

      for (const [jsField, dbField] of Object.entries(fieldMapping)) {
        if (details.oldValues.hasOwnProperty(jsField)) {
          updates.push(`${dbField} = ?`);
          values.push(details.oldValues[jsField]);
        }
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to revert'
      });
    }

    // Add updated_by
    updates.push('updated_by = ?');
    values.push(req.user.id);

    // Add id for WHERE clause
    values.push(hostId);

    // Execute update
    await pool.execute(`
      UPDATE hosts
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);

    // Create audit log for reversion
    await createAuditLog(
      req.user.id,
      'host_reverted',
      'host',
      hostId,
      {
        name: details.name,
        reverted_audit_log_id: auditLogId,
        reverted_changes: details.changes,
        restored_values: details.oldValues,
        reverted_by: req.user.username
      },
      getClientIp(req),
      details.name
    );

    // Send SSE events - both for compatibility
    sseManager.broadcast({
      type: 'host_reverted',
      data: { id: hostId }
    });
    
    sseManager.broadcast({
      type: 'host_updated',
      data: { id: hostId }
    });

    logger.info(`Host changes reverted: ${details.name} by user ${req.user.username}`);

    res.json({
      success: true,
      message: 'Host changes successfully reverted'
    });

  } catch (error) {
    logger.error('Error reverting host changes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revert host changes'
    });
  }
});

module.exports = router;