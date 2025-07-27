#!/bin/bash

echo "🔧 Passe Frontend für Port 9080 an..."

cd /Users/alflewerken/Desktop/web-appliance-dashboard/Mac-Electron/frontend-build

# Ersetze alle Vorkommen von localhost:3001 mit localhost:9080
echo "📝 Ersetze API URLs..."

# Für JavaScript Dateien
find . -name "*.js" -type f -exec sed -i '' 's/localhost:3001/localhost:9080/g' {} \;

# Für HTML Dateien
find . -name "*.html" -type f -exec sed -i '' 's/localhost:3001/localhost:9080/g' {} \;

# Spezifische Ersetzungen für verschiedene URL-Formate
find . -name "*.js" -type f -exec sed -i '' 's|http://localhost:3001|http://localhost:9080|g' {} \;
find . -name "*.js" -type f -exec sed -i '' 's|ws://localhost:3001|ws://localhost:9080|g' {} \;
find . -name "*.js" -type f -exec sed -i '' 's|"3001"|"9080"|g' {} \;

echo "✅ Frontend URLs angepasst!"
echo ""
echo "Die App sollte jetzt mit dem Backend auf Port 9080 funktionieren."
