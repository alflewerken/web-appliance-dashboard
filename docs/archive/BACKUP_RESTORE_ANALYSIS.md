# Backup & Restore Analyse - Web Appliance Dashboard

## Datenbankstruktur

### Haupt-Tabellen
1. **appliances** - Appliance-Konfigurationen mit Service-Commands und SSH-Verbindungen
2. **categories** - Kategorien für Appliances
3. **user_settings** - Anwendungseinstellungen
4. **background_images** - Hintergrundbilder mit Metadaten
5. **ssh_hosts** - SSH-Host-Konfigurationen
6. **ssh_keys** - SSH-Schlüssel (privat/öffentlich)
7. **ssh_config** - SSH-Konfigurationen pro Host
8. **users** - Benutzerkonten mit Passwort-Hashes
9. **role_permissions** - Rollenberechtigungen
10. **user_appliance_permissions** - Benutzer-spezifische Appliance-Berechtigungen
11. **user_sessions** - Aktive Benutzersitzungen
12. **audit_logs** - Audit-Protokolle
13. **appliance_commands** - Benutzerdefinierte Befehle
14. **service_command_logs** - Service-Befehlsprotokolle

## Aktuelle Backup-Funktionalität

### Gesicherte Daten (backup.js)
✅ **appliances** - Vollständig mit allen Feldern
✅ **categories** - Vollständig
✅ **user_settings** - Vollständig
✅ **background_images** - Mit Base64-kodierten Bilddaten
✅ **ssh_hosts** - Vollständig
✅ **ssh_keys** - Mit Dateisystem-Integration (private/public Keys)
✅ **appliance_commands** - Vollständig
✅ **users** - Vollständig mit Passwort-Hashes
✅ **audit_logs** - Letzte 1000 Einträge
✅ **role_permissions** - Vollständig
✅ **user_appliance_permissions** - Vollständig
✅ **service_command_logs** - Letzte 5000 Einträge
✅ **sessions** - Nur aktive Sitzungen

### NICHT gesicherte Tabellen
❌ **ssh_config** - SSH-Host-spezifische Konfigurationen
❌ **user_sessions** - Benutzersitzungen (Token-basiert)

## Restore-Funktionalität

### Wiederhergestellte Daten
✅ Alle gesicherten Tabellen werden wiederhergestellt
✅ SSH-Schlüssel werden sowohl in DB als auch im Dateisystem wiederhergestellt
✅ Hintergrundbilder werden als Dateien wiederhergestellt
✅ Auto-Increment-Werte werden korrekt gesetzt
✅ Legacy-Backup-Unterstützung für ältere Versionen ohne SSH-Daten

### Probleme beim Restore

1. **ssh_config Tabelle fehlt**
   - SSH-Host-spezifische Konfigurationen gehen verloren
   - Diese Tabelle wird weder gesichert noch wiederhergestellt

2. **user_sessions werden nicht vollständig behandelt**
   - Nur aktive Sessions werden gesichert
   - Beim Restore werden Sessions nicht korrekt wiederhergestellt

## Empfohlene Korrekturen

1. **ssh_config Tabelle zum Backup hinzufügen**
2. **user_sessions korrekt behandeln** (entweder komplett weglassen oder vollständig implementieren)
3. **Restore-Prozess für Sessions verbessern**
