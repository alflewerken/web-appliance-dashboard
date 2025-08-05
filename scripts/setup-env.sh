#!/bin/bash

# Script zum sicheren Setup der Environment-Variablen

set -e

echo "🔧 Web Appliance Dashboard - Environment Setup"
echo "============================================="

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

# .env aus Example erstellen
cp .env.example .env
echo "✅ .env erstellt aus .env.example"

# Funktion zum Generieren sicherer Secrets (ohne Newlines!)
generate_secret() {
    # Generiere Secret und entferne alle Newlines
    openssl rand -base64 $1 | tr -d '\n\r'
}

# Funktion zum sicheren Ersetzen in Dateien (einfache bash Lösung)
safe_replace() {
    local file=$1
    local key=$2
    local value=$3
    
    # Erstelle eine temporäre Datei
    local tmp_file="${file}.tmp.$$"
    
    # Verwende eine while-Schleife um die Datei zu lesen und zu ersetzen
    while IFS= read -r line || [ -n "$line" ]; do
        if [[ "$line" == "$key="* ]]; then
            # Ersetze die Zeile mit dem neuen Wert
            echo "${key}=${value}"
        else
            # Behalte die Zeile wie sie ist
            echo "$line"
        fi
    done < "$file" > "$tmp_file"
    
    # Ersetze die originale Datei
    mv "$tmp_file" "$file"
}

# Neue Secrets generieren
echo "🔐 Generiere sichere Secrets..."

# JWT Secret (64 Bytes)
JWT_SECRET=$(generate_secret 64)
safe_replace .env "JWT_SECRET" "$JWT_SECRET"

# SSH Encryption Key - Frage den Benutzer
echo ""
echo "🔐 Verschlüsselungsschlüssel für Remote-Host-Passwörter"
echo "=================================================="
echo ""
echo "Dieser Schlüssel wird verwendet, um Passwörter für Remote-Hosts (SSH, VNC, RDP)"
echo "sicher zu verschlüsseln. Er wird benötigt, um nach einer Backup-Wiederherstellung"
echo "die verschlüsselten Passwörter wieder entschlüsseln zu können."
echo ""
echo "⚠️  WICHTIG: Bewahren Sie diesen Schlüssel sicher auf!"
echo "   - Ohne diesen Schlüssel müssen alle Remote-Passwörter neu eingegeben werden"
echo "   - Speichern Sie ihn in einem Passwort-Manager"
echo "   - Teilen Sie ihn nicht mit unbefugten Personen"
echo ""
read -p "Verschlüsselungsschlüssel eingeben (Enter für automatische Generierung): " SSH_KEY_INPUT

if [ -n "$SSH_KEY_INPUT" ]; then
    # Benutzer hat einen Schlüssel eingegeben
    SSH_KEY="$SSH_KEY_INPUT"
    echo "✅ Benutzerdefinierter Verschlüsselungsschlüssel wird verwendet"
else
    # Generiere einen sicheren Schlüssel (32 Zeichen)
    SSH_KEY=$(generate_secret 32 | head -c 32)
    echo ""
    echo "🔑 Ein sicherer Schlüssel wurde generiert:"
    echo ""
    echo "    $SSH_KEY"
    echo ""
    echo "⚠️  BITTE NOTIEREN SIE SICH DIESEN SCHLÜSSEL!"
    echo "   Er wird für die Entschlüsselung von Remote-Passwörtern nach einer"
    echo "   Backup-Wiederherstellung benötigt."
    echo ""
    read -p "Drücken Sie Enter, wenn Sie den Schlüssel notiert haben..." -n 1 -r
    echo ""
fi

safe_replace .env "SSH_KEY_ENCRYPTION_SECRET" "$SSH_KEY"
safe_replace .env "ENCRYPTION_SECRET" "$SSH_KEY"

# MySQL Root Password
MYSQL_ROOT_PWD=$(generate_secret 24)
safe_replace .env "MYSQL_ROOT_PASSWORD" "$MYSQL_ROOT_PWD"

