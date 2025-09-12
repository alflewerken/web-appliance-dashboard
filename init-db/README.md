# Database Schema - Web Appliance Dashboard

## Version 2.0.0 - Consolidated Schema

As of September 12, 2025, the database schema has been consolidated from multiple migration files into a single, clean schema file.

## Structure

### Main Schema File
- **Location**: `init-db/01-init.sql`
- **Version**: 2.0.0
- **Description**: Complete database schema including all tables, indexes, and default data

### Key Changes in Consolidation

1. **SNMP Configuration**: Moved to dedicated `host_snmp_configs` table (no longer in `hosts` table)
2. **Monitoring Tables**: Full suite of monitoring tables for metrics, disk, and network interfaces
3. **Audit & Logging**: Comprehensive audit trail and activity logging
4. **Views**: Optimized views for common queries

## Migration from Old Structure

If you have an existing database with the old migration-based structure:

```bash
./scripts/migrate-to-consolidated.sh
```

This script will mark your database as consolidated without changing any data.

## Archived Migrations

Old migration files have been moved to `backend/migrations-archived/` for reference.
These files are no longer needed for new installations.

## Table Overview

### Core Tables
- `users` - System users with role-based access
- `hosts` - SSH/Terminal/Remote desktop hosts
- `appliances` - Web applications and services
- `categories` - Organization for appliances
- `ssh_keys` - SSH key storage

### SNMP & Monitoring
- `host_snmp_configs` - SNMP configuration per host
- `snmp_metrics` - Time-series metrics data
- `host_monitoring_data` - Aggregated monitoring data
- `host_metrics_logging` - Metrics configuration
- `disk_configurations` - Disk monitoring config
- `interface_mappings` - Network interface mappings
- `snmp_reload_signals` - Worker process signals

### System Tables
- `app_settings` - Application settings
- `user_preferences` - User preferences
- `user_sessions` - Active sessions
- `audit_logs` - Security audit trail
- `activity_logs` - User activity tracking
- `migrations` - Migration history

## Best Practices

1. **All future schema changes** should be made directly to `init-db/01-init.sql`
2. **Version control** the schema file for tracking changes
3. **Test changes** in a development environment first
4. **Document** significant schema changes in this README

## Backup & Restore

The consolidated schema is fully compatible with the backup/restore functionality:
- New backups work with the consolidated structure
- Old backups are automatically migrated during restore
- SNMP configurations are preserved and migrated as needed

## Development

For local development with a fresh database:

```bash
docker-compose down -v  # Remove volumes
docker-compose up -d    # Start with fresh consolidated schema
```

## Notes

- The consolidation is a structural improvement, not a data migration
- No data is lost or changed during consolidation
- Full backward compatibility is maintained
