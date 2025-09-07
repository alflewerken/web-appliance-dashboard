-- Migration: Create metric_definitions table for unified metric architecture
-- Date: 2025-09-07
-- Purpose: Centralize metric configuration for consistent processing

DROP TABLE IF EXISTS metric_definitions;

CREATE TABLE metric_definitions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  metric_key VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  data_type VARCHAR(20) NOT NULL DEFAULT 'gauge', -- gauge, counter, percentage
  
  -- Storage configuration
  storage_unit VARCHAR(20) NOT NULL, -- bytes, load, percent, count, etc.
  storage_multiplier DECIMAL(20,6) DEFAULT 1.0, -- for unit conversion on storage
  
  -- Display configuration  
  display_unit VARCHAR(20) NOT NULL, -- GB, %, load, etc.
  display_format VARCHAR(50) DEFAULT '{value} {unit}', -- format template
  decimal_places INT DEFAULT 2,
  
  -- Normalization configuration
  normalization_type VARCHAR(20) DEFAULT 'none', -- none, percentage, ratio, delta
  normalization_max DECIMAL(20,2) DEFAULT NULL, -- max value for percentage calc
  normalization_base VARCHAR(100) DEFAULT NULL, -- reference metric for relative calculations
  
  -- Graph configuration
  graph_min DECIMAL(20,2) DEFAULT 0,
  graph_max DECIMAL(20,2) DEFAULT 100,
  graph_color VARCHAR(7) DEFAULT '#3B82F6',
  graph_type VARCHAR(20) DEFAULT 'line', -- line, area, bar
  
  -- Metadata
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_category (category),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert standard metric definitions
INSERT INTO metric_definitions (
  metric_key, display_name, category, unit, data_type,
  storage_unit, display_unit, display_format, decimal_places,
  normalization_type, normalization_max, graph_max, graph_color,
  description
) VALUES
-- CPU Metrics
('cpu.user', 'CPU User', 'cpu', '%', 'gauge', 
 'percent', '%', '{value}%', 1,
 'none', NULL, 100, '#3B82F6',
 'CPU time spent in user mode'),
 
('cpu.system', 'CPU System', 'cpu', '%', 'gauge',
 'percent', '%', '{value}%', 1,
 'none', NULL, 100, '#EF4444',
 'CPU time spent in kernel mode'),
 
('cpu.idle', 'CPU Idle', 'cpu', '%', 'gauge',
 'percent', '%', '{value}%', 1,
 'none', NULL, 100, '#10B981',
 'CPU time spent idle'),

('cpu.load1', 'Load Average (1m)', 'cpu', 'load', 'gauge',
 'load', 'load', '{value}', 2,
 'ratio', 10, 10, '#F59E0B',
 '1-minute load average'),
 
('cpu.load5', 'Load Average (5m)', 'cpu', 'load', 'gauge',
 'load', 'load', '{value}', 2,
 'ratio', 10, 10, '#F97316',
 '5-minute load average'),
 
('cpu.load15', 'Load Average (15m)', 'cpu', 'load', 'gauge',
 'load', 'load', '{value}', 2,
 'ratio', 10, 10, '#DC2626',
 '15-minute load average'),

-- Memory Metrics
('memory.total', 'Total Memory', 'memory', 'bytes', 'gauge',
 'bytes', 'GB', '{value} GB', 2,
 'none', NULL, NULL, '#6B7280',
 'Total system memory'),
 
('memory.used', 'Memory Used', 'memory', '%', 'gauge',
 'percent', '%', '{value}%', 1,
 'none', NULL, 100, '#EF4444',
 'Percentage of memory used'),
 
('memory.free', 'Memory Free', 'memory', '%', 'gauge',
 'percent', '%', '{value}%', 1,
 'none', NULL, 100, '#10B981',
 'Percentage of memory free'),
 
('memory.percent', 'Memory Usage', 'memory', '%', 'gauge',
 'percent', '%', '{value}%', 1,
 'none', NULL, 100, '#3B82F6',
 'Overall memory usage percentage'),

-- Process Metrics
('process.total', 'Total Processes', 'process', 'count', 'gauge',
 'count', 'processes', '{value}', 0,
 'none', NULL, 1000, '#8B5CF6',
 'Total number of processes'),
 
('process.running', 'Running Processes', 'process', 'count', 'gauge',
 'count', 'processes', '{value}', 0,
 'none', NULL, 100, '#10B981',
 'Number of running processes'),

-- Network Metrics (examples - will be expanded dynamically)
('network.eth0.in', 'Network In (eth0)', 'network', 'bytes', 'counter',
 'bytes', 'MB/s', '{value} MB/s', 2,
 'delta', NULL, NULL, '#3B82F6',
 'Network bytes received on eth0'),
 
('network.eth0.out', 'Network Out (eth0)', 'network', 'bytes', 'counter',
 'bytes', 'MB/s', '{value} MB/s', 2,
 'delta', NULL, NULL, '#EF4444',
 'Network bytes sent on eth0'),

-- Disk Metrics (examples - will be expanded dynamically)
('disk./.usage', 'Root Disk Usage', 'disk', '%', 'gauge',
 'percent', '%', '{value}%', 1,
 'none', NULL, 100, '#F59E0B',
 'Root filesystem usage percentage'),
 
('disk./.available', 'Root Disk Available', 'disk', 'bytes', 'gauge',
 'bytes', 'GB', '{value} GB', 2,
 'none', NULL, NULL, '#10B981',
 'Root filesystem available space');

-- Add helper view for metric processing
CREATE OR REPLACE VIEW v_metric_config AS
SELECT 
  metric_key,
  display_name,
  category,
  unit,
  data_type,
  storage_unit,
  display_unit,
  display_format,
  decimal_places,
  normalization_type,
  normalization_max,
  normalization_base,
  graph_min,
  graph_max,
  graph_color,
  graph_type
FROM metric_definitions
WHERE is_active = true;
