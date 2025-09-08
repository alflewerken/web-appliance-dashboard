-- Migration: 020_add_disk_configurations.sql
-- Date: 2025-09-08
-- Description: Add table for storing disk configurations per host
-- Author: Web Appliance Dashboard Team

-- Create table for disk configurations
CREATE TABLE IF NOT EXISTS host_disk_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  host_id INT NOT NULL,
  disk_index VARCHAR(10) NOT NULL,
  disk_name VARCHAR(255) DEFAULT NULL,
  total_size_gb DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_host_disk (host_id, disk_index),
  FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE,
  INDEX idx_host_disk (host_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert known disk configurations
INSERT INTO host_disk_config (host_id, disk_index, disk_name, total_size_gb) VALUES
(6, '0', 'Macintosh HD', 7449.2),  -- MacbookPro (Alf's current machine)
(8, '0', 'Macintosh HD', 233.5)     -- Macbook (Alf's old machine)
ON DUPLICATE KEY UPDATE 
  disk_name = VALUES(disk_name),
  total_size_gb = VALUES(total_size_gb);
