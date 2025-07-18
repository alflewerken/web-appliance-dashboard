# Web-Appliance-Dashboard Update v1.0.3

## 🚀 Neue Features

### SSH-Host Audit-Log Funktionalität
- **Live-Updates**: Änderungen an SSH-Hosts werden in Echtzeit im Audit-Log angezeigt
- **Wiederherstellung**: SSH-Host Konfigurationen können über das Audit-Log wiederhergestellt werden  
- **Detaillierte Visualisierung**: Vorher/Nachher-Vergleich bei SSH-Host Änderungen
- **Verbesserte Stabilität**: Behebung von Race Conditions und 404-Fehlern

### Technische Verbesserungen
- Erweiterte SSE (Server-Sent Events) für SSH-Host Events
- Verbesserte Live-Updates im Einstellungen-Panel
- Optimierte Fehlerbehandlung bei Wiederherstellungsvorgängen
- Backup-Version auf 2.8.0 aktualisiert
- Sessions-Tracking in Backups (für Metadaten)

## 📝 Änderungen aus Version 1.0.2

### Backup & Restore Verbesserungen
- **Vollständige Datensicherung**: Alle Datentypen werden korrekt gesichert und wiederhergestellt
- **Password-Hashes**: Benutzer-Passwort-Hashes sind jetzt in Backups enthalten
- **Verifizierte Datentypen**:
  - Appliances (inkl. SSH-Verbindungen, Service-Commands, alle Einstellungen)
  - Kategorien (mit korrekter Reihenfolge)
  - Benutzereinstellungen
  - Hintergrundbilder (als Base64)
  - SSH-Hosts und Keys (mit Dateisystem-Synchronisation)
  - Custom Commands (mit SSH-Host-Mapping)

## 🔧 Behobene Probleme

### Version 1.0.3
- SSH-Host Audit Log 404-Fehler bei Restore/Revert Operationen
- Settings Panel aktualisiert sich nicht live bei SSH-Host Änderungen
- SSE Event Listener im Settings Panel für SSH-Host Updates
- Frontend-Routing für SSH-Host Restore/Revert Endpoints
- Race Conditions im Audit Log Event Handling
- SSH-Host Änderungsdetails Anzeige in gelber Highlight-Box

## 💡 Upgrade-Hinweise

1. **Backup erstellen**: Vor dem Update ein vollständiges Backup durchführen
2. **Docker Images aktualisieren**: 
   ```bash
   docker-compose pull
   docker-compose up -d
   ```
3. **Cache leeren**: Browser-Cache nach dem Update leeren für optimale Performance
4. **Kompatibilität**: Version 1.0.3 ist vollständig abwärtskompatibel mit 1.0.2

## 📖 Dokumentation

Die vollständige Benutzerdokumentation wurde aktualisiert und ist verfügbar unter:
- `/docs/user-manual/index.html`

Neue Abschnitte:
- SSH-Host Audit-Log Features
- Erweiterte Backup-Funktionalität
- Live-Update Funktionen

---

**Version**: 1.0.3  
**Release-Datum**: 09.01.2025  
**Dokumentation aktualisiert**: 09.01.2025
