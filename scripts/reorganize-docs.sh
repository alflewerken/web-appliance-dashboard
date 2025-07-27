#!/bin/bash

# Script to reorganize documentation files with language suffixes
# -eng for English, -ger for German

echo "🌐 Reorganizing documentation files with language suffixes..."

# Change to docs directory
cd "$(dirname "$0")/../docs" || exit 1

# Create backup directory
mkdir -p backup-original-docs
echo "📁 Creating backup of original documentation..."

# List of documentation files to process
docs=(
    "BACKEND_PROXY_IMPLEMENTATION.md"
    "DEVELOPMENT_SETUP.md"
    "PROXY_IMPLEMENTATION_SUMMARY.md"
    "REMOTE_DESKTOP_PASSWORD_RESTORE.md"
    "api-client-sdks.md"
    "api-reference.md"
    "docker-env-setup.md"
    "integration-guide.md"
    "performance-tuning-guide.md"
    "remote-desktop-setup-guide.md"
    "security-best-practices-guide.md"
)

# First, backup all original files
for doc in "${docs[@]}"; do
    if [ -f "$doc" ]; then
        cp "$doc" "backup-original-docs/$doc"
        echo "✅ Backed up: $doc"
    fi
done

# Process each documentation file
for doc in "${docs[@]}"; do
    if [ -f "$doc" ]; then
        # Get filename without extension
        basename="${doc%.md}"
        
        # Create English version with -eng suffix
        cp "$doc" "${basename}-eng.md"
        echo "🇬🇧 Created: ${basename}-eng.md"
        
        # Create German version placeholder (to be translated)
        cp "$doc" "${basename}-ger.md"
        echo "🇩🇪 Created: ${basename}-ger.md (needs translation)"
        
        # Remove original file
        rm "$doc"
        echo "🗑️  Removed original: $doc"
    fi
done

echo ""
echo "📋 Summary:"
echo "- Original files backed up to: docs/backup-original-docs/"
echo "- English versions created with -eng suffix"
echo "- German versions created with -ger suffix (need translation)"
echo ""
echo "✅ Documentation reorganization complete!"
