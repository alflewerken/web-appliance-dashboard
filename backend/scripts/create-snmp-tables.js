#!/usr/bin/env node

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function createSNMPTables() {
  let connection;
  
  try {
    // Create connection using environment variables
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'appliance_dashboard'
    });

    console.log('Connected to database');

    // Create host_snmp_configs table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS host_snmp_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hostId INT NOT NULL,
        enabled BOOLEAN DEFAULT FALSE,
        version VARCHAR(10) DEFAULT '2c',
        community VARCHAR(255) DEFAULT 'public',
        port INT DEFAULT 161,
        username VARCHAR(255),
        authProtocol VARCHAR(10),
        authPassword VARCHAR(255),
        privProtocol VARCHAR(10),
        privPassword VARCHAR(255),
        pollInterval INT DEFAULT 60,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (hostId) REFERENCES hosts(id) ON DELETE CASCADE,
        UNIQUE KEY unique_host (hostId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    await connection.execute(createTableSQL);
    console.log('✅ Created host_snmp_configs table');

    // Create host_monitoring_data table for storing historical metrics
    const createMetricsTableSQL = `
      CREATE TABLE IF NOT EXISTS host_monitoring_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hostId INT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        cpu FLOAT,
        memoryUsed BIGINT,
        memoryTotal BIGINT,
        diskUsed BIGINT,
        diskTotal BIGINT,
        networkRxBytes BIGINT,
        networkTxBytes BIGINT,
        temperature FLOAT,
        uptime INT,
        status VARCHAR(20) DEFAULT 'offline',
        FOREIGN KEY (hostId) REFERENCES hosts(id) ON DELETE CASCADE,
        INDEX idx_host_timestamp (hostId, timestamp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    await connection.execute(createMetricsTableSQL);
    console.log('✅ Created host_monitoring_data table');

    console.log('✅ SNMP tables migration completed successfully');

  } catch (error) {
    console.error('❌ Error creating SNMP tables:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the migration
createSNMPTables();
