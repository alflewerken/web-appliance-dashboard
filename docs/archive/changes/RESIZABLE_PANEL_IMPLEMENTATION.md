# Resizable Service Panel Implementierung

## Übersicht
Das Service Panel ist jetzt in der Breite anpassbar. Benutzer können die Breite durch Ziehen des linken Randes ändern, und die Einstellung wird im localStorage gespeichert.

## Features

### 1. Drag Handle
- Sichtbarer Griff am linken Rand des Panels
- Hover-Effekt zeigt Greifbarkeit an
- GripVertical Icon für bessere Erkennbarkeit
- Cursor ändert sich zu `col-resize` beim Hover

### 2. Resize-Funktionalität
- Minimum-Breite: 400px (verhindert zu schmale Panels)
- Maximum-Breite: Fensterbreite - 100px (lässt Platz für den Hauptinhalt)
- Smooth Resize während des Ziehens
- Keine Transition während des Resize für flüssige Bewegung

### 3. Persistenz
- Breite wird im localStorage gespeichert
- Key: `servicePanelWidth`
- Standard-Breite: 600px
- Wird beim nächsten Öffnen wiederhergestellt

### 4. Responsive Design
- Desktop: Anpassbare Breite
- Tablet (<1200px): Maximale Breite 480px
- Mobile (<768px): Volle Breite (100%)

### 5. Main Content Anpassung
- Hauptinhalt passt sich dynamisch an die Panel-Breite an
- CSS-Variable `--sidepanel-width` wird verwendet
- Smooth Transition beim Öffnen/Schließen

## Technische Details

### State Management
```javascript
const [panelWidth, setPanelWidth] = useState(() => {
  const saved = localStorage.getItem('servicePanelWidth');
  return saved ? parseInt(saved, 10) : 600;
});
```

### Mouse Event Handling
- `mousedown`: Startet Resize
- `mousemove`: Aktualisiert Breite während des Ziehens
- `mouseup`: Beendet Resize und speichert Wert

### CSS Integration
```css
--sidepanel-width: ${servicePanelWidth}px
```

### Visual Feedback
- Resize-Handle mit 2px breiter Linie
- Farbe ändert sich während des Resize
- Body Cursor wird zu `col-resize`
- User-Select wird deaktiviert während des Resize

## Verwendung

1. **Resize starten**: Klicken und halten Sie den linken Rand des Service Panels
2. **Breite anpassen**: Ziehen Sie nach links oder rechts
3. **Resize beenden**: Lassen Sie die Maustaste los
4. **Persistenz**: Die Breite wird automatisch gespeichert

## Browser-Kompatibilität
- Alle modernen Browser
- Touch-Events werden noch nicht unterstützt (zukünftige Erweiterung)

## Performance
- Keine Reflows während des Resize (nur Transform)
- LocalStorage-Zugriff nur beim mouseup Event
- Debounced Updates vermeiden Performance-Probleme
