# Backup Tab Icon Styling

## Übersicht
Die Icons im Backup Tab wurden mit intensiven Glow-Effekten versehen:
- **Backup Icon (CloudDownload)**: Blau (#007aff) mit starkem blauen Glow
- **Restore Icon (CloudUpload)**: Grün (#4caf50) mit starkem grünen Glow

## Implementierte Effekte

### 1. Mehrfache Drop-Shadows auf Icons
```javascript
filter: 'drop-shadow(0 0 30px rgba(color, 1)) 
         drop-shadow(0 0 60px rgba(color, 0.8)) 
         drop-shadow(0 0 90px rgba(color, 0.6))'
```
- 3 Schichten von Schatten für maximalen Glow
- Verschiedene Blur-Radien (30px, 60px, 90px)
- Abnehmende Opazität für realistischen Effekt

### 2. Hintergrund-Glow mit Pseudo-Elementen
**::before (Innerer Glow)**
- Größe: 120% des Icons
- Blur: 25px (verstärkt von 20px)
- Opazität: 0.8 (verstärkt von 0.6)

**::after (Äußerer Glow)**
- Größe: 200% des Icons
- Blur: 50px (verstärkt von 40px)
- Opazität: 0.6 (verstärkt von 0.4)
- Animiert mit Pulse-Effekt

### 3. Animationen
- **Float Animation**: Icons schweben auf und ab
- **Pulse Animation**: Glow pulsiert rhythmisch
- **Hover-Effekte**: Karten leuchten beim Hover

### 4. CSS-Erweiterungen (BackupTab.css)
- `intense-pulse` Animation für zusätzliche Helligkeitsvariation
- Mehrschichtige Box-Shadows beim Hover
- `glow-expand` Animation für expandierenden Glow-Effekt

## Farben
- **Backup (Blau)**: `#007aff` / `rgba(0, 122, 255, x)`
- **Restore (Grün)**: `#4caf50` / `rgba(76, 175, 80, x)`

## Anpassungen für Light Mode
Die Glow-Effekte wurden für den Light Mode optimiert mit höherer Opazität für bessere Sichtbarkeit auf hellem Hintergrund.

## Performance
Trotz der intensiven visuellen Effekte bleibt die Performance durch GPU-beschleunigte CSS-Filter erhalten.
