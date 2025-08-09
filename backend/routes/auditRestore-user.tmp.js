// Restore deleted user
router.post('/restore/user/:logId', requireAdmin, async (req, res) => {
  try {
    const result = await db.transaction(async (trx) => {
      // Get the audit log
      const logs = await trx.select('audit_logs',
        {
          id: req.params.logId,
          action: 'user_deleted'
        },
        { limit: 1 }
      );

      if (logs.length === 0) {
        throw new Error('Audit log not found or not a user deletion');
      }

      const log = logs[0];
      const details = JSON.parse(log.details || '{}');
      const userData = details.user;

      if (!userData) {
        throw new Error('No user data found in audit log');
      }

      // Check if username or email already exists  
      const existing = await trx.select('users',
        {
          $or: [
            { username: userData.username },
            { email: userData.email }
          ]
        },
        { limit: 1 }
      );

      if (existing.length > 0) {
        throw new Error('User with this username or email already exists');
      }

      // Generate a temporary password
      const bcrypt = require('bcryptjs');
      const tempPassword = 'changeme' + Math.random().toString(36).slice(-8);
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      // Restore the user
      const insertResult = await trx.insert('users', {
        username: userData.username,
        email: userData.email,
        passwordHash: passwordHash,
        role: userData.role || 'user',
        isActive: 0 // Set as inactive, needs password reset
      });

      const restoredUserId = insertResult.insertId;

      // Create audit log for restoration
      await createAuditLog(
        req.user.id,
        'user_restored',
        'user',
        restoredUserId,
        {
          restoredFromLogId: req.params.logId,
          restoredUserData: userData,
          temporaryPassword: tempPassword,
          requiresPasswordReset: true
        },
        getClientIp(req)
      );

      // Broadcast the restoration
      broadcast('user_restored', {
        userId: restoredUserId,
        username: userData.username,
        restoredBy: req.user.username
      });

      return {
        success: true,
        message: 'User restored successfully',
        userId: restoredUserId,
        username: userData.username,
        temporaryPassword: tempPassword,
        note: 'User account is inactive. They must reset their password to activate.'
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error restoring user:', error);
    res.status(error.message.includes('already exists') ? 409 : 500)
      .json({ error: error.message || 'Failed to restore user' });
  }
});