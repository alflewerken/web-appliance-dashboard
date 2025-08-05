#!/bin/bash

# Script to remove deprecated ssh_hosts references from backend
# Date: 2025-08-03

echo "🧹 Cleaning up deprecated ssh_hosts references..."

# List of files that need to be removed or heavily modified
FILES_TO_REMOVE=(
    "backend/regenerate-ssh-config.js"
    "backend/debug-host6.js"
    "backend/utils/sshManager.js"
    "backend/utils/sshStatusMonitor.js"
    "backend/utils/ssh-post-restore-fix.js"
    "backend/utils/ssh-restore-fix.js"
    "backend/utils/quick-ssh-fix.js"
)

# Remove deprecated files
for file in "${FILES_TO_REMOVE[@]}"; do
    if [ -f "$file" ]; then
        echo "❌ Removing deprecated file: $file"
        rm -f "$file"
    fi
done

echo ""
echo "⚠️  The following files need manual review and modification:"
echo "These files contain references to ssh_hosts that need to be updated to use hosts table:"
echo ""
echo "1. backend/routes/commands.js - Update SQL queries to use hosts table"
echo "2. backend/routes/backup.js - Remove ssh_hosts backup/restore logic"
echo "3. backend/routes/auditRestore.js - Remove ssh_hosts restore functions"
echo "4. backend/routes/rustdesk-install.js - Update JOIN queries to use hosts"
echo "5. backend/routes/terminal-websocket/ssh-terminal.js - Update to use hosts"
echo "6. backend/utils/guacamoleHelper.js - Update to use hosts"
echo "7. backend/utils/sshUploadHandler.js - Update host lookups"
echo "8. backend/utils/ssh.js - Update host queries"
echo "9. backend/utils/sshDiagnostic.js - Update diagnostic queries"
echo "10. backend/utils/terminal-session.js - Update to use hosts"
echo "11. backend/utils/backup/*.js - Update backup validators and managers"
echo ""
echo "These changes require careful review to ensure functionality is preserved."
echo ""
echo "✅ Cleanup script completed. Please review the files listed above."
