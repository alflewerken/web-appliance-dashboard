#!/bin/bash

# Direct VNC Connection Script
# Umgeht Docker-Netzwerk für maximale Performance

echo "🚀 Direkte VNC Verbindung Setup"
echo "=============================="

# 1. Finde alle laufenden VNC Server
echo "Suche VNC Server..."
VNC_PORTS=$(lsof -i -P | grep LISTEN | grep -E ":(590[0-9]|5800)" | awk '{print $9}' | cut -d: -f2 | sort -u)

if [ -z "$VNC_PORTS" ]; then
    echo "❌ Kein VNC Server gefunden!"
    echo ""
    echo "Starten Sie einen VNC Server:"
    echo "  macOS: Systemeinstellungen > Freigabe > Bildschirmfreigabe"
    echo "  Linux: vncserver :1"
    echo "  Windows: TightVNC/RealVNC Server"
    exit 1
fi

echo "✅ VNC Server gefunden auf Port(s): $VNC_PORTS"

# 2. Erstelle direkte noVNC Verbindung
echo ""
echo "Starte noVNC direkt (ohne Docker)..."

# Check if noVNC exists
if [ ! -d "novnc" ]; then
    echo "Lade noVNC herunter..."
    git clone https://github.com/novnc/noVNC.git novnc
fi

# Start websockify
cd novnc
echo ""
echo "Starte WebSocket Proxy..."
echo "Zugriff über: http://localhost:6080/vnc.html?host=localhost&port=6080"
echo ""

# Use the first VNC port found
FIRST_PORT=$(echo $VNC_PORTS | cut -d' ' -f1)
./utils/novnc_proxy --vnc localhost:$FIRST_PORT --listen 6080
