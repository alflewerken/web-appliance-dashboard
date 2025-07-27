#!/bin/bash

# Script to check translation status of documentation files

echo "📊 Übersetzungsstatus der Dokumentation"
echo "======================================"
echo ""

cd "$(dirname "$0")/../docs" || exit 1

# Arrays für die Statistik
translated=()
needs_translation=()

# Alle -ger.md Dateien durchgehen
for ger_file in *-ger.md; do
    if [ -f "$ger_file" ]; then
        # Korrespondierende englische Datei
        eng_file="${ger_file%-ger.md}-eng.md"
        
        if [ -f "$eng_file" ]; then
            # Größenvergleich
            ger_size=$(wc -l < "$ger_file" | tr -d ' ')
            eng_size=$(wc -l < "$eng_file" | tr -d ' ')
            
            # Wenn deutsche Datei mindestens 80% der Größe der englischen hat, gilt sie als übersetzt
            threshold=$((eng_size * 80 / 100))
            
            if [ "$ger_size" -ge "$threshold" ]; then
                translated+=("$ger_file")
                echo "✅ $ger_file (${ger_size} Zeilen / ${eng_size} Zeilen)"
            else
                needs_translation+=("$ger_file")
                echo "❌ $ger_file (${ger_size} Zeilen / ${eng_size} Zeilen) - Übersetzung unvollständig"
            fi
        fi
    fi
done

echo ""
echo "📈 Zusammenfassung:"
echo "==================="
echo "✅ Übersetzt: ${#translated[@]} Dateien"
echo "❌ Benötigt Übersetzung: ${#needs_translation[@]} Dateien"
echo ""

if [ ${#needs_translation[@]} -gt 0 ]; then
    echo "📝 Dateien, die übersetzt werden müssen:"
    for file in "${needs_translation[@]}"; do
        echo "   - $file"
    done
fi
