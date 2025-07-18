const pool = require('../utils/database');

// Middleware to check if user can restore
// Admins can restore anything
// Regular users can only restore their own changes
const canRestore = async (req, res, next) => {
  try {
    const user = req.user;
    const { logId } = req.params;

    // Admins can always restore
    if (user.role === 'Administrator' || user.role === 'admin') {
      return next();
    }

    // For regular users, check if they made the original change
    const [logs] = await pool.execute(
      'SELECT user_id FROM audit_logs WHERE id = ?',
      [logId]
    );

    if (logs.length === 0) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    // Check if the user made the original change
    if (logs[0].user_id === user.id) {
      return next();
    }

    // User doesn't have permission
    return res.status(403).json({ 
      error: 'You can only restore changes you made yourself' 
    });
  } catch (error) {
    console.error('Error in canRestore middleware:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Export the middleware
module.exports = { canRestore };
