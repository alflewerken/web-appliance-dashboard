#!/bin/bash

export PATH=/usr/local/bin/:$PATH

cd /docker/web-appliance-dashboard

# Docker Compose Status Check Script
# Überprüft ob alle in docker-compose.yml definierten Container laufen

# Farben für Output (optional)
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Funktion um zu prüfen ob wir im richtigen Verzeichnis sind
check_compose_file() {
    if [ ! -f "docker-compose.yml" ] && [ ! -f "docker-compose.yaml" ]; then
        echo "status: error - no docker-compose.yml found"
        exit 1
    fi
}

# Funktion um Container-Status zu prüfen
check_containers_status() {
    # Hole alle Service-Namen aus docker-compose.yml
    local services=$(docker-compose config --services 2>/dev/null)
    
    if [ -z "$services" ]; then
        echo "status: error - no services defined"
        exit 1
    fi
    
    # Zähle definierte Services
    local total_services=$(echo "$services" | wc -l)
    local running_services=0
    
    # Prüfe jeden Service
    while IFS= read -r service; do
        # Prüfe ob Container für diesen Service läuft
        # docker-compose ps gibt Exit-Code 0 wenn Service läuft
        if docker-compose ps -q "$service" 2>/dev/null | grep -q .; then
            # Prüfe ob der Container wirklich läuft (nicht nur existiert)
            container_id=$(docker-compose ps -q "$service" 2>/dev/null)
            if [ -n "$container_id" ]; then
                # Prüfe Container-Status
                if docker inspect -f '{{.State.Running}}' "$container_id" 2>/dev/null | grep -q "true"; then
                    ((running_services++))
                fi
            fi
        fi
    done <<< "$services"
    
    # Ausgabe basierend auf Status
    if [ "$running_services" -eq "$total_services" ] && [ "$total_services" -gt 0 ]; then
        echo "status: running"
        return 0
    else
        echo "status: stopped"
        return 1
    fi
}

# Hauptprogramm
main() {
    # Prüfe ob docker und docker-compose verfügbar sind
    if ! command -v docker &> /dev/null; then
        echo "status: error - docker not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo "status: error - docker-compose not installed"
        exit 1
    fi
    
    # Prüfe ob Docker Daemon läuft
    if ! docker info &> /dev/null; then
        echo "status: error - docker daemon not running"
        exit 1
    fi
    
    # Prüfe ob docker-compose.yml existiert
    check_compose_file
    
    # Prüfe Container-Status
    check_containers_status
}

# Script ausführen
main