# MySQL User Password
MYSQL_USER_PWD=$(generate_secret 24)
safe_replace .env "MYSQL_PASSWORD" "$MYSQL_USER_PWD"
safe_replace .env "DB_PASSWORD" "$MYSQL_USER_PWD"

# Cleanup backup files
rm -f .env.bak

echo "✅ Secrets generiert und gespeichert"

# Default SSH User (optional, kann später pro Verbindung gesetzt werden)
# Wir setzen einfach einen leeren Wert - der Benutzer gibt das später im Dashboard ein
safe_replace .env "DEFAULT_SSH_USER" ""
safe_replace .env "DEFAULT_SSH_PASS" ""

# Domain/CORS konfigurieren
echo ""
read -p "Geben Sie Ihre Domain ein (oder Enter für localhost): " DOMAIN

if [ -n "$DOMAIN" ]; then
    CORS_ORIGINS="http://localhost,https://localhost,http://$DOMAIN,https://$DOMAIN,https://www.$DOMAIN"
    safe_replace .env "ALLOWED_ORIGINS" "$CORS_ORIGINS"
    rm -f .env.bak
    echo "✅ CORS Origins konfiguriert"
fi

# Externe URL für Remote-Zugriff konfigurieren
echo ""
echo "📡 Externe URL Konfiguration (für Remote Desktop)"
echo "Diese URL wird für Remote Desktop Verbindungen verwendet."
echo "Beispiele:"
echo "  - http://192.168.178.100:9080"
echo "  - https://dashboard.example.com"
echo "  - http://10.0.0.50:9080"
echo ""
read -p "Externe URL (Enter für Standard): " EXTERNAL_URL

if [ -n "$EXTERNAL_URL" ]; then
    # Setze die externe URL
    if grep -q "^EXTERNAL_URL=" .env; then
        # Ersetze existierende Zeile
        safe_replace .env "EXTERNAL_URL" "$EXTERNAL_URL"
    else
        # Füge neue Zeile hinzu
        echo "EXTERNAL_URL=$EXTERNAL_URL" >> .env
    fi
    rm -f .env.bak
    echo "✅ Externe URL gesetzt: $EXTERNAL_URL"
else
    echo "ℹ️  Keine externe URL gesetzt (Standard wird verwendet)"
fi

# Environment auswählen
echo ""
echo "Wählen Sie die Umgebung:"
echo "1) Production (default)"
echo "2) Development"
echo "3) Staging"
read -p "Auswahl [1-3]: " -n 1 -r ENV_CHOICE
echo

case $ENV_CHOICE in
    2)
        safe_replace .env "NODE_ENV" "development"
        safe_replace .env "LOG_LEVEL" "debug"
        echo "✅ Development Environment konfiguriert"
        ;;
    3)
        safe_replace .env "NODE_ENV" "staging"
        echo "✅ Staging Environment konfiguriert"
        ;;
    *)
        echo "✅ Production Environment beibehalten"
        ;;
esac

rm -f .env.bak

# Backend .env erstellen
echo ""
echo "📦 Erstelle Backend .env..."

# Alte backend/.env löschen falls vorhanden
if [ -f backend/.env ]; then
    echo "🗑️  Lösche alte backend/.env..."
    rm -f backend/.env
fi

