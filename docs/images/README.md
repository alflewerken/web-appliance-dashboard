# Dashboard Screenshots

Dieser Ordner enthält Screenshots für die Dokumentation.

## Benötigte Screenshots:

1. **dashboard-preview.png** - Hauptansicht des Dashboards
   - Zeigt mehrere Appliances
   - Dark Mode bevorzugt
   - Auflösung: 1920x1080 oder 1440x900

2. **login-screen.png** - Login-Bildschirm
   - Zeigt das Login-Formular
   - Auflösung: 800x600

3. **terminal-view.png** - Web Terminal in Aktion
   - Zeigt eine aktive Terminal-Session
   - Auflösung: 1200x800

4. **ssh-manager.png** - SSH Key Management
   - Zeigt die SSH-Key Verwaltung
   - Auflösung: 1200x800

5. **mobile-view.png** - Mobile Ansicht
   - Zeigt das responsive Design
   - Auflösung: 375x812 (iPhone X)

6. **settings-modal.png** - Einstellungen
   - Zeigt die Einstellungsoptionen
   - Auflösung: 800x600

## Screenshot erstellen:

### macOS:
```bash
# Vollbild
Cmd + Shift + 3

# Ausschnitt
Cmd + Shift + 4

# Fenster
Cmd + Shift + 4, dann Leertaste
```

### Linux:
```bash
# Mit gnome-screenshot
gnome-screenshot -a

# Mit scrot
scrot -s
```

### Windows:
```
# Snipping Tool
Win + Shift + S
```

## Optimierung:

Nach dem Erstellen der Screenshots, optimieren Sie diese:

```bash
# Mit ImageMagick
convert dashboard-preview.png -quality 85 dashboard-preview-optimized.png

# Mit pngquant
pngquant --quality=65-80 dashboard-preview.png
```