const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkUsers() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'web_appliance_dashboard'
  });

  try {
    console.log('=== CHECKING USERS IN DATABASE ===\n');
    
    // Get all users
    const [users] = await connection.execute('SELECT id, username, email, role, is_active FROM users');
    
    console.log('Total users:', users.length);
    console.log('\nUser details:');
    console.table(users);
    
    // Check specific user "Alf"
    const [alfUser] = await connection.execute('SELECT * FROM users WHERE username = ?', ['Alf']);
    if (alfUser.length > 0) {
      console.log('\n=== USER "Alf" DETAILS ===');
      console.log('ID:', alfUser[0].id);
      console.log('Username:', alfUser[0].username);
      console.log('Email:', alfUser[0].email);
      console.log('Role:', alfUser[0].role);
      console.log('Is Active:', alfUser[0].is_active);
      console.log('Created:', alfUser[0].created_at);
      
      // Check role permissions
      const [permissions] = await connection.execute(
        'SELECT permission FROM role_permissions WHERE role = ?',
        [alfUser[0].role]
      );
      console.log('\nRole permissions for', alfUser[0].role + ':');
      permissions.forEach(p => console.log('  -', p.permission));
    } else {
      console.log('\nUser "Alf" not found in database!');
    }
    
    // Check admin users
    const [admins] = await connection.execute('SELECT username, role FROM users WHERE role = "Administrator"');
    console.log('\n=== ADMIN USERS ===');
    if (admins.length > 0) {
      console.table(admins);
    } else {
      console.log('No administrators found!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkUsers();
