-- ====================================================================
-- Web Appliance Dashboard Database Initialization
-- Version: 2.0.0 - Consolidated with all migrations
-- Date: 2025-09-12
-- Based on ACTUAL database structure after all migrations
-- ====================================================================

-- Ensure UTF8MB4 character set for full Unicode support
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ====================================================================
-- AUTHENTICATION AND ROLE TABLES
-- ====================================================================

-- Users table
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

-- Role permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    permission VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_role_permission (role, permission),
    INDEX idx_role (role)
);

-- Active sessions table (for authentication)
CREATE TABLE IF NOT EXISTS active_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_sessions (user_id),
    INDEX idx_session_token (session_token),
    INDEX idx_expires (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ====================================================================
-- CORE APPLICATION TABLES
-- ====================================================================

-- Categories table
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
    
    INDEX idx_categories_name (name),
    INDEX idx_categories_order (order_index)
);

-- Appliances table
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
    
    -- Additional fields from actual DB
    username VARCHAR(255) NULL,
    password VARCHAR(1024) NULL,
    tags JSON NULL,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    open_in_new_tab BOOLEAN DEFAULT FALSE,
    check_ssl BOOLEAN DEFAULT TRUE,
    custom_headers JSON NULL,
    auth_type ENUM('none', 'basic', 'bearer', 'custom') DEFAULT 'none',
    bearer_token VARCHAR(1024) NULL,
    last_checked TIMESTAMP NULL,
    last_status ENUM('online', 'offline', 'error', 'unknown') DEFAULT 'unknown',
    response_time INT NULL,
    
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

-- Hosts table
CREATE TABLE IF NOT EXISTS hosts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    hostname VARCHAR(255) NOT NULL,
    ip VARCHAR(45) DEFAULT NULL,
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
    os_type VARCHAR(50) DEFAULT 'linux',
    last_tested TIMESTAMP NULL COMMENT 'Last time connection was tested',
    test_status ENUM('success', 'failed', 'unknown') DEFAULT 'unknown' COMMENT 'Last test result',
    
    -- SNMP monitoring fields (from migrations)
    snmp_status VARCHAR(20) DEFAULT 'unknown',
    last_snmp_check DATETIME DEFAULT NULL,
    last_snmp_error TEXT DEFAULT NULL,
    last_metrics JSON DEFAULT NULL,
    
    -- Ping monitoring fields (from migration 021)
    ping_enabled BOOLEAN DEFAULT FALSE,
    last_ping_check DATETIME DEFAULT NULL,
    ping_status VARCHAR(20) DEFAULT 'unknown',
    ping_response_time DECIMAL(10,3) DEFAULT NULL,
    
    -- Additional fields
    device_type VARCHAR(50) DEFAULT NULL,
    last_used TIMESTAMP NULL,
    
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
    INDEX idx_hosts_ping_enabled (ping_enabled),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) COMMENT='Unified hosts table for SSH, terminal and remote desktop connections';

-- SSH keys table
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
    last_used TIMESTAMP NULL,
    created_by INT DEFAULT NULL COMMENT 'User who created this key',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_key_name_user (key_name, created_by),
    INDEX idx_key_name (key_name),
    INDEX idx_default (is_default),
    INDEX idx_ssh_keys_created_by (created_by),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) COMMENT='SSH keys stored in database for centralized management';

-- ====================================================================
-- SNMP MONITORING TABLES (from migrations 004-024)
-- ====================================================================

