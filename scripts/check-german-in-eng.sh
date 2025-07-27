#!/bin/bash

# Script to check which -eng files still contain German content

echo "🔍 Checking for German content in -eng files..."
echo "============================================="
echo ""

cd "$(dirname "$0")/../docs" || exit 1

# German indicators to look for
german_indicators=(
    "Übersicht"
    "Einführung"
    "Beschreibung"
    "Beispiel"
    "Hinweis"
    "Warnung"
    "Anleitung"
    "Konfiguration"
    "Sicherheit"
    "Verwaltung"
    "Benutzer"
    "Passwort"
    "Schlüssel"
    "Verbindung"
    "Einstellungen"
    "Fehler"
    "Lösung"
    "wurde"
    "können"
    "müssen"
    "sollen"
    "werden"
    "für"
    "über"
    "oder"
    "und"
)

# Function to check file for German content
check_german_content() {
    local file=$1
    local found_german=false
    
    for indicator in "${german_indicators[@]}"; do
        if grep -q "$indicator" "$file" 2>/dev/null; then
            found_german=true
            break
        fi
    done
    
    echo $found_german
}

# Check all -eng.md files
eng_files_with_german=()
eng_files_ok=()

for eng_file in *-eng.md; do
    if [ -f "$eng_file" ]; then
        if [ "$(check_german_content "$eng_file")" = "true" ]; then
            eng_files_with_german+=("$eng_file")
            echo "❌ $eng_file - Contains German content"
        else
            eng_files_ok+=("$eng_file")
            echo "✅ $eng_file - Appears to be in English"
        fi
    fi
done

echo ""
echo "📊 Summary:"
echo "==========="
echo "✅ English files OK: ${#eng_files_ok[@]}"
echo "❌ Files with German content: ${#eng_files_with_german[@]}"

if [ ${#eng_files_with_german[@]} -gt 0 ]; then
    echo ""
    echo "📝 Files that need translation to English:"
    for file in "${eng_files_with_german[@]}"; do
        echo "   - $file"
    done
fi
