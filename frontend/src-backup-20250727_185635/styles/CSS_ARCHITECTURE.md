# CSS Architecture - Web Appliance Dashboard

## Übersicht

Nach der Bereinigung haben wir eine klare und wartbare CSS-Struktur:

### Haupt-CSS-Dateien

1. **`App.css`** - Basis-Styles der Anwendung
2. **`theme.css`** - Theme-Definitionen (Dark/Light/Auto)
3. **`mobile.css`** - Mobile-spezifische Anpassungen

### Styles-Verzeichnis

1. **`app-consolidated.css`** - Konsolidierte Lösung für:
   - Transparente Hintergründe (überschreibt theme.css)
   - Background Image Layer System
   - Glassmorphism für alle UI-Elemente
   - Service Cards und Icon-Farben
   - Form-Elemente und interaktive Komponenten

2. **`firefox-fixes.css`** - Firefox-spezifische Fixes:
   - Icon-Farben in der Sidebar
   - Deaktivierung von backdrop-filter auf Icon-Containern
   - Fallback-Farben für statische Kategorien

3. **`background-fix.css`** - Löst das Problem des verschwindenden Hintergrundbilds:
   - Feste z-index Hierarchie
   - Isolation contexts
   - Panel-unabhängige Background-Darstellung

4. **`panel-layout.css`** - Multi-Panel Layout System

5. **Platform-spezifische Fixes:**
   - `safari-theme-fix.css`
   - `ipad-swipe.css`
   - `ios-scroll-fix.css`

6. **Mobile Fixes:**
   - `mobile-content-fix.css`
   - `mobile-override-fix.css`
   - `mini-dashboard.css`

7. **`Auth.css`** - Authentifizierungs-UI

## Gelöste Probleme

### 1. Firefox Icon-Farben
- Problem: Inline `backgroundColor` wurde in Firefox nicht angezeigt
- Lösung: Deaktivierung von `backdrop-filter` auf Icon-Containern mit `@-moz-document url-prefix()`

### 2. Verschwindendes Hintergrundbild
- Problem: Background verschwand beim Öffnen von Panels
- Lösung: Klare z-index Hierarchie und isolation contexts

### 3. Glassmorphism-Konsistenz
- Problem: Unterschiedliche Blur-Effekte auf verschiedenen Elementen
- Lösung: Einheitliche glassmorphism-Definitionen für alle UI-Elemente

## Z-Index Hierarchie

```
-10: .background-image
 -9: .background-overlay
  0: #root
  1: .music-app
 10: .main-content, .content-body
100: .sidebar
1000: .panel-container
1300: Individual panels
```

## Wartungshinweise

1. **Keine neuen Override-CSS-Dateien erstellen!** - Änderungen in den bestehenden Dateien vornehmen
2. **Firefox-spezifische Anpassungen** nur in `firefox-fixes.css`
3. **Background-bezogene Änderungen** in `background-fix.css`
4. **Allgemeine UI-Änderungen** in `app-consolidated.css`

## Backup

Alle alten CSS-Dateien wurden in `_old_backup/` gesichert für den Fall, dass etwas wiederhergestellt werden muss.
