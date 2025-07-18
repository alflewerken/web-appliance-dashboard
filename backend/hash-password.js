const bcrypt = require('bcryptjs');

async function hashPassword() {
  const password = process.argv[2] || 'admin123';
  const hash = await bcrypt.hash(password, 10);
  console.log(`Password: ${password}`);
  console.log(`Hash: ${hash}`);
}

hashPassword().catch(console.error);
