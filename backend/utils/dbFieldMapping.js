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
  autoStart: 'auto_start',
  serviceStatus: 'service_status',
  lastStatusCheck: 'last_status_check',

  // SSH Connection Field
  sshConnection: 'ssh_connection',

  // Visual Settings Fields
  transparency: 'transparency',
  blurAmount: 'blur_amount',

  // URL Open Mode Settings
  openModeMini: 'open_mode_mini',
  openModeMobile: 'open_mode_mobile',
  openModeDesktop: 'open_mode_desktop',

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
  autoStart: 'autoStart',
  serviceStatus: 'serviceStatus',
  lastStatusCheck: 'lastStatusCheck',

  // SSH Connection Field
  sshConnection: 'sshConnection',

  // Visual Settings Fields
  transparency: 'transparency',
  blurAmount: 'blurAmount',
  blur: 'blur', // Alternative name used in some places

  // URL Open Mode Settings
  openModeMini: 'openModeMini',
  openModeMobile: 'openModeMobile',
  openModeDesktop: 'openModeDesktop',

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
    autoStart: Boolean(row.auto_start),
    serviceStatus: row.service_status || 'unknown',
    lastStatusCheck: row.last_status_check,

    // SSH Connection Field
    sshConnection: row.ssh_connection || null,

    // Visual Settings Fields
    transparency: row.transparency !== undefined ? row.transparency : 0.7,
    blur: row.blur_amount !== undefined ? row.blur_amount : 8,
    blurAmount: row.blur_amount !== undefined ? row.blur_amount : 8,

    // URL Open Mode Settings
    openModeMini: row.open_mode_mini || 'browser_tab',
    openModeMobile: row.open_mode_mobile || 'browser_tab',
    openModeDesktop: row.open_mode_desktop || 'browser_tab',

    // Remote Desktop Settings
    remote_desktop_enabled: Boolean(row.remote_desktop_enabled),
    remote_protocol: row.remote_protocol || 'vnc',
    remote_host: row.remote_host || null,
    remote_port: row.remote_port || null,
    remote_username: row.remote_username || null,
    // Password is not returned for security

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

  // URL Open Mode Settings
  if (jsObj.openModeMini !== undefined)
    dbObj.open_mode_mini = jsObj.openModeMini;
  if (jsObj.openModeMobile !== undefined)
    dbObj.open_mode_mobile = jsObj.openModeMobile;
  if (jsObj.openModeDesktop !== undefined)
    dbObj.open_mode_desktop = jsObj.openModeDesktop;

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
    created_at, 
    updated_at
  `.trim();
}

module.exports = {
  DB_COLUMNS,
  JS_PROPERTIES,
  mapDbToJs,
  mapJsToDb,
  getSelectColumns,
};
