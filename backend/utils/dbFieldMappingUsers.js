// Database Field Mapping for Users Table
// This file ensures consistent mapping between database columns and JavaScript variables

/**
 * Database column names for users table
 */
const USER_DB_COLUMNS = {
  id: 'id',
  username: 'username',
  email: 'email',
  passwordHash: 'password_hash',
  role: 'role',
  isActive: 'is_active',
  lastLogin: 'last_login',
  lastActivity: 'last_activity',
  isOnline: 'is_online',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

/**
 * Map database row to JavaScript object for users
 */
function mapUserDbToJs(row) {
  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role || 'user',
    isActive: Boolean(row.is_active !== false), // Default true
    lastLogin: row.last_login,
    lastActivity: row.last_activity,
    isOnline: Boolean(row.is_online),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map JavaScript object to database fields for users
 */
function mapUserJsToDb(jsObj) {
  if (!jsObj) return null;

  const dbObj = {};

  // Map each field if it exists
  if (jsObj.username !== undefined) dbObj.username = jsObj.username;
  if (jsObj.email !== undefined) dbObj.email = jsObj.email;
  if (jsObj.passwordHash !== undefined) dbObj.password_hash = jsObj.passwordHash;
  if (jsObj.role !== undefined) dbObj.role = jsObj.role;
  if (jsObj.isActive !== undefined) dbObj.is_active = jsObj.isActive ? 1 : 0;
  if (jsObj.lastLogin !== undefined) dbObj.last_login = jsObj.lastLogin;
  if (jsObj.lastActivity !== undefined) dbObj.last_activity = jsObj.lastActivity;

  return dbObj;
}

/**
 * Get SELECT columns for users table
 */
function getUserSelectColumns() {
  return `
    id, username, email, role,
    is_active, last_login, created_at, updated_at
  `.trim();
}

/**
 * Map user data with passwords (for authentication only!)
 */
function mapUserDbToJsWithPassword(row) {
  if (!row) return null;
  
  const result = mapUserDbToJs(row);
  result.passwordHash = row.password_hash;
  
  return result;
}

module.exports = {
  USER_DB_COLUMNS,
  mapUserDbToJs,
  mapUserJsToDb,
  getUserSelectColumns,
  mapUserDbToJsWithPassword,
};
