-- ====================================================================
-- Web Appliance Dashboard Database Initialization
-- Version: 1.5.0 - Removed deprecated ssh_hosts table
-- ====================================================================

-- Ensure UTF8MB4 character set for full Unicode support
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ====================================================================
-- AUTHENTICATION AND ROLE TABLES (MUST BE FIRST FOR FOREIGN KEYS)
-- ====================================================================

-- Create users table with enhanced role system
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Administrator', 'Power User', 'Benutzer', 'Gast') DEFAULT 'Benutzer',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    last_activity TIMESTAMP NULL COMMENT 'Last activity timestamp for session tracking',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_active (is_active)
);

-- Create role permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    permission VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_role_permission (role, permission),
    INDEX idx_role (role)
);

-- Insert default role permissions
INSERT IGNORE INTO role_permissions (role, permission, description) VALUES
('Administrator', 'all', 'Full system access'),
('Administrator', 'manage_users', 'Create, update, delete users'),
('Administrator', 'manage_appliances', 'Create, update, delete appliances'),
('Administrator', 'manage_system', 'System configuration and settings'),
('Administrator', 'view_audit_logs', 'View all audit logs'),
('Administrator', 'restore_backups', 'Restore from backups'),
('Power User', 'manage_appliances', 'Create, update, delete appliances'),
('Power User', 'control_appliances', 'Start, stop, restart appliances'),
('Power User', 'view_users', 'View user list'),
('Power User', 'view_audit_logs', 'View audit logs'),
('Benutzer', 'view_appliances', 'View appliances'),
('Benutzer', 'control_appliances', 'Start, stop, restart appliances'),
('Gast', 'view_appliances', 'View appliances only');

-- ====================================================================
-- CORE APPLICATION TABLES
-- ====================================================================

-- Create services table (for proxy services)
CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    port INT DEFAULT NULL,
    use_https BOOLEAN DEFAULT FALSE,
    status ENUM('active', 'inactive', 'maintenance') DEFAULT 'active',
    description TEXT DEFAULT NULL,
    ssh_host VARCHAR(255) DEFAULT NULL,
    ssh_port INT DEFAULT 22,
    ssh_username VARCHAR(255) DEFAULT NULL,
    ssh_password VARCHAR(255) DEFAULT NULL,
    ssh_private_key TEXT DEFAULT NULL,
    vnc_port INT DEFAULT 5900,
    vnc_password VARCHAR(255) DEFAULT NULL,
    rdp_port INT DEFAULT 3389,
    rdp_username VARCHAR(255) DEFAULT NULL,
    rdp_password VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_services_type (type),
    INDEX idx_services_status (status),
    INDEX idx_services_ip (ip_address)
) COMMENT='Services table for proxy and remote access configurations';

-- Create categories table (must be before appliances for foreign key)
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#007AFF',
    icon VARCHAR(50) DEFAULT 'folder',
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    order_index INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_name (name),
    INDEX idx_order (order_index)
);

-- Insert default categories
INSERT IGNORE INTO categories (name, color, icon, order_index) VALUES
('Uncategorized', '#8E8E93', 'folder', 999),
('System', '#FF3B30', 'server', 1),
('Network', '#007AFF', 'wifi', 2),
('Storage', '#5856D6', 'hard-drive', 3),
('Development', '#FF9500', 'code', 4),
('Monitoring', '#34C759', 'activity', 5);