-- Host SNMP configurations (from migration 005, modified by 024)
CREATE TABLE IF NOT EXISTS host_snmp_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    host_id INT NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    version VARCHAR(10) DEFAULT '2c',
    community VARCHAR(255) DEFAULT 'public',
    port INT DEFAULT 161,
    username VARCHAR(255) DEFAULT NULL,
    auth_protocol VARCHAR(10) DEFAULT NULL,
    auth_password VARCHAR(255) DEFAULT NULL,
    priv_protocol VARCHAR(10) DEFAULT NULL,
    priv_password VARCHAR(255) DEFAULT NULL,
    poll_interval INT DEFAULT 60,
    timeout INT DEFAULT 5000,
    retries INT DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_host_config (host_id),
    INDEX idx_enabled (enabled),
    INDEX idx_host_enabled (host_id, enabled),
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- SNMP metrics time-series data (from migration 017)
CREATE TABLE IF NOT EXISTS snmp_metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    host_id INT NOT NULL,
    metric_key VARCHAR(255) NOT NULL,
    metric_value DECIMAL(20,4) DEFAULT NULL,
    metric_name VARCHAR(255) DEFAULT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_host_metric_time (host_id, metric_key, timestamp),
    INDEX idx_timestamp (timestamp),
    INDEX idx_host_timestamp (host_id, timestamp),
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Host monitoring data (from migration 005)
CREATE TABLE IF NOT EXISTS host_monitoring_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    host_id INT NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    metric_data JSON NOT NULL,
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_host_type_time (host_id, metric_type, collected_at),
    INDEX idx_collected (collected_at),
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Host metrics logging configuration (from migration 015-016)
CREATE TABLE IF NOT EXISTS host_metrics_logging (
    id INT AUTO_INCREMENT PRIMARY KEY,
    host_id INT NOT NULL,
    selected_metrics JSON DEFAULT NULL,
    default_time_range VARCHAR(20) DEFAULT '24h',
    config JSON DEFAULT NULL,
    custom_names JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_host_logging (host_id),
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Disk configurations (from migration 020)
CREATE TABLE IF NOT EXISTS disk_configurations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    host_id INT NOT NULL,
    mount_point VARCHAR(255) NOT NULL,
    device_name VARCHAR(255) DEFAULT NULL,
    display_name VARCHAR(255) DEFAULT NULL,
    is_monitored BOOLEAN DEFAULT TRUE,
    warning_threshold DECIMAL(5,2) DEFAULT 80.00,
    critical_threshold DECIMAL(5,2) DEFAULT 90.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_host_mount (host_id, mount_point),
    INDEX idx_host_monitored (host_id, is_monitored),
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Interface mappings (from migration 022)
CREATE TABLE IF NOT EXISTS interface_mappings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    host_id INT NOT NULL,
    snmp_index INT NOT NULL,
    interface_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) DEFAULT NULL,
    is_monitored BOOLEAN DEFAULT TRUE,
    interface_type VARCHAR(50) DEFAULT NULL,
    mac_address VARCHAR(17) DEFAULT NULL,
    speed BIGINT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_host_interface (host_id, snmp_index),
    INDEX idx_host_name (host_id, interface_name),
    INDEX idx_monitored (host_id, is_monitored),
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- SNMP reload signals (from migration 023)
CREATE TABLE IF NOT EXISTS snmp_reload_signals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    host_id INT DEFAULT NULL,
    signal_type VARCHAR(20) NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    
    INDEX idx_unprocessed (processed, created_at),
    INDEX idx_host_signal (host_id, signal_type),
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ====================================================================
-- SETTINGS AND CONFIGURATION TABLES
-- ====================================================================

