#!/bin/bash
# Dynamischer Terminal-Launcher für Mac-App
# Startet ttyd-Container on-demand für verschiedene SSH-Hosts

HOST_ID=$1
HOST_NAME=$2
SSH_USER=$3
SSH_PORT=${4:-22}

if [ -z "$HOST_ID" ]; then
    echo "Usage: $0 <host_id> <host_name> <ssh_user> [ssh_port]"
    exit 1
fi

# Container-Name basierend auf Host-ID
CONTAINER_NAME="wad_app_ttyd_${HOST_ID}"
PORT=$((7700 + HOST_ID))

# Prüfe ob Container bereits läuft
if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
    echo "Terminal für $HOST_NAME läuft bereits auf Port $PORT"
else
    echo "Starte Terminal für $HOST_NAME auf Port $PORT..."
    
    # Starte neuen ttyd-Container
    docker run -d \
        --name $CONTAINER_NAME \
        --network wad_app_network \
        -p $PORT:7681 \
        -v wad_app_ssh_keys:/root/.ssh:ro \
        -e SSH_HOST=$HOST_NAME \
        -e SSH_USER=$SSH_USER \
        -e SSH_PORT=$SSH_PORT \
        tsl0922/ttyd:latest \
        ttyd \
        --writable \
        --port 7681 \
        --base-path /terminal \
        --terminal-type xterm-256color \
        ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p $SSH_PORT $SSH_USER@$HOST_NAME
fi

# Öffne Terminal im Browser
open "http://localhost:$PORT/terminal/"
