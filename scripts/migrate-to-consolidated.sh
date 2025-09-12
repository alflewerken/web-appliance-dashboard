#!/bin/bash

# ============================================================
# Migration Script: Alte Struktur -> Konsolidierte Struktur
# Date: 2025-09-12
# ============================================================

echo "=================================="
echo "Database Migration Check"
echo "=================================="

# Database connection details
DB_HOST="${MYSQL_HOST:-appliance_db}"
DB_PORT="${MYSQL_PORT:-3306}"
DB_NAME="${MYSQL_DATABASE:-appliance_dashboard}"
DB_USER="${MYSQL_USER:-dashboard_user}"
DB_PASS="${MYSQL_PASSWORD:-dashboard_pass123}"

# Function to execute SQL
execute_sql() {
    docker exec appliance_db mariadb -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "$1" 2>/dev/null
}

# Check if migrations table exists
echo "Checking migration status..."
MIGRATIONS_EXIST=$(execute_sql "SELECT COUNT(*) FROM migrations WHERE filename='025_consolidated_schema.sql';" 2>/dev/null | tail -1)

if [ "$MIGRATIONS_EXIST" = "1" ]; then
    echo "✅ Database is already using consolidated schema"
    exit 0
fi

echo "⚠️  Database needs migration to consolidated schema"
echo ""
echo "The database structure has been consolidated."
echo "All migrations have been integrated into a single init.sql file."
echo ""
echo "This is a metadata-only change - no actual database structure changes."
echo ""

read -p "Mark database as consolidated? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled"
    exit 1
fi

# Mark as consolidated
echo "Marking database as consolidated..."
execute_sql "INSERT INTO migrations (filename) VALUES ('025_consolidated_schema.sql');"

echo "✅ Database marked as consolidated"
echo ""
echo "Note: The migrations folder can now be archived or removed."
echo "All future changes should be made to init-db/01-init.sql"