-- App settings table
CREATE TABLE IF NOT EXISTS app_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_setting_key (setting_key),
    INDEX idx_system (is_system)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    preference_key VARCHAR(100) NOT NULL,
    preference_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_user_preference (user_id, preference_key),
    INDEX idx_user_preferences (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User settings
CREATE TABLE IF NOT EXISTS user_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSON DEFAULT NULL,
    description TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_user_setting (user_id, setting_key),
    INDEX idx_user_settings (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ====================================================================
-- AUDIT AND LOGGING TABLES
-- ====================================================================

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    username VARCHAR(50) DEFAULT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) DEFAULT NULL,
    resource_id INT DEFAULT NULL,
    resource_name VARCHAR(255) DEFAULT NULL,
    entity_type VARCHAR(50) DEFAULT NULL,
    entity_id INT DEFAULT NULL,
    details JSON DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_resource (resource_type, resource_id),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_created (created_at),
    INDEX idx_audit_success (success),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Activity logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    description TEXT,
    metadata JSON DEFAULT NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_activity_user (user_id),
    INDEX idx_activity_type (activity_type),
    INDEX idx_activity_created (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ====================================================================
-- ADDITIONAL TABLES
-- ====================================================================

-- Background images
CREATE TABLE IF NOT EXISTS background_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT DEFAULT NULL,
    mime_type VARCHAR(100) DEFAULT NULL,
    width INT DEFAULT NULL,
    height INT DEFAULT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    uploaded_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_active (is_active),
    INDEX idx_uploaded_by (uploaded_by),
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Services table (legacy)
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

-- Migrations tracking
CREATE TABLE IF NOT EXISTS migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_migrations_filename (filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ====================================================================
-- VIEWS
-- ====================================================================

-- Latest SNMP metrics view
CREATE OR REPLACE VIEW snmp_latest_metrics AS
SELECT 
    h.id as host_id,
    h.hostname,
    c.enabled as snmp_enabled,
    h.snmp_status,
    JSON_EXTRACT(h.last_metrics, '$.cpu.percent') as cpu_percent,
    JSON_EXTRACT(h.last_metrics, '$.memory.usedPercent') as memory_percent,
    JSON_EXTRACT(h.last_metrics, '$.disk.usedPercent') as disk_percent,
    h.last_snmp_check,
    h.last_snmp_error
FROM hosts h
LEFT JOIN host_snmp_configs c ON h.id = c.host_id
WHERE c.enabled = 1;

-- Active hosts summary view
CREATE OR REPLACE VIEW active_hosts_summary AS
SELECT 
    COUNT(*) as total_hosts,
    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_hosts,
    SUM(CASE WHEN remote_desktop_enabled = 1 THEN 1 ELSE 0 END) as remote_desktop_hosts,
    SUM(CASE WHEN c.enabled = 1 THEN 1 ELSE 0 END) as snmp_enabled_hosts,
    SUM(CASE WHEN ping_enabled = 1 THEN 1 ELSE 0 END) as ping_enabled_hosts
FROM hosts h
LEFT JOIN host_snmp_configs c ON h.id = c.host_id;

-- ====================================================================
-- DEFAULT DATA
-- ====================================================================

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

-- Insert default category
INSERT IGNORE INTO categories (name, color, icon, description, is_system) VALUES
('Uncategorized', '#6B7280', 'folder', 'Default category for uncategorized items', TRUE);

-- Mark all migrations as applied
INSERT IGNORE INTO migrations (filename) VALUES
('001_initial_schema.sql'),
('002_add_audit_tables.sql'),
('003_add_user_sessions.sql'),
('004_add_snmp_monitoring.sql'),
('005_add_host_monitoring.sql'),
('006_enhanced_snmp_monitoring.sql'),
('007_fix_monitoring_data_structure.sql'),
('008_add_app_settings.sql'),
('009_add_user_preferences.sql'),
('010_add_activity_logs.sql'),
('011_add_backup_restore.sql'),
('012_add_ssh_keys.sql'),
('013_add_remote_desktop.sql'),
('014_add_categories.sql'),
('015_host_metrics_logging.sql'),
('016_add_custom_names_to_metrics_logging.sql'),
('017_fix_snmp_metrics_structure.sql'),
('018_cleanup_snmp_metrics_table.sql'),
('019_add_metrics_settings.sql'),
('020_add_disk_configurations.sql'),
('021_add_host_ping_status.sql'),
('022_create_interface_mappings_table.sql'),
('023_fix_snmp_reload_signals.sql'),
('024_consolidate_snmp_config.sql');

-- ====================================================================
-- END OF CONSOLIDATED SCHEMA
-- ====================================================================
