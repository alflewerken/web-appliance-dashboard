# Release Notes - Version 1.1.5

**Veröffentlichungsdatum:** 20. August 2025  
**Typ:** Minor Release - Großes Frontend-Refactoring

## 🎉 Highlights

Dieses Release stellt eine massive Verbesserung der Code-Qualität, Wartbarkeit und Benutzererfahrung dar. Wir haben die Codebasis um über 7.600 Zeilen reduziert und gleichzeitig die Funktionalität verbessert und kritische Fehler behoben.

### Wichtigste Erfolge
- **83% Code-Reduktion** in AuditLog-Komponenten durch Modularisierung
- **~2.000 Zeilen toter Code** eliminiert
- **16 ungenutzte Komponenten** entfernt
- **Besser organisierte** Komponentenstruktur mit logischen Ordnern

## 🚀 Was ist neu

### Komplette AuditLog-Modularisierung
Die monolithische AuditLog-Komponente (2.800+ Zeilen) wurde in 8 fokussierte, wartbare Module aufgeteilt:
- `AuditLogActions.js` - Action-Icons und Formatierungs-Utilities
- `AuditLogFilters.js` - Erweiterte Filter-Oberfläche
- `AuditLogRestore.js` - Wiederherstellungs-Logik
- `AuditLogDetailRenderer.js` - Detail-Ansicht Rendering
- `AuditLogStats.js` - Statistik-Anzeige-Karten
- `AuditLogExport.js` - Export-Funktionalität
- `AuditLogPanel.js` - Haupt-Orchestrator (um 64% reduziert)
- `AuditLogTableMUI.js` - Tabellen-Komponente (um 83% reduziert)

### Frontend-Komponenten-Organisation
Alle Komponenten sind jetzt in logische Ordner mit klarer Trennung der Verantwortlichkeiten organisiert:
- `components/Appliances/` - 19 Appliance-bezogene Komponenten
- `components/SettingsPanel/` - 11 Settings-bezogene Komponenten
- `components/Hosts/` - Host-Management-Komponenten
- Named Exports via index.js für sauberere Imports

## 🐛 Fehlerbehebungen

### Kritische Fixes
- **Panel-Resize-Bug** - Problem behoben, bei dem das AuditLog-Panel nur 2-3 Pixel bewegt werden konnte
- **Dark Mode Tabellen** - Text jetzt korrekt sichtbar in Modal/Dialog-Kontexten
- **Wiederherstellen-Buttons** - Erscheinen jetzt korrekt für alle wiederherstellbaren Aktionen
- **Docker Volume** - Von read-only auf writable geändert für korrekte Frontend-Updates

### UI/UX-Verbesserungen
- Flüssiges Panel-Resizing zwischen 400-1200px Breite
- LocalStorage-Persistierung für Panel-Positionen
- Konsistente camelCase-Benennung im gesamten Frontend
- Bessere Dark Mode-Unterstützung mit erhöhter CSS-Spezifität

## 🧹 Code-Bereinigung

### Entfernte Komponenten
- 16 ungenutzte Komponenten und CSS-Dateien eliminiert
- Veraltete Backend-Routes entfernt (backupEnhanced, browser, roles, statusCheck)
- Nie genutzten Dialog-Code aus AuditLogTableMUI bereinigt
- Redundante CSS-Dateien und doppelte Styles gelöscht

### Struktur-Verbesserungen
- Komponenten jetzt mit ihren CSS-Dateien zusammen
- Klare Trennung der Verantwortlichkeiten mit Single Responsibility
- Bessere Wartbarkeit mit ~200 Zeilen fokussierten Modulen (vorher 1400+)
- Verbesserte Test-Möglichkeiten mit isolierten Modulen

## 📊 Statistiken

- **Geänderte Dateien gesamt:** 120
- **Hinzugefügte Zeilen:** 5.079
- **Entfernte Zeilen:** 12.730
- **Netto-Reduktion:** 7.651 Zeilen
- **Code-Qualität:** Signifikant verbessert
- **Wartbarkeit:** Drastisch erhöht

## 📚 Dokumentations-Updates

- README mit Version 1.1.5 Features aktualisiert
- Veraltete Configuration und Performance Sektionen entfernt
- RustDesk zu Danksagungen hinzugefügt
- CHANGELOG mit vollständigen Release-Details aktualisiert
- Dokumentation für bessere Klarheit bereinigt

## 🔧 Technische Verbesserungen

- Bessere Code-Splitting-Möglichkeiten mit modularer Struktur
- Verbesserte Build-Konfiguration
- Utility-Scripts für Code-Analyse hinzugefügt
- Erweiterter Entwicklungs-Workflow mit schreibbaren Docker-Volumes

## 💡 Migrations-Hinweise

Dieses Release enthält signifikante strukturelle Änderungen, behält aber volle Rückwärtskompatibilität. Keine Migrationsschritte erforderlich. Einfach die neueste Version ziehen und Container neu starten:

```bash
git pull
docker compose down
docker compose up -d
```

## 🙏 Danksagungen

Besonderer Dank an alle Open-Source-Projekte, die dies möglich machen:
- React.js für das UI-Framework
- Express.js für das Backend
- Apache Guacamole für Remote-Desktop-Funktionalität
- RustDesk für Remote-Zugriffs-Fähigkeiten
- ttyd für Web-Terminal-Unterstützung

## 📝 Commit-Historie

- `4f92147` - refactor: Komplette AuditLog-Modularisierung und Panel-Resize-Fix
- `410734d` - refactor: Große Frontend-Reorganisation und Dead-Code-Entfernung
- `4f55dc7` - fix: Dark Mode Text-Sichtbarkeit und CSS-Verbesserungen
- `2948e78` - docs: Dokumentation für v1.1.5 aktualisiert
- `0153d14` - chore: Build-Konfigurationen und Scripts aktualisiert
- `c4de5f0` - cleanup: Verschobene Komponenten-Dateien entfernt

## 🚀 Was kommt als Nächstes

- Weitere Performance-Optimierungen
- Zusätzliche Komponenten-Modularisierung
- Erweiterte Test-Abdeckung
- Verbesserte Dokumentation

---

**Vollständiges Changelog:** https://github.com/alflewerken/web-appliance-dashboard/compare/v1.1.4...v1.1.5

**Download:** https://github.com/alflewerken/web-appliance-dashboard/releases/tag/v1.1.5
