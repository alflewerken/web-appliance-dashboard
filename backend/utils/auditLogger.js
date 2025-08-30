const pool = require('./database');
const sseManager = require('./sseManager');

/**
 * Create an audit log entry
 * @param {number} userId - User ID
 * @param {string} action - Action performed
 * @param {string} resourceType - Type of resource
 * @param {number} resourceId - Resource ID
 * @param {object} details - Additional details (can include _req for IP extraction)
 * @param {string} ipAddress - IP address (optional if _req is in details)
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
    // Extract IP from request object if passed in details
    let finalIpAddress = ipAddress;
    
    // If details contains a _req property, extract IP from it
    if (details && details._req && details._req.clientIp) {
      finalIpAddress = details._req.clientIp;
      // Remove _req from details before storing
      const { _req, ...cleanDetails } = details;
      details = cleanDetails;
    }
    
    // If ipAddress is still not set, try to extract from common patterns
    if (!finalIpAddress) {
      // Check if details was actually meant to be ipAddress (common mistake in calls)
      if (typeof details === 'string' && details.includes('.')) {
        finalIpAddress = details;
        details = {};
      }
    }
    
    // Ensure we have a valid IP or set to null
    if (!finalIpAddress || finalIpAddress === 'undefined') {
      finalIpAddress = null;
    }
    
    // Debug log

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
        finalIpAddress,
      ]
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
        ip_address: finalIpAddress,
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
