#!/bin/bash

echo "=== Docker Container Status ==="
docker ps -a | grep -E "(appliance|NAME)"

echo -e "\n=== Database Container Logs (letzte 50 Zeilen) ==="
docker logs appliance_db --tail 50

echo -e "\n=== Docker Compose Services ==="
cd /docker/web-appliance-dashboard 2>/dev/null || cd ~/docker/web-appliance-dashboard 2>/dev/null
docker compose ps

echo -e "\n=== Database Connection Test ==="
docker exec appliance_db pg_isready -U applianceuser -d appliancedb || echo "Database not ready"

echo -e "\n=== Environment Variables Check ==="
if [ -f .env ]; then
    echo "DB-relevante .env Einträge:"
    grep -E "^(DB_|POSTGRES_)" .env | sed 's/PASSWORD=.*/PASSWORD=***/'
else
    echo ".env Datei nicht gefunden"
fi

echo -e "\n=== Docker Network ==="
docker network ls | grep appliance

echo -e "\n=== Database Container Inspect Health ==="
docker inspect appliance_db --format='{{json .State.Health}}' | python3 -m json.tool 2>/dev/null || \
docker inspect appliance_db --format='{{.State.Health}}'
