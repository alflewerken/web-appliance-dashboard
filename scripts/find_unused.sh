#!/bin/bash
# Script zum Finden ungenutzter JS-Komponenten

echo "=== Ungenutzte Komponenten-Analyse ==="
echo ""

cd /Users/alflewerken/Desktop/web-appliance-dashboard/frontend/src

# Alle JS-Dateien in components finden
for file in $(find components -name "*.js" -o -name "*.jsx" | grep -v index.js); do
    filename=$(basename "$file" .js)
    filename=$(basename "$filename" .jsx)
    
    # Prüfen ob die Datei irgendwo importiert wird
    grep_result=$(grep -r "import.*$filename" . --include="*.js" --include="*.jsx" 2>/dev/null | grep -v "^$file:")
    
    if [ -z "$grep_result" ]; then
        echo "❌ UNGENUTZT: $file"
    fi
done

echo ""
echo "=== Analyse abgeschlossen ==="
