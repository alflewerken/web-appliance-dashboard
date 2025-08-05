#!/bin/bash
# Run RustDesk database migration

echo "🔄 Running RustDesk database migration..."

# Get database credentials from .env
source .env

# Run migration using MySQL
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" << EOF
-- Add RustDesk fields to appliances table
ALTER TABLE appliances 
ADD COLUMN IF NOT EXISTS remote_desktop_type VARCHAR(20) DEFAULT 'guacamole' COMMENT 'Type of remote desktop: guacamole or rustdesk',
ADD COLUMN IF NOT EXISTS rustdesk_id VARCHAR(20) DEFAULT NULL COMMENT 'RustDesk ID after installation',
ADD COLUMN IF NOT EXISTS rustdesk_installed BOOLEAN DEFAULT FALSE COMMENT 'Whether RustDesk is installed on this appliance',
ADD COLUMN IF NOT EXISTS rustdesk_installation_date DATETIME DEFAULT NULL COMMENT 'When RustDesk was installed';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_appliances_rustdesk_id ON appliances(rustdesk_id);

-- Show new columns
DESCRIBE appliances;
EOF

echo "✅ Migration complete!"
