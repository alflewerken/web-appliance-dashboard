# Settings Panel Header Fix

## Problem
Es gab einen ReferenceError: `activeTab is not defined`

## Ursache
Im Header wurde versucht, auf eine Variable `activeTab` zuzugreifen, die nicht existiert. Die tatsächliche State-Variable heißt `tabValue` und enthält den Index des aktiven Tabs.

## Lösung
```javascript
// Vorher (fehlerhaft):
title={tabs.find(tab => tab.key === activeTab)?.label || 'Einstellungen'}

// Nachher (korrekt):
title={tabs[tabValue]?.label || 'Einstellungen'}
```

## Technische Details

1. **tabValue**: Enthält den Index des aktiven Tabs (0, 1, 2, ...)
2. **tabs Array**: Enthält die Tab-Definitionen mit icon, label und key
3. **Zugriff**: Direkter Array-Zugriff über Index ist effizienter als find()

## Funktionsweise

- `tabs[tabValue]` gibt das Tab-Objekt am aktuellen Index zurück
- `?.label` verwendet Optional Chaining für sicheren Zugriff
- `|| 'Einstellungen'` als Fallback, falls kein Tab gefunden wird

Der Header zeigt nun korrekt den Namen und das Icon des aktiven Tabs an.