-- Create main appliances table
CREATE TABLE IF NOT EXISTS appliances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(100) DEFAULT 'Uncategorized',
    description TEXT,
    url VARCHAR(500),
    icon VARCHAR(100) DEFAULT 'globe',
    color VARCHAR(7) DEFAULT '#007AFF',
    is_favorite BOOLEAN DEFAULT FALSE,
    last_used TIMESTAMP NULL,
    status_command TEXT COMMENT 'Command to check service status',
    start_command TEXT COMMENT 'Command to start service',
    stop_command TEXT COMMENT 'Command to stop service',
    restart_command TEXT COMMENT 'Command to restart service',
    service_status ENUM('running', 'stopped', 'error', 'offline', 'unknown') DEFAULT 'unknown',
    last_status_check TIMESTAMP NULL,
    auto_start BOOLEAN DEFAULT FALSE,
    ssh_connection VARCHAR(255) NULL,
    transparency DECIMAL(3,2) DEFAULT 0.95,
    blur_amount INT DEFAULT 10,
    open_mode_mini VARCHAR(20) DEFAULT '_self',
    open_mode_mobile VARCHAR(20) DEFAULT '_self',
    open_mode_desktop VARCHAR(20) DEFAULT '_self',
    remote_desktop_enabled BOOLEAN DEFAULT FALSE COMMENT 'Whether remote desktop is enabled',
    remote_protocol ENUM('vnc', 'rdp') DEFAULT 'vnc' COMMENT 'Remote desktop protocol',
    remote_host VARCHAR(255) DEFAULT NULL COMMENT 'Remote desktop host address',
    remote_port INT DEFAULT NULL COMMENT 'Remote desktop port',
    remote_username VARCHAR(255) DEFAULT NULL COMMENT 'Remote desktop username',
    remote_password_encrypted TEXT DEFAULT NULL COMMENT 'Encrypted remote desktop password',
    remote_desktop_type VARCHAR(50) DEFAULT 'guacamole' COMMENT 'Type of remote desktop (guacamole, rustdesk)',
    rustdesk_id VARCHAR(20) DEFAULT NULL COMMENT 'RustDesk device ID',
    rustdesk_password_encrypted TEXT DEFAULT NULL COMMENT 'Encrypted RustDesk password',
    rustdesk_installed BOOLEAN DEFAULT FALSE,
    rustdesk_installation_date DATETIME DEFAULT NULL,
    guacamole_performance_mode VARCHAR(20) DEFAULT 'balanced' COMMENT 'Guacamole performance mode',
    order_index INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    background_image VARCHAR(500) COMMENT 'Path or URL to background image',
    
    INDEX idx_category (category),
    INDEX idx_status (service_status),
    INDEX idx_isfavorite (is_favorite),
    INDEX idx_order (order_index),
    INDEX idx_auto_start (auto_start),
    INDEX idx_ssh_connection (ssh_connection),
    INDEX idx_remote_desktop_enabled (remote_desktop_enabled),
    INDEX idx_remote_desktop_type (remote_desktop_type),
    INDEX idx_rustdesk_id (rustdesk_id),
    FOREIGN KEY (category) REFERENCES categories(name) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ====================================================================
-- SSH AND REMOTE ACCESS TABLES
-- ====================================================================

-- Create hosts table (unified SSH and remote host management)
CREATE TABLE IF NOT EXISTS hosts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    hostname VARCHAR(255) NOT NULL,
    port INT DEFAULT 22,
    username VARCHAR(255) NOT NULL,
    icon VARCHAR(100) DEFAULT 'Server',
    password VARCHAR(1024) DEFAULT NULL,
    private_key TEXT DEFAULT NULL,
    ssh_key_name VARCHAR(100) DEFAULT NULL COMMENT 'Name of SSH key from ssh_keys table',
    color VARCHAR(7) DEFAULT '#007AFF',
    transparency DECIMAL(3,2) DEFAULT 0.10,
    blur INT DEFAULT 0,
    remote_desktop_enabled BOOLEAN DEFAULT FALSE COMMENT 'Whether remote desktop is enabled',
    remote_desktop_type VARCHAR(50) DEFAULT 'guacamole' COMMENT 'Type of remote desktop (guacamole, rustdesk)',
    remote_protocol ENUM('vnc', 'rdp', 'ssh') DEFAULT 'vnc' COMMENT 'Remote desktop protocol',
    remote_port INT DEFAULT NULL COMMENT 'Remote desktop port',
    remote_username VARCHAR(255) DEFAULT NULL COMMENT 'Remote desktop username',
    remote_password VARCHAR(1024) DEFAULT NULL COMMENT 'Encrypted remote desktop password',
    guacamole_performance_mode VARCHAR(20) DEFAULT 'balanced' COMMENT 'Guacamole performance mode',
    rustdesk_id VARCHAR(20) DEFAULT NULL COMMENT 'RustDesk device ID',
    rustdesk_password VARCHAR(1024) DEFAULT NULL COMMENT 'Encrypted RustDesk password',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Whether this host is active',
    last_tested TIMESTAMP NULL COMMENT 'Last time connection was tested',
    test_status ENUM('success', 'failed', 'unknown') DEFAULT 'unknown' COMMENT 'Last test result',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_hosts_name (name),
    INDEX idx_hosts_hostname (hostname),
    INDEX idx_hosts_created_by (created_by),
    INDEX idx_hosts_ssh_key_name (ssh_key_name),
    INDEX idx_hosts_remote_desktop_enabled (remote_desktop_enabled),
    INDEX idx_hosts_remote_desktop_type (remote_desktop_type),
    INDEX idx_hosts_active (is_active),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) COMMENT='Unified hosts table for SSH, terminal and remote desktop connections';

