#!/bin/bash

# Build Guacamole Dashboard Authentication Extension

cd "$(dirname "$0")"

echo "Building Guacamole Dashboard Authentication Extension..."

# Prüfe ob Maven installiert ist
if ! command -v mvn &> /dev/null; then
    echo "Maven ist nicht installiert. Bitte installiere Maven:"
    echo "  macOS: brew install maven"
    echo "  Ubuntu: sudo apt-get install maven"
    exit 1
fi

# Clean und Build
mvn clean package

if [ $? -eq 0 ]; then
    echo ""
    echo "Build erfolgreich!"
    echo "Die Extension JAR befindet sich unter:"
    echo "  target/guacamole-auth-dashboard-1.0.0.jar"
    echo ""
    echo "Installation:"
    echo "1. Kopiere die JAR in das Guacamole extensions Verzeichnis:"
    echo "   docker cp target/guacamole-auth-dashboard-1.0.0.jar appliance_guacamole:/etc/guacamole/extensions/"
    echo ""
    echo "2. Setze die Umgebungsvariablen im docker-compose.yml für guacamole:"
    echo "   JWT_SECRET: \${JWT_SECRET}"
    echo "   DB_HOST: database"
    echo "   DB_PORT: 3306"
    echo "   DB_NAME: appliance_dashboard"
    echo "   DB_USER: \${DB_USER}"
    echo "   DB_PASSWORD: \${DB_PASSWORD}"
    echo ""
    echo "3. Starte Guacamole neu:"
    echo "   docker-compose restart guacamole"
else
    echo "Build fehlgeschlagen!"
    exit 1
fi