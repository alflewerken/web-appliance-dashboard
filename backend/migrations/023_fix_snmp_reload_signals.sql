-- Migration: 023_fix_snmp_reload_signals.sql
-- Date: 2025-09-09
-- Description: Fix snmp_reload_signals table to allow NULL host_id for global signals
-- Author: Web Appliance Dashboard Team

-- Drop the old table (if it exists)
DROP TABLE IF EXISTS snmp_reload_signals;

-- Create new table with proper structure
-- host_id is nullable to allow global signals (reload-all)
-- Foreign key only validates non-NULL values
CREATE TABLE snmp_reload_signals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  host_id INT NULL COMMENT 'NULL for global signals, specific ID for host signals',
  signal_type ENUM('reload', 'stop', 'add', 'reload-all') DEFAULT 'reload',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY unique_host (host_id),
  FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE,
  INDEX idx_processed (processed_at),
  INDEX idx_signal_type (signal_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add comment to document the usage
ALTER TABLE snmp_reload_signals COMMENT = 'Signals for SNMP background polling service. NULL host_id = global signal';
