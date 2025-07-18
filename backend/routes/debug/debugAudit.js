// Temporary debug route for audit logs
const express = require('express');
const router = express.Router();
const pool = require('../utils/database');

// Debug route to check audit log details
router.get('/debug-user', async (req, res) => {
  try {
    // Get audit logs that might contain "user #" in their details
    const [logs] = await pool.execute(`
      SELECT 
        al.id,
        al.user_id,
        al.action,
        al.details,
        al.created_at,
        u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.details LIKE '%user #%'
      ORDER BY al.created_at DESC
      LIMIT 10
    `);

    // Parse details and check for "user #" pattern
    const problematicLogs = logs.map(log => {
      let parsedDetails = {};
      try {
        parsedDetails = log.details ? JSON.parse(log.details) : {};
      } catch (e) {
        parsedDetails = { error: 'Failed to parse' };
      }

      return {
        id: log.id,
        user_id: log.user_id,
        action: log.action,
        username: log.username,
        created_at: log.created_at,
        details: parsedDetails,
        hasUserHash: JSON.stringify(parsedDetails).includes('user #'),
      };
    });

    res.json({
      count: problematicLogs.length,
      logs: problematicLogs,
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
// Debug route to check specific audit log entry
router.get('/check-login/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get all login entries for this user
    const [logs] = await pool.execute(
      `
      SELECT 
        al.id,
        al.user_id,
        al.action,
        al.details,
        al.created_at,
        u.username as db_username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.action = 'user_login' 
        AND (al.user_id = ? OR al.details LIKE ?)
      ORDER BY al.created_at DESC
      LIMIT 20
    `,
      [userId, `%"${userId}"%`]
    );

    // Check users table
    const [users] = await pool.execute(
      'SELECT id, username, email, role, is_active FROM users WHERE id = ?',
      [userId]
    );

    const results = logs.map(log => {
      let details = {};
      try {
        details = log.details ? JSON.parse(log.details) : {};
      } catch (e) {
        details = { parseError: true, raw: log.details };
      }

      return {
        id: log.id,
        user_id: log.user_id,
        action: log.action,
        db_username: log.db_username,
        details_username:
          details.username ||
          details.created_by ||
          details.updated_by ||
          'NOT_FOUND',
        all_details: details,
        created_at: log.created_at,
      };
    });

    res.json({
      user_exists: users.length > 0,
      user_data: users[0] || null,
      login_logs_count: results.length,
      login_logs: results,
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});
