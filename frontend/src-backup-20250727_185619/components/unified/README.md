# Panel Design Unification Guide

## Übersicht
Diese Anleitung zeigt, wie die drei Panels (Einstellungen, Benutzerverwaltung und Service) dem Design des Audit Log Panels angepasst werden.

## Wichtige Design-Elemente des Audit Log Panels

1. **Glassmorphism-Effekt**
   - `background: rgba(118, 118, 128, 0.12)`
   - `backdrop-filter: blur(30px) saturate(150%)`
   - `-webkit-backdrop-filter: blur(30px) saturate(150%)`

2. **Konsistente Abstände**
   - Header: `padding: 20px 24px`
   - Content: `padding: 24px`
   - Border: `1px solid rgba(255, 255, 255, 0.08)`

3. **Einheitliche Farben**
   - Primary: `#007AFF`
   - Success: `#34C759`
   - Error: `#FF3B30`
   - Text Primary: `white`
   - Text Secondary: `rgba(255, 255, 255, 0.7)`

4. **Resize Handle**
   - Width: `6px`
   - Hover: `background: rgba(0, 122, 255, 0.5)`

## Implementierung

### Option 1: CSS-Patches verwenden

1. Importiere die CSS-Patches in den jeweiligen Komponenten:

```javascript
// In SettingsPanel.js
import './unified/SettingsPanelPatch.css';

// In UserPanel.js  
import './unified/UserPanelPatch.css';

// In ServicePanel.js
import './unified/ServicePanelPatch.css';
```

### Option 2: Direkte Anpassung der Komponenten

Alternativ können die Inline-Styles in den Komponenten direkt angepasst werden:

#### SettingsPanel.js
```javascript
// Hauptcontainer
sx={{ 
  position: 'fixed',
  top: 0,
  right: 0,
  height: '100vh',
  width: isMobile ? '100%' : `${panelWidth}px`,
  // Glassmorphism
  background: 'rgba(118, 118, 128, 0.12) !important',
  backdropFilter: 'blur(30px) saturate(150%) !important',
  WebkitBackdropFilter: 'blur(30px) saturate(150%) !important',
  borderLeft: '1px solid rgba(255, 255, 255, 0.08) !important',
  boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.3)',
  // ... rest
}}
```

#### UserPanel.js
```javascript
// Gleiche Anpassungen wie SettingsPanel
```

#### ServicePanel.js
```javascript
// Gleiche Anpassungen wie SettingsPanel
```

## Gemeinsame Komponenten

### Panel Header
```css
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: transparent;
  flex-shrink: 0;
}
```

### Close Button
```css
.panel-close-btn {
  background: rgba(118, 118, 128, 0.12);
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s;
}
```

### Tabs
```css
.panel-tabs {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
  min-height: 48px;
}

.panel-tab {
  color: rgba(255, 255, 255, 0.7);
  border-bottom: 2px solid transparent;
}

.panel-tab.active {
  color: #007AFF;
  border-bottom-color: #007AFF;
}
```

## Testing

1. Öffne jedes Panel und überprüfe:
   - Glassmorphism-Effekt ist sichtbar
   - Resize-Handle funktioniert
   - Farben sind konsistent
   - Mobile Ansicht ist responsiv

2. Teste in verschiedenen Themes:
   - Dark Mode
   - Light Mode
   - Auto Mode

## Weitere Schritte

1. **Entfernung von Material-UI**: Langfristig sollten die Panels von Material-UI auf native React-Komponenten umgestellt werden, um eine einheitlichere Codebasis zu haben.

2. **Gemeinsame Komponente**: Erstelle eine `UnifiedPanel` Komponente, die als Basis für alle Panels dient.

3. **CSS-in-JS**: Erwäge die Verwendung von styled-components oder emotion für bessere Typsicherheit und Wartbarkeit.
