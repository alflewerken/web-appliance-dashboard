// Revert user to original state
router.post('/revert/user/:logId', requireAdmin, async (req, res) => {
  try {
    const result = await db.transaction(async (trx) => {
      // Get the audit log
      const logs = await trx.select('audit_logs',
        {
          id: req.params.logId,
          action: 'user_updated'
        },
        { limit: 1 }
      );

      if (logs.length === 0) {
        throw new Error('Audit log not found or not a user update');
      }

      const log = logs[0];
      const details = JSON.parse(log.details || '{}');
      const originalData = details.original_data;

      if (!originalData) {
        throw new Error('No original data found in audit log');
      }

      // Check if user still exists
      const existing = await trx.select('users',
        { id: log.resourceId },
        { limit: 1 }
      );

      if (existing.length === 0) {
        throw new Error('User no longer exists');
      }

      // Build update data from original data
      const updateData = {};
      
      if (originalData.username !== undefined) {
        updateData.username = originalData.username;
      }
      if (originalData.email !== undefined) {
        updateData.email = originalData.email;
      }
      if (originalData.role !== undefined) {
        updateData.role = originalData.role;
      }
      if (originalData.isActive !== undefined) {
        updateData.isActive = originalData.isActive;
      }

      if (Object.keys(updateData).length === 0) {
        throw new Error('No fields to revert');
      }

      // Revert the user
      await trx.update('users', updateData, { id: log.resourceId });

      // Create audit log for reversion
      await createAuditLog(
        req.user.id,
        'user_reverted',
        'users',
        log.resourceId,
        {
          revertedFromLogId: req.params.logId,
          revertedData: originalData,
          previousData: details.new_data
        },
        getClientIp(req)
      );

      // Broadcast the update
      broadcast('user_updated', {
        userId: log.resourceId,
        revertedBy: req.user.username
      });

      return {
        success: true,
        message: 'User reverted to original state',
        userId: log.resourceId
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error reverting user:', error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: error.message || 'Failed to revert user' });
  }
});