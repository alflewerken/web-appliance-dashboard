# Terminal Theme Reaktivität - Implementierung

## Problem
Die Terminal-Komponenten haben die Text- und Cursorfarben beim Wechsel zwischen Hell- und Dunkelmodus nicht automatisch aktualisiert.

## Lösung

### 1. XTerminal.js Anpassungen
```javascript
// Import useSettings Hook
import { useSettings } from '../hooks/useSettings';

// Theme-Zustand aus Settings holen
const { currentTheme } = useSettings();

// Theme-Funktion erweitert
const getTerminalTheme = () => {
  const isDarkMode = currentTheme === 'dark' || 
                    (currentTheme === 'auto' && theme.palette.mode === 'dark');
  
  if (!isDarkMode) {
    // Light theme colors
    return {
      background: '#ffffff',
      foreground: '#000000',
      cursor: '#000000',
      // ... weitere Farben
    };
  } else {
    // Dark theme colors
    return {
      background: '#1a1a1a',
      foreground: '#ffffff',
      cursor: '#00ff00',
      // ... weitere Farben
    };
  }
};

// useEffect für Theme-Updates
useEffect(() => {
  if (terminal.current) {
    const newTheme = getTerminalTheme();
    terminal.current.options.theme = newTheme;
    // Force refresh to apply new theme
    terminal.current.refresh(0, terminal.current.rows - 1);
  }
}, [currentTheme, theme.palette.mode]);
```

### 2. FullTerminal.js
Gleiche Anpassungen wie XTerminal.js

### 3. CSS-basierte Terminals
- SimpleTerminal
- TTYDTerminal
- TerminalModal

Diese reagieren automatisch über CSS-Klassen:
- `body.theme-light` 
- `body.theme-auto` mit `@media (prefers-color-scheme: light)`

## Funktionsweise

1. **Theme-Wechsel im Settings Panel**
   - Benutzer wählt Hell/Dunkel/Auto
   - `useSettings` Hook aktualisiert `currentTheme`

2. **Terminal-Reaktion**
   - `useEffect` erkennt Theme-Änderung
   - Neue Theme-Farben werden berechnet
   - Terminal wird mit neuen Farben aktualisiert
   - `terminal.refresh()` erzwingt Neuzeichnung

3. **CSS-Reaktion**
   - Body-Klasse wird auf `theme-light` gesetzt
   - CSS-Regeln greifen automatisch
   - Terminal-Container und UI-Elemente passen sich an

## Testing

1. Terminal öffnen
2. Settings → Design-Modus → Hell wählen
3. Terminal sollte sofort umschalten:
   - Weißer Hintergrund
   - Schwarzer Text und Cursor
   - Angepasste ANSI-Farben

## Bekannte Limitierungen

- Bei sehr großen Terminal-Outputs kann das Refresh kurz flackern
- WebSocket-Verbindung bleibt bestehen (kein Reconnect nötig)
- Terminal-History bleibt erhalten

## Weitere Optimierungen

Falls ein kompletter Neuaufbau gewünscht ist:
```javascript
// Terminal komplett neu erstellen
if (terminal.current) {
  terminal.current.dispose();
  // Terminal neu initialisieren
}
```

Dies würde jedoch die Verbindung unterbrechen und den Output löschen.
