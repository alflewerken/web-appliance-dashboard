#!/bin/bash

# Script zum Aktualisieren der externen URL

echo "🔧 Web Appliance Dashboard - Externe URL Update"
echo "=============================================="
echo ""

# Prüfe ob .env existiert
if [ ! -f .env ]; then
    echo "❌ .env Datei nicht gefunden!"
    echo "   Bitte führen Sie zuerst ./scripts/setup-env.sh aus"
    exit 1
fi

# Backup der .env Datei
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup erstellt: .env.backup.*"

# Aktuelle externe URL anzeigen
CURRENT_URL=$(grep "^EXTERNAL_URL=" .env | cut -d= -f2- || echo "(nicht gesetzt)")
echo ""
echo "Aktuelle externe URL: $CURRENT_URL"
echo ""

# Neue URL abfragen
echo "Geben Sie die neue externe URL ein, unter der das Dashboard erreichbar ist."
echo "Beispiele:"
echo "  - http://192.168.178.100:9080"
echo "  - https://dashboard.example.com"
echo "  - http://10.0.0.50:9080"
echo ""
echo "Leer lassen um die externe URL zu entfernen."
echo ""
read -p "Neue externe URL: " NEW_URL

# URL setzen oder entfernen
if [ -n "$NEW_URL" ]; then
    # Setze die externe URL
    if grep -q "^EXTERNAL_URL=" .env; then
        # Ersetze existierende Zeile
        sed -i.bak "s|^EXTERNAL_URL=.*|EXTERNAL_URL=$NEW_URL|" .env
    else
        # Füge neue Zeile hinzu
        echo "EXTERNAL_URL=$NEW_URL" >> .env
    fi
    echo "✅ Externe URL wurde gesetzt auf: $NEW_URL"
else
    # Entferne externe URL
    if grep -q "^EXTERNAL_URL=" .env; then
        sed -i.bak "/^EXTERNAL_URL=/d" .env
        echo "✅ Externe URL wurde entfernt"
    else
        echo "ℹ️  Keine externe URL war gesetzt"
    fi
fi

# Cleanup backup files
rm -f .env.bak

# Backend .env synchronisieren
if [ -f backend/.env ]; then
    echo ""
    echo "📦 Synchronisiere backend/.env..."
    
    # Backup
    cp backend/.env backend/.env.backup.$(date +%Y%m%d_%H%M%S)
    
    if [ -n "$NEW_URL" ]; then
        # Setze URL in backend/.env
        if grep -q "^EXTERNAL_URL=" backend/.env; then
            sed -i.bak "s|^EXTERNAL_URL=.*|EXTERNAL_URL=$NEW_URL|" backend/.env
        else
            echo "EXTERNAL_URL=$NEW_URL" >> backend/.env
        fi
    else
        # Entferne URL aus backend/.env
        sed -i.bak "/^EXTERNAL_URL=/d" backend/.env
    fi
    
    # Cleanup
    rm -f backend/.env.bak
    echo "✅ backend/.env synchronisiert"
fi

# Backend neu starten
echo ""
echo "🔄 Backend wird neu gestartet..."
docker-compose restart backend

echo ""
echo "✅ Fertig!"

if [ -n "$NEW_URL" ]; then
    echo "   Remote Desktop Links nutzen jetzt: $NEW_URL/guacamole/"
else
    echo "   Remote Desktop nutzt jetzt die Standard-URLs"
fi
echo ""
echo "💡 Tipp: Testen Sie die Remote Desktop Funktion nach dieser Änderung"