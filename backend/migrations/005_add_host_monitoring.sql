-- Host Monitoring Tables Migration
-- Date: 2025-09-02
-- Description: Add host-specific SNMP monitoring support with separate configuration

-- Host SNMP Configurations
CREATE TABLE IF NOT EXISTS host_snmp_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  host_id INT NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  version VARCHAR(10) DEFAULT '2c',
  community VARCHAR(255),
  port INT DEFAULT 161,
  username VARCHAR(255),
  auth_protocol VARCHAR(10),
  auth_password VARCHAR(255),
  priv_protocol VARCHAR(10),
  priv_password VARCHAR(255),
  poll_interval INT DEFAULT 60,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE,
  UNIQUE KEY unique_host_config (host_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Host Monitoring Data
CREATE TABLE IF NOT EXISTS host_monitoring_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  host_id INT NOT NULL,
  status VARCHAR(50) DEFAULT 'offline',
  last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cpu_usage FLOAT,
  memory_used BIGINT,
  memory_total BIGINT,
  memory_percent FLOAT,
  temperature FLOAT,
  uptime_seconds BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE,
  INDEX idx_host_created (host_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Host Disk Metrics
CREATE TABLE IF NOT EXISTS host_disk_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  monitoring_data_id INT NOT NULL,
  name VARCHAR(255),
  used BIGINT,
  total BIGINT,
  percent FLOAT,
  FOREIGN KEY (monitoring_data_id) REFERENCES host_monitoring_data(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Host Network Metrics  
CREATE TABLE IF NOT EXISTS host_network_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  monitoring_data_id INT NOT NULL,
  name VARCHAR(255),
  rx_bytes_per_sec BIGINT,
  tx_bytes_per_sec BIGINT,
  FOREIGN KEY (monitoring_data_id) REFERENCES host_monitoring_data(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add comment to track migration purpose
-- This migration adds host-specific monitoring tables separate from the global SNMP tables
-- to support individual host monitoring panels with their own configurations
