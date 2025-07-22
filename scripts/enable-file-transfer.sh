#!/bin/bash

echo "========================================"
echo "Web Appliance Dashboard - File Transfer"
echo "========================================"
echo ""
echo "Die Dateiübertragung ist jetzt über die SSH-Integration verfügbar!"
echo ""
echo "So funktioniert es:"
echo "1. Öffnen Sie einen Service mit konfiguriertem SSH-Host"
echo "2. Klicken Sie auf den Upload-Button (⬆️) neben dem Remote Desktop Button"
echo "3. Ziehen Sie Dateien in das Upload-Fenster oder klicken Sie zum Auswählen"
echo ""
echo "Vorteile:"
echo "- Nutzt die bereits konfigurierten SSH-Zugangsdaten"
echo "- Keine zusätzliche Konfiguration in Guacamole nötig"
echo "- Sichere Übertragung über SSH/SFTP"
echo "- Upload-Fortschritt wird angezeigt"
echo ""
echo "Starte Services neu..."
docker-compose restart backend nginx

echo ""
echo "✅ Fertig! Browser neu laden und ausprobieren."
