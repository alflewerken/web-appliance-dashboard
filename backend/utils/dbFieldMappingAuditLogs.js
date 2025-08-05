// Database Field Mapping for Audit Logs Table
// This file ensures consistent mapping between database columns and JavaScript variables

/**
 * Database column names for audit_logs table
 */
const AUDIT_LOG_DB_COLUMNS = {
  id: 'id',
  userId: 'user_id',
  username: 'username',
  action: 'action',
  resourceType: 'resource_type',
  resourceId: 'resource_id',
  resourceName: 'resource_name',
  ipAddress: 'ip_address',
  userAgent: 'user_agent',
  metadata: 'metadata',
  createdAt: 'created_at',
};

/**
 * Map database row to JavaScript object for audit logs
 */
function mapAuditLogDbToJs(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    resourceName: row.resource_name,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null,
    createdAt: row.created_at,
  };
}

/**
 * Map JavaScript object to database fields for audit logs
 */
function mapAuditLogJsToDb(jsObj) {
  if (!jsObj) return null;

  const dbObj = {};

  // Map each field if it exists
  if (jsObj.userId !== undefined) dbObj.user_id = jsObj.userId;
  if (jsObj.username !== undefined) dbObj.username = jsObj.username;
  if (jsObj.action !== undefined) dbObj.action = jsObj.action;
  if (jsObj.resourceType !== undefined) dbObj.resource_type = jsObj.resourceType;
  if (jsObj.resourceId !== undefined) dbObj.resource_id = jsObj.resourceId;
  if (jsObj.resourceName !== undefined) dbObj.resource_name = jsObj.resourceName;
  if (jsObj.ipAddress !== undefined) dbObj.ip_address = jsObj.ipAddress;
  if (jsObj.userAgent !== undefined) dbObj.user_agent = jsObj.userAgent;
  if (jsObj.metadata !== undefined) {
    dbObj.metadata = typeof jsObj.metadata === 'object' ? JSON.stringify(jsObj.metadata) : jsObj.metadata;
  }

  return dbObj;
}

/**
 * Get SELECT columns for audit_logs table
 */
function getAuditLogSelectColumns() {
  return `
    id, user_id, username, action,
    resource_type, resource_id, resource_name,
    ip_address, user_agent, metadata, created_at
  `.trim();
}

/**
 * Map action names to human-readable format
 */
function getActionDisplayName(action) {
  const actionMap = {
    'login': 'User Login',
    'logout': 'User Logout',
    'create': 'Created',
    'update': 'Updated',
    'delete': 'Deleted',
    'appliance_created': 'Appliance Created',
    'appliance_updated': 'Appliance Updated',
    'appliance_deleted': 'Appliance Deleted',
    'category_created': 'Category Created',
    'category_updated': 'Category Updated',
    'category_deleted': 'Category Deleted',
    'user_created': 'User Created',
    'user_updated': 'User Updated',
    'user_deleted': 'User Deleted',
    'host_created': 'Host Created',
    'host_updated': 'Host Updated',
    'host_deleted': 'Host Deleted',
    'service_started': 'Service Started',
    'service_stopped': 'Service Stopped',
    'service_restarted': 'Service Restarted',
    'backup_created': 'Backup Created',
    'backup_restored': 'Backup Restored',
    'rustdesk_installed': 'RustDesk Installed',
    'ssh_key_generated': 'SSH Key Generated',
    'ssh_key_imported': 'SSH Key Imported',
    'ssh_key_deleted': 'SSH Key Deleted',
  };

  return actionMap[action] || action;
}

module.exports = {
  AUDIT_LOG_DB_COLUMNS,
  mapAuditLogDbToJs,
  mapAuditLogJsToDb,
  getAuditLogSelectColumns,
  getActionDisplayName,
};
