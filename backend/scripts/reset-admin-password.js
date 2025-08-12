/**
 * Reset admin password for testing
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../utils/database');

async function resetAdminPassword() {
    try {
        // Neues Passwort
        const newPassword = 'admin123';
        const passwordHash = await bcrypt.hash(newPassword, 10);
        
        // Update admin password
        await pool.execute(
            'UPDATE users SET password_hash = ? WHERE username = ?',
            [passwordHash, 'admin']
        );
        
        console.log('✅ Admin password reset to:', newPassword);
        console.log('Username: admin');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

resetAdminPassword();