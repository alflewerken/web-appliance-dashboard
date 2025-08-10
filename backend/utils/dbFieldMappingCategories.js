// Database Field Mapping for Categories Table
// This file ensures consistent mapping between database columns and JavaScript variables

/**
 * Database column names for categories table
 */
const CATEGORY_DB_COLUMNS = {
  id: 'id',
  name: 'name',
  displayName: 'display_name',
  description: 'description',
  icon: 'icon',
  color: 'color',
  isSystem: 'is_system',
  orderIndex: 'order_index',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

/**
 * Map database row to JavaScript object for categories
 */
function mapCategoryDbToJs(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    displayName: row.name, // Use name as displayName since column doesn't exist
    description: row.description || '',
    icon: row.icon || 'Folder',
    color: row.color || '#007AFF',
    isSystem: Boolean(row.is_system),
    orderIndex: row.order_index || 0,
    order: row.order_index || 0, // Alias for frontend compatibility
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Additional fields that might be added by queries
    appliancesCount: row.appliances_count || 0,
  };
}

/**
 * Map JavaScript object to database fields for categories
 */
function mapCategoryJsToDb(jsObj) {
  if (!jsObj) return null;

  const dbObj = {};

  // Map each field if it exists
  if (jsObj.name !== undefined) dbObj.name = jsObj.name;
  if (jsObj.displayName !== undefined) dbObj.display_name = jsObj.displayName;
  if (jsObj.description !== undefined) dbObj.description = jsObj.description;
  if (jsObj.icon !== undefined) dbObj.icon = jsObj.icon;
  if (jsObj.color !== undefined) dbObj.color = jsObj.color;
  if (jsObj.isSystem !== undefined) dbObj.is_system = jsObj.isSystem ? 1 : 0;
  if (jsObj.orderIndex !== undefined) dbObj.order_index = jsObj.orderIndex;
  if (jsObj.order !== undefined && jsObj.orderIndex === undefined) {
    dbObj.order_index = jsObj.order; // Handle frontend alias
  }

  return dbObj;
}

/**
 * Get SELECT columns for categories table
 */
function getCategorySelectColumns() {
  return `
    id, name, description, icon, color,
    is_system, order_index, created_at, updated_at
  `.trim();
}

module.exports = {
  CATEGORY_DB_COLUMNS,
  mapCategoryDbToJs,
  mapCategoryJsToDb,
  getCategorySelectColumns,
};
