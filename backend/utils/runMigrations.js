const pool = require('../utils/database');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./logger');

async function runMigrations() {
  logger.info('Running database migrations...');

  try {
    // Create migrations table if it doesn't exist
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of migration files
    const migrationDir = path.join(__dirname, '../migrations');
    const files = await fs.readdir(migrationDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

    // Check which migrations have been run
    const [executed] = await pool.execute('SELECT filename FROM migrations');
    const executedFiles = new Set(executed.map(row => row.filename));

    // Run pending migrations
    for (const file of sqlFiles) {
      if (!executedFiles.has(file)) {
        logger.info(`Running migration: ${file}`);

        const sqlPath = path.join(migrationDir, file);
        const sql = await fs.readFile(sqlPath, 'utf8');

        // Split by semicolon and execute each statement
        const statements = sql.split(';').filter(s => s.trim());

        for (const statement of statements) {
          try {
            await pool.execute(statement);
          } catch (error) {
            // Handle "IF NOT EXISTS" errors gracefully
            if (!error.message.includes('Duplicate column name')) {
              throw error;
            }
          }
        }

        // Record migration as executed
        await pool.execute('INSERT INTO migrations (filename) VALUES (?)', [
          file,
        ]);

        logger.info(`Migration ${file} completed`);
      }
    }

    logger.info('All migrations completed');
  } catch (error) {
    logger.error('Migration error:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = runMigrations;
