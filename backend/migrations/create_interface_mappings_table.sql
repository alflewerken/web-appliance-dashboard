-- Neue Tabelle für dynamische Interface-Mappings
-- Diese Tabelle wird bei jedem SNMP-Poll aktualisiert
CREATE TABLE IF NOT EXISTS host_interface_mappings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  host_id INT NOT NULL,
  interface_index INT NOT NULL,
  interface_name VARCHAR(255),
  interface_descr VARCHAR(255),
  interface_type VARCHAR(100),
  interface_speed BIGINT,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_host_interface (host_id, interface_index),
  FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE,
  INDEX idx_host_lastseen (host_id, last_seen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Clean up old mappings (interfaces not seen in 24 hours)
-- This could be run periodically
-- DELETE FROM host_interface_mappings WHERE last_seen < NOW() - INTERVAL 24 HOUR;
