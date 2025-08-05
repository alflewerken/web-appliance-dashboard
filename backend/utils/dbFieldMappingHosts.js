// Database Field Mapping for Hosts Table
// This file ensures consistent mapping between database columns and JavaScript variables

/**
 * Database column names for hosts table
 */
const HOST_DB_COLUMNS = {
  id: 'id',
  name: 'name',
  description: 'description',
  hostname: 'hostname',
  port: 'port',
  username: 'username',
  icon: 'icon',
  color: 'color',
  transparency: 'transparency',
  blur: 'blur',
  
  // SSH Settings
  password: 'password',
  privateKey: 'private_key',
  sshKeyName: 'ssh_key_name',
  
  // Remote Desktop Settings
  remoteDesktopEnabled: 'remote_desktop_enabled',
  remoteDesktopType: 'remote_desktop_type',
  remoteProtocol: 'remote_protocol',
  remotePort: 'remote_port',
  remoteUsername: 'remote_username',
  remotePassword: 'remote_password',
  
  // Guacamole Settings
  guacamolePerformanceMode: 'guacamole_performance_mode',
  
  // RustDesk Settings
  rustdeskId: 'rustdesk_id',
  rustdeskPassword: 'rustdesk_password',
  
  // Status Fields
  isActive: 'is_active',
  lastTested: 'last_tested',
  testStatus: 'test_status',
  
  // Timestamps
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

/**
 * Map database row to JavaScript object for hosts
 */
function mapHostDbToJs(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    hostname: row.hostname,
    port: row.port || 22,
    username: row.username,
    icon: row.icon || 'Server',
    color: row.color || '#007AFF',
    transparency: row.transparency !== undefined ? row.transparency : 0.15,
    blur: row.blur !== undefined ? row.blur : 8,
    
    // SSH Settings (password is handled separately for security)
    privateKey: row.private_key || null,
    sshKeyName: row.ssh_key_name || null,
    
    // Remote Desktop Settings
    remoteDesktopEnabled: Boolean(row.remote_desktop_enabled),
    remoteDesktopType: row.remote_desktop_type || 'guacamole',
    remoteProtocol: row.remote_protocol || 'ssh',
    remotePort: row.remote_port || null,
    remoteUsername: row.remote_username || null,
    
    // Guacamole Settings
    guacamolePerformanceMode: row.guacamole_performance_mode || 'balanced',
    
    // RustDesk Settings
    rustdeskId: row.rustdesk_id || null,
    
    // Status Fields
    isActive: Boolean(row.is_active !== false), // Default true
    lastTested: row.last_tested,
    testStatus: row.test_status || 'unknown',
    
    // Timestamps
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map JavaScript object to database fields for hosts
 */
function mapHostJsToDb(jsObj) {
  if (!jsObj) return null;

  const dbObj = {};

  // Map each field if it exists
  if (jsObj.name !== undefined) dbObj.name = jsObj.name;
  if (jsObj.description !== undefined) dbObj.description = jsObj.description;
  if (jsObj.hostname !== undefined) dbObj.hostname = jsObj.hostname;
  if (jsObj.port !== undefined) dbObj.port = jsObj.port;
  if (jsObj.username !== undefined) dbObj.username = jsObj.username;
  if (jsObj.icon !== undefined) dbObj.icon = jsObj.icon;
  if (jsObj.color !== undefined) dbObj.color = jsObj.color;
  if (jsObj.transparency !== undefined) dbObj.transparency = jsObj.transparency;
  if (jsObj.blur !== undefined) dbObj.blur = jsObj.blur;
  
  // SSH Settings
  if (jsObj.password !== undefined) dbObj.password = jsObj.password;
  if (jsObj.privateKey !== undefined) dbObj.private_key = jsObj.privateKey;
  if (jsObj.sshKeyName !== undefined) dbObj.ssh_key_name = jsObj.sshKeyName;
  
  // Remote Desktop Settings
  if (jsObj.remoteDesktopEnabled !== undefined)
    dbObj.remote_desktop_enabled = jsObj.remoteDesktopEnabled ? 1 : 0;
  if (jsObj.remoteDesktopType !== undefined)
    dbObj.remote_desktop_type = jsObj.remoteDesktopType;
  if (jsObj.remoteProtocol !== undefined)
    dbObj.remote_protocol = jsObj.remoteProtocol;
  if (jsObj.remotePort !== undefined)
    dbObj.remote_port = jsObj.remotePort;
  if (jsObj.remoteUsername !== undefined)
    dbObj.remote_username = jsObj.remoteUsername;
  if (jsObj.remotePassword !== undefined)
    dbObj.remote_password = jsObj.remotePassword;
    
  // Guacamole Settings
  if (jsObj.guacamolePerformanceMode !== undefined)
    dbObj.guacamole_performance_mode = jsObj.guacamolePerformanceMode;
    
  // RustDesk Settings
  if (jsObj.rustdeskId !== undefined)
    dbObj.rustdesk_id = jsObj.rustdeskId;
  if (jsObj.rustdeskPassword !== undefined)
    dbObj.rustdesk_password = jsObj.rustdeskPassword;
    
  // Status Fields
  if (jsObj.isActive !== undefined)
    dbObj.is_active = jsObj.isActive ? 1 : 0;
  if (jsObj.testStatus !== undefined)
    dbObj.test_status = jsObj.testStatus;

  return dbObj;
}

/**
 * Get SELECT columns for hosts table
 */
function getHostSelectColumns() {
  return `
    id, name, description, hostname, port, username, icon, color,
    transparency, blur, private_key, ssh_key_name,
    remote_desktop_enabled, remote_desktop_type, remote_protocol,
    remote_port, remote_username, guacamole_performance_mode,
    rustdesk_id, is_active, last_tested, test_status,
    created_at, updated_at
  `.trim();
}

/**
 * Map host data with passwords (for specific use cases)
 */
function mapHostDbToJsWithPasswords(row) {
  if (!row) return null;
  
  const result = mapHostDbToJs(row);
  
  // Add password fields
  result.password = row.password || null;
  result.remotePassword = row.remote_password || null;
  result.rustdeskPassword = row.rustdesk_password || null;
  
  return result;
}

module.exports = {
  HOST_DB_COLUMNS,
  mapHostDbToJs,
  mapHostJsToDb,
  getHostSelectColumns,
  mapHostDbToJsWithPasswords,
};
