const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const { requireAdmin } = require('../utils/auth');
const { createAuditLog } = require('../utils/auth');
const logger = require('../utils/logger');

// Get all audit logs (admin only)
router.get('/', requireAdmin, async (req, res) => {
  logger.debug('Audit logs requested by:', req.user);
  try {
    const query = `
      SELECT 
        al.id,
        al.action,
        al.resource_type,
        al.resource_id,
        al.details,
        al.ip_address,
        al.created_at,
        u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 1000
    `;

    const [logs] = await pool.execute(query);
    logger.debug('Audit logs found:', logs.length);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get audit logs with filters
router.get('/filtered', requireAdmin, async (req, res) => {
  try {
    const {
      action,
      user_id,
      resource_type,
      start_date,
      end_date,
      limit = 1000,
    } = req.query;

    let query = `
      SELECT 
        al.id,
        al.action,
        al.resource_type,
        al.resource_id,
        al.details,
        al.ip_address,
        al.created_at,
        u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (action) {
      query += ' AND al.action = ?';
      params.push(action);
    }

    if (user_id) {
      query += ' AND al.user_id = ?';
      params.push(user_id);
    }

    if (resource_type) {
      query += ' AND al.resource_type = ?';
      params.push(resource_type);
    }

    if (start_date) {
      query += ' AND al.created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND al.created_at <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY al.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const [logs] = await pool.execute(query, params);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching filtered audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get audit log statistics
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    // Total logs
    const [totalResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM audit_logs'
    );

    // Logs today
    const [todayResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM audit_logs WHERE DATE(created_at) = CURDATE()'
    );

    // Unique users
    const [usersResult] = await pool.execute(
      'SELECT COUNT(DISTINCT user_id) as total FROM audit_logs WHERE user_id IS NOT NULL'
    );

    // Critical actions
    const criticalActions = [
      'user_delete',
      'appliance_delete',
      'settings_update',
      'user_role_change',
      'backup_restore',
    ];
    const placeholders = criticalActions.map(() => '?').join(',');
    const [criticalResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM audit_logs WHERE action IN (${placeholders})`,
      criticalActions
    );

    res.json({
      totalLogs: totalResult[0].total,
      todayLogs: todayResult[0].total,
      uniqueUsers: usersResult[0].total,
      criticalActions: criticalResult[0].total,
    });
  } catch (error) {
    console.error('Error fetching audit log stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Export audit logs as CSV (admin only)
router.get('/export', requireAdmin, async (req, res) => {
  try {
    const { action, user_id, resource_type, start_date, end_date } = req.query;

    let query = `
      SELECT 
        al.id,
        al.created_at,
        u.username,
        al.action,
        al.resource_type,
        al.resource_id,
        al.ip_address,
        al.details
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (action && action !== 'all') {
      query += ' AND al.action = ?';
      params.push(action);
    }

    if (user_id && user_id !== 'all') {
      query += ' AND al.user_id = ?';
      params.push(user_id);
    }

    if (resource_type && resource_type !== 'all') {
      query += ' AND al.resource_type = ?';
      params.push(resource_type);
    }

    if (start_date) {
      query += ' AND al.created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND al.created_at <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY al.created_at DESC';

    const [logs] = await pool.execute(query, params);

    // Convert to CSV
    const csv = [
      'ID,Timestamp,User,Action,Resource Type,Resource ID,IP Address,Details',
      ...logs.map(
        log =>
          `${log.id},"${log.created_at}","${log.username || 'System'}","${log.action}","${log.resource_type || ''}","${log.resource_id || ''}","${log.ip_address || ''}","${JSON.stringify(log.details || {}).replace(/"/g, '""')}"`
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit_logs.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

// Delete audit logs based on IDs (admin only)
router.delete('/delete', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No log IDs provided' });
    }

    // Sicherheitscheck: Maximal 10000 Einträge auf einmal löschen
    if (ids.length > 10000) {
      return res
        .status(400)
        .json({ error: 'Too many logs to delete at once. Maximum is 10000.' });
    }

    // Create placeholders for the IN clause
    const placeholders = ids.map(() => '?').join(',');

    // Get count before deletion for audit log
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as count FROM audit_logs WHERE id IN (${placeholders})`,
      ids
    );
    const deletedCount = countResult[0].count;

    // Delete the audit logs
    await pool.execute(
      `DELETE FROM audit_logs WHERE id IN (${placeholders})`,
      ids
    );

    // Create audit log for this deletion
    const ipAddress = req.clientIp;
    await createAuditLog(
      req.user?.id || null,
      'audit_logs_delete',
      'audit_logs',
      null,
      {
        deleted_count: deletedCount,
        deleted_by: req.user?.username || 'unknown',
        deletion_timestamp: new Date().toISOString(),
      },
      ipAddress
    );

    res.json({
      success: true,
      deletedCount,
      message: `${deletedCount} Audit Log Einträge wurden gelöscht`,
    });
  } catch (error) {
    console.error('Error deleting audit logs:', error);
    res.status(500).json({ error: 'Failed to delete audit logs' });
  }
});

module.exports = router;
