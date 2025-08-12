// Database Field Mapping for SSH Keys Table
// This file ensures consistent mapping between database columns and JavaScript variables

/**
 * Database column names for ssh_keys table
 */
const SSH_KEY_DB_COLUMNS = {
  id: 'id',
  keyName: 'key_name',
  keyType: 'key_type',
  keySize: 'key_size',
  comment: 'comment',
  publicKey: 'public_key',
  privateKey: 'private_key',
  fingerprint: 'fingerprint',
  isActive: 'is_active',
  createdBy: 'created_by',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

/**
 * Map database row to JavaScript object for SSH keys
 */
function mapSSHKeyDbToJs(row) {
  if (!row) return null;

  return {
    id: row.id,
    keyName: row.key_name,
    keyType: row.key_type || 'rsa',
    keySize: row.key_size || 2048,
    comment: row.comment || '',
    publicKey: row.public_key,
    privateKey: row.private_key,
    fingerprint: row.fingerprint,
    isActive: true, // Default to true since column doesn't exist
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map JavaScript object to database fields for SSH keys
 */
function mapSSHKeyJsToDb(jsObj) {
  if (!jsObj) return null;

  const dbObj = {};

  // Map each field if it exists
  if (jsObj.keyName !== undefined) dbObj.key_name = jsObj.keyName;
  if (jsObj.keyType !== undefined) dbObj.key_type = jsObj.keyType;
  if (jsObj.keySize !== undefined) dbObj.key_size = jsObj.keySize;
  if (jsObj.comment !== undefined) dbObj.comment = jsObj.comment;
  if (jsObj.publicKey !== undefined) dbObj.public_key = jsObj.publicKey;
  if (jsObj.privateKey !== undefined) dbObj.private_key = jsObj.privateKey;
  if (jsObj.fingerprint !== undefined) dbObj.fingerprint = jsObj.fingerprint;
  if (jsObj.isActive !== undefined) dbObj.is_active = jsObj.isActive ? 1 : 0;
  if (jsObj.createdBy !== undefined) dbObj.created_by = jsObj.createdBy;

  return dbObj;
}

/**
 * Get SELECT columns for ssh_keys table
 */
function getSSHKeySelectColumns() {
  return `
    id, key_name, key_type, key_size, comment,
    public_key, private_key, fingerprint,
    created_by, created_at, updated_at
  `.trim();
}

/**
 * Map SSH key data without sensitive fields (for listing)
 */
function mapSSHKeyDbToJsPublic(row) {
  if (!row) return null;
  
  const result = mapSSHKeyDbToJs(row);
  
  // Remove sensitive fields for public API responses
  delete result.privateKey;
  
  return result;
}

module.exports = {
  SSH_KEY_DB_COLUMNS,
  mapSSHKeyDbToJs,
  mapSSHKeyJsToDb,
  getSSHKeySelectColumns,
  mapSSHKeyDbToJsPublic,
};
