-- Add custom_names column to host_metrics_logging table
ALTER TABLE host_metrics_logging
ADD COLUMN custom_names JSON DEFAULT NULL COMMENT 'Custom names for metrics' AFTER config;
