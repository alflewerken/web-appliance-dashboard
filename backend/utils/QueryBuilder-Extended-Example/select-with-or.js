  /**
   * Enhanced select with OR support
   * @param {string} table - Table name
   * @param {Object} where - WHERE conditions (supports $or)
   * @param {Array|Object} options - Query options or column list
   * @returns {Promise<Array>} Array of JavaScript objects
   */
  async select(table, where = {}, options = {}) {
    // Handle backwards compatibility: if options is an array, it's the columns
    if (Array.isArray(options)) {
      options = { columns: options };
    }
    
    const mappedWhere = where.$or ? where : mapJsToDbForTable(table, where);
    
    // Build SELECT clause
    let sql = `SELECT `;
    if (options.columns && options.columns.length > 0) {
      const mappedColumns = options.columns.map(col => {
        const dbCol = this._mapFieldToDb(table, col);
        return dbCol;
      });
      sql += mappedColumns.join(', ');
    } else {
      sql += '*';
    }
    sql += ` FROM ${table}`;
    
    const values = [];
    
    // Add WHERE clause with OR support
    if (where.$or && Array.isArray(where.$or)) {
      const orConditions = where.$or.map(condition => {
        const mapped = mapJsToDbForTable(table, condition);
        const fields = Object.keys(mapped).map(field => {
          values.push(mapped[field]);
          return `${field} = ?`;
        });
        return fields.length > 1 ? `(${fields.join(' AND ')})` : fields[0];
      });
      sql += ` WHERE ${orConditions.join(' OR ')}`;
    } 
    // Standard AND-based WHERE
    else if (Object.keys(mappedWhere).length > 0) {
      const whereFields = Object.keys(mappedWhere)
        .map(field => `${field} = ?`)
        .join(' AND ');
      sql += ` WHERE ${whereFields}`;
      values.push(...Object.values(mappedWhere));
    }
    
    // Add ORDER BY
    if (options.orderBy) {
      const orderField = this._mapFieldToDb(table, options.orderBy);
      sql += ` ORDER BY ${orderField}`;
      if (options.orderDir) {
        sql += ` ${options.orderDir.toUpperCase()}`;
      }
    }
    
    // Add LIMIT
    if (options.limit) {
      sql += ` LIMIT ${parseInt(options.limit)}`;
      if (options.offset) {
        sql += ` OFFSET ${parseInt(options.offset)}`;
      }
    }
    
    const [rows] = await this.pool.execute(sql, values);
    
    // Map results back to JS format
    return rows.map(row => mapDbToJsForTable(table, row));
  }