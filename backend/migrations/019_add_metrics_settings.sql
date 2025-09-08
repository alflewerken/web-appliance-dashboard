-- Migration: 019_add_metrics_settings.sql
-- Date: 2025-09-08
-- Description: Add fields for saving user's metrics selection and time range preferences
-- Author: Web Appliance Dashboard Team

-- Add columns to host_metrics_logging table for storing user preferences
ALTER TABLE host_metrics_logging 
ADD COLUMN IF NOT EXISTS selected_metrics JSON DEFAULT NULL 
    COMMENT 'User-selected metrics for the history view',
ADD COLUMN IF NOT EXISTS default_time_range VARCHAR(10) DEFAULT '15m' 
    COMMENT 'Default time range for the metrics history view';

-- Add index for faster queries when loading settings
ALTER TABLE host_metrics_logging 
ADD INDEX IF NOT EXISTS idx_host_settings (host_id, updated_at);

-- Update existing records to have the default time range
UPDATE host_metrics_logging 
SET default_time_range = '15m' 
WHERE default_time_range IS NULL;
