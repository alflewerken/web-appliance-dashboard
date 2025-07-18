# Web Appliance Dashboard - Backup & Restore Vervollständigung

## Zusammenfassung der Implementierung

Ich habe die Backup- und Restore-Funktionalität deines Web Appliance Dashboards vervollständigt. Die fehlende `ssh_config` Tabelle wird nun ebenfalls gesichert und wiederhergestellt.

## Durchgeführte Änderungen

### 1. **backup.js erweitert**
   - SSH Config Daten werden beim Backup abgerufen
   - SSH Config wird in der Backup-Datei gespeichert
   - Metadata enthält SSH Config Informationen

### 2. **Restore-Funktion erweitert**
   - SSH Config Einträge werden wiederhergestellt
   - Host-ID Mapping funktioniert korrekt (falls IDs sich ändern)
   - Fehlerbehandlung verhindert Restore-Abbruch

## Vollständige Backup-Coverage

✅ **Folgende Tabellen werden gesichert:**
- appliances (inkl. Service-Commands, SSH-Verbindungen, Visual Settings)
- categories
- user_settings
- background_images (inkl. Bilddateien als Base64)
- ssh_hosts
- ssh_keys (inkl. Dateisystem-Integration)
- **ssh_config** (NEU implementiert)
- users (inkl. Passwort-Hashes)
- audit_logs (letzte 1000)
- role_permissions
- user_appliance_permissions
- appliance_commands
- service_command_logs (letzte 5000)
- sessions (nur aktive)

❌ **Nicht gesichert (beabsichtigt):**
- user_sessions - Temporäre Token-basierte Sessions sollten nicht wiederhergestellt werden

## Besondere Features

1. **Legacy-Support**: Alte Backups ohne SSH-Daten werden erkannt und behandelt
2. **ID-Mapping**: Bei Restore werden Referenzen korrekt auf neue IDs gemappt
3. **Dateisystem-Integration**: SSH-Schlüssel werden sowohl in DB als auch im Dateisystem wiederhergestellt
4. **Robuste Fehlerbehandlung**: Einzelne Fehler führen nicht zum Abbruch des gesamten Restore

## Nächste Schritte

Die Implementierung ist vollständig. Du kannst die Änderungen testen, indem du:

1. Ein neues Backup erstellst
2. Prüfst, ob `ssh_config` im Backup enthalten ist
3. Das Backup wiederherstellst
4. Verifizierst, dass alle SSH-Konfigurationen korrekt wiederhergestellt wurden

Die Backup-Datei enthält nun wirklich ALLE relevanten Daten für eine vollständige Systemwiederherstellung.
