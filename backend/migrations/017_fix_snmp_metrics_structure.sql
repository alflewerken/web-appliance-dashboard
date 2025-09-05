-- Fix SNMP metrics table for flexible metric storage
-- Date: 2025-09-05
-- Description: Add flexible metric storage columns to snmp_metrics table

-- Add new columns for flexible metric storage
ALTER TABLE snmp_metrics 
ADD COLUMN IF NOT EXISTS metric_name VARCHAR(255) AFTER host_id,
ADD COLUMN IF NOT EXISTS metric_key VARCHAR(255) AFTER metric_name,
ADD COLUMN IF NOT EXISTS metric_value VARCHAR(500) AFTER metric_key,
ADD COLUMN IF NOT EXISTS unit VARCHAR(50) AFTER metric_value,
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER unit;

-- Add updated_at to host_monitoring_data
ALTER TABLE host_monitoring_data
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_metric_key ON snmp_metrics(host_id, metric_key, timestamp);
CREATE INDEX IF NOT EXISTS idx_metric_timestamp ON snmp_metrics(timestamp);

-- Comment for documentation
-- The snmp_metrics table now supports flexible metric storage:
-- metric_name: Human-readable name (can be customized)
-- metric_key: Technical metric identifier (e.g., cpu.user, memory.used)
-- metric_value: The actual value as string
-- unit: Unit of measurement (%, KB, etc.)
-- timestamp: When the metric was collected
