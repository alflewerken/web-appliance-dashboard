# Service-Erstellung über Service Panel

## Änderungen

### 1. Modal Dialog entfernt
- `ApplianceModal.js` und `ApplianceModal.css` gelöscht
- Alle Referenzen zum Modal aus App.js entfernt
- State-Variablen `showModal`, `editingAppliance` und `formData` entfernt
- Funktionen `handleSubmit` und `resetForm` entfernt

### 2. Service Panel erweitert

#### Neue Service-Unterstützung
- `isNew` Flag zeigt an, ob es sich um einen neuen Service handelt
- Titel zeigt "Neuer Service" bei neuen Services
- Lösch-Button wird bei neuen Services nicht angezeigt
- Grafische Einstellungen Tab ist bei neuen Services deaktiviert

#### App.js Anpassungen
```javascript
const handleAddService = () => {
  const newAppliance = {
    ...constants.defaultFormData,
    category: getValidCategoryForNewService(),
    isNew: true // Flag für neuen Service
  };
  setSelectedServiceForPanel(newAppliance);
  setShowServicePanel(true);
};
```

#### onSave Callback
```javascript
onSave={async (applianceId, data) => {
  if (selectedServiceForPanel.isNew) {
    // Neuen Service erstellen
    const newAppliance = await createAppliance(data);
    if (newAppliance && newAppliance.id) {
      // Panel mit erstelltem Service aktualisieren
      setSelectedServiceForPanel(newAppliance);
    }
  } else {
    // Existierenden Service aktualisieren
    await ApplianceService.patchAppliance(applianceId, data);
  }
  await fetchAppliances();
}}
```

## Workflow

### Neuen Service erstellen
1. Klick auf "+" Button in der Sidebar
2. Service Panel öffnet sich mit leeren Feldern
3. Titel zeigt "Neuer Service"
4. Nur "Service-Einstellungen" Tab ist aktiv
5. Nach dem Speichern:
   - Service wird erstellt
   - Panel bleibt offen
   - Titel zeigt den Service-Namen
   - "Grafische Einstellungen" Tab wird aktiviert
   - Lösch-Button erscheint

### Service bearbeiten
1. Klick auf Service-Karte
2. Service Panel öffnet sich mit bestehenden Daten
3. Beide Tabs sind verfügbar
4. Speichern aktualisiert den Service ohne Panel zu schließen

## Vorteile
- Konsistente Benutzeroberfläche für Erstellen und Bearbeiten
- Weniger Code-Duplikation
- Besserer Workflow - Panel bleibt nach Erstellung offen
- Sofortiger Zugriff auf alle Einstellungen nach Erstellung

## Entfernte Komponenten
- `ApplianceModal.js`
- `ApplianceModal.css`
- Modal-bezogene States und Funktionen in App.js
