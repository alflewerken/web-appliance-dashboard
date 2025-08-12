-- Guacamole Database Initialization
-- This script ensures proper initialization of the Guacamole database

-- Connect to the database
\c guacamole_db;

-- Check if tables exist, if not we'll create them via separate schema files
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' 
                   AND table_name = 'guacamole_connection') THEN
        RAISE NOTICE 'Guacamole tables not found. Please ensure schema files are loaded.';
        -- The actual schema loading will be handled by docker-entrypoint-initdb.d scripts
    ELSE
        RAISE NOTICE 'Guacamole tables already exist.';
    END IF;
END $$;

-- Note: The actual schema and custom configuration are in separate files:
-- - 001-create-schema.sql: Creates the base Guacamole schema
-- - 002-create-admin-user.sql: Creates the default admin user
-- - custom-sftp.sql: Adds our custom SFTP configuration
