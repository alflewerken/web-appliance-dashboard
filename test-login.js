const mysql = require('mysql2/promise');

async function testLogin() {
  const pool = mysql.createPool({
    host: 'database',
    port: 3306,
    user: 'appliance_user',
    password: '5360cdc96c966c19b5e4b57923adf6e6f4f140a4e33831eb7a4d073eaf5330d9',
    database: 'appliance_dashboard'
  });

  try {
    console.log('Testing database connection...');
    const [rows] = await pool.execute(
      'SELECT id, username, password, is_admin, is_active FROM users WHERE username = ?',
      ['admin']
    );
    
    console.log('Query result:', rows);
    
    if (rows.length > 0) {
      const user = rows[0];
      console.log('User found:', {
        id: user.id,
        username: user.username,
        password: user.password ? user.password.substring(0, 20) + '...' : 'NULL',
        is_admin: user.is_admin,
        is_active: user.is_active
      });
      
      const bcrypt = require('bcryptjs');
      const passwordMatch = await bcrypt.compare('admin123', user.password);
      console.log('Password match:', passwordMatch);
    } else {
      console.log('No user found!');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

testLogin();
