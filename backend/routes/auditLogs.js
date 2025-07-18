const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const { requireAdmin } = require('../utils/auth');
const { broadcast } = require('./sse');
const logger = require('../utils/logger');
const { Parser } = require('json2csv');

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
      Details: typeof log.details === 'object' ? JSON.stringify(log.details) : log.details,
      'IP Address': log.ip_address || 'N/A'
    }));
    
    // Create CSV
    const fields = ['ID', 'Date', 'User', 'Action', 'Resource Type', 'Resource ID', 'Details', 'IP Address'];
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
    const query = `
      SELECT 
        al.id,
        al.user_id,
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
      LIMIT 500
    `;

    const [logs] = await pool.execute(query);
    res.json(logs);
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
    const [currentSettings] = await pool.execute(
      'SELECT background_blur FROM user_settings WHERE user_id = 1'
    );
    if (currentSettings.length > 0 && currentSettings[0].background_blur !== details.blur) {
      oldValues.blur = currentSettings[0].background_blur;
    }
  }
  
  if (details.opacity !== undefined) {
    const [currentSettings] = await pool.execute(
      'SELECT background_opacity FROM user_settings WHERE user_id = 1'
    );
    if (currentSettings.length > 0 && currentSettings[0].background_opacity !== details.opacity) {
      oldValues.opacity = currentSettings[0].background_opacity;
    }
  }
  
  if (details.transparentPanels !== undefined) {
    const [currentSettings] = await pool.execute(
      'SELECT transparent_panels FROM user_settings WHERE user_id = 1'
    );
    if (currentSettings.length > 0) {
      oldValues.transparentPanels = currentSettings[0].transparent_panels === 1 ? false : true;
    }
  }
  
  return oldValues;
}

// Neue Route zum Abrufen des Verlaufs für SSH-Hosts
router.get('/ssh-host/:hostId/history', requireAdmin, async (req, res) => {
  const { hostId } = req.params;
  
  try {
    const query = `
      SELECT 
        al.id,
        al.action,
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

module.exports = router;
