#!/bin/bash

echo "🔧 Passe Frontend für Electron an..."

# Verzeichnis prüfen
if [ ! -d "frontend-build" ]; then
    echo "❌ frontend-build Verzeichnis nicht gefunden!"
    echo "Bitte erst ./build-frontend.sh ausführen"
    exit 1
fi

cd frontend-build

# Backup erstellen
cp index.html index.html.backup 2>/dev/null

# Ersetze absolute Pfade mit relativen Pfaden in allen HTML-Dateien
echo "📝 Korrigiere Pfade in HTML-Dateien..."

# Für macOS verwenden wir sed mit -i ''
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    find . -name "*.html" -type f | while read file; do
        sed -i '' 's|href="/|href="./|g' "$file"
        sed -i '' 's|src="/|src="./|g' "$file"
        sed -i '' 's|content="/|content="./|g' "$file"
    done
    
    # Spezielle Anpassungen für React Router
    if [ -f "index.html" ]; then
        sed -i '' 's|<script>window.PUBLIC_URL=""</script>|<script>window.PUBLIC_URL="."</script>|g' index.html
    fi
else
    # Linux
    find . -name "*.html" -type f | while read file; do
        sed -i 's|href="/|href="./|g' "$file"
        sed -i 's|src="/|src="./|g' "$file"
        sed -i 's|content="/|content="./|g' "$file"
    done
    
    if [ -f "index.html" ]; then
        sed -i 's|<script>window.PUBLIC_URL=""</script>|<script>window.PUBLIC_URL="."</script>|g' index.html
    fi
fi

# Korrigiere JavaScript-Dateien für relative Imports
echo "📝 Korrigiere JavaScript Imports..."

# Finde und korrigiere static imports
if [ -d "static/js" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        find static/js -name "*.js" -type f | while read file; do
            sed -i '' 's|"/static/|"./static/|g' "$file"
        done
    else
        find static/js -name "*.js" -type f | while read file; do
            sed -i 's|"/static/|"./static/|g' "$file"
        done
    fi
fi

echo "✅ Frontend für Electron angepasst!"
cd ..
