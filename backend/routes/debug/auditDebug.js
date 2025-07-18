const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const { requireAdmin } = require('../utils/auth');

// Debug endpoint to check audit log details
router.get('/check/:id', requireAdmin, async (req, res) => {
  try {
    const [logs] = await pool.execute(
      `SELECT 
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
      WHERE al.id = ?`,
      [req.params.id]
    );

    if (logs.length === 0) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    const log = logs[0];

    // Parse details JSON
    let details = {};
    try {
      details = JSON.parse(log.details || '{}');
    } catch (e) {
      console.error('Error parsing audit log details:', e);
    }

    // Debug information
    const debugInfo = {
      raw_action: log.action,
      action_includes_delete: log.action.includes('delete'),
      action_equals_appliance_delete: log.action === 'appliance_delete',
      resource_type: log.resource_type,
      has_details: Object.keys(details).length > 0,
      detail_keys: Object.keys(details),
      has_service_key: 'service' in details,
      has_appliance_key: 'appliance' in details,
    };

    // Check if the resource can be restored
    let canRestore = false;
    let restoreInfo = null;

    const deleteActions = [
      'category_deleted',
      'user_deleted',
      'service_deleted',
      'appliance_delete',
      'appliance_deleted',
    ];
    const updateActions = [
      'category_updated',
      'user_updated',
      'service_updated',
      'appliance_update',
      'appliance_updated',
    ];

    debugInfo.is_delete_action = deleteActions.includes(log.action);
    debugInfo.is_update_action = updateActions.includes(log.action);

    if (deleteActions.includes(log.action)) {
      canRestore = true;
      const resourceData =
        details[log.resource_type] ||
        details.category ||
        details.user ||
        details.service ||
        details.appliance;

      restoreInfo = {
        type: log.resource_type,
        data: resourceData,
      };

      debugInfo.found_resource_data = !!resourceData;
    }

    if (updateActions.includes(log.action) && details.original_data) {
      canRestore = true;
      restoreInfo = {
        type: log.resource_type,
        original_data: details.original_data,
        new_data: details.new_data,
        canRevertToOriginal: true,
      };
    }

    res.json({
      ...log,
      details,
      canRestore,
      restoreInfo,
      debugInfo,
    });
  } catch (error) {
    console.error('Error in debug audit check:', error);
    res
      .status(500)
      .json({ error: 'Failed to check audit log', details: error.message });
  }
});

module.exports = router;
