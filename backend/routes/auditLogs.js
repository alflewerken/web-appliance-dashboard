const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');
const db = new QueryBuilder(pool);
const { requireAdmin } = require('../utils/auth');
const { broadcast } = require('./sse');
const { logger } = require('../utils/logger');
const { Parser } = require('json2csv');
const { createAuditLog } = require('../utils/auditLogger');
const {
  mapAuditLogDbToJs,
  mapAuditLogJsToDb,
  getAuditLogSelectColumns,
  getActionDisplayName
} = require('../utils/dbFieldMappingAuditLogs');

// Export audit logs as CSV
router.get('/export', requireAdmin, async (req, res) => {
  try {
    const { start_date, end_date, action, resource_type, user_id } = req.query;
    
    let query = `
      SELECT 
        al.id,
        al.user_id,
        al.action,
        al.resource_type,
        al.resource_id,
        al.resource_name,
        al.details,
        al.ip_address,
        al.created_at,
        u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (start_date) {
      query += ' AND al.created_at >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND al.created_at <= ?';
      params.push(end_date);
    }
    
    if (action) {
      query += ' AND al.action = ?';
      params.push(action);
    }
    
    if (resource_type) {
      query += ' AND al.resource_type = ?';
      params.push(resource_type);
    }
    
    if (user_id) {
      query += ' AND al.user_id = ?';
      params.push(user_id);
    }
    
    query += ' ORDER BY al.created_at DESC';
    
    const [logs] = await pool.execute(query, params);
    
    // Transform the data for CSV export
    const csvData = logs.map(log => ({
      ID: log.id,
      Date: new Date(log.created_at).toISOString(),
      User: log.username || 'System',
      Action: log.action,
      'Resource Type': log.resource_type,
      'Resource ID': log.resource_id,
      'Resource Name': log.resource_name || '-',
      Details: typeof log.details === 'object' ? JSON.stringify(log.details) : log.details,
      'IP Address': log.ip_address || 'N/A'
    }));
    
    // Create CSV
    const fields = ['ID', 'Date', 'User', 'Action', 'Resource Type', 'Resource ID', 'Resource Name', 'Details', 'IP Address'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(csvData);
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
    
  } catch (error) {
    logger.error('Error exporting audit logs:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

// Get all audit logs
router.get('/', requireAdmin, async (req, res) => {
  try {
    console.log('[AUDIT_LOGS] API called at:', new Date().toISOString());
    
    const { since } = req.query;
    
    let query = `
      SELECT 
        al.id,
        al.user_id,
        al.action,
        al.resource_type,
        al.resource_id,
        al.resource_name,
        al.details,
        al.ip_address,
        al.user_agent,
        al.created_at,
        u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
    `;
    
    const params = [];
    
    // If 'since' parameter is provided, only return logs newer than this timestamp
    if (since) {
      query += ' WHERE al.created_at > ?';
      params.push(since);
      console.log('[AUDIT_LOGS] Fetching logs since:', since);
    }
    
    query += ' ORDER BY al.created_at DESC LIMIT 500';

    const [logs] = await pool.execute(query, params);
    console.log('[AUDIT_LOGS] Found', logs.length, 'logs from DB');
    
    // Debug: Check first log for IP
    if (logs.length > 0) {
      console.log('[AUDIT_LOGS] First DB log IP:', logs[0].ip_address);
    }
    
    // Map logs to camelCase format
    const mappedLogs = logs.map(log => {
      const mapped = {
        ...mapAuditLogDbToJs(log),
        username: log.username, // Add username from JOIN
        actionDisplay: getActionDisplayName(log.action)
      };
      
      // Debug: Check action mapping for update events
      if (log.action && log.action.includes('update')) {
        console.log('[AUDIT_LOGS] Update action mapping:');
        console.log('  - Original DB action:', log.action);
        console.log('  - Mapped action:', mapped.action);
        console.log('  - Details preview:', JSON.stringify(mapped.details).substring(0, 100));
      }
      
      return mapped;
    });
    
    // Debug: Check first mapped log for IP
    if (mappedLogs.length > 0) {
      console.log('[AUDIT_LOGS] First mapped log IP:', mappedLogs[0].ipAddress);
    }
    
    // Berechne Statistiken direkt im Backend
    const todayString = new Date().toISOString().split('T')[0];
    const todayCount = mappedLogs.filter(log => 
      log.createdAt && log.createdAt.startsWith(todayString)
    ).length;
    
    console.log('[AUDIT_LOGS] Today count:', todayCount);
    console.log('[AUDIT_LOGS] First mapped log:', JSON.stringify(mappedLogs[0], null, 2));
    console.log('[AUDIT_LOGS] Sending', mappedLogs.length, 'logs to frontend');
    
    // Sende Logs UND Statistiken
    res.json({
      logs: mappedLogs,
      stats: {
        total: mappedLogs.length,
        today: todayCount,
        todayDate: todayString
      }
    });
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get audit logs for a specific resource
router.get('/:resourceType/:resourceId', requireAdmin, async (req, res) => {
  const { resourceType, resourceId } = req.params;
  
  try {
    const query = `
      SELECT 
        al.id,
        al.action,
        al.resource_type,
        al.resource_id,
        al.resource_name,
        al.details,
        al.ip_address,
        al.created_at,
        u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.resource_type = ? AND al.resource_id = ?
      ORDER BY al.created_at DESC
      LIMIT 100
    `;

    const [logs] = await pool.execute(query, [resourceType, resourceId]);
    res.json(logs);
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Helper function to get old values for restoring settings
async function getOldSettingsValues(details) {
  const oldValues = {};
  
  if (details.backgroundEnabled !== undefined) {
    oldValues.backgroundEnabled = !details.backgroundEnabled;
  }
  
  if (details.blur !== undefined) {
    const currentSettings = await db.select('user_settings', 
      { userId: 1 }, 
      { limit: 1 }
    );
    if (currentSettings.length > 0 && currentSettings[0].backgroundBlur !== details.blur) {
      oldValues.blur = currentSettings[0].backgroundBlur;
    }
  }
  
  if (details.opacity !== undefined) {
    const currentSettings = await db.select('user_settings', 
      { userId: 1 }, 
      { limit: 1 }
    );
    if (currentSettings.length > 0 && currentSettings[0].backgroundOpacity !== details.opacity) {
      oldValues.opacity = currentSettings[0].backgroundOpacity;
    }
  }
  
  if (details.transparentPanels !== undefined) {
    const currentSettings = await db.select('user_settings', 
      { userId: 1 }, 
      { limit: 1 }
    );
    if (currentSettings.length > 0) {
      oldValues.transparentPanels = currentSettings[0].transparentPanels === 1 ? false : true;
    }
  }
  
  return oldValues;
}

// Host history endpoint moved to use hosts table
router.get('/host/:hostId/history', requireAdmin, async (req, res) => {
  const { hostId } = req.params;
  
  try {
    const query = `
      SELECT 
        al.id,
        al.action,
        al.resource_name,
        al.details,
        al.created_at,
        u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.resource_type = 'ssh_host' 
        AND al.resource_id = ?
      ORDER BY al.created_at DESC
      LIMIT 50
    `;
    
    const [history] = await pool.execute(query, [hostId]);
    res.json({ history });
  } catch (error) {
    logger.error('Error fetching SSH host history:', error);
    res.status(500).json({ error: 'Failed to fetch SSH host history' });
  }
});

// Get history for a specific resource
router.get('/history/:resourceType/:resourceId', requireAdmin, async (req, res) => {
  const { resourceType, resourceId } = req.params;
  
  try {
    const query = `
      SELECT 
        al.id,
        al.action,
        al.resource_name,
        al.details,
        al.created_at,
        u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.resource_type = ? 
        AND al.resource_id = ?
        AND al.action IN ('update', 'create')
      ORDER BY al.created_at DESC
      LIMIT 20
    `;
    
    const [history] = await pool.execute(query, [resourceType, resourceId]);
    
    // Transform the history to show changes
    const transformedHistory = history.map((entry, index) => {
      const nextEntry = history[index + 1];
      return {
        id: entry.id,
        action: entry.action,
        details: entry.details,
        previousDetails: nextEntry ? nextEntry.details : null,
        created_at: entry.created_at,
        username: entry.username
      };
    });
    
    res.json({ history: transformedHistory });
  } catch (error) {
    logger.error('Error fetching resource history:', error);
    res.status(500).json({ error: 'Failed to fetch resource history' });
  }
});

// Delete audit logs
router.delete('/delete', requireAdmin, async (req, res) => {
  const { ids } = req.body;
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No log IDs provided' });
  }

  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Create placeholders for the IN clause
    const placeholders = ids.map(() => '?').join(',');
    
    // Delete the audit logs
    const [result] = await connection.execute(
      `DELETE FROM audit_logs WHERE id IN (${placeholders})`,
      ids
    );
    
    await connection.commit();
    
    // Log this administrative action
    logger.info(`Admin ${req.user.username} deleted ${result.affectedRows} audit log entries`);
    
    // Broadcast the deletion event
    broadcast('audit_logs_deleted', {
      count: result.affectedRows,
      deletedBy: req.user.username
    });
    
    res.json({ 
      success: true, 
      deletedCount: result.affectedRows,
      message: `${result.affectedRows} audit log entries deleted successfully`
    });
    
  } catch (error) {
    await connection.rollback();
    logger.error('Error deleting audit logs:', error);
    res.status(500).json({ error: 'Failed to delete audit logs' });
  } finally {
    connection.release();
  }
});

// Delete specific filtered audit logs
router.delete('/delete-filtered', requireAdmin, async (req, res) => {
  const { logIds } = req.body;
  
  if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
    return res.status(400).json({ error: 'No log IDs provided' });
  }
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Create placeholders for SQL query
    const placeholders = logIds.map(() => '?').join(',');
    
    // Delete the specified audit logs
    const [result] = await connection.execute(
      `DELETE FROM audit_logs WHERE id IN (${placeholders})`,
      logIds
    );
    
    await connection.commit();
    
    // Log this administrative action
    logger.info(`Admin ${req.user.username} deleted ${result.affectedRows} filtered audit log entries`);
    
    // Create audit log for this deletion
    await createAuditLog(
      req.user.id,
      'audit_logs_delete',
      'audit_logs',
      null,
      {
        deleted_count: result.affectedRows,
        deleted_ids: logIds.slice(0, 10), // Log first 10 IDs for reference
        total_ids: logIds.length,
        deleted_by: req.user.username,
        timestamp: new Date().toISOString(),
      },
      req.ip || req.connection.remoteAddress,
      `${result.affectedRows} Einträge`
    );
    
    // Broadcast the deletion event
    broadcast('audit_logs_deleted', {
      count: result.affectedRows,
      deletedBy: req.user.username
    });
    
    res.json({ 
      success: true, 
      deletedCount: result.affectedRows,
      message: `${result.affectedRows} audit log entries deleted successfully`
    });
    
  } catch (error) {
    await connection.rollback();
    logger.error('Error deleting filtered audit logs:', error);
    res.status(500).json({ error: 'Failed to delete filtered audit logs' });
  } finally {
    connection.release();
  }
});

module.exports = router;
