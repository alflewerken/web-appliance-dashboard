# Fix für automatische Slider-Updates über SSE

## Problem
Beim Bewegen eines Sliders im Service Panel unter "Grafische Einstellungen" wurden die Änderungen nicht automatisch an alle Clients übertragen. Zusätzlich trat ein JavaScript-Fehler auf: "setAppliances is not defined".

## Lösung

### 1. Backend - `/backend/routes/appliances.js`
- Import der SSE broadcast Funktion hinzugefügt: `const { broadcast } = require('./sse');`
- PUT-Route erweitert um SSE-Events zu senden
- Neue PATCH-Route für partielle Updates implementiert
- Beide Routen senden jetzt `appliance_updated` Events über SSE

### 2. Frontend - `/frontend/src/App.js`
- `handleUpdateCardSettings` nutzt jetzt korrekt `ApplianceService.patchAppliance`
- Entfernte die optimistische State-Aktualisierung (setAppliances), da diese nicht verfügbar war
- Die Aktualisierung erfolgt jetzt ausschließlich über SSE-Events

## Ergebnis
- Wenn ein Slider losgelassen wird, speichert das System automatisch den Wert in der Datenbank
- Backend sendet ein SSE-Event `appliance_updated` an alle Clients
- Alle verbundenen Clients erhalten sofort die Aktualisierung über SSE
- Die Service Cards zeigen die neuen Transparenz- und Unschärfewerte in Echtzeit an
- Kein JavaScript-Fehler mehr

## Test
1. Dashboard in mehreren Browser-Tabs öffnen
2. Service Panel öffnen → "Grafische Einstellungen" Tab
3. Slider bewegen und loslassen
4. Alle Clients zeigen die Änderungen sofort an
