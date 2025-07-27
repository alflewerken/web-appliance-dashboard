#!/bin/bash

# Script zum einfachen Setup mit vorhandenem Verschlüsselungsschlüssel

set -e

echo "🔧 Web Appliance Dashboard - Quick Setup with Encryption Key"
echo "==========================================================="

# Prüfe ob .env bereits existiert
if [ -f .env ]; then
    echo "⚠️  .env existiert bereits!"
    read -p "Überschreiben? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup abgebrochen."
        exit 1
    fi
    # Backup erstellen
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backup erstellt: .env.backup.*"
fi

# Verschlüsselungsschlüssel abfragen
echo ""
echo "🔐 Bitte geben Sie Ihren Verschlüsselungsschlüssel ein:"
echo "   (Dieser wird für die Verschlüsselung von Remote-Host-Passwörtern verwendet)"
echo ""
read -p "Verschlüsselungsschlüssel: " ENCRYPTION_KEY

if [ -z "$ENCRYPTION_KEY" ]; then
    echo "❌ Kein Verschlüsselungsschlüssel eingegeben. Setup abgebrochen."
    exit 1
fi

# Externe URL abfragen
echo ""
echo "📡 Externe URL für Remote-Zugriff (z.B. http://192.168.1.100:9080):"
read -p "Externe URL (Enter für localhost): " EXTERNAL_URL

# Setup durchführen
echo ""
echo "🚀 Führe Setup aus..."

# Verwende das normale setup-env.sh mit vorgegebenem Schlüssel
export SSH_KEY_INPUT="$ENCRYPTION_KEY"

# Erstelle temporäre Antwort-Datei für automatisiertes Setup
TEMP_ANSWERS=$(mktemp)
cat > "$TEMP_ANSWERS" << EOF
$ENCRYPTION_KEY
$EXTERNAL_URL


EOF

# Führe setup-env.sh mit den Antworten aus
./scripts/setup-env.sh < "$TEMP_ANSWERS"

# Aufräumen
rm -f "$TEMP_ANSWERS"

echo ""
echo "✅ Setup abgeschlossen!"
echo ""
echo "📝 Nächste Schritte:"
echo "1. Starten Sie die Container: docker-compose up -d"
echo "2. Zugriff auf das Dashboard: http://localhost:9080"
if [ -n "$EXTERNAL_URL" ]; then
    echo "3. Remote-Zugriff: $EXTERNAL_URL"
fi
