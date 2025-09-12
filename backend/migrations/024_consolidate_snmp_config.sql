-- Migration: Remove redundant SNMP fields from hosts table
-- Date: 2025-09-12
-- Description: Consolidate SNMP configuration in host_snmp_configs table only

-- Step 1: Ensure all SNMP data is in host_snmp_configs
-- First, create configs for hosts that have SNMP enabled but no config entry
INSERT INTO host_snmp_configs (host_id, enabled, version, community, port, created_at, updated_at)
SELECT 
    h.id,
    h.snmp_enabled,
    COALESCE(h.snmp_version, '2c'),
    COALESCE(h.snmp_community, 'public'),
    COALESCE(h.snmp_port, 161),
    NOW(),
    NOW()
FROM hosts h
WHERE h.snmp_enabled = 1
    AND NOT EXISTS (
        SELECT 1 FROM host_snmp_configs c WHERE c.host_id = h.id
    );

-- Step 2: Update existing configs with any data from hosts table (in case of discrepancies)
UPDATE host_snmp_configs c
INNER JOIN hosts h ON c.host_id = h.id
SET 
    c.enabled = COALESCE(h.snmp_enabled, c.enabled),
    c.version = COALESCE(h.snmp_version, c.version),
    c.community = COALESCE(h.snmp_community, c.community),
    c.port = COALESCE(h.snmp_port, c.port),
    c.updated_at = NOW()
WHERE h.snmp_enabled IS NOT NULL 
   OR h.snmp_version IS NOT NULL 
   OR h.snmp_community IS NOT NULL 
   OR h.snmp_port IS NOT NULL;

-- Step 3: Drop redundant columns from hosts table
ALTER TABLE hosts 
    DROP COLUMN IF EXISTS snmp_enabled,
    DROP COLUMN IF EXISTS snmp_community,
    DROP COLUMN IF EXISTS snmp_port,
    DROP COLUMN IF EXISTS snmp_version;

-- Note: Keeping snmp_status, last_snmp_check, last_snmp_error, last_metrics 
-- in hosts table as they are runtime status fields, not configuration

-- Step 4: Add index for better JOIN performance
ALTER TABLE host_snmp_configs
    ADD INDEX IF NOT EXISTS idx_enabled (enabled),
    ADD INDEX IF NOT EXISTS idx_host_enabled (host_id, enabled);
