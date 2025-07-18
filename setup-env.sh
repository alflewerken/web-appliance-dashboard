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

# Funktion zum Generieren sicherer Secrets
generate_secret() {
    openssl rand -base64 $1 | tr -d '\n'
}

# Neue Secrets generieren
echo "🔐 Generiere sichere Secrets..."

# JWT Secret (64 Bytes)
JWT_SECRET=$(generate_secret 64)
sed -i.bak "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env

# SSH Encryption Key (32 Zeichen)
SSH_KEY=$(generate_secret 32 | head -c 32)
sed -i.bak "s|SSH_KEY_ENCRYPTION_SECRET=.*|SSH_KEY_ENCRYPTION_SECRET=$SSH_KEY|" .env

# MySQL Root Password
MYSQL_ROOT_PWD=$(generate_secret 24)
sed -i.bak "s|MYSQL_ROOT_PASSWORD=.*|MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PWD|" .env

# MySQL User Password
MYSQL_USER_PWD=$(generate_secret 24)
sed -i.bak "s|MYSQL_PASSWORD=.*|MYSQL_PASSWORD=$MYSQL_USER_PWD|" .env
sed -i.bak "s|DB_PASSWORD=.*|DB_PASSWORD=$MYSQL_USER_PWD|" .env

# Cleanup backup files
rm -f .env.bak

echo "✅ Secrets generiert und gespeichert"

# Domain/CORS konfigurieren
echo ""
read -p "Geben Sie Ihre Domain ein (oder Enter für localhost): " DOMAIN

if [ -n "$DOMAIN" ]; then
    CORS_ORIGINS="http://localhost,https://localhost,http://$DOMAIN,https://$DOMAIN,https://www.$DOMAIN"
    sed -i.bak "s|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=$CORS_ORIGINS|" .env
    rm -f .env.bak
    echo "✅ CORS Origins konfiguriert"
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
        sed -i.bak "s|NODE_ENV=.*|NODE_ENV=development|" .env
        sed -i.bak "s|LOG_LEVEL=.*|LOG_LEVEL=debug|" .env
        echo "✅ Development Environment konfiguriert"
        ;;
    3)
        sed -i.bak "s|NODE_ENV=.*|NODE_ENV=staging|" .env
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
    sed -i.bak "s|DB_HOST=.*|DB_HOST=$DB_HOST|" backend/.env
    sed -i.bak "s|DB_PORT=.*|DB_PORT=$DB_PORT|" backend/.env
    sed -i.bak "s|DB_USER=.*|DB_USER=$DB_USER|" backend/.env
    sed -i.bak "s|DB_PASSWORD=.*|DB_PASSWORD=$DB_PASSWORD|" backend/.env
    sed -i.bak "s|DB_NAME=.*|DB_NAME=$DB_NAME|" backend/.env
    
    # JWT und SSH Keys synchronisieren
    JWT_VALUE=$(grep "JWT_SECRET=" .env | cut -d= -f2- || echo "")
    SSH_VALUE=$(grep "SSH_KEY_ENCRYPTION_SECRET=" .env | cut -d= -f2- || echo "")
    NODE_ENV=$(grep "NODE_ENV=" .env | cut -d= -f2- || echo "production")
    ALLOWED_ORIGINS=$(grep "ALLOWED_ORIGINS=" .env | cut -d= -f2- || echo "http://localhost,https://localhost")
    
    sed -i.bak "s|JWT_SECRET=.*|JWT_SECRET=$JWT_VALUE|" backend/.env
    sed -i.bak "s|SSH_KEY_ENCRYPTION_SECRET=.*|SSH_KEY_ENCRYPTION_SECRET=$SSH_VALUE|" backend/.env
    sed -i.bak "s|NODE_ENV=.*|NODE_ENV=$NODE_ENV|" backend/.env
    
    # CORS Settings hinzufügen falls nicht vorhanden
    if ! grep -q "ALLOWED_ORIGINS=" backend/.env; then
        echo "ALLOWED_ORIGINS=$ALLOWED_ORIGINS" >> backend/.env
    else
        sed -i.bak "s|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=$ALLOWED_ORIGINS|" backend/.env
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
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME

# JWT Configuration
JWT_SECRET=$JWT_VALUE

# SSH Key Encryption
SSH_KEY_ENCRYPTION_SECRET=$SSH_VALUE

# Node Environment
NODE_ENV=$NODE_ENV

# CORS Settings
ALLOWED_ORIGINS=$ALLOWED_ORIGINS

# Rate Limiting
DISABLE_RATE_LIMIT=true
EOF
    echo "✅ Minimale backend/.env erstellt"
fi

# Frontend .env erstellen (falls vorhanden)
if [ -f frontend/.env.example ]; then
    echo "📦 Erstelle Frontend .env..."
    cp frontend/.env.example frontend/.env
    echo "✅ Frontend .env erstellt"
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