-- Fix host_monitoring_data table structure
-- Date: 2025-09-03
-- Description: Add metrics JSON column to store complex monitoring data

-- Add metrics column if it doesn't exist
ALTER TABLE host_monitoring_data 
ADD COLUMN IF NOT EXISTS metrics JSON AFTER uptime_seconds;

-- Comment for documentation
-- The metrics column stores all monitoring data as JSON including:
-- cpu, memory, disk arrays, network arrays, temperature, uptime
