#!/bin/bash

# Übersetzungsskript für deutsche Dokumentation
# Dieses Skript ersetzt häufige englische Begriffe in deutschen Markdown-Dateien

echo "🌐 Starte Übersetzung der deutschen Dokumentation..."

# Liste der zu übersetzenden Dateien
files=(
    "docs/security-best-practices-guide-ger.md"
    "docs/api-client-sdks-ger.md"
    "docs/api-reference-ger.md"
    "docs/docker-env-setup-ger.md"
    "docs/integration-guide-ger.md"
    "docs/performance-tuning-guide-ger.md"
    "docs/remote-desktop-setup-guide-ger.md"
    "docs/BACKEND_PROXY_IMPLEMENTATION-ger.md"
    "docs/DEVELOPMENT_SETUP-ger.md"
    "docs/PROXY_IMPLEMENTATION_SUMMARY-ger.md"
    "docs/REMOTE_DESKTOP_PASSWORD_RESTORE-ger.md"
)

# Backup-Verzeichnis erstellen
backup_dir="docs/backup-translations-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"

# Funktion zum Ersetzen von Begriffen
translate_file() {
    local file=$1
    local backup_file="$backup_dir/$(basename $file)"
    
    echo "📄 Übersetze: $file"
    
    # Backup erstellen
    cp "$file" "$backup_file"
    
    # Temporäre Datei für Bearbeitung
    tmp_file="${file}.tmp"
    cp "$file" "$tmp_file"
    
    # Überschriften und häufige Begriffe ersetzen
    # WICHTIG: Längere Begriffe zuerst, um Teilersetzungen zu vermeiden
    
    # Überschriften
    sed -i 's/Table of Contents/Inhaltsverzeichnis/g' "$tmp_file"
    sed -i 's/## Overview/## Übersicht/g' "$tmp_file"
    sed -i 's/## Introduction/## Einführung/g' "$tmp_file"
    sed -i 's/## Prerequisites/## Voraussetzungen/g' "$tmp_file"
    sed -i 's/## Requirements/## Anforderungen/g' "$tmp_file"
    sed -i 's/## Installation/## Installation/g' "$tmp_file"
    sed -i 's/## Configuration/## Konfiguration/g' "$tmp_file"
    sed -i 's/## Setup/## Einrichtung/g' "$tmp_file"
    sed -i 's/## Quick Start/## Schnellstart/g' "$tmp_file"
    sed -i 's/## Getting Started/## Erste Schritte/g' "$tmp_file"
    sed -i 's/## Features/## Funktionen/g' "$tmp_file"
    sed -i 's/## Usage/## Verwendung/g' "$tmp_file"
    sed -i 's/## Example/## Beispiel/g' "$tmp_file"
    sed -i 's/## Examples/## Beispiele/g' "$tmp_file"
    sed -i 's/## Documentation/## Dokumentation/g' "$tmp_file"
    sed -i 's/## Reference/## Referenz/g' "$tmp_file"
    sed -i 's/## Guide/## Leitfaden/g' "$tmp_file"
    sed -i 's/## Summary/## Zusammenfassung/g' "$tmp_file"
    sed -i 's/## Troubleshooting/## Fehlerbehebung/g' "$tmp_file"
    
    # Sicherheitsbegriffe
    sed -i 's/Security Features/Sicherheitsfunktionen/g' "$tmp_file"
    sed -i 's/Container Security/Container-Sicherheit/g' "$tmp_file"
    sed -i 's/SSH Security/SSH-Sicherheit/g' "$tmp_file"
    sed -i 's/Remote Desktop Security/Remote-Desktop-Sicherheit/g' "$tmp_file"
    sed -i 's/Infrastructure Security/Infrastruktur-Sicherheit/g' "$tmp_file"
    sed -i 's/Application Security/Anwendungssicherheit/g' "$tmp_file"
    sed -i 's/Data Security/Datensicherheit/g' "$tmp_file"
    sed -i 's/Perimeter Security/Perimeter-Sicherheit/g' "$tmp_file"
    sed -i 's/Operational Security/Betriebssicherheit/g' "$tmp_file"
    sed -i 's/Password Policy/Passwort-Richtlinie/g' "$tmp_file"
    sed -i 's/JWT Configuration/JWT-Konfiguration/g' "$tmp_file"
    
    # System-Begriffe
    sed -i 's/Audit & Monitoring/Audit & Überwachung/g' "$tmp_file"
    sed -i 's/System Requirements/Systemanforderungen/g' "$tmp_file"
    sed -i 's/Performance Optimization/Leistungsoptimierung/g' "$tmp_file"
    sed -i 's/Backup & Restore/Sicherung & Wiederherstellung/g' "$tmp_file"
    sed -i 's/Environment Variables/Umgebungsvariablen/g' "$tmp_file"
    sed -i 's/Default Values/Standardwerte/g' "$tmp_file"
    
    # Aktionen
    sed -i 's/Create Backup/Sicherung erstellen/g' "$tmp_file"
    sed -i 's/Restore Backup/Sicherung wiederherstellen/g' "$tmp_file"
    sed -i 's/Get Started/Erste Schritte/g' "$tmp_file"
    
    # Code-Kommentare (nur in Code-Blöcken)
    # Diese müssen vorsichtiger behandelt werden
    perl -i -pe '
        if (/^```/ ... /^```/) {
            s|// Initialize|// Initialisieren|g;
            s|// Configure|// Konfigurieren|g;
            s|// Create|// Erstellen|g;
            s|// Update|// Aktualisieren|g;
            s|// Delete|// Löschen|g;
            s|// Check|// Prüfen|g;
            s|// Validate|// Validieren|g;
            s|// Handle error|// Fehler behandeln|g;
            s|// Process|// Verarbeiten|g;
            s|// Return|// Zurückgeben|g;
            s|// Set|// Setzen|g;
            s|// Get|// Abrufen|g;
            s|// Connect|// Verbinden|g;
            s|// Disconnect|// Trennen|g;
            s|// Clean up|// Aufräumen|g;
            s|// Helper function|// Hilfsfunktion|g;
            s|// Main function|// Hauptfunktion|g;
            s|// Optional|// Optional|g;
            s|// Required|// Erforderlich|g;
            s|// Default|// Standard|g;
            s|// Example|// Beispiel|g;
            s|// Note|// Hinweis|g;
            s|// WARNING|// WARNUNG|g;
            s|// IMPORTANT|// WICHTIG|g;
        }
    ' "$tmp_file"
    
    # Datei zurückkopieren
    mv "$tmp_file" "$file"
    
    echo "✅ $file übersetzt (Backup: $backup_file)"
}

# Alle Dateien übersetzen
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        translate_file "$file"
    else
        echo "⚠️  Datei nicht gefunden: $file"
    fi
done

echo ""
echo "✅ Übersetzung abgeschlossen!"
echo "📁 Backups gespeichert in: $backup_dir"
echo ""
echo "⚠️  WICHTIGE HINWEISE:"
echo "- Bitte überprüfen Sie die übersetzten Dateien manuell"
echo "- Technische Begriffe (API, REST, HTTP, etc.) wurden bewusst nicht übersetzt"
echo "- Code-Variablen und Funktionsnamen bleiben englisch"
echo "- Bei Problemen können Sie die Backups wiederherstellen"
