const pool = require('./database');
const sseManager = require('./sseManager');

/**
 * Create an audit log entry
 * @param {number} userId - User ID
 * @param {string} action - Action performed
 * @param {string} resourceType - Type of resource
 * @param {number} resourceId - Resource ID
 * @param {object} details - Additional details
 * @param {string} ipAddress - IP address
 * @param {string} resourceName - Human-readable resource name (optional)
 */
async function createAuditLog(
  userId,
  action,
  resourceType,
  resourceId,
  details,
  ipAddress,
  resourceName = null
) {
  try {
    // Debug log
    console.log(`📝 Creating audit log - Action: ${action}, Resource: ${resourceType} #${resourceId}, Name: "${resourceName}"`);
    
    // Insert audit log entry
    const [result] = await pool.execute(
      `
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, resource_name, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `,
      [
        userId,
        action,
        resourceType,
        resourceId,
        resourceName,
        JSON.stringify(details),
        ipAddress || null,
      ]
    );

    console.log(
      `📝 Audit log created: ${action} on ${resourceType} #${resourceId}${resourceName ? ` (${resourceName})` : ''} by user ${userId}`
    );

    // Broadcast SSE event for audit log creation
    sseManager.broadcast({
      type: 'audit_log_created',
      data: {
        id: result.insertId,
        user_id: userId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        resource_name: resourceName,
        details,
        ip_address: ipAddress,
        created_at: new Date(),
      },
    });

    // Also broadcast specific event for the action
    sseManager.broadcast({
      type: action,
      data: {
        id: resourceId,
        resource_type: resourceType,
        resource_name: resourceName,
        ...details,
      },
    });

    return result.insertId;
  } catch (error) {
    console.error('Error creating audit log:', error);
    throw error;
  }
}

module.exports = {
  createAuditLog,
};
