const pool = require('./utils/database');
const { hashPassword } = require('./utils/auth');

async function createInitialAdmin() {
  try {
    // Check if any admin exists
    const [existingAdmins] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE role = ?',
      ['admin']
    );

    if (existingAdmins[0].count > 0) {
      return;
    }

    // Create default admin
    const defaultPassword = 'admin123';
    const passwordHash = await hashPassword(defaultPassword);

    await pool.execute(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['admin', 'admin@localhost', passwordHash, 'admin']
    );
  } catch (error) {
    console.error('Failed to create admin user:', error);
    process.exit(1);
  } finally {
    process.exit();
  }
}

// Run if called directly
if (require.main === module) {
  createInitialAdmin();
}

module.exports = createInitialAdmin;
