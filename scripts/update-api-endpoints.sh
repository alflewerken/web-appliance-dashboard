#!/bin/bash

# Script to update API endpoints from kebab-case to camelCase
# This script updates all frontend files to use the new camelCase API endpoints

cd /Users/alflewerken/Desktop/web-appliance-dashboard

# Update frontend files
echo "Updating frontend API endpoints..."

# Replace audit-logs with auditLogs
echo "Replacing /api/audit-logs with /api/auditLogs"
find frontend/src -type f \( -name "*.js" -o -name "*.jsx" \) -exec grep -l "/api/audit-logs" {} \; | while read file; do
    echo "  Updating $file"
    sed -i '' "s|/api/audit-logs|/api/auditLogs|g" "$file"
done

# Replace audit-restore with auditRestore
echo "Replacing /api/audit-restore with /api/auditRestore"
find frontend/src -type f \( -name "*.js" -o -name "*.jsx" \) -exec grep -l "/api/audit-restore" {} \; | while read file; do
    echo "  Updating $file"
    sed -i '' "s|/api/audit-restore|/api/auditRestore|g" "$file"
done

# Replace ssh-keys with sshKeys
echo "Replacing /api/ssh-keys with /api/sshKeys"
find frontend/src -type f \( -name "*.js" -o -name "*.jsx" \) -exec grep -l "/api/ssh-keys" {} \; | while read file; do
    echo "  Updating $file"
    sed -i '' "s|/api/ssh-keys|/api/sshKeys|g" "$file"
done

# Replace status-check with statusCheck
echo "Replacing /api/status-check with /api/statusCheck"
find frontend/src -type f \( -name "*.js" -o -name "*.jsx" \) -exec grep -l "/api/status-check" {} \; | while read file; do
    echo "  Updating $file"
    sed -i '' "s|/api/status-check|/api/statusCheck|g" "$file"
done

# Replace rustdesk-install with rustdeskInstall
echo "Replacing /api/rustdesk-install with /api/rustdeskInstall"
find frontend/src -type f \( -name "*.js" -o -name "*.jsx" \) -exec grep -l "/api/rustdesk-install" {} \; | while read file; do
    echo "  Updating $file"
    sed -i '' "s|/api/rustdesk-install|/api/rustdeskInstall|g" "$file"
done

echo "API endpoint updates completed!"
