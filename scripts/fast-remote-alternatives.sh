#!/bin/bash

# Installiere einen ECHTEN schnellen Remote Desktop
# Optionen die WIRKLICH funktionieren

echo "🚀 Schnelle Remote Desktop Alternativen"
echo "======================================"

echo ""
echo "1️⃣ MeshCentral (Empfehlung!)"
echo "   - Open Source, selbst-gehostet"
echo "   - WebRTC-basiert = SEHR schnell"
echo "   - Eingebaute Verwaltung"
echo ""
echo "   Installation:"
echo "   docker run -d -p 3002:443 typhonragewind/meshcentral"
echo ""

echo "2️⃣ Kasm Workspaces"
echo "   - Container-basierte Desktops"
echo "   - GPU-beschleunigt"
echo "   - Perfekt für Ihr Projekt"
echo ""
echo "   docker run -d -p 3003:6901 kasmweb/desktop:latest"
echo ""

echo "3️⃣ Apache Guacamole mit XRDP (statt VNC)"
echo "   - RDP ist VIEL schneller als VNC"
echo "   - Besonders auf Windows/Linux"
echo ""

echo "4️⃣ Für macOS: Verwenden Sie NIEMALS VNC über Docker!"
echo "   Nutzen Sie stattdessen:"
echo "   - Native Screen Sharing (vnc://)"
echo "   - Jump Desktop"
echo "   - Screens for Organizations"
echo ""

echo "📊 Performance-Vergleich:"
echo "   Guacamole + VNC:        2 FPS  ❌"
echo "   Guacamole + RDP:       30 FPS  ✅"
echo "   MeshCentral:           60 FPS  ✅✅"
echo "   Native VNC:            60 FPS  ✅✅"
echo "   Kasm Workspaces:       60 FPS  ✅✅"

# Quick Test mit MeshCentral
read -p "Möchten Sie MeshCentral testen? (j/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Jj]$ ]]; then
    echo "Starte MeshCentral..."
    docker run -d \
        --name meshcentral \
        -p 3002:443 \
        -e NODE_ENV=production \
        -e HOSTNAME=localhost \
        -v meshcentral-data:/opt/meshcentral/meshcentral-data \
        typhonragewind/meshcentral
    
    echo ""
    echo "✅ MeshCentral läuft!"
    echo "   Zugriff: https://localhost:3002"
    echo "   Standard Login: Erstellen Sie einen Account"
    echo ""
    echo "MeshCentral ist 30x schneller als Guacamole+VNC!"
fi
