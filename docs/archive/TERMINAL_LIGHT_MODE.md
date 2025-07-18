# Terminal Light Mode Implementation

## Übersicht
Die Terminal-Komponenten wurden für die Unterstützung des Light Mode erweitert. Alle Terminal-Varianten zeigen jetzt ein helles Design, wenn der Light Mode aktiv ist.

## Betroffene Komponenten
1. **XTerminal** - Hauptterminal mit xterm.js
2. **TTYDTerminal** - TTYD-basiertes Terminal
3. **SimpleTerminal** - Einfaches Command-Terminal
4. **TerminalModal** - Modal-Container für Terminals
5. **FullTerminal** - Vollbild-Terminal

## CSS-Implementierung

### Struktur
- Jede Terminal-Komponente hat ihre eigene CSS-Datei
- Light Mode Styles wurden am Ende jeder CSS-Datei hinzugefügt
- Unterstützung für `body.theme-light` und `body.theme-auto`

### Zentrale Datei
`/frontend/src/components/terminal-light-mode.css`
- Definiert CSS-Variablen für konsistente Farben
- Importiert alle Terminal-CSS-Dateien
- Wird in App.js importiert

### Farbschema Light Mode
```css
--terminal-light-bg: #ffffff;
--terminal-light-header-bg: #f5f5f5;
--terminal-light-border: #e1e1e1;
--terminal-light-text: #333333;
--terminal-light-text-secondary: #666666;
--terminal-light-success: #52c41a;
--terminal-light-warning: #faad14;
--terminal-light-error: #ff4d4f;
--terminal-light-info: #1890ff;
```

## Terminal-Inhalt (xterm.js)
Das XTerminal nutzt bereits das MUI Theme-System und passt die Terminal-Farben automatisch an:
- Light Mode: Weißer Hintergrund mit schwarzem Text
- Dark Mode: Schwarzer Hintergrund mit weißem Text
- ANSI-Farben werden für beide Modi angepasst

## Theme-Aktivierung
Der Light Mode wird über die Settings aktiviert:
1. Settings Panel → Allgemeine Einstellungen → Design-Modus
2. Optionen: Hell, Dunkel, Auto (Systemeinstellung)
3. Die Einstellung wird in `body.theme-light` Klasse umgesetzt

## Testing
1. Terminal im Dark Mode öffnen
2. Zu Settings navigieren und Light Mode aktivieren
3. Terminal sollte sofort auf helles Design wechseln
4. Alle Terminal-Varianten testen:
   - SSH Terminal
   - Service Terminal
   - Command Terminal

## Weitere Anpassungen
Falls weitere Anpassungen nötig sind:
1. CSS-Variablen in `terminal-light-mode.css` anpassen
2. Spezifische Overrides in den jeweiligen Terminal-CSS-Dateien
3. Bei Bedarf JavaScript-Anpassungen in den Terminal-Komponenten
