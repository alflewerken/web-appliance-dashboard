-- ====================================================================
-- Web Appliance Dashboard Database Schema
-- Version: 2.0.0 - Consolidated Schema with all Migrations
-- Date: 2025-09-12
-- ====================================================================

-- Ensure UTF8MB4 character set for full Unicode support
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ====================================================================
-- AUTHENTICATION AND ROLE TABLES
-- ====================================================================

-- Users table with enhanced role system
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='System users with role-based access control';

-- Role permissions mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    permission VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_role_permission (role, permission),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Permission definitions for each role';

-- User sessions tracking
CREATE TABLE IF NOT EXISTS active_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_sessions (user_id),
    INDEX idx_session_token (session_token),
    INDEX idx_expires (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Active user sessions';

-- ====================================================================
-- CORE APPLICATION TABLES
-- ====================================================================

-- Categories for organizing appliances
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#007AFF',
    icon VARCHAR(50) DEFAULT 'folder',
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    order_index INT DEFAULT 0 COMMENT 'Compatibility alias for display_order',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_categories_name (name),
    INDEX idx_categories_order (display_order),
    INDEX idx_categories_order_index (order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Categories for organizing appliances';

-- SSH Keys storage
CREATE TABLE IF NOT EXISTS ssh_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    key_name VARCHAR(100) NOT NULL UNIQUE COMMENT 'SSH key identifier',
    private_key TEXT NOT NULL COMMENT 'Encrypted private SSH key',
    public_key TEXT NOT NULL COMMENT 'Public SSH key',
    key_type VARCHAR(50) DEFAULT 'rsa' COMMENT 'SSH key type (rsa, ed25519, etc.)',
    key_size INT DEFAULT 2048 COMMENT 'SSH key size in bits',
    comment VARCHAR(255) NULL COMMENT 'SSH key comment',
    fingerprint VARCHAR(255) NULL COMMENT 'SSH key fingerprint',
    last_used TIMESTAMP NULL COMMENT 'Last time key was used',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    
    INDEX idx_ssh_keys_name (key_name),
    INDEX idx_ssh_keys_fingerprint (fingerprint),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SSH keys for host connections';

-- Unified hosts table for SSH, terminal and remote desktop
CREATE TABLE IF NOT EXISTS hosts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    hostname VARCHAR(255) NOT NULL,
    ip VARCHAR(45) DEFAULT NULL COMMENT 'IP address for direct connections',
    port INT DEFAULT 22,
    username VARCHAR(255) NOT NULL,
    icon VARCHAR(100) DEFAULT 'Server',
    password VARCHAR(1024) DEFAULT NULL COMMENT 'Encrypted SSH password',
    private_key TEXT DEFAULT NULL COMMENT 'Encrypted private SSH key',
    ssh_key_name VARCHAR(100) DEFAULT NULL COMMENT 'Reference to ssh_keys table',
    color VARCHAR(7) DEFAULT '#007AFF',
    transparency DECIMAL(3,2) DEFAULT 0.10,
    blur INT DEFAULT 0,
    
    -- Remote desktop configuration
    remote_desktop_enabled BOOLEAN DEFAULT FALSE,
    remote_desktop_type VARCHAR(50) DEFAULT 'guacamole',
    remote_protocol ENUM('vnc', 'rdp', 'ssh') DEFAULT 'vnc',
    remote_port INT DEFAULT NULL,
    remote_username VARCHAR(255) DEFAULT NULL,
    remote_password VARCHAR(1024) DEFAULT NULL COMMENT 'Encrypted remote password',
    guacamole_performance_mode VARCHAR(20) DEFAULT 'balanced',
    rustdesk_id VARCHAR(20) DEFAULT NULL,
    rustdesk_password VARCHAR(1024) DEFAULT NULL COMMENT 'Encrypted RustDesk password',
    
    -- Status and monitoring
    is_active BOOLEAN DEFAULT TRUE,
    os_type VARCHAR(50) DEFAULT 'linux' COMMENT 'Operating system type',
    last_tested TIMESTAMP NULL,
    test_status ENUM('success', 'failed', 'unknown') DEFAULT 'unknown',
    
    -- SNMP runtime status (configuration is in host_snmp_configs)
    snmp_status VARCHAR(20) DEFAULT 'unknown',
    last_snmp_check DATETIME DEFAULT NULL,
    last_snmp_error TEXT DEFAULT NULL,
    last_metrics JSON DEFAULT NULL COMMENT 'Latest SNMP metrics as JSON',
    
    -- Ping monitoring
    ping_enabled BOOLEAN DEFAULT FALSE,
    last_ping_check DATETIME DEFAULT NULL,
    ping_status VARCHAR(20) DEFAULT 'unknown',
    ping_response_time DECIMAL(10,3) DEFAULT NULL COMMENT 'Response time in ms',
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_hosts_name (name),
    INDEX idx_hosts_hostname (hostname),
    INDEX idx_hosts_ip (ip),
    INDEX idx_hosts_ssh_key_name (ssh_key_name),
    INDEX idx_hosts_remote_desktop (remote_desktop_enabled),
    INDEX idx_hosts_active (is_active),
    INDEX idx_hosts_ping_enabled (ping_enabled),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (ssh_key_name) REFERENCES ssh_keys(key_name) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Unified hosts table for all connections';

-- Appliances (web applications)
CREATE TABLE IF NOT EXISTS appliances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    category_id INT DEFAULT NULL,
    username VARCHAR(255) DEFAULT NULL,
    password VARCHAR(1024) DEFAULT NULL COMMENT 'Encrypted password',
    icon VARCHAR(255) DEFAULT 'Globe',
    color VARCHAR(7) DEFAULT '#007AFF',
    transparency DECIMAL(3,2) DEFAULT 0.10,
    blur INT DEFAULT 0,
    description TEXT DEFAULT NULL,
    tags JSON DEFAULT NULL COMMENT 'Array of tags as JSON',
    is_active BOOLEAN DEFAULT TRUE,
    is_favorite BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    open_in_new_tab BOOLEAN DEFAULT FALSE,
    check_ssl BOOLEAN DEFAULT TRUE,
    custom_headers JSON DEFAULT NULL COMMENT 'Custom HTTP headers as JSON',
    auth_type ENUM('none', 'basic', 'bearer', 'custom') DEFAULT 'none',
    bearer_token VARCHAR(1024) DEFAULT NULL COMMENT 'Encrypted bearer token',
    
    -- Service control fields
    ssh_connection VARCHAR(255) DEFAULT NULL COMMENT 'SSH connection string (user@host:port)',
    status_command VARCHAR(500) DEFAULT NULL COMMENT 'Command to check service status',
    start_command VARCHAR(500) DEFAULT NULL COMMENT 'Command to start service',
    stop_command VARCHAR(500) DEFAULT NULL COMMENT 'Command to stop service',
    restart_command VARCHAR(500) DEFAULT NULL COMMENT 'Command to restart service',
    service_status VARCHAR(50) DEFAULT NULL COMMENT 'Current service status',
    
    -- Monitoring fields
    last_checked TIMESTAMP NULL,
    last_status ENUM('online', 'offline', 'error', 'unknown') DEFAULT 'unknown',
    response_time INT DEFAULT NULL COMMENT 'Response time in milliseconds',
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_appliances_name (name),
    INDEX idx_appliances_category (category_id),
    INDEX idx_appliances_active (is_active),
    INDEX idx_appliances_favorite (is_favorite),
    INDEX idx_appliances_order (display_order),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Web applications and services';

-- Services for proxy configuration (legacy, may be deprecated)
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Legacy services table for proxy configurations';

-- ====================================================================
-- SNMP MONITORING TABLES
-- ====================================================================

-- SNMP configuration per host
CREATE TABLE IF NOT EXISTS host_snmp_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    host_id INT NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    version VARCHAR(10) DEFAULT '2c' COMMENT 'SNMP version (1, 2c, 3)',
    community VARCHAR(255) DEFAULT 'public' COMMENT 'SNMP community string (v1/v2c)',
    port INT DEFAULT 161,
    
    -- SNMPv3 specific fields
    username VARCHAR(255) DEFAULT NULL,
    auth_protocol VARCHAR(10) DEFAULT NULL COMMENT 'MD5, SHA, SHA224, SHA256, SHA384, SHA512',
    auth_password VARCHAR(255) DEFAULT NULL,
    priv_protocol VARCHAR(10) DEFAULT NULL COMMENT 'DES, AES, AES192, AES256',
    priv_password VARCHAR(255) DEFAULT NULL,
    
    poll_interval INT DEFAULT 60 COMMENT 'Polling interval in seconds',
    timeout INT DEFAULT 5000 COMMENT 'Timeout in milliseconds',
    retries INT DEFAULT 3,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_host_config (host_id),
    INDEX idx_enabled (enabled),
    INDEX idx_host_enabled (host_id, enabled),
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SNMP configuration for each host';

-- SNMP metrics time-series data
CREATE TABLE IF NOT EXISTS snmp_metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    host_id INT NOT NULL,
    metric_key VARCHAR(255) NOT NULL COMMENT 'Metric identifier (e.g., cpu.user, memory.used)',
    metric_value DECIMAL(20,4) DEFAULT NULL COMMENT 'Numeric metric value',
    metric_name VARCHAR(255) DEFAULT NULL COMMENT 'Human-readable metric name',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_host_metric_time (host_id, metric_key, timestamp),
    INDEX idx_timestamp (timestamp),
    INDEX idx_host_timestamp (host_id, timestamp),
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Time-series SNMP metrics data';

-- Host monitoring data (aggregated metrics)
CREATE TABLE IF NOT EXISTS host_monitoring_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    host_id INT NOT NULL,
    metric_type VARCHAR(50) NOT NULL COMMENT 'Type of metric (cpu, memory, disk, etc.)',
    metric_data JSON NOT NULL COMMENT 'Metric data as JSON',
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_host_type_time (host_id, metric_type, collected_at),
    INDEX idx_collected (collected_at),
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Aggregated monitoring data per host';

-- Host metrics logging configuration
CREATE TABLE IF NOT EXISTS host_metrics_logging (
    id INT AUTO_INCREMENT PRIMARY KEY,
    host_id INT NOT NULL,
    selected_metrics JSON DEFAULT NULL COMMENT 'Array of selected metric keys',
    default_time_range VARCHAR(20) DEFAULT '24h' COMMENT 'Default time range for charts',
    config JSON DEFAULT NULL COMMENT 'Additional configuration as JSON',
    custom_names JSON DEFAULT NULL COMMENT 'Custom names for metrics',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_host_logging (host_id),
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Metrics logging configuration per host';

-- Disk configuration for monitoring
CREATE TABLE IF NOT EXISTS disk_configurations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    host_id INT NOT NULL,
    mount_point VARCHAR(255) NOT NULL COMMENT 'Disk mount point (e.g., /, /home)',
    device_name VARCHAR(255) DEFAULT NULL COMMENT 'Device name (e.g., /dev/sda1)',
    display_name VARCHAR(255) DEFAULT NULL COMMENT 'Custom display name',
    is_monitored BOOLEAN DEFAULT TRUE,
    warning_threshold DECIMAL(5,2) DEFAULT 80.00 COMMENT 'Warning threshold percentage',
    critical_threshold DECIMAL(5,2) DEFAULT 90.00 COMMENT 'Critical threshold percentage',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_host_mount (host_id, mount_point),
    INDEX idx_host_monitored (host_id, is_monitored),
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Disk monitoring configuration per host';

-- Network interface mappings
CREATE TABLE IF NOT EXISTS interface_mappings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    host_id INT NOT NULL,
    snmp_index INT NOT NULL COMMENT 'SNMP interface index',
    interface_name VARCHAR(100) NOT NULL COMMENT 'Interface name (e.g., eth0, en0)',
    display_name VARCHAR(100) DEFAULT NULL COMMENT 'Custom display name',
    is_monitored BOOLEAN DEFAULT TRUE,
    interface_type VARCHAR(50) DEFAULT NULL COMMENT 'Interface type (ethernet, wifi, loopback)',
    mac_address VARCHAR(17) DEFAULT NULL COMMENT 'MAC address',
    speed BIGINT DEFAULT NULL COMMENT 'Interface speed in bits per second',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_host_interface (host_id, snmp_index),
    INDEX idx_host_name (host_id, interface_name),
    INDEX idx_monitored (host_id, is_monitored),
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Network interface mappings for SNMP monitoring';

-- SNMP reload signals for worker processes
CREATE TABLE IF NOT EXISTS snmp_reload_signals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    host_id INT DEFAULT NULL,
    signal_type VARCHAR(20) NOT NULL COMMENT 'Signal type (reload, stop, restart)',
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    
    INDEX idx_unprocessed (processed, created_at),
    INDEX idx_host_signal (host_id, signal_type),
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Signals for SNMP worker process';

-- ====================================================================
-- SETTINGS AND CONFIGURATION TABLES
-- ====================================================================

-- Application settings
CREATE TABLE IF NOT EXISTS app_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE COMMENT 'System settings cannot be deleted',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_setting_key (setting_key),
    INDEX idx_system (is_system)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Application-wide settings';

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='User-specific preferences';

-- User settings (legacy compatibility)
CREATE TABLE IF NOT EXISTS user_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSON DEFAULT NULL,
    description TEXT DEFAULT NULL COMMENT 'Description of the setting',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_user_setting (user_id, setting_key),
    INDEX idx_user_settings (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='User settings in JSON format';

-- Background images for dashboard customization
CREATE TABLE IF NOT EXISTS background_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT DEFAULT NULL COMMENT 'File size in bytes',
    mime_type VARCHAR(100) DEFAULT NULL,
    width INT DEFAULT NULL COMMENT 'Image width in pixels',
    height INT DEFAULT NULL COMMENT 'Image height in pixels',
    is_active BOOLEAN DEFAULT FALSE,
    uploaded_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_active (is_active),
    INDEX idx_uploaded_by (uploaded_by),
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Background images for dashboard customization';

-- ====================================================================
-- AUDIT AND LOGGING TABLES
-- ====================================================================

-- Audit logs for security and compliance
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    username VARCHAR(50) DEFAULT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) DEFAULT NULL COMMENT 'Type of resource (compatibility alias for entity_type)',
    resource_id INT DEFAULT NULL COMMENT 'ID of the resource (compatibility alias for entity_id)',
    resource_name VARCHAR(255) DEFAULT NULL COMMENT 'Name of the resource',
    entity_type VARCHAR(50) DEFAULT NULL COMMENT 'Type of entity (user, host, appliance, etc.)',
    entity_id INT DEFAULT NULL COMMENT 'ID of the affected entity',
    details JSON DEFAULT NULL COMMENT 'Additional details as JSON',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Audit trail for all system actions';

-- Activity logs for user behavior tracking
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='User activity tracking';

-- ====================================================================
-- MIGRATION TRACKING TABLE
-- ====================================================================

-- Track applied database migrations
CREATE TABLE IF NOT EXISTS migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_migrations_filename (filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Database migration history';

-- ====================================================================
-- VIEWS
-- ====================================================================

-- Latest SNMP metrics per host
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

-- Active hosts summary
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
('Administrator', 'manage_hosts', 'Create, update, delete hosts'),
('Administrator', 'manage_system', 'System configuration and settings'),
('Administrator', 'view_audit_logs', 'View all audit logs'),
('Administrator', 'restore_backups', 'Restore from backups'),
('Power User', 'manage_appliances', 'Create, update, delete appliances'),
('Power User', 'manage_hosts', 'Create, update, delete hosts'),
('Power User', 'control_appliances', 'Start, stop, restart appliances'),
('Power User', 'view_users', 'View user list'),
('Power User', 'view_audit_logs', 'View audit logs'),
('Benutzer', 'view_appliances', 'View appliances'),
('Benutzer', 'view_hosts', 'View hosts'),
('Benutzer', 'control_appliances', 'Start, stop, restart appliances'),
('Gast', 'view_appliances', 'View appliances only'),
('Gast', 'view_hosts', 'View hosts only');

-- Insert default categories
INSERT IGNORE INTO categories (name, color, icon, description, is_system, display_order) VALUES
('Uncategorized', '#6B7280', 'folder', 'Default category for uncategorized items', TRUE, 999);

-- Insert default app settings
INSERT IGNORE INTO app_settings (setting_key, setting_value, setting_type, description, is_system) VALUES
('app_name', 'Web Appliance Dashboard', 'string', 'Application name', TRUE),
('app_version', '2.0.0', 'string', 'Application version', TRUE),
('session_timeout', '3600', 'number', 'Session timeout in seconds', TRUE),
('max_login_attempts', '5', 'number', 'Maximum login attempts before lockout', TRUE),
('lockout_duration', '900', 'number', 'Account lockout duration in seconds', TRUE),
('password_min_length', '8', 'number', 'Minimum password length', TRUE),
('enable_2fa', 'false', 'boolean', 'Enable two-factor authentication', TRUE),
('enable_audit_log', 'true', 'boolean', 'Enable audit logging', TRUE),
('enable_activity_log', 'true', 'boolean', 'Enable activity logging', TRUE),
('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode', TRUE),
('snmp_default_community', 'public', 'string', 'Default SNMP community string', FALSE),
('snmp_default_version', '2c', 'string', 'Default SNMP version', FALSE),
('snmp_default_port', '161', 'number', 'Default SNMP port', FALSE),
('snmp_default_timeout', '5000', 'number', 'Default SNMP timeout in milliseconds', FALSE),
('metrics_retention_days', '30', 'number', 'Number of days to retain metrics data', FALSE),
('backup_encryption_enabled', 'true', 'boolean', 'Enable backup encryption', FALSE);

-- Mark this schema version in migrations table
INSERT INTO migrations (filename) VALUES 
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
('024_consolidate_snmp_config.sql'),
('025_consolidated_schema.sql');

-- ====================================================================
-- END OF SCHEMA
-- ====================================================================
