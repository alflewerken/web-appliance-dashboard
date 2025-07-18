#!/bin/bash
# Öffne Terminal Test Page

cd "$(dirname "$0")"

echo "Öffne Terminal Test Page..."
echo ""

# Kopiere Test-Seite in das Frontend-Verzeichnis
cp terminal-test.html ../frontend/public/terminal-test.html

echo "Test-Seite verfügbar unter:"
echo "http://localhost:9081/terminal-test.html"
echo ""
echo "Öffne diese URL im Dashboard Browser"
echo "Oder navigiere direkt dort hin"
echo ""

# Öffne im Browser
open "http://localhost:9081/terminal-test.html"
