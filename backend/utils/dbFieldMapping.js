// Database Field Mapping for Web Appliance Dashboard
// This file ensures consistent mapping between database columns and JavaScript variables

/**
 * Database column names as they exist in the MySQL database
 * These should be used in all SQL queries
 */
const DB_COLUMNS = {
  // Primary fields
  id: 'id',
  name: 'name',
  url: 'url',
  icon: 'icon',
  color: 'color',
  description: 'description',
  category: 'category',
  isFavorite: 'isFavorite', // Note: camelCase in DB
  lastUsed: 'lastUsed', // Note: camelCase in DB

  // Service Control Fields
  startCommand: 'start_command',
  stopCommand: 'stop_command',
  statusCommand: 'status_command',
  restartCommand: 'restart_command',
  autoStart: 'auto_start',
  serviceStatus: 'service_status',
  lastStatusCheck: 'last_status_check',

  // SSH Connection Field
  sshConnection: 'ssh_connection',

  // Visual Settings Fields
  transparency: 'transparency',
  blurAmount: 'blur_amount',
  backgroundImage: 'background_image',

  // URL Open Mode Settings
  openModeMini: 'open_mode_mini',
  openModeMobile: 'open_mode_mobile',
  openModeDesktop: 'open_mode_desktop',

  // Remote Desktop Settings
  remoteDesktopEnabled: 'remote_desktop_enabled',
  remoteProtocol: 'remote_protocol',
  remoteHost: 'remote_host',
  remotePort: 'remote_port',
  remoteUsername: 'remote_username',
  remotePasswordEncrypted: 'remote_password_encrypted',
  remoteDesktopType: 'remote_desktop_type',
  
  // RustDesk Fields
  rustdeskId: 'rustdesk_id',
  rustdeskPasswordEncrypted: 'rustdesk_password_encrypted',
  rustdeskInstalled: 'rustdesk_installed',
  rustdeskInstallationDate: 'rustdesk_installation_date',
  
  // Guacamole Settings
  guacamolePerformanceMode: 'guacamole_performance_mode',
  
  // Other
  orderIndex: 'order_index',

  // Timestamps
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

/**
 * JavaScript property names used in the frontend/API
 * These are typically camelCase
 */
const JS_PROPERTIES = {
  // Primary fields
  id: 'id',
  name: 'name',
  url: 'url',
  icon: 'icon',
  color: 'color',
  description: 'description',
  category: 'category',
  isFavorite: 'isFavorite',
  lastUsed: 'lastUsed',

  // Service Control Fields
  startCommand: 'startCommand',
  stopCommand: 'stopCommand',
  statusCommand: 'statusCommand',
  restartCommand: 'restartCommand',
  autoStart: 'autoStart',
  serviceStatus: 'serviceStatus',
  lastStatusCheck: 'lastStatusCheck',

  // SSH Connection Field
  sshConnection: 'sshConnection',

  // Visual Settings Fields
  transparency: 'transparency',
  blurAmount: 'blurAmount',
  blur: 'blur', // Alternative name used in some places
  backgroundImage: 'backgroundImage',

  // URL Open Mode Settings
  openModeMini: 'openModeMini',
  openModeMobile: 'openModeMobile',
  openModeDesktop: 'openModeDesktop',

  // Remote Desktop Settings
  remoteDesktopEnabled: 'remoteDesktopEnabled',
  remoteProtocol: 'remoteProtocol',
  remoteHost: 'remoteHost',
  remotePort: 'remotePort',
  remoteUsername: 'remoteUsername',
  remotePasswordEncrypted: 'remotePasswordEncrypted',
  remoteDesktopType: 'remoteDesktopType',
  
  // RustDesk Fields
  rustdeskId: 'rustdeskId',
  rustdeskPasswordEncrypted: 'rustdeskPasswordEncrypted',
  rustdeskInstalled: 'rustdeskInstalled',
  rustdeskInstallationDate: 'rustdeskInstallationDate',
  
  // Guacamole Settings
  guacamolePerformanceMode: 'guacamolePerformanceMode',
  
  // Other
  orderIndex: 'orderIndex',

  // Timestamps
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

/**
 * Map database row to JavaScript object
 * @param {Object} row - Database row
 * @returns {Object} - JavaScript object with camelCase properties
 */
function mapDbToJs(row) {
  if (!row) return null;

  return {
    // Primary fields
    id: row.id,
    name: row.name,
    url: row.url,
    icon: row.icon || 'Server',
    color: row.color || '#007AFF',
    description: row.description || '',
    category: row.category || 'productivity',
    isFavorite: Boolean(row.isFavorite),
    lastUsed: row.lastUsed,

    // Service Control Fields
    startCommand: row.start_command || null,
    stopCommand: row.stop_command || null,
    statusCommand: row.status_command || null,
    restartCommand: row.restart_command || null,
    autoStart: Boolean(row.auto_start),
    serviceStatus: row.service_status || 'unknown',
    lastStatusCheck: row.last_status_check,

    // SSH Connection Field
    sshConnection: row.ssh_connection || null,

    // Visual Settings Fields
    transparency: row.transparency !== undefined ? row.transparency : 0.7,
    blur: row.blur_amount !== undefined ? row.blur_amount : 8,
    blurAmount: row.blur_amount !== undefined ? row.blur_amount : 8,
    backgroundImage: row.background_image || null,

    // URL Open Mode Settings
    openModeMini: row.open_mode_mini || 'browser_tab',
    openModeMobile: row.open_mode_mobile || 'browser_tab',
    openModeDesktop: row.open_mode_desktop || 'browser_tab',

    // Remote Desktop Settings
    remoteDesktopEnabled: Boolean(row.remote_desktop_enabled),
    remoteProtocol: row.remote_protocol || 'vnc',
    remoteHost: row.remote_host || null,
    remotePort: row.remote_port || null,
    remoteUsername: row.remote_username || null,
    // Password is not returned for security
    
    // RustDesk Fields
    remoteDesktopType: row.remote_desktop_type || 'guacamole',
    rustdeskId: row.rustdesk_id || null,
    rustdeskInstalled: Boolean(row.rustdesk_installed),
    rustdeskInstallationDate: row.rustdesk_installation_date || null,
    
    // Guacamole Settings
    guacamolePerformanceMode: row.guacamole_performance_mode || 'balanced',
    
    // Order
    orderIndex: row.order_index || 0,

    // Timestamps
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map JavaScript object to database fields
 * @param {Object} jsObj - JavaScript object
 * @returns {Object} - Object with database column names
 */
function mapJsToDb(jsObj) {
  if (!jsObj) return null;

  const dbObj = {};

  // Map each field if it exists
  if (jsObj.name !== undefined) dbObj.name = jsObj.name;
  if (jsObj.url !== undefined) dbObj.url = jsObj.url;
  if (jsObj.icon !== undefined) dbObj.icon = jsObj.icon;
  if (jsObj.color !== undefined) dbObj.color = jsObj.color;
  if (jsObj.description !== undefined) dbObj.description = jsObj.description;
  if (jsObj.category !== undefined) dbObj.category = jsObj.category;
  if (jsObj.isFavorite !== undefined)
    dbObj.isFavorite = jsObj.isFavorite ? 1 : 0;

  // Service Control Fields
  if (jsObj.startCommand !== undefined)
    dbObj.start_command = jsObj.startCommand;
  if (jsObj.stopCommand !== undefined) dbObj.stop_command = jsObj.stopCommand;
  if (jsObj.statusCommand !== undefined)
    dbObj.status_command = jsObj.statusCommand;
  if (jsObj.restartCommand !== undefined)
    dbObj.restart_command = jsObj.restartCommand;
  if (jsObj.autoStart !== undefined) dbObj.auto_start = jsObj.autoStart ? 1 : 0;
  if (jsObj.serviceStatus !== undefined)
    dbObj.service_status = jsObj.serviceStatus;

  // SSH Connection Field
  if (jsObj.sshConnection !== undefined)
    dbObj.ssh_connection = jsObj.sshConnection;

  // Visual Settings Fields
  if (jsObj.transparency !== undefined) dbObj.transparency = jsObj.transparency;
  if (jsObj.blur !== undefined) dbObj.blur_amount = jsObj.blur;
  if (jsObj.blurAmount !== undefined) dbObj.blur_amount = jsObj.blurAmount;
  if (jsObj.backgroundImage !== undefined) dbObj.background_image = jsObj.backgroundImage;

  // URL Open Mode Settings
  if (jsObj.openModeMini !== undefined)
    dbObj.open_mode_mini = jsObj.openModeMini;
  if (jsObj.openModeMobile !== undefined)
    dbObj.open_mode_mobile = jsObj.openModeMobile;
  if (jsObj.openModeDesktop !== undefined)
    dbObj.open_mode_desktop = jsObj.openModeDesktop;
    
  // Remote Desktop Settings
  if (jsObj.remoteDesktopEnabled !== undefined)
    dbObj.remote_desktop_enabled = jsObj.remoteDesktopEnabled ? 1 : 0;
  if (jsObj.remoteProtocol !== undefined)
    dbObj.remote_protocol = jsObj.remoteProtocol;
  if (jsObj.remoteHost !== undefined)
    dbObj.remote_host = jsObj.remoteHost;
  if (jsObj.remotePort !== undefined)
    dbObj.remote_port = jsObj.remotePort;
  if (jsObj.remoteUsername !== undefined)
    dbObj.remote_username = jsObj.remoteUsername;
  if (jsObj.remotePasswordEncrypted !== undefined)
    dbObj.remote_password_encrypted = jsObj.remotePasswordEncrypted;
    
  // RustDesk Fields
  if (jsObj.remoteDesktopType !== undefined)
    dbObj.remote_desktop_type = jsObj.remoteDesktopType;
  if (jsObj.rustdeskId !== undefined)
    dbObj.rustdesk_id = jsObj.rustdeskId;
  if (jsObj.rustdeskPasswordEncrypted !== undefined)
    dbObj.rustdesk_password_encrypted = jsObj.rustdeskPasswordEncrypted;
  if (jsObj.rustdeskInstalled !== undefined)
    dbObj.rustdesk_installed = jsObj.rustdeskInstalled ? 1 : 0;
  if (jsObj.rustdeskInstallationDate !== undefined)
    dbObj.rustdesk_installation_date = jsObj.rustdeskInstallationDate;
    
  // Guacamole Settings
  if (jsObj.guacamolePerformanceMode !== undefined)
    dbObj.guacamole_performance_mode = jsObj.guacamolePerformanceMode;
    
  // Order
  if (jsObj.orderIndex !== undefined)
    dbObj.order_index = jsObj.orderIndex;

  return dbObj;
}

/**
 * Generate SELECT query with proper column aliases
 * @returns {string} - SELECT query fragment
 */
function getSelectColumns() {
  return `
    id, name, url, description, icon, color, category, 
    isFavorite, lastUsed,
    start_command, 
    stop_command, 
    status_command,
    restart_command,
    auto_start, 
    service_status, 
    last_status_check,
    ssh_connection, 
    transparency, 
    blur_amount,
    open_mode_mini,
    open_mode_mobile,
    open_mode_desktop,
    remote_desktop_enabled,
    remote_protocol,
    remote_host,
    remote_port,
    remote_username,
    remote_password_encrypted,
    remote_desktop_type,
    rustdesk_id,
    rustdesk_installed,
    rustdesk_installation_date,
    rustdesk_password_encrypted,
    guacamole_performance_mode,
    order_index,
    background_image,
    created_at, 
    updated_at
  `.trim();
}

/**
 * Map database row to JavaScript object WITH passwords (for audit log only!)
 * @param {Object} row - Database row
 * @returns {Object} - JavaScript object with camelCase properties including passwords
 */
function mapDbToJsWithPasswords(row) {
  if (!row) return null;
  
  // Get all normal fields first
  const result = mapDbToJs(row);
  
  // Add password fields for audit logging
  result.remotePasswordEncrypted = row.remote_password_encrypted || null;
  result.rustdeskPasswordEncrypted = row.rustdesk_password_encrypted || null;
  
  return result;
}

module.exports = {
  DB_COLUMNS,
  JS_PROPERTIES,
  mapDbToJs,
  mapJsToDb,
  getSelectColumns,
  mapDbToJsWithPasswords,
};
