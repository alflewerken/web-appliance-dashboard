/**
 * Beispiel-Erweiterung für QueryBuilder mit erweiterten Features
 * Zeigt, wie aufwändig die Implementierung wäre
 */

class ExtendedQueryBuilder extends QueryBuilder {
  
  /**
   * FEATURE 1: OR-Bedingungen (Aufwand: 2-3 Stunden)
   */
  _buildWhereClause(where, table) {
    const values = [];
    let whereClause = '';
    
    // Unterstützt $or operator
    if (where.$or) {
      const orConditions = where.$or.map(condition => {
        const mapped = mapJsToDbForTable(table, condition);
        const fields = Object.keys(mapped).map(field => {
          values.push(mapped[field]);
          return `${field} = ?`;
        });
        return `(${fields.join(' AND ')})`;
      });
      whereClause = orConditions.join(' OR ');
    } 
    // Standard AND-Bedingungen
    else {
      const mapped = mapJsToDbForTable(table, where);
      const fields = Object.keys(mapped).map(field => {
        values.push(mapped[field]);
        return `${field} = ?`;
      });
      whereClause = fields.join(' AND ');
    }
    
    return { whereClause, values };
  }

  /**
   * FEATURE 2: JOINs (Aufwand: 4-6 Stunden)
   */
  async selectWithJoin(config) {
    const {
      from,
      select = '*',
      joins = [],
      where = {},
      groupBy = null,
      orderBy = null,
      limit = null
    } = config;
    
    // Build SELECT clause
    let sql = `SELECT ${Array.isArray(select) ? select.join(', ') : select}`;
    sql += ` FROM ${from}`;
    
    // Build JOINs
    const values = [];
    joins.forEach(join => {
      const { type = 'LEFT', table, on } = join;
      sql += ` ${type} JOIN ${table} ON ${on}`;
    });
    
    // Build WHERE
    if (Object.keys(where).length > 0) {
      const { whereClause, values: whereValues } = this._buildWhereClause(where, from);
      sql += ` WHERE ${whereClause}`;
      values.push(...whereValues);
    }
    
    // GROUP BY
    if (groupBy) {
      sql += ` GROUP BY ${Array.isArray(groupBy) ? groupBy.join(', ') : groupBy}`;
    }
    
    // ORDER BY
    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    }
    
    // LIMIT
    if (limit) {
      sql += ` LIMIT ${limit}`;
    }
    
