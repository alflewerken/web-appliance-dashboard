# URL-Öffnungsmodus Implementierung

## Übersicht
Die Funktion ermöglicht es, für jeden Service individuell festzulegen, wie URLs geöffnet werden sollen. Dies kann für drei verschiedene Kontexte konfiguriert werden:
- Mini-Widget Modus
- Mobile/iPad Modus  
- Desktop Modus

## Verfügbare Öffnungsmodi

### 1. Browser neuer Tab (Standard)
- Öffnet die URL in einem neuen Browser-Tab
- Standard-Verhalten für alle Modi

### 2. Browser neues Fenster
- Öffnet die URL in einem neuen Browser-Fenster
- Mit Menüleiste, Toolbar und allen Browser-Features
- Fensterparameter: 1200x800px, resizable

### 3. Safari PWA Modus
- Für Progressive Web Apps optimiert
- Minimalistisches Fenster ohne Browser-UI
- Besondere Behandlung je nach Umgebung:
  - **Electron**: Öffnet ohne Menü- und Toolbar
  - **Safari Standalone**: Navigiert direkt zur URL
  - **Safari Normal**: Zeigt Hinweis zum "Zum Dock hinzufügen"
  - **Andere Browser**: Öffnet minimalistisches Fenster

## Implementierung

### Frontend-Komponenten

#### ServicePanel.js
- Erweitert um drei Select-Felder für die Modi
- Speichert Einstellungen in formData:
  - `openModeMini`
  - `openModeMobile`
  - `openModeDesktop`

#### ApplianceCard.js
- Erkennt automatisch den aktuellen Kontext
- Wendet den entsprechenden Öffnungsmodus an
- Fallback auf `browser_tab` wenn nicht konfiguriert

### Datenbank-Felder
- `open_mode_mini`: VARCHAR(50)
- `open_mode_mobile`: VARCHAR(50)
- `open_mode_desktop`: VARCHAR(50)

## Verwendung

1. Service Panel öffnen
2. Im Tab "Service-Einstellungen" nach unten scrollen
3. Unter "Öffnungsmodus" die gewünschten Modi auswählen
4. Änderungen speichern

## Technische Details

### Kontexterkennung
```javascript
// Mini-Dashboard
const isMiniDashboard = document.querySelector('.music-app.mini-dashboard') !== null;

// Mobile/iPad
const isMobile = window.innerWidth <= 768 || /iPad|iPhone|iPod/.test(navigator.userAgent);

// Desktop (Standard wenn keine anderen Bedingungen zutreffen)
```

### Safari PWA-Erkennung
- `window.navigator.standalone`: Prüft ob App im Standalone-Modus läuft
- User-Agent Prüfung für Safari-Browser
- LocalStorage für Hinweis-Anzeige (einmalig)

## Best Practices

1. **PWA-Modus**: Ideal für Services die als eigenständige Apps fungieren sollen
2. **Neues Fenster**: Gut für Services die parallel genutzt werden
3. **Neuer Tab**: Standard für normale Web-Navigation
