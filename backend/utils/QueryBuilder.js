/**
 * SQL Query Builder with Field Mapping and Transaction Support
 * Simplifies database operations with automatic field mapping
 */

const { prepareInsert, prepareUpdate } = require('./genericFieldMapping');
const { mapJsToDbForTable, mapDbToJsForTable } = require('./universalFieldMapping');

class QueryBuilder {
  constructor(pool, connection = null) {
    this.pool = pool;
    this.connection = connection; // For transaction support
    this.isTransaction = !!connection;
  }

  /**
   * Get the database connection (either pool or transaction connection)
   * @private
   */
  _getConnection() {
    return this.connection || this.pool;
  }

  /**
   * Begin a new transaction
   * @returns {Promise<QueryBuilder>} New QueryBuilder instance with transaction
   */
  async beginTransaction() {
    if (this.isTransaction) {
      throw new Error('Already in a transaction');
    }
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();
    return new QueryBuilder(this.pool, connection);
  }

  /**
   * Commit the current transaction
   * @returns {Promise<void>}
   */
  async commit() {
    if (!this.isTransaction) {
      throw new Error('Not in a transaction');
    }
    await this.connection.commit();
    this.connection.release();
    this.connection = null;
    this.isTransaction = false;
  }

  /**
   * Rollback the current transaction
   * @returns {Promise<void>}
   */
  async rollback() {
    if (!this.isTransaction) {
      throw new Error('Not in a transaction');
    }
    await this.connection.rollback();
    this.connection.release();
    this.connection = null;
    this.isTransaction = false;
  }

