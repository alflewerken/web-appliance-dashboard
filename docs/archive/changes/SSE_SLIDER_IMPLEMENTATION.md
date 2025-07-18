# SSE Real-time Updates für Slider-Änderungen

## Implementierte Änderungen

### 1. Backend - SSE-Integration für Slider Updates

#### `/backend/routes/appliances.js`
- Import von SSE broadcast Funktion hinzugefügt
- PUT-Route erweitert um SSE-Event `appliance_updated` zu senden
- Neue PATCH-Route hinzugefügt, die partielle Updates unterstützt
- Bei jedem Update wird ein SSE-Event `appliance_updated` gebroadcasted
- Unterstützt `transparency` und `blur` Felder mit korrektem Datenbank-Mapping:
  - API: `transparency` → DB: `transparency` (0.0-1.0)
  - API: `blur` → DB: `blur_amount` (pixels)

### 2. Frontend - SSE Event Handler

#### `/frontend/src/hooks/useAppliances.js`
- Bestehender Event-Listener für `appliance_updated` Events
- Aktualisiert die lokale State sofort wenn SSE-Events empfangen werden
- Alle Clients erhalten die Updates in Echtzeit

#### `/frontend/src/components/ServicePanel.js`
- Bereits implementiert: `onChangeCommitted` Handler für Slider
- Speichert Werte in der Datenbank wenn Slider losgelassen wird
- Debounced Live-Updates während des Ziehens (50ms)

#### `/frontend/src/App.js`
- `handleUpdateCardSettings` nutzt jetzt korrekt `ApplianceService.patchAppliance`

### 3. Datenfluss

1. **Benutzer zieht Slider** → Lokale Vorschau-Updates (debounced)
2. **Benutzer lässt Slider los** → `onChangeCommitted` wird ausgelöst
3. **Frontend sendet PATCH Request** → `/api/appliances/:id` mit neuen Werten
4. **Backend speichert in DB** → `transparency` und `blur_amount` Spalten
5. **Backend sendet SSE Event** → `appliance_updated` mit vollständigen Appliance-Daten
6. **Alle Clients empfangen Event** → State wird automatisch aktualisiert
7. **UI aller Clients updated** → Service Cards zeigen neue Werte

## Verwendung

### Server starten
```bash
cd /Users/alflewerken/Desktop/web-appliance-dashboard/backend
npm start
# Migrationen werden automatisch ausgeführt
```

### Frontend starten
```bash
cd /Users/alflewerken/Desktop/web-appliance-dashboard/frontend
npm start
```

## Testing

1. Öffnen Sie das Dashboard in mehreren Browser-Tabs/Fenstern
2. Öffnen Sie das ServicePanel für einen Service
3. Wechseln Sie zum "Grafische Einstellungen" Tab
4. Ziehen Sie die Slider für Transparenz oder Unschärfe
5. Lassen Sie den Slider los
6. Beobachten Sie, wie sich die Service Cards in allen Clients aktualisieren

## Technische Details

- **Optimistic Updates**: UI wird sofort aktualisiert, Server-Bestätigung folgt
- **Fehlerbehandlung**: Bei Fehlern wird auf vorherigen Zustand zurückgesetzt
- **Performance**: Debounced Updates vermeiden Flackern während des Ziehens
- **Konsistenz**: SSE stellt sicher, dass alle Clients synchron bleiben
