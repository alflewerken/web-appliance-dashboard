/**
 * Führt die Proxy-Migration aus
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

async function runMigration() {
    console.log('🚀 Starting proxy migration...\n');
    
    let connection;
    
    try {
        // Verbindung zur Datenbank herstellen
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'dashboard_user',
            password: process.env.DB_PASSWORD || 'dashboard_pass123',
            database: process.env.DB_NAME || 'appliance_dashboard',
            multipleStatements: true
        });
        
        console.log('✅ Connected to database');
        
        // Migration SQL lesen
        const migrationPath = path.join(__dirname, '../migrations/add-proxy-fields.sql');
        const migrationSQL = await fs.readFile(migrationPath, 'utf8');
        
        console.log('📋 Running migration...');
        
        // Migration ausführen
        await connection.query(migrationSQL);
        
        console.log('✅ Migration completed successfully!');
        
        // Überprüfen, ob die Spalten hinzugefügt wurden
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'services'
            AND COLUMN_NAME IN ('url', 'hostname', 'username', 'protocol', 'targetHost')
        `, [process.env.DB_NAME || 'appliance_dashboard']);
        
        console.log(`\n✅ Added ${columns.length} new columns to services table`);
        
        // Überprüfen, ob AuditLogs-Tabelle erstellt wurde
        const [tables] = await connection.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'AuditLogs'
        `, [process.env.DB_NAME || 'appliance_dashboard']);
        
        if (tables.length > 0) {
            console.log('✅ AuditLogs table created successfully');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Migration ausführen
runMigration();