-- Create SSH keys table for storing SSH keys in database
CREATE TABLE IF NOT EXISTS ssh_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    key_name VARCHAR(100) NOT NULL COMMENT 'SSH key identifier',
    private_key TEXT NOT NULL COMMENT 'Private SSH key content',
    public_key TEXT NOT NULL COMMENT 'Public SSH key content',
    key_type VARCHAR(50) DEFAULT 'rsa' COMMENT 'SSH key type (rsa, ed25519, etc.)',
    key_size INT DEFAULT 2048 COMMENT 'SSH key size in bits',
    comment VARCHAR(255) NULL COMMENT 'SSH key comment',
    fingerprint VARCHAR(255) DEFAULT NULL COMMENT 'SSH key fingerprint',
    passphrase_hash VARCHAR(255) NULL COMMENT 'Hashed passphrase if key is encrypted',
    is_default BOOLEAN DEFAULT FALSE COMMENT 'Whether this is the default key',
    created_by INT DEFAULT NULL COMMENT 'User who created this key',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_key_name_user (key_name, created_by),
    INDEX idx_key_name (key_name),
    INDEX idx_default (is_default),
    INDEX idx_ssh_keys_created_by (created_by),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) COMMENT='SSH keys stored in database for centralized management - Multi-tenant support';

-- Create SSH upload log table
CREATE TABLE IF NOT EXISTS ssh_upload_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    host_id INT NOT NULL COMMENT 'Reference to hosts table',
    filename VARCHAR(255) NOT NULL COMMENT 'Name of uploaded file',
    file_size BIGINT NOT NULL COMMENT 'Size in bytes',
    target_path VARCHAR(500) NOT NULL COMMENT 'Full path where file was uploaded',
    status ENUM('success', 'failed') NOT NULL COMMENT 'Upload status',
    error_message TEXT DEFAULT NULL COMMENT 'Error message if upload failed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INT DEFAULT NULL COMMENT 'User who performed the upload',
    
    INDEX idx_host_id (host_id),
    INDEX idx_created_at (created_at),
    INDEX idx_status (status),
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
) COMMENT='Log of all SSH file uploads';

-- Create appliance custom commands table
CREATE TABLE IF NOT EXISTS appliance_commands (
    id INT AUTO_INCREMENT PRIMARY KEY,
    appliance_id INT NOT NULL,
    description VARCHAR(255) NOT NULL,
    command TEXT NOT NULL,
    host_id INT NULL COMMENT 'Reference to hosts table for SSH execution',
    order_index INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_appliance (appliance_id),
    INDEX idx_order (order_index),
    FOREIGN KEY (appliance_id) REFERENCES appliances(id) ON DELETE CASCADE,
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE SET NULL
);

-- ====================================================================
-- USER SETTINGS AND CONFIGURATION
-- ====================================================================

