-- Enhanced SNMP Monitoring Tables
-- Date: 2025-09-03
-- Description: Add disk metrics table and enhanced error tracking

-- Create SNMP disk metrics table
CREATE TABLE IF NOT EXISTS snmp_disk_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  host_id INT NOT NULL,
  device VARCHAR(100) NOT NULL,
  total_bytes BIGINT DEFAULT 0,
  used_bytes BIGINT DEFAULT 0,
  free_bytes BIGINT DEFAULT 0,
  percent_used DECIMAL(5,2) DEFAULT 0,
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE,
  INDEX idx_host_device (host_id, device),
  INDEX idx_collected (collected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add additional columns to hosts table for better device classification
ALTER TABLE hosts 
ADD COLUMN IF NOT EXISTS os_type VARCHAR(50) DEFAULT 'linux',
ADD COLUMN IF NOT EXISTS device_type VARCHAR(50) DEFAULT 'server';

-- Update snmp_status enum to include more states
ALTER TABLE hosts 
MODIFY COLUMN snmp_status VARCHAR(20) DEFAULT 'unknown' 
CHECK (snmp_status IN ('unknown', 'online', 'offline', 'auth_failed', 'timeout', 'unreachable', 'disabled'));

-- Add index for error tracking
ALTER TABLE snmp_errors 
ADD INDEX IF NOT EXISTS idx_error_type (error_type),
ADD INDEX IF NOT EXISTS idx_host_time_type (host_id, occurred_at, error_type);
