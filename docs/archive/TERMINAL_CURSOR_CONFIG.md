# Terminal Cursor Konfiguration

## Cursor-Farben

Die Terminal-Cursor sind jetzt für beide Modi (Hell und Dunkel) mit einem weiß-schwarz blinkenden Effekt konfiguriert:

### Dark Mode
- **cursor**: `#ffffff` (Weiß)
- **cursorAccent**: `#000000` (Schwarz)
- **cursorBlink**: `true`

### Light Mode  
- **cursor**: `#000000` (Schwarz)
- **cursorAccent**: `#ffffff` (Weiß)
- **cursorBlink**: `true`

## Funktionsweise

Der Cursor in xterm.js verwendet zwei Farben:
- `cursor`: Die Hauptfarbe des Cursors
- `cursorAccent`: Die Farbe des Textes unter dem Cursor

Durch die invertierte Farbkombination entsteht der gewünschte Kontrast-Effekt:
- Im Dark Mode: Weißer Cursor auf schwarzem Hintergrund
- Im Light Mode: Schwarzer Cursor auf weißem Hintergrund

Der Text unter dem Cursor wird automatisch in der `cursorAccent`-Farbe dargestellt, wodurch er immer lesbar bleibt.

## Angepasste Komponenten
- `XTerminal.js`
- `FullTerminal.js`

Beide Komponenten verwenden nun die gleiche Cursor-Konfiguration für konsistentes Verhalten.
