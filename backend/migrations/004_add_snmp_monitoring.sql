-- SNMP Monitoring Tables Migration
-- Date: 2025-09-02
-- Description: Add SNMP monitoring support to web-appliance-dashboard

-- Add SNMP columns to hosts table
ALTER TABLE hosts 
ADD COLUMN IF NOT EXISTS snmp_enabled TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS snmp_community VARCHAR(100) DEFAULT 'public',
ADD COLUMN IF NOT EXISTS snmp_port INT DEFAULT 161,
ADD COLUMN IF NOT EXISTS snmp_version VARCHAR(10) DEFAULT 'v2c',
ADD COLUMN IF NOT EXISTS snmp_status VARCHAR(20) DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS last_snmp_check DATETIME DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_snmp_error TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_metrics JSON DEFAULT NULL,
ADD COLUMN IF NOT EXISTS os_type VARCHAR(50) DEFAULT 'linux';

-- Create SNMP metrics table for historical data
CREATE TABLE IF NOT EXISTS snmp_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  host_id INT NOT NULL,
  uptime BIGINT DEFAULT 0,
  cpu_load DECIMAL(5,2) DEFAULT 0,
  cpu_percent DECIMAL(5,2) DEFAULT 0,
  memory_total BIGINT DEFAULT 0,
  memory_used BIGINT DEFAULT 0,
  memory_percent DECIMAL(5,2) DEFAULT 0,
  disk_total BIGINT DEFAULT 0,
  disk_used BIGINT DEFAULT 0,
  disk_percent DECIMAL(5,2) DEFAULT 0,
  process_count INT DEFAULT 0,
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE,
  INDEX idx_host_time (host_id, collected_at),
  INDEX idx_collected (collected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create SNMP interface statistics table
CREATE TABLE IF NOT EXISTS snmp_interfaces (
  id INT AUTO_INCREMENT PRIMARY KEY,
  host_id INT NOT NULL,
  interface_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'unknown',
  speed BIGINT DEFAULT 0,
  bytes_in BIGINT DEFAULT 0,
  bytes_out BIGINT DEFAULT 0,
  errors_in INT DEFAULT 0,
  errors_out INT DEFAULT 0,
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE,
  INDEX idx_host_interface (host_id, interface_name),
  INDEX idx_collected (collected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create SNMP errors table for debugging
CREATE TABLE IF NOT EXISTS snmp_errors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  host_id INT NOT NULL,
  error_type VARCHAR(50) NOT NULL,
  error_message TEXT,
  occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE,
  INDEX idx_host_error (host_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create SNMP thresholds table for alerting
CREATE TABLE IF NOT EXISTS snmp_thresholds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  host_id INT DEFAULT NULL,
  metric_name VARCHAR(50) NOT NULL,
  warning_value DECIMAL(10,2) DEFAULT NULL,
  critical_value DECIMAL(10,2) DEFAULT NULL,
  enabled TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE,
  UNIQUE KEY unique_host_metric (host_id, metric_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default thresholds (global, host_id = NULL)
INSERT INTO snmp_thresholds (host_id, metric_name, warning_value, critical_value) VALUES
(NULL, 'cpu_percent', 80, 95),
(NULL, 'memory_percent', 85, 95),
(NULL, 'disk_percent', 80, 90),
(NULL, 'process_count', 500, 1000)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- Create view for latest metrics per host
CREATE OR REPLACE VIEW snmp_latest_metrics AS
SELECT 
  h.id as host_id,
  h.hostname,
  h.ip,
  h.snmp_enabled,
  h.snmp_status,
  m.cpu_percent,
  m.memory_percent,
  m.disk_percent,
  m.process_count,
  m.uptime,
  m.collected_at
FROM hosts h
LEFT JOIN (
  SELECT 
    m1.*
  FROM snmp_metrics m1
  INNER JOIN (
    SELECT host_id, MAX(collected_at) as max_time
    FROM snmp_metrics
    GROUP BY host_id
  ) m2 ON m1.host_id = m2.host_id AND m1.collected_at = m2.max_time
) m ON h.id = m.host_id
WHERE h.snmp_enabled = 1;