# Neue backend/.env aus Example erstellen
if [ -f backend/.env.example ]; then
    cp backend/.env.example backend/.env
    echo "✅ Backend .env aus .env.example erstellt"
    
    # Sync Database Konfiguration
    DB_HOST=$(grep "DB_HOST=" .env | cut -d= -f2- || echo "database")
    DB_PORT=$(grep "DB_PORT=" .env | cut -d= -f2- || echo "3306")
    DB_USER=$(grep "DB_USER=" .env | cut -d= -f2- || echo "dashboard_user")
    DB_PASSWORD=$(grep "DB_PASSWORD=" .env | cut -d= -f2- || echo "")
    DB_NAME=$(grep "DB_NAME=" .env | cut -d= -f2- || echo "appliance_dashboard")
    
    # Update backend/.env mit den Werten aus der Haupt .env
    safe_replace backend/.env "DB_HOST" "$DB_HOST"
    safe_replace backend/.env "DB_PORT" "$DB_PORT"
    safe_replace backend/.env "DB_USER" "$DB_USER"
    safe_replace backend/.env "DB_PASSWORD" "$DB_PASSWORD"
    safe_replace backend/.env "DB_NAME" "$DB_NAME"
    
    # JWT und SSH Keys synchronisieren
    JWT_VALUE=$(grep "JWT_SECRET=" .env | cut -d= -f2- || echo "")
    SSH_VALUE=$(grep "SSH_KEY_ENCRYPTION_SECRET=" .env | cut -d= -f2- || echo "")
    ENCRYPTION_VALUE=$(grep "ENCRYPTION_SECRET=" .env | cut -d= -f2- || echo "")
    NODE_ENV=$(grep "NODE_ENV=" .env | cut -d= -f2- || echo "production")
    ALLOWED_ORIGINS=$(grep "ALLOWED_ORIGINS=" .env | cut -d= -f2- || echo "http://localhost,https://localhost")
    EXTERNAL_URL=$(grep "EXTERNAL_URL=" .env | cut -d= -f2- || echo "")
    
    safe_replace backend/.env "JWT_SECRET" "$JWT_VALUE"
    safe_replace backend/.env "SSH_KEY_ENCRYPTION_SECRET" "$SSH_VALUE"
    safe_replace backend/.env "ENCRYPTION_SECRET" "$ENCRYPTION_VALUE"
    safe_replace backend/.env "NODE_ENV" "$NODE_ENV"
    
    # CORS Settings aktualisieren
    if ! grep -q "CORS_ORIGIN=" backend/.env; then
        echo "CORS_ORIGIN=$ALLOWED_ORIGINS" >> backend/.env
    else
        safe_replace backend/.env "CORS_ORIGIN" "$ALLOWED_ORIGINS"
    fi
    
    # ALLOWED_ORIGINS hinzufügen falls nicht vorhanden (für neuere Versionen)
    if ! grep -q "ALLOWED_ORIGINS=" backend/.env; then
        echo "ALLOWED_ORIGINS=$ALLOWED_ORIGINS" >> backend/.env
    else
        safe_replace backend/.env "ALLOWED_ORIGINS" "$ALLOWED_ORIGINS"
    fi
    
    # External URL hinzufügen falls vorhanden
    if [ -n "$EXTERNAL_URL" ]; then
        if ! grep -q "EXTERNAL_URL=" backend/.env; then
            echo "EXTERNAL_URL=$EXTERNAL_URL" >> backend/.env
        else
            safe_replace backend/.env "EXTERNAL_URL" "$EXTERNAL_URL"
        fi
    fi
    
    # Cleanup backup files
    rm -f backend/.env.bak
    echo "✅ Backend .env erfolgreich synchronisiert"
else
    echo "❌ backend/.env.example nicht gefunden!"
    echo "   Erstelle minimale backend/.env..."
    cat > backend/.env << EOF
# Backend Configuration
PORT=3001

# Database Configuration
DB_HOST=${DB_HOST:-database}
DB_PORT=${DB_PORT:-3306}
DB_USER=${DB_USER:-dashboard_user}
DB_PASSWORD=$DB_PASSWORD
DB_NAME=${DB_NAME:-appliance_dashboard}

# JWT Configuration
JWT_SECRET=$JWT_VALUE

# SSH Key Encryption
SSH_KEY_ENCRYPTION_SECRET=$SSH_VALUE
ENCRYPTION_SECRET=$ENCRYPTION_VALUE

# Node Environment
NODE_ENV=$NODE_ENV

# CORS Settings
CORS_ORIGIN=$ALLOWED_ORIGINS
ALLOWED_ORIGINS=$ALLOWED_ORIGINS

# External URL (for generating links)
EXTERNAL_URL=$EXTERNAL_URL

# Logging
LOG_LEVEL=info

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# Session
SESSION_SECRET=$JWT_VALUE

# Rate Limiting
DISABLE_RATE_LIMIT=true
EOF
    echo "✅ Minimale backend/.env erstellt"
fi

# Frontend .env erstellen
echo ""
echo "📦 Erstelle Frontend .env..."

# Alte frontend/.env löschen falls vorhanden
if [ -f frontend/.env ]; then
    echo "🗑️  Lösche alte frontend/.env..."
    rm -f frontend/.env
fi

# Neue frontend/.env erstellen
if [ -f frontend/.env.example ]; then
    cp frontend/.env.example frontend/.env
    echo "✅ Frontend .env aus .env.example erstellt"
    
    # API URL konfigurieren
    REACT_APP_API_URL="http://localhost:9080/api"
    REACT_APP_WS_URL="ws://localhost:9080"
    REACT_APP_TERMINAL_URL="http://localhost:9080/terminal"
    REACT_APP_GUACAMOLE_URL="http://localhost:9080/guacamole"
    
    if [ -n "$EXTERNAL_URL" ]; then
        # Wenn externe URL gesetzt ist, diese für alle URLs verwenden
        # Protokoll extrahieren (http oder https)
        if [[ "$EXTERNAL_URL" =~ ^https:// ]]; then
            WS_PROTOCOL="wss"
        else
            WS_PROTOCOL="ws"
        fi
        # Host extrahieren (ohne Protokoll)
        HOST_PART="${EXTERNAL_URL#*://}"
        
        REACT_APP_API_URL="${EXTERNAL_URL}/api"
        REACT_APP_WS_URL="${WS_PROTOCOL}://${HOST_PART}"
        REACT_APP_TERMINAL_URL="${EXTERNAL_URL}/terminal"
        REACT_APP_GUACAMOLE_URL="${EXTERNAL_URL}/guacamole"
    fi
    
    # Update frontend/.env
    safe_replace frontend/.env "REACT_APP_API_URL" "$REACT_APP_API_URL"
    safe_replace frontend/.env "REACT_APP_WS_URL" "$REACT_APP_WS_URL"
    safe_replace frontend/.env "REACT_APP_TERMINAL_URL" "$REACT_APP_TERMINAL_URL"
    safe_replace frontend/.env "REACT_APP_GUACAMOLE_URL" "$REACT_APP_GUACAMOLE_URL"
    
    # Node Environment synchronisieren
    if ! grep -q "NODE_ENV=" frontend/.env; then
        echo "NODE_ENV=$NODE_ENV" >> frontend/.env
    else
        safe_replace frontend/.env "NODE_ENV" "$NODE_ENV"
    fi
    
    # Externe URL für Frontend
    if [ -n "$EXTERNAL_URL" ]; then
        if ! grep -q "REACT_APP_EXTERNAL_URL=" frontend/.env; then
            echo "REACT_APP_EXTERNAL_URL=$EXTERNAL_URL" >> frontend/.env
        else
            safe_replace frontend/.env "REACT_APP_EXTERNAL_URL" "$EXTERNAL_URL"
        fi
    fi
    
    # Cleanup backup files
    rm -f frontend/.env.bak
    echo "✅ Frontend .env erfolgreich konfiguriert"
else
    echo "❌ frontend/.env.example nicht gefunden!"
    echo "   Erstelle minimale frontend/.env..."
    cat > frontend/.env << EOF
# Frontend Configuration
NODE_ENV=$NODE_ENV

# API Configuration
REACT_APP_API_URL=$REACT_APP_API_URL
REACT_APP_WS_URL=$REACT_APP_WS_URL
REACT_APP_API_TIMEOUT=30000

# Terminal Configuration
REACT_APP_TERMINAL_URL=$REACT_APP_TERMINAL_URL
REACT_APP_TERMINAL_ENABLED=true

# Guacamole Configuration
REACT_APP_GUACAMOLE_URL=$REACT_APP_GUACAMOLE_URL

# Application Settings
REACT_APP_NAME=Web Appliance Dashboard
REACT_APP_VERSION=1.1.0
REACT_APP_ENVIRONMENT=$NODE_ENV

# Feature Flags
REACT_APP_FEATURE_SSH=true
REACT_APP_FEATURE_TERMINAL=true
REACT_APP_FEATURE_BACKUP=true
REACT_APP_FEATURE_AUDIT_LOG=true
REACT_APP_FEATURE_SERVICE_CONTROL=true
REACT_APP_FEATURE_DARK_MODE=true
REACT_APP_ENABLE_REMOTE_DESKTOP=true

# External URL (for generating public links)
REACT_APP_EXTERNAL_URL=$EXTERNAL_URL

# UI Configuration
REACT_APP_DEFAULT_THEME=dark
REACT_APP_ITEMS_PER_PAGE=20

# Polling Intervals (in milliseconds)
REACT_APP_STATUS_CHECK_INTERVAL=30000
REACT_APP_NOTIFICATION_DURATION=5000

# Session Configuration
REACT_APP_SESSION_TIMEOUT=86400000
REACT_APP_SESSION_WARNING_TIME=300000

# Public URL Configuration
PUBLIC_URL=/
EOF
    echo "✅ Minimale frontend/.env erstellt"
fi

# Überprüfung der erstellten Dateien
echo ""
echo "📋 Überprüfe erstellte Konfigurationsdateien..."
if [ -f .env ]; then
    echo "✅ .env vorhanden"
else
    echo "❌ .env fehlt!"
fi

if [ -f backend/.env ]; then
    echo "✅ backend/.env vorhanden"
    # Zeige Sync-Status
    MAIN_DB_PASS=$(grep "DB_PASSWORD=" .env | cut -d= -f2-)
    BACKEND_DB_PASS=$(grep "DB_PASSWORD=" backend/.env | cut -d= -f2-)
    if [ "$MAIN_DB_PASS" = "$BACKEND_DB_PASS" ]; then
        echo "✅ Datenbank-Passwörter sind synchronisiert"
    else
        echo "⚠️  WARNUNG: Datenbank-Passwörter sind NICHT synchronisiert!"
    fi
else
    echo "❌ backend/.env fehlt!"
fi

if [ -f frontend/.env ]; then
    echo "✅ frontend/.env vorhanden"
    # Zeige API URL
    FRONTEND_API_URL=$(grep "REACT_APP_API_URL=" frontend/.env | cut -d= -f2-)
    if [ -n "$FRONTEND_API_URL" ]; then
        echo "   API URL: $FRONTEND_API_URL"
    fi
else
    echo "❌ frontend/.env fehlt!"
fi

# Zusammenfassung
echo ""
echo "🎉 Setup abgeschlossen!"
echo "======================"
echo ""
echo "📝 Nächste Schritte:"
echo "1. Prüfen Sie die .env Datei und passen Sie ggf. weitere Werte an"
echo "2. Starten Sie die Container: docker-compose up -d"
echo "3. Zugriff auf das Dashboard: http://localhost:9080"
echo ""
echo "⚠️  WICHTIG: Die .env Datei enthält sensible Daten!"
echo "   - Committen Sie diese NIEMALS in Git"
echo "   - Bewahren Sie Backups sicher auf"
echo "   - Ändern Sie das Admin-Passwort nach dem ersten Login"
echo ""
echo "💡 Tipp: Für Development nutzen Sie docker-compose.override.yml"
echo "   cp docker-compose.override.yml.example docker-compose.override.yml"