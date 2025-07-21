# Remote Desktop Auto-Sync Feature

## Übersicht

Ab sofort werden Guacamole-Verbindungen automatisch erstellt und aktualisiert, wenn Sie Remote Desktop Einstellungen für eine Appliance speichern.

## Was wurde geändert?

### 1. **Automatische Synchronisation**
   - Beim **Erstellen** einer neuen Appliance mit Remote Desktop wird automatisch eine Guacamole-Verbindung angelegt
   - Beim **Aktualisieren** der Remote Desktop Einstellungen wird die Guacamole-Verbindung automatisch aktualisiert
   - Beim **Löschen** einer Appliance wird die zugehörige Guacamole-Verbindung automatisch entfernt

### 2. **Passwort-Verwaltung**
   - Remote Desktop Passwörter werden verschlüsselt in der Datenbank gespeichert
   - Die Passwörter werden automatisch an Guacamole weitergegeben
   - Keine manuelle Konfiguration in Guacamole mehr nötig!

### 3. **Unterstützte Protokolle**
   - **VNC** (Standard-Port: 5900)
   - **RDP** (Standard-Port: 3389)

## Wie funktioniert es?

1. **Appliance bearbeiten**
   - Gehen Sie zu einer Appliance
   - Aktivieren Sie "Remote Desktop"
   - Geben Sie die Verbindungsdaten ein:
     - Protokoll (VNC/RDP)
     - Host (IP-Adresse oder Hostname)
     - Port (optional, nutzt Standard-Ports)
     - Benutzername (optional)
     - **Passwort** (wichtig für VNC!)

2. **Speichern**
   - Die Einstellungen werden gespeichert
   - Im Hintergrund wird automatisch eine Guacamole-Verbindung erstellt/aktualisiert

3. **Verbinden**
   - Klicken Sie auf das Monitor-Icon in der Appliance
   - Die Remote Desktop Verbindung öffnet sich

## Migration bestehender Appliances

Falls Sie bereits Appliances mit Remote Desktop Einstellungen haben, führen Sie das Migrations-Script aus:

```bash
docker exec appliance_backend node scripts/migrate-remote-desktop.js
```

## Fehlerbehandlung

### VNC-Verbindung funktioniert nicht?

1. **Prüfen Sie das Passwort**
   - VNC benötigt in der Regel ein Passwort
   - Stellen Sie sicher, dass das richtige Passwort in den Appliance-Einstellungen hinterlegt ist

2. **Prüfen Sie die Verbindungsdaten**
   - Host: Korrekte IP-Adresse?
   - Port: Standard 5900 für VNC, 3389 für RDP
   - Firewall-Einstellungen auf dem Zielrechner prüfen

3. **Mac-spezifisch**
   - Systemeinstellungen → Freigaben → Bildschirmfreigabe aktivieren
   - VNC-Passwort konfigurieren

### Logs prüfen

```bash
# Backend-Logs
docker logs appliance_backend -f | grep -i guacamole

# Guacamole-Logs
docker logs appliance_guacamole -f

# Guacd-Logs (Verbindungsprobleme)
docker logs appliance_guacd -f
```

## Technische Details

Die Implementierung nutzt:
- `utils/guacamoleHelper.js` - Hilfsfunktionen für Guacamole-Sync
- `routes/appliances.js` - Automatische Synchronisation bei CRUD-Operationen
- `utils/guacamole/GuacamoleDBManager.js` - Direkte Datenbank-Integration

Die Verbindungen werden mit dem Namen `dashboard-{applianceId}` in Guacamole gespeichert.
