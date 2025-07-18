# Fix: Transparenz und Unschärfe beim Service-Speichern erhalten

## Problem
Beim Speichern im Service Panel (Tab "Service-Einstellungen") wurden die Transparenz- und Unschärfewerte überschrieben, obwohl diese nur im Tab "Grafische Einstellungen" geändert werden sollten.

## Lösung

### 1. Frontend - App.js
- `onSave` Callback verwendet jetzt `patchAppliance` statt `updateAppliance`
- PATCH sendet nur die übergebenen Felder, PUT würde alle Felder überschreiben

### 2. Frontend - ServicePanel.js
- `handleSaveService` dokumentiert explizit, dass visuelle Einstellungen nicht mitgesendet werden
- Transparenz und Unschärfe werden nur über den Tab "Grafische Einstellungen" gespeichert

### 3. Backend - appliances.js
- PATCH-Route erweitert um camelCase-Mapping für openMode-Felder
- Unterstützt jetzt beide Schreibweisen: `openModeMini` und `open_mode_mini`

## Technische Details

### PATCH vs PUT
- **PUT**: Überschreibt ALLE Felder des Datensatzes
- **PATCH**: Aktualisiert NUR die übergebenen Felder

### Datenfluss
1. Service-Tab speichern → Sendet nur Service-Daten (Name, URL, Icon, etc.)
2. Grafik-Tab speichern → Sendet nur visuelle Daten (transparency, blur)
3. Backend PATCH → Aktualisiert nur die empfangenen Felder
4. SSE Broadcast → Alle Clients erhalten Update

## Ergebnis
- Transparenz und Unschärfe bleiben beim Speichern im Service-Tab unverändert
- Jeder Tab speichert nur seine eigenen Einstellungen
- Keine unerwünschten Überschreibungen mehr
