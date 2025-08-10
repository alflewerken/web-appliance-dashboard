/**
 * Generic Database Field Mapping Utility
 * Automatically converts between camelCase (JS) and snake_case (DB)
 */

/**
 * Convert camelCase to snake_case
 * @param {string} str - camelCase string
 * @returns {string} - snake_case string
 */
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case to camelCase
 * @param {string} str - snake_case string
 * @returns {string} - camelCase string
 */
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Generic mapping from JS object to DB format
 * Handles both camelCase and snake_case inputs
 * @param {Object} jsObj - JavaScript object
 * @returns {Object} - Database object with snake_case fields
 */
function genericMapJsToDb(jsObj) {
  if (!jsObj) return null;
  
  const dbObj = {};
  
  for (const [key, value] of Object.entries(jsObj)) {
    // Skip undefined values
    if (value === undefined) continue;
    
    // Convert key to snake_case if it's camelCase
    const dbKey = key.includes('_') ? key : camelToSnake(key);
    
    // Handle boolean conversions
    if (typeof value === 'boolean') {
      dbObj[dbKey] = value ? 1 : 0;
    } 
    // Handle Date conversions
    else if (value instanceof Date) {
      // Convert to MySQL datetime format: YYYY-MM-DD HH:MM:SS
      dbObj[dbKey] = value.toISOString().slice(0, 19).replace('T', ' ');
    }
    // Handle ISO date strings
    else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      // Convert ISO string to MySQL format
      dbObj[dbKey] = value.slice(0, 19).replace('T', ' ');
    }
    else {
      dbObj[dbKey] = value;
    }
  }
  
  return dbObj;
}

/**
 * Generic mapping from DB row to JS format
 * @param {Object} dbRow - Database row
 * @returns {Object} - JavaScript object with camelCase fields
 */
function genericMapDbToJs(dbRow) {
  if (!dbRow) return null;
  
  const jsObj = {};
  
  for (const [key, value] of Object.entries(dbRow)) {
    // Convert key to camelCase if it contains underscores
    const jsKey = key.includes('_') ? snakeToCamel(key) : key;
    
    // Handle boolean fields (MySQL returns 0/1)
    // Check both the original DB key and the converted JS key
    const isBooleanField = 
      key.startsWith('is_') || 
      key.endsWith('_enabled') || 
      key.endsWith('_installed') ||
      key === 'auto_start' || 
      jsKey === 'isFavorite' ||
      jsKey === 'autoStart' ||
      jsKey.endsWith('Enabled') ||
      jsKey.endsWith('Installed');
      
    if (isBooleanField) {
      jsObj[jsKey] = value === 1 || value === true || value === '1';
    } else {
      jsObj[jsKey] = value;
    }
  }
  
  return jsObj;
}

/**
 * Prepare INSERT statement from JS object
 * @param {string} tableName - Table name
 * @param {Object} jsObj - JavaScript object
 * @returns {Object} - { sql, values } for prepared statement
 */
function prepareInsert(tableName, jsObj) {
  const dbObj = genericMapJsToDb(jsObj);
  const fields = Object.keys(dbObj);
  const values = Object.values(dbObj);
  const placeholders = fields.map(() => '?').join(', ');
  
  const sql = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
  
  return { sql, values };
}

/**
 * Prepare UPDATE statement from JS object
 * @param {string} tableName - Table name
 * @param {Object} jsObj - JavaScript object
 * @param {string} whereField - Field for WHERE clause (default: 'id')
 * @returns {Object} - { sql, values } for prepared statement
 */
function prepareUpdate(tableName, jsObj, whereField = 'id') {
  const dbObj = genericMapJsToDb(jsObj);
  const whereValue = dbObj[whereField];
  delete dbObj[whereField]; // Remove WHERE field from SET clause
  
  const fields = Object.keys(dbObj);
  const values = Object.values(dbObj);
  const setClause = fields.map(field => `${field} = ?`).join(', ');
  
  values.push(whereValue); // Add WHERE value at the end
  
  const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${whereField} = ?`;
  
  return { sql, values };
}

module.exports = {
  camelToSnake,
  snakeToCamel,
  genericMapJsToDb,
  genericMapDbToJs,
  prepareInsert,
  prepareUpdate
};