    const [rows] = await this.pool.execute(sql, values);
    return rows;
  }

  /**
   * FEATURE 3: CASE Statements (Aufwand: 3-4 Stunden)
   */
  selectWithCase(table, config) {
    const { caseField, cases, defaultValue, alias } = config;
    
    let caseStatement = `CASE ${caseField}`;
    cases.forEach(({ when, then }) => {
      caseStatement += ` WHEN '${when}' THEN ${then}`;
    });
    if (defaultValue !== undefined) {
      caseStatement += ` ELSE ${defaultValue}`;
    }
    caseStatement += ` END`;
    
    if (alias) {
      caseStatement += ` AS ${alias}`;
    }
    
    return caseStatement;
  }

  /**
   * FEATURE 4: Aggregat-Funktionen (Aufwand: 2-3 Stunden)
   */
  async aggregate(table, config) {
    const {
      select = [],  // [{ func: 'COUNT', field: '*', alias: 'total' }]
      where = {},
      groupBy = null,
      having = null
    } = config;
    
    // Build SELECT with aggregates
    const selectClauses = select.map(s => {
      let clause = `${s.func}(${s.field})`;
      if (s.alias) clause += ` AS ${s.alias}`;
      return clause;
    });
    
    let sql = `SELECT ${selectClauses.join(', ')} FROM ${table}`;
    const values = [];
    
    // WHERE
    if (Object.keys(where).length > 0) {
      const { whereClause, values: whereValues } = this._buildWhereClause(where, table);
      sql += ` WHERE ${whereClause}`;
      values.push(...whereValues);
    }
    
    // GROUP BY
    if (groupBy) {
      sql += ` GROUP BY ${Array.isArray(groupBy) ? groupBy.join(', ') : groupBy}`;
    }
    
    // HAVING
    if (having) {
      sql += ` HAVING ${having}`;
    }
    
    const [rows] = await this.pool.execute(sql, values);
    return rows;
  }

  /**
   * FEATURE 5: Transaktionen (Aufwand: 3-4 Stunden)
   */
  async transaction(callback) {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Erstelle temporären QueryBuilder mit dieser Connection
      const txQueryBuilder = new ExtendedQueryBuilder(connection);
      
      // Führe Callback mit Transaktions-QueryBuilder aus
      const result = await callback(txQueryBuilder);
      
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * FEATURE 6: Batch-Operationen (Aufwand: 2-3 Stunden)
   */
  async batchInsert(table, dataArray) {
    if (!dataArray.length) return { affectedRows: 0 };
    
    // Map first item to get column names
    const firstItem = mapJsToDbForTable(table, dataArray[0]);
    const columns = Object.keys(firstItem);
    
    // Build VALUES clause for all items
    const valuePlaceholders = dataArray.map(() => 
      `(${columns.map(() => '?').join(', ')})`
    ).join(', ');
    
    // Flatten all values
    const values = dataArray.flatMap(item => {
      const mapped = mapJsToDbForTable(table, item);
      return columns.map(col => mapped[col]);
    });
    
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${valuePlaceholders}`;
    const [result] = await this.pool.execute(sql, values);
    return result;
  }

  /**
   * FEATURE 7: Subqueries (Aufwand: 4-5 Stunden)
   */
  async selectWithSubquery(config) {
    const { from, select, where, subqueries = [] } = config;
    
    let sql = `SELECT ${select} FROM ${from}`;
    const values = [];
    
    // Handle subqueries in WHERE
    if (where) {
      let whereClause = '';
      for (const [key, value] of Object.entries(where)) {
        if (value.$in) {
          // Subquery für IN operator
          whereClause += `${key} IN (${value.$in.query})`;
          values.push(...(value.$in.values || []));
        } else if (value.$exists) {
          // EXISTS subquery
          whereClause += `EXISTS (${value.$exists.query})`;
          values.push(...(value.$exists.values || []));
        } else {
          // Normal condition
          whereClause += `${key} = ?`;
          values.push(value);
        }
      }
      
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
      }
    }
    
    const [rows] = await this.pool.execute(sql, values);
    return rows;
  }
}

// Beispiel-Verwendung:
/*
const db = new ExtendedQueryBuilder(pool);

// 1. OR-Bedingung
const users = await db.select('users', {
  $or: [
    { username: 'admin' },
    { email: 'admin@example.com' }
  ]
});

// 2. JOIN
const userSessions = await db.selectWithJoin({
  from: 'users u',
  select: ['u.id', 'u.username', 'COUNT(s.id) as session_count'],
  joins: [
    {
      type: 'LEFT',
      table: 'sessions s',
      on: 'u.id = s.user_id'
    }
  ],
  groupBy: ['u.id', 'u.username']
});

// 3. Aggregation
const stats = await db.aggregate('users', {
  select: [
    { func: 'COUNT', field: '*', alias: 'total' },
    { func: 'COUNT', field: 'DISTINCT role', alias: 'unique_roles' }
  ],
  groupBy: 'role'
});

// 4. Transaktion
const result = await db.transaction(async (tx) => {
  const user = await tx.insert('users', { username: 'test' });
  await tx.insert('user_settings', { userId: user.insertId });
  return user;
});

// 5. Batch Insert
await db.batchInsert('logs', [
  { message: 'Log 1', level: 'info' },
  { message: 'Log 2', level: 'error' },
  { message: 'Log 3', level: 'warning' }
]);
*/

module.exports = ExtendedQueryBuilder;
