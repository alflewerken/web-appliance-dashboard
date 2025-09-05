-- Cleanup SNMP metrics table - Remove unused legacy columns
-- Date: 2025-09-05
-- Description: Remove old fixed columns that are no longer used after switching to flexible metric storage

-- Drop the old fixed columns that are no longer needed
ALTER TABLE snmp_metrics 
DROP COLUMN IF EXISTS uptime,
DROP COLUMN IF EXISTS cpu_load,
DROP COLUMN IF EXISTS cpu_percent,
DROP COLUMN IF EXISTS memory_total,
DROP COLUMN IF EXISTS memory_used,
DROP COLUMN IF EXISTS memory_percent,
DROP COLUMN IF EXISTS disk_total,
DROP COLUMN IF EXISTS disk_used,
DROP COLUMN IF EXISTS disk_percent,
DROP COLUMN IF EXISTS process_count,
DROP COLUMN IF EXISTS collected_at;

-- The table now only contains the flexible columns:
-- id, host_id, metric_name, metric_key, metric_value, unit, timestamp

-- Update indexes if needed (keep the existing ones)
-- Index idx_host_time was on (host_id, collected_at), needs update
DROP INDEX IF EXISTS idx_host_time ON snmp_metrics;
DROP INDEX IF EXISTS idx_collected ON snmp_metrics;

-- Create new index on host_id and timestamp
CREATE INDEX IF NOT EXISTS idx_host_timestamp ON snmp_metrics(host_id, timestamp);

-- Comment for documentation
-- The snmp_metrics table is now fully flexible and supports any metric type
-- Old structure with fixed columns has been completely removed