  /**
   * Execute a function within a transaction
   * @param {Function} callback - Async function to execute
   * @returns {Promise<any>} Result of the callback
   * 
   * @example
   * const result = await db.transaction(async (trx) => {
   *   await trx.insert('users', { name: 'John' });
   *   await trx.update('stats', { userCount: 1 }, { id: 1 });
   *   return { success: true };
   * });
   */
  async transaction(callback) {
    const trx = await this.beginTransaction();
    try {
      const result = await callback(trx);
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Insert a record with automatic field mapping
   * @param {string} table - Table name
   * @param {Object} data - JavaScript object with data
   * @returns {Promise<Object>} Insert result
   */
  async insert(table, data) {
    const { sql, values } = prepareInsert(table, data);
    const conn = this._getConnection();
    const [result] = await conn.execute(sql, values);
    return result;
  }

  /**
   * Update a record with automatic field mapping
   * @param {string} table - Table name
   * @param {Object} data - JavaScript object with data
   * @param {Object} where - WHERE conditions
   * @returns {Promise<Object>} Update result
   */
  async update(table, data, where) {
    const mappedData = mapJsToDbForTable(table, data);
    
    // Build SET clause
    const setFields = Object.keys(mappedData)
      .map(field => `${field} = ?`)
      .join(', ');
    
    // Build WHERE clause with OR support
    const { whereClause, whereValues } = this._buildWhereClause(table, where);
    
    const sql = `UPDATE ${table} SET ${setFields}${whereClause ? ' WHERE ' + whereClause : ''}`;
    const values = [...Object.values(mappedData), ...whereValues];
    
    const conn = this._getConnection();
    const [result] = await conn.execute(sql, values);
    return result;
  }

  /**
   * Select records with automatic field mapping
   * @param {string} table - Table name
   * @param {Object} where - WHERE conditions (optional) - supports $or operator
   * @param {Object} options - Query options (limit, orderBy, etc.)
   * @returns {Promise<Array>} Array of JavaScript objects
   * 
   * @example
   * // Simple AND conditions
   * await db.select('users', { username: 'admin', active: true });
   * 
   * @example
   * // OR conditions
   * await db.select('users', {
   *   $or: [
   *     { username: 'admin' },
   *     { email: 'admin@example.com' }
   *   ]
   * });
   * 
   * @example
   * // Within a transaction
   * await db.transaction(async (trx) => {
   *   const users = await trx.select('users', { active: true });
   *   // ... more operations
   * });
   */
  async select(table, where = {}, options = {}) {
    let sql = `SELECT * FROM ${table}`;
    
    // Build WHERE clause with OR support
    const { whereClause, whereValues } = this._buildWhereClause(table, where);
    
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
    
    // Add ORDER BY
    if (options.orderBy) {
      const orderField = options.orderBy.includes('_') ? 
        options.orderBy : 
        options.orderBy.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      sql += ` ORDER BY ${orderField}`;
      if (options.orderDir) {
        sql += ` ${options.orderDir.toUpperCase()}`;
      }
    }
    
    // Add LIMIT
    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
      if (options.offset) {
        sql += ` OFFSET ${options.offset}`;
      }
    }
    
    const conn = this._getConnection();
    const [rows] = await conn.execute(sql, whereValues);
    
    // Map results back to JS format
    return rows.map(row => mapDbToJsForTable(table, row));
  }

  /**
   * Delete records
   * @param {string} table - Table name
   * @param {Object} where - WHERE conditions - supports $or operator
   * @returns {Promise<Object>} Delete result
   */
  async delete(table, where) {
    // Build WHERE clause with OR support
    const { whereClause, whereValues } = this._buildWhereClause(table, where);
    
    if (!whereClause) {
      throw new Error('DELETE requires WHERE conditions');
    }
    
    const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
    
    const conn = this._getConnection();
    const [result] = await conn.execute(sql, whereValues);
    return result;
  }

  /**
   * Find one record
   * @param {string} table - Table name
   * @param {Object} where - WHERE conditions - supports $or operator
   * @returns {Promise<Object|null>} Single record or null
   */
  async findOne(table, where) {
    const results = await this.select(table, where, { limit: 1 });
    return results[0] || null;
  }

  /**
   * Count records
   * @param {string} table - Table name
   * @param {Object} where - WHERE conditions (optional) - supports $or operator
   * @returns {Promise<number>} Count
   */
  async count(table, where = {}) {
    let sql = `SELECT COUNT(*) as count FROM ${table}`;
    
    // Build WHERE clause with OR support
    const { whereClause, whereValues } = this._buildWhereClause(table, where);
    
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
    
    const conn = this._getConnection();
    const [rows] = await conn.execute(sql, whereValues);
    return rows[0].count;
  }

  /**
   * Execute raw query (for complex queries)
   * @param {string} sql - SQL query
   * @param {Array} values - Query parameters
   * @returns {Promise<Array>} Query results
   */
  async raw(sql, values = []) {
    const conn = this._getConnection();
    const [rows] = await conn.execute(sql, values);
    return rows;
  }

  /**
   * Select with JOIN support
   * @param {Object} config - Query configuration
   * @param {string} config.from - Main table name
   * @param {Array<string>} config.select - Fields to select (optional, defaults to all)
   * @param {Array<Object>} config.joins - Array of join configurations
   * @param {Object} config.where - WHERE conditions - supports $or operator
   * @param {Object} config.options - Query options (limit, orderBy, etc.)
   * @returns {Promise<Array>} Array of JavaScript objects with mapped fields
   * 
   * @example
   * await db.selectWithJoin({
   *   from: 'appliances',
   *   select: ['appliances.*', 'hosts.hostname', 'hosts.username'],
   *   joins: [{
   *     table: 'hosts',
   *     on: 'appliances.ssh_connection = CONCAT(hosts.username, "@", hosts.hostname, ":", hosts.port)',
   *     type: 'LEFT'
   *   }],
   *   where: { 
   *     'appliances.active': true,
   *     $or: [
   *       { 'appliances.type': 'web' },
   *       { 'appliances.type': 'ssh' }
   *     ]
   *   }
   * });
   */
  async selectWithJoin(config) {
    const { from, select = ['*'], joins = [], where = {}, options = {} } = config;
    
    // Build SELECT clause
    let sql = `SELECT ${select.join(', ')} FROM ${from}`;
    
    // Add JOINs
    for (const join of joins) {
      const joinType = join.type || 'INNER';
      sql += ` ${joinType} JOIN ${join.table} ON ${join.on}`;
    }
    
    // Build WHERE clause with OR support
    const { whereClause, whereValues } = this._buildWhereClauseWithPrefix(from, where, joins);
    
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
    
    // Add ORDER BY
    if (options.orderBy) {
      const orderParts = options.orderBy.split('.');
      let mappedOrderBy;
      
      if (orderParts.length === 2) {
        const [table, field] = orderParts;
        const dbField = this._mapFieldToDb(table, field);
        mappedOrderBy = `${table}.${dbField}`;
      } else {
        const dbField = this._mapFieldToDb(from, options.orderBy);
        mappedOrderBy = `${from}.${dbField}`;
      }
      
      sql += ` ORDER BY ${mappedOrderBy}`;
      if (options.orderDir) {
        sql += ` ${options.orderDir.toUpperCase()}`;
      }
    }
    
    // Add LIMIT
    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
      if (options.offset) {
        sql += ` OFFSET ${options.offset}`;
      }
    }
    
    const conn = this._getConnection();
    const [rows] = await conn.execute(sql, whereValues);
    
    // Map results - handle multiple tables
    return rows.map(row => {
      const result = {};
      
      for (const [key, value] of Object.entries(row)) {
        // Try to determine which table this field belongs to
        let mapped = false;
        
        // Check main table
        try {
          const jsField = this._mapFieldToJs(from, key);
          if (jsField) {
            result[jsField] = value;
            mapped = true;
          }
        } catch (e) {
          // Field not from main table
        }
        
        // Check joined tables
        if (!mapped) {
          for (const join of joins) {
            try {
              const jsField = this._mapFieldToJs(join.table, key);
              if (jsField) {
                // Prefix with table name to avoid conflicts
                result[`${join.table}_${jsField}`] = value;
                mapped = true;
                break;
              }
            } catch (e) {
              // Field not from this table
            }
          }
        }
        
        // If still not mapped, use original key
        if (!mapped) {
          result[key] = value;
        }
      }
      
      return result;
    });
  }