-- Create user settings table
CREATE TABLE IF NOT EXISTS user_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL COMMENT 'NULL for global settings',
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_user_setting (user_id, setting_key),
    INDEX idx_user_id (user_id),
    INDEX idx_setting_key (setting_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert default global settings
INSERT IGNORE INTO user_settings (user_id, setting_key, setting_value) VALUES
(NULL, 'service_status_refresh_interval', '30'),
(NULL, 'theme', 'dark'),
(NULL, 'sidebar_collapsed', 'false'),
(NULL, 'show_offline_services', 'true'),
(NULL, 'terminal_font_size', '14'),
(NULL, 'terminal_cursor_blink', 'true'),
(NULL, 'terminal_cursor_style', 'block'),
(NULL, 'enable_animations', 'true'),
(NULL, 'audit_log_retention_days', '30'),
(NULL, 'backup_retention_days', '7'),
(NULL, 'max_backup_size_mb', '100');

-- ====================================================================
-- LOGGING AND AUDIT TABLES
-- ====================================================================

-- Create command logs table
CREATE TABLE IF NOT EXISTS service_command_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    appliance_id INT NOT NULL,
    command_type ENUM('status', 'start', 'stop', 'restart') NOT NULL,
    command TEXT NOT NULL,
    output TEXT,
    exit_code INT,
    executed_by INT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_ms INT COMMENT 'Command execution duration in milliseconds',
    
    INDEX idx_appliance (appliance_id),
    INDEX idx_command_type (command_type),
    INDEX idx_executed_at (executed_at),
    INDEX idx_executed_by (executed_by),
    FOREIGN KEY (appliance_id) REFERENCES appliances(id) ON DELETE CASCADE,
    FOREIGN KEY (executed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL COMMENT 'NULL for system actions',
    action VARCHAR(100) NOT NULL COMMENT 'Action performed',
    resource_type VARCHAR(50) NOT NULL COMMENT 'Type of resource affected',
    resource_id INT NULL COMMENT 'ID of affected resource',
    resource_name VARCHAR(255) DEFAULT NULL COMMENT 'Name of affected resource',
    details JSON COMMENT 'Additional details about the action',
    ip_address VARCHAR(45) NULL COMMENT 'IP address of the user',
    user_agent TEXT NULL COMMENT 'User agent string',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_resource (resource_type, resource_id),
    INDEX idx_audit_logs_resource_name (resource_name),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ====================================================================
-- BACKUP AND RECOVERY TABLES
-- ====================================================================

-- Create backup metadata table
CREATE TABLE IF NOT EXISTS backup_metadata (
    id INT AUTO_INCREMENT PRIMARY KEY,
    backup_id VARCHAR(36) NOT NULL UNIQUE COMMENT 'UUID for backup',
    backup_type ENUM('full', 'partial', 'auto', 'manual') DEFAULT 'manual',
    backup_size BIGINT COMMENT 'Size in bytes',
    file_path VARCHAR(500) COMMENT 'Path to backup file',
    includes_database BOOLEAN DEFAULT TRUE,
    includes_ssh_keys BOOLEAN DEFAULT TRUE,
    includes_config BOOLEAN DEFAULT TRUE,
    includes_images BOOLEAN DEFAULT TRUE,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    metadata JSON COMMENT 'Additional backup metadata',
    
    INDEX idx_backup_id (backup_id),
    INDEX idx_created_at (created_at),
    INDEX idx_backup_type (backup_type),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ====================================================================
-- MEDIA AND ASSETS TABLES
-- ====================================================================

-- Create background images table
CREATE TABLE IF NOT EXISTS background_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_size INT NOT NULL COMMENT 'Size in bytes',
    mime_type VARCHAR(100) NOT NULL,
    width INT NULL,
    height INT NULL,
    uploaded_by INT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INT DEFAULT 0 COMMENT 'Number of services using this image',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_filename (filename),
    INDEX idx_active (is_active),
    INDEX idx_uploaded_by (uploaded_by),
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ====================================================================
-- SESSION AND TEMPORARY TABLES
-- ====================================================================

-- Create active sessions table
CREATE TABLE IF NOT EXISTS active_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    
    INDEX idx_user_id (user_id),
    INDEX idx_token (session_token),
    INDEX idx_expires (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ====================================================================
-- MIGRATION TRACKING
-- ====================================================================

-- Create migrations table to track applied migrations
CREATE TABLE IF NOT EXISTS migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_filename (filename)
);

-- ====================================================================
-- STORED PROCEDURES AND FUNCTIONS
-- ====================================================================

-- Procedure to clean up expired sessions
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS cleanup_expired_sessions()
BEGIN
    DELETE FROM active_sessions WHERE expires_at < NOW();
END$$
DELIMITER ;

-- Procedure to update service status
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS update_service_status(
    IN p_appliance_id INT,
    IN p_status ENUM('running', 'stopped', 'error', 'offline', 'unknown')
)
BEGIN
    UPDATE appliances 
    SET service_status = p_status, 
        last_status_check = NOW() 
    WHERE id = p_appliance_id;
END$$
DELIMITER ;

-- ====================================================================
-- TRIGGERS
-- ====================================================================

-- Trigger to update appliance updated_at on service status change
DELIMITER $$
CREATE TRIGGER IF NOT EXISTS update_appliance_timestamp
BEFORE UPDATE ON appliances
FOR EACH ROW
BEGIN
    IF NEW.service_status != OLD.service_status THEN
        SET NEW.updated_at = NOW();
    END IF;
END$$
DELIMITER ;

-- ====================================================================
-- EVENTS (Scheduled Tasks)
-- ====================================================================

-- Enable event scheduler
SET GLOBAL event_scheduler = ON;

-- Event to clean up old audit logs
DELIMITER $$
CREATE EVENT IF NOT EXISTS cleanup_old_audit_logs
ON SCHEDULE EVERY 1 DAY
DO
BEGIN
    DECLARE retention_days INT DEFAULT 30;
    
    -- Get retention setting
    SELECT CAST(setting_value AS UNSIGNED) INTO retention_days
    FROM user_settings 
    WHERE user_id IS NULL AND setting_key = 'audit_log_retention_days'
    LIMIT 1;
    
    -- Delete old audit logs
    DELETE FROM audit_logs 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL retention_days DAY);
END$$
DELIMITER ;

-- Event to clean up expired sessions
DELIMITER $$
CREATE EVENT IF NOT EXISTS cleanup_sessions
ON SCHEDULE EVERY 1 HOUR
DO
BEGIN
    CALL cleanup_expired_sessions();
END$$
DELIMITER ;

-- ====================================================================
-- INITIAL DATA AND FINAL SETUP
-- ====================================================================

-- Mark all appliances as unknown status initially
UPDATE appliances SET service_status = 'unknown' WHERE service_status IS NULL;

-- Set database character set
ALTER DATABASE appliance_dashboard CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Record initial migrations
INSERT IGNORE INTO migrations (filename) VALUES 
    ('001_initial_schema.sql'),
    ('002_add_role_permissions.sql'),
    ('003_add_ssh_tables.sql'),
    ('004_add_audit_tables.sql'),
    ('005_add_backup_tables.sql'),
    ('006_add_remote_desktop.sql'),
    ('007_add_hosts_table.sql'),
    ('008_add_ssh_upload_log.sql'),
    ('009_add_rustdesk_columns.sql'),
    ('010_add_remote_desktop_type.sql'),
    ('011_multi_tenant_support.sql'),
    ('012_add_description_to_hosts.sql'),
    ('013_add_resource_name_to_audit_logs.sql'),
    ('014_add_icon_to_hosts.sql'),
    ('015_migrate_ssh_hosts_to_hosts.sql'),
    ('016_update_audit_log_resource_names.sql');

-- ====================================================================
-- END OF INITIALIZATION
-- ====================================================================
