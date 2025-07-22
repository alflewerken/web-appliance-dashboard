-- Guacamole Database Initialization with Auto-SFTP
-- This file initializes the database and enables SFTP by default

-- First, let Guacamole create its standard schema
-- (This happens automatically)

-- Then add our custom SFTP configuration
-- Wait a moment for the standard tables to be created
\c guacamole_db;

-- Create a stored procedure to auto-configure SFTP
CREATE OR REPLACE FUNCTION auto_configure_sftp()
RETURNS void AS $$
DECLARE
    conn RECORD;
BEGIN
    -- Loop through all connections
    FOR conn IN 
        SELECT c.connection_id,
               c.connection_name,
               c.protocol,
               host.parameter_value as hostname,
               usr.parameter_value as username,
               pwd.parameter_value as password
        FROM guacamole_connection c
        LEFT JOIN guacamole_connection_parameter host 
            ON c.connection_id = host.connection_id 
            AND host.parameter_name = 'hostname'
        LEFT JOIN guacamole_connection_parameter usr 
            ON c.connection_id = usr.connection_id 
            AND usr.parameter_name = 'username'
        LEFT JOIN guacamole_connection_parameter pwd 
            ON c.connection_id = pwd.connection_id 
            AND pwd.parameter_name = 'password'
        WHERE c.protocol IN ('rdp', 'vnc', 'ssh')
    LOOP
        -- Enable SFTP
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES (conn.connection_id, 'enable-sftp', 'true')
        ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = 'true';
        
        -- Set SFTP hostname (same as connection hostname)
        IF conn.hostname IS NOT NULL THEN
            INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
            VALUES (conn.connection_id, 'sftp-hostname', conn.hostname)
            ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = conn.hostname;
        END IF;
        
        -- Set SFTP port
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES (conn.connection_id, 'sftp-port', '22')
        ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = '22';
        
        -- Set SFTP username (same as connection username or default)
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES (conn.connection_id, 'sftp-username', COALESCE(conn.username, 'alflewerken'))
        ON CONFLICT (connection_id, parameter_name) 
        DO UPDATE SET parameter_value = COALESCE(conn.username, 'alflewerken');
        
        -- Set SFTP password (same as connection password if available)
        IF conn.password IS NOT NULL THEN
            INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
            VALUES (conn.connection_id, 'sftp-password', conn.password)
            ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = conn.password;
        END IF;
        
        -- Set upload directory
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES (conn.connection_id, 'sftp-root-directory', '/home/' || COALESCE(conn.username, 'alflewerken') || '/Desktop')
        ON CONFLICT (connection_id, parameter_name) 
        DO UPDATE SET parameter_value = '/home/' || COALESCE(conn.username, 'alflewerken') || '/Desktop';
        
        -- Enable file transfer
        INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
        VALUES 
            (conn.connection_id, 'sftp-disable-download', 'false'),
            (conn.connection_id, 'sftp-disable-upload', 'false')
        ON CONFLICT (connection_id, parameter_name) DO UPDATE SET parameter_value = 'false';
        
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new connections
CREATE OR REPLACE FUNCTION enable_sftp_on_new_connection()
RETURNS TRIGGER AS $$
BEGIN
    -- Basic SFTP enable
    INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
    VALUES (NEW.connection_id, 'enable-sftp', 'true');
    
    -- Set default values that will be updated by auto_configure_sftp
    INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
    VALUES 
        (NEW.connection_id, 'sftp-port', '22'),
        (NEW.connection_id, 'sftp-disable-download', 'false'),
        (NEW.connection_id, 'sftp-disable-upload', 'false');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS sftp_enable_trigger ON guacamole_connection;
CREATE TRIGGER sftp_enable_trigger
AFTER INSERT ON guacamole_connection
FOR EACH ROW
EXECUTE FUNCTION enable_sftp_on_new_connection();

-- Schedule automatic configuration (this needs to be run after Guacamole creates connections)
-- We'll call this function from a startup script
