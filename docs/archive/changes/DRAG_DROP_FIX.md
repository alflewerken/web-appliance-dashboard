# Fehlerbehebung: setFormData is not defined

## Problem
Nach dem Entfernen des ApplianceModal trat ein Fehler auf:
```
ReferenceError: setFormData is not defined
```

## Ursache
Der `useDragAndDrop` Hook versuchte noch, die alten Modal-Funktionen (`setFormData`, `setEditingAppliance`, `setShowModal`) zu verwenden, obwohl diese als `null` übergeben wurden.

## Lösung

### 1. App.js erweitert
Neue Parameter für Service Panel an useDragAndDrop übergeben:
```javascript
const { handleDragEnter, handleDragOver, handleDragLeave, handleDrop } = useDragAndDrop(
  showSettingsModal,
  activeSettingsTab,
  setActiveSettingsTab,
  setShowSettingsModal,
  null, // setFormData - nicht mehr benötigt
  null, // setEditingAppliance - nicht mehr benötigt  
  null, // setShowModal - nicht mehr benötigt
  uploadBackgroundImage,
  selectedCategory,
  // Neue Parameter für Service Panel
  setSelectedServiceForPanel,
  setShowServicePanel
);
```

### 2. useDragAndDrop Hook angepasst
- Neue Parameter `setSelectedServiceForPanel` und `setShowServicePanel` hinzugefügt
- URL-Drop verwendet jetzt Service Panel statt Modal
- Fallback für altes System (falls benötigt)
- Null-Checks verhindern Fehler

### 3. Drag & Drop funktioniert jetzt mit Service Panel
Wenn eine URL per Drag & Drop hinzugefügt wird:
1. Domain-Informationen werden extrahiert
2. Neues Service-Objekt wird erstellt mit `isNew: true`
3. Service Panel öffnet sich mit vorausgefüllten Daten

## Ergebnis
- Fehler behoben
- Drag & Drop funktioniert mit dem neuen Service Panel System
- Intelligente URL-Erkennung bleibt erhalten
# Fehlerbehebung: iconMap is not defined

## Problem
Nach dem Entfernen des ApplianceModal wurde versehentlich auch der iconMap Import entfernt, obwohl er noch an anderen Stellen verwendet wird.

## Lösung
iconMap Import wieder hinzugefügt in App.js:
```javascript
import { iconMap, constants, getFilteredAppliances, getTimeBasedSections, getAllCategories } from './utils';
```

## Verwendung von iconMap
iconMap wird noch benötigt für:
- `getAllCategories()` Funktion
- Kategorie-Icon-Mapping
- SimpleIcon Komponente
- ApplianceCard Komponente

## Lessons Learned
Beim Refactoring sollten Imports nur entfernt werden, wenn sichergestellt ist, dass sie nirgends mehr verwendet werden.
