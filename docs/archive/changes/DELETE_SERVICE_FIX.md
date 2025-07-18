# Fehlerbehebung: Service löschen - "Appliance not found"

## Problem
Beim Versuch einen Service über das Service Panel zu löschen, erschien die Fehlermeldung "Appliance not found".

## Ursache
Die `deleteAppliance` Funktion erwartet eine ID als Parameter, aber das ServicePanel hat das komplette appliance Objekt übergeben.

```javascript
// Falsch:
await deleteAppliance(appliance);

// Richtig:
await deleteAppliance(appliance.id);
```

## Lösung
In App.js wurde die onDelete Callback-Funktion korrigiert:

```javascript
onDelete={async (appliance) => {
  await deleteAppliance(appliance.id);  // Nur die ID übergeben
  // Beim Löschen schließen wir das Panel
  setShowServicePanel(false);
  setSelectedServiceForPanel(null);
}}
```

## Ergebnis
- Services können jetzt erfolgreich über das Service Panel gelöscht werden
- Das Panel schließt sich nach dem Löschen automatisch
- Keine Fehlermeldung mehr

## Technische Details
Die `deleteAppliance` Funktion in `useAppliances.js`:
- Erwartet eine ID als Parameter
- Führt optimistische Updates durch
- Rollt bei Fehlern zurück
- SSE übernimmt die finale Synchronisation
