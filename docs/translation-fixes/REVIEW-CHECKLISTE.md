# Übersetzungs-Review-Checkliste

## Überprüfte Dateien

### ✅ Vollständig überprüft und angepasst:
- [x] GLOSSAR.md - Neues umfassendes Übersetzungsglossar erstellt
- [x] security-best-practices-guide-ger.md - Titel und erste Abschnitte übersetzt
- [x] integration-guide-ger.md - Titel und Hauptüberschriften übersetzt

### 🔄 Teilweise bearbeitet:
- [ ] api-reference-ger.md - Bereits gut übersetzt, nur kleine Anpassungen nötig
- [ ] docker-env-setup-ger.md
- [ ] performance-tuning-guide-ger.md
- [ ] remote-desktop-setup-guide-ger.md

### ❌ Noch zu bearbeiten:
- [ ] api-client-sdks-ger.md - Sehr große Datei mit vielen Code-Beispielen
- [ ] BACKEND_PROXY_IMPLEMENTATION-ger.md
- [ ] DEVELOPMENT_SETUP-ger.md
- [ ] PROXY_IMPLEMENTATION_SUMMARY-ger.md
- [ ] REMOTE_DESKTOP_PASSWORD_RESTORE-ger.md

## Häufige Übersetzungsprobleme gefunden:

1. **Inkonsistente Titel**
   - Englische Titel in deutschen Dokumenten
   - Gemischte Sprachen in Überschriften

2. **Code-Kommentare**
   - Viele englische Kommentare in Code-Beispielen
   - Sollten für bessere Verständlichkeit übersetzt werden

3. **Technische Begriffe**
   - Uneinheitliche Handhabung (mal übersetzt, mal nicht)
   - Lösung: GLOSSAR.md als Referenz verwenden

4. **Häufig nicht übersetzte Begriffe:**
   - Table of Contents → Inhaltsverzeichnis
   - Overview → Übersicht
   - Prerequisites → Voraussetzungen
   - Quick Start → Schnellstart
   - Security → Sicherheit
   - Performance → Leistung
   - Backup → Sicherung

## Empfohlenes Vorgehen:

1. **Priorität 1**: Hauptüberschriften und Titel aller Dateien
2. **Priorität 2**: Häufig verwendete Begriffe gemäß Glossar
3. **Priorität 3**: Code-Kommentare in Beispielen
4. **Priorität 4**: Fließtext und detaillierte Beschreibungen

## Qualitätskriterien:

- [ ] Konsistente Verwendung der Begriffe aus dem Glossar
- [ ] Keine gemischten Sprachen in einem Satz
- [ ] Technische Begriffe einheitlich behandelt
- [ ] Code-Kommentare übersetzt (wo sinnvoll)
- [ ] Natürlicher deutscher Sprachfluss
- [ ] Fachlich korrekte Übersetzungen

## Tools und Hilfsmittel:

1. **GLOSSAR.md** - Zentrale Referenz für alle Übersetzungen
2. **translate-docs.sh** - Automatisierungsskript (erstellt, aber manuell ausführen)
3. **Backup-Verzeichnis** - Sicherungskopien vor Änderungen

## Nächste Schritte:

1. Systematisch jede Datei durchgehen
2. Übersetzungen gemäß Glossar anwenden
3. Review durch deutschsprachige Teammitglieder
4. Finale Qualitätskontrolle
