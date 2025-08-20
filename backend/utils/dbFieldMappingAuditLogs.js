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
 * Convert snake_case action names to camelCase
 */
function actionToCamelCase(action) {
  if (!action) return action;
  
  // Map of snake_case actions to camelCase
  const actionMap = {
    'host_create': 'hostCreate',
    'host_created': 'hostCreated',
    'host_update': 'hostUpdate',
    'host_updated': 'hostUpdated',
    'host_delete': 'hostDelete',
    'host_deleted': 'hostDeleted',
    'host_restore': 'hostRestore',
    'host_restored': 'hostRestored',
    'ssh_key_registered': 'sshKeyRegistered',
    'remote_desktop_access': 'remoteDesktopAccess',
    'service_create': 'serviceCreate',
    'service_update': 'serviceUpdate',
    'service_delete': 'serviceDelete',
    'service_restore': 'serviceRestore',
    'user_login': 'userLogin',
    'user_logout': 'userLogout',
    'backup_create': 'backupCreate',
    'backup_restore': 'backupRestore',
    'settings_update': 'settingsUpdate',
    'category_create': 'categoryCreate',
    'category_update': 'categoryUpdate',
    'category_delete': 'categoryDelete',
  };
  
  return actionMap[action] || action;
}

/**
 * Convert camelCase action names to snake_case for database
 */
function actionToSnakeCase(action) {
  if (!action) return action;
  
  // Map of camelCase actions to snake_case
  const actionMap = {
    'hostCreate': 'host_create',
    'hostCreated': 'host_created',
    'hostUpdate': 'host_update',
    'hostUpdated': 'host_updated',
    'hostDelete': 'host_delete',
    'hostDeleted': 'host_deleted',
    'hostRestore': 'host_restore',
    'hostRestored': 'host_restored',
    'sshKeyRegistered': 'ssh_key_registered',
    'remoteDesktopAccess': 'remote_desktop_access',
    'serviceCreate': 'service_create',
    'serviceUpdate': 'service_update',
    'serviceDelete': 'service_delete',
    'serviceRestore': 'service_restore',
    'userLogin': 'user_login',
    'userLogout': 'user_logout',
    'backupCreate': 'backup_create',
    'backupRestore': 'backup_restore',
    'settingsUpdate': 'settings_update',
    'categoryCreate': 'category_create',
    'categoryUpdate': 'category_update',
    'categoryDelete': 'category_delete',
  };
  
  return actionMap[action] || action;
}

/**
 * Map database row to JavaScript object for audit logs
 */
function mapAuditLogDbToJs(row) {
  if (!row) return null;

  // Convert MySQL datetime to ISO string for proper JS Date parsing
  let createdAt = row.created_at;
  if (createdAt) {
    // Check if it's already a Date object
    if (createdAt instanceof Date) {
      createdAt = createdAt.toISOString();
    } else if (typeof createdAt === 'string') {
      // MySQL datetime might come in different formats
      if (createdAt.includes('Z') || createdAt.includes('+')) {
        // Already has timezone info, use as-is
        createdAt = createdAt;
      } else if (createdAt.includes('T')) {
        // Has T separator but no timezone - assume UTC (Docker container time)
        // Add Z to mark as UTC
        createdAt = createdAt + 'Z';
      } else {
        // MySQL datetime format: "2025-08-08 11:56:11" 
        // In Docker containers, MySQL/MariaDB stores in container's timezone (UTC in our case)
        // Since the container runs in UTC, we can directly add Z to mark it as UTC
        const utcDateStr = createdAt.replace(' ', 'T') + 'Z';
        createdAt = utcDateStr;
      }
    }
  }

  // Parse details/metadata field
  let metadata = row.metadata || row.details;
  if (metadata && typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch (e) {
      // If parsing fails, keep as string
      console.error('Failed to parse metadata:', e);
    }
  }

  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    action: actionToCamelCase(row.action),  // Convert to camelCase
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    resourceName: row.resource_name,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    metadata: metadata,
    details: metadata,  // Frontend erwartet 'details'
    createdAt: createdAt,
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
  if (jsObj.action !== undefined) dbObj.action = actionToSnakeCase(jsObj.action);  // Convert to snake_case
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
  actionToCamelCase,
  actionToSnakeCase,
};
