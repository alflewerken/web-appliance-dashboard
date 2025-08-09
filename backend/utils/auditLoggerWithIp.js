const { createAuditLog: originalCreateAuditLog } = require('./auditLogger');

/**
 * Enhanced audit log wrapper that automatically extracts IP from request
 * @param {object} req - Express request object
 * @returns {function} - Wrapped createAuditLog function with IP auto-extraction
 */
function createAuditLogWithIp(req) {
  return async function(userId, action, resourceType, resourceId, details, resourceName) {
    // Get IP from request
    const ipAddress = req.clientIp || req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
    
    // Call original function with IP
    return originalCreateAuditLog(
      userId,
      action,
      resourceType,
      resourceId,
      details || {},
      ipAddress,
      resourceName
    );
  };
}

module.exports = {
  createAuditLogWithIp
};
