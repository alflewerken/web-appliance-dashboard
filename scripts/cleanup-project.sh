#!/bin/bash

# Web Appliance Dashboard - Projekt Aufräum-Skript

echo "🧹 Starte Projekt-Aufräumung..."

# Entferne Backup-Dateien
echo "📁 Entferne Backup-Dateien..."
find . -name "*.backup" -type f -delete
find . -name "*.backup2" -type f -delete
find . -name "*.old" -type f -delete
find . -name "*.broken" -type f -delete

# Entferne temporäre Dateien
echo "🗑️  Entferne temporäre Dateien..."
find . -name "*.tmp" -type f -delete
find . -name "*.temp" -type f -delete
find . -name "*~" -type f -delete
find . -name "*.swp" -type f -delete

# Entferne OS-spezifische Dateien
echo "💻 Entferne OS-spezifische Dateien..."
find . -name ".DS_Store" -type f -delete
find . -name "Thumbs.db" -type f -delete

# Entferne Debug-Dateien
echo "🐛 Entferne Debug-Dateien..."
find . -name "*debug*.html" -type f -delete
find . -name "*debug*.css" -type f -delete
find . -name "*test*.html" -type f -delete

# Entferne leere Verzeichnisse
echo "📂 Entferne leere Verzeichnisse..."
find . -type d -empty -delete

# Git Cache bereinigen
if [ -d ".git" ]; then
    echo "🔧 Bereinige Git-Cache..."
    git gc --prune=now
fi

echo "✅ Aufräumung abgeschlossen!"

# Zeige Projekt-Statistiken
echo ""
echo "📊 Projekt-Statistiken:"
echo "Anzahl Dateien: $(find . -type f -not -path "./node_modules/*" -not -path "./.git/*" | wc -l)"
echo "Anzahl Verzeichnisse: $(find . -type d -not -path "./node_modules/*" -not -path "./.git/*" | wc -l)"

# Zeige größte Dateien
echo ""
echo "📏 Größte Dateien (Top 10):"
find . -type f -not -path "./node_modules/*" -not -path "./.git/*" -exec ls -lh {} \; | sort -k5 -hr | head -10

echo ""
echo "💡 Tipp: Führe 'git status' aus, um unversionierte Dateien zu sehen."
