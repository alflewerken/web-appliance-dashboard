/**
 * Universal Database Field Mapping Configuration
 * Central configuration for all table mappings
 */

const fieldMappings = {
  // Users table
  users: {
    booleanFields: ['is_active', 'is_locked'],
    dateFields: ['last_login', 'created_at', 'updated_at'],
    jsonFields: ['preferences'],
    passwordFields: ['password_hash']
  },
  
  // Categories table
  categories: {
    booleanFields: ['is_system'],
    dateFields: ['created_at', 'updated_at'],
    intFields: ['order_index']
  },
  
  // Hosts table
  hosts: {
    booleanFields: ['remote_desktop_enabled', 'rustdesk_installed'],
    dateFields: ['created_at', 'updated_at', 'rustdesk_installation_date'],
    intFields: ['port', 'remote_port', 'created_by', 'updated_by'],
    encryptedFields: ['password', 'remote_password', 'rustdeskPassword']
  },
  
  // Settings table
  user_settings: {
    dateFields: ['created_at', 'updated_at'],
    jsonFields: ['setting_value']
  },
  
  // Background images table
  background_images: {
    booleanFields: ['is_active'],
    dateFields: ['created_at'],
    intFields: ['file_size', 'width', 'height', 'uploaded_by', 'usage_count']
  },
  
  // Commands table
  appliance_commands: {
    dateFields: ['created_at', 'updated_at'],
    intFields: ['appliance_id', 'host_id']
  },
  
  // SSH Keys table
  ssh_keys: {
    booleanFields: ['is_default'],
    dateFields: ['created_at', 'updated_at', 'last_used'],
    intFields: ['key_size', 'created_by'],
    encryptedFields: ['passphrase_hash']
  },
  
  // Appliances table
  appliances: {
    booleanFields: ['is_custom'],
    dateFields: ['created_at', 'updated_at', 'last_used'],
    intFields: ['order_index', 'created_by', 'updated_by'],
    jsonFields: ['ports']
  },
  
  // Services table
  services: {
    booleanFields: ['use_https'],
    dateFields: ['created_at', 'updated_at'],
    intFields: ['port', 'ssh_port', 'vnc_port', 'rdp_port'],
    encryptedFields: ['ssh_password', 'vnc_password', 'rdp_password']
  },
  
  // Audit logs table
  audit_logs: {
    dateFields: ['created_at'],
    intFields: ['user_id'],
    jsonFields: ['details', 'old_values', 'new_values']
  },
  
  // Role permissions table
  role_permissions: {
    booleanFields: ['granted'],
    dateFields: ['created_at', 'updated_at']
  },
  
  // User appliance permissions table
  user_appliance_permissions: {
    booleanFields: ['can_view', 'can_control', 'can_edit', 'can_delete'],
    dateFields: ['created_at', 'updated_at'],
    intFields: ['user_id', 'appliance_id', 'granted_by']
  }
};

/**
 * Get field configuration for a table
 * @param {string} tableName - Name of the table
 * @returns {Object} Field configuration
 */
function getTableConfig(tableName) {
  return fieldMappings[tableName] || {};
}

/**
 * Enhanced generic mapping with table-specific rules
 * @param {string} tableName - Name of the table
 * @param {Object} jsObj - JavaScript object
 * @returns {Object} Database object
 */
function mapJsToDbForTable(tableName, jsObj) {
  const { genericMapJsToDb } = require('./genericFieldMapping');
  const config = getTableConfig(tableName);
  
  // Start with generic mapping
  const dbObj = genericMapJsToDb(jsObj);
  
  // Apply table-specific rules
  if (config.dateFields) {
    config.dateFields.forEach(field => {
      const jsField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      if (jsObj[jsField] && dbObj[field]) {
        // Format dates for MySQL
        dbObj[field] = new Date(jsObj[jsField])
          .toISOString()
          .slice(0, 19)
          .replace('T', ' ');
      }
    });
  }
  
  if (config.jsonFields) {
    config.jsonFields.forEach(field => {
      const jsField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      if (jsObj[jsField] !== undefined && typeof jsObj[jsField] === 'object') {
        dbObj[field] = JSON.stringify(jsObj[jsField]);
      }
    });
  }
  
  return dbObj;
}

/**
 * Enhanced generic mapping from DB with table-specific rules
 * @param {string} tableName - Name of the table
 * @param {Object} dbRow - Database row
 * @returns {Object} JavaScript object
 */
function mapDbToJsForTable(tableName, dbRow) {
  const { genericMapDbToJs } = require('./genericFieldMapping');
  const config = getTableConfig(tableName);
  
  // Start with generic mapping
  const jsObj = genericMapDbToJs(dbRow);
  
  // Apply table-specific rules
  if (config.jsonFields) {
    config.jsonFields.forEach(field => {
      const jsField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      if (jsObj[jsField] && typeof jsObj[jsField] === 'string') {
        try {
          jsObj[jsField] = JSON.parse(jsObj[jsField]);
        } catch (e) {
          // Keep as string if parsing fails
        }
      }
    });
  }
  
  // Remove password fields from output
  if (config.passwordFields) {
    config.passwordFields.forEach(field => {
      const jsField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      delete jsObj[jsField];
    });
  }
  
  return jsObj;
}

module.exports = {
  fieldMappings,
  getTableConfig,
  mapJsToDbForTable,
  mapDbToJsForTable
};