  /**
   * Find one record with JOIN support
   * @param {Object} config - Query configuration (same as selectWithJoin)
   * @returns {Promise<Object|null>} Single record or null
   */
  async findOneWithJoin(config) {
    const results = await this.selectWithJoin({
      ...config,
      options: { ...config.options, limit: 1 }
    });
    return results[0] || null;
  }

  /**
   * Build WHERE clause with support for $or operator
   * @private
   * @param {string} table - Table name
   * @param {Object} where - WHERE conditions
   * @returns {Object} { whereClause: string, whereValues: Array }
   */
  _buildWhereClause(table, where) {
    if (!where || Object.keys(where).length === 0) {
      return { whereClause: '', whereValues: [] };
    }

    const conditions = [];
    const values = [];

    // Process each condition
    for (const [key, value] of Object.entries(where)) {
      if (key === '$or') {
        // Handle OR conditions
        if (!Array.isArray(value) || value.length === 0) {
          throw new Error('$or must be a non-empty array');
        }

        const orConditions = [];
        for (const orCondition of value) {
          for (const [orKey, orValue] of Object.entries(orCondition)) {
            const dbField = this._mapFieldToDb(table, orKey);
            if (orValue === null) {
              orConditions.push(`${dbField} IS NULL`);
            } else {
              orConditions.push(`${dbField} = ?`);
              values.push(orValue);
            }
          }
        }

        if (orConditions.length > 0) {
          conditions.push(`(${orConditions.join(' OR ')})`);
        }
      } else {
        // Regular AND condition
        const dbField = this._mapFieldToDb(table, key);
        if (value === null) {
          conditions.push(`${dbField} IS NULL`);
        } else {
          conditions.push(`${dbField} = ?`);
          values.push(value);
        }
      }
    }

    return {
      whereClause: conditions.join(' AND '),
      whereValues: values
    };
  }

  /**
   * Build WHERE clause with table prefixes (for JOINs) and $or support
   * @private
   * @param {string} mainTable - Main table name
   * @param {Object} where - WHERE conditions
   * @param {Array} joins - Join configurations
   * @returns {Object} { whereClause: string, whereValues: Array }
   */
  _buildWhereClauseWithPrefix(mainTable, where, joins = []) {
    if (!where || Object.keys(where).length === 0) {
      return { whereClause: '', whereValues: [] };
    }

    const conditions = [];
    const values = [];

    // Process each condition
    for (const [key, value] of Object.entries(where)) {
      if (key === '$or') {
        // Handle OR conditions
        if (!Array.isArray(value) || value.length === 0) {
          throw new Error('$or must be a non-empty array');
        }

        const orConditions = [];
        for (const orCondition of value) {
          for (const [orKey, orValue] of Object.entries(orCondition)) {
            // Check if field has table prefix
            const parts = orKey.split('.');
            let mappedField;
            
            if (parts.length === 2) {
              // Field has table prefix: table.field
              const [table, fieldName] = parts;
              const dbField = this._mapFieldToDb(table, fieldName);
              mappedField = `${table}.${dbField}`;
            } else {
              // No table prefix, assume main table
              const dbField = this._mapFieldToDb(mainTable, orKey);
              mappedField = `${mainTable}.${dbField}`;
            }
            
            if (orValue === null) {
              orConditions.push(`${mappedField} IS NULL`);
            } else {
              orConditions.push(`${mappedField} = ?`);
              values.push(orValue);
            }
          }
        }

        if (orConditions.length > 0) {
          conditions.push(`(${orConditions.join(' OR ')})`);
        }
      } else {
        // Regular AND condition
        // Check if field has table prefix
        const parts = key.split('.');
        let mappedField;
        
        if (parts.length === 2) {
          // Field has table prefix: table.field
          const [table, fieldName] = parts;
          const dbField = this._mapFieldToDb(table, fieldName);
          mappedField = `${table}.${dbField}`;
        } else {
          // No table prefix, assume main table
          const dbField = this._mapFieldToDb(mainTable, key);
          mappedField = `${mainTable}.${dbField}`;
        }
        
        if (value === null) {
          conditions.push(`${mappedField} IS NULL`);
        } else {
          conditions.push(`${mappedField} = ?`);
          values.push(value);
        }
      }
    }

    return {
      whereClause: conditions.join(' AND '),
      whereValues: values
    };
  }

  /**
   * Helper method to map field name to database column
   * @private
   */
  _mapFieldToDb(table, field) {
    const mappingInfo = require('./universalFieldMapping').fieldMappings[table];
    if (!mappingInfo) return field;
    
    // Convert camelCase to snake_case
    return field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Helper method to map database column to field name
   * @private
   */
  _mapFieldToJs(table, column) {
    const mappingInfo = require('./universalFieldMapping').fieldMappings[table];
    if (!mappingInfo) return column;
    
    // Convert snake_case to camelCase
    return column.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
  }
}

module.exports = QueryBuilder;