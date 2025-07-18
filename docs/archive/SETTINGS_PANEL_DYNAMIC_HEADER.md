# Settings Panel - Dynamischer Header

## Übersicht
Das Settings Panel zeigt jetzt den Namen des aktuell ausgewählten Tabs im Header an, anstatt immer "Einstellungen" zu zeigen.

## Implementierung

### 1. Tab-Definitionen
Die Tabs werden jetzt mit Icon-Komponenten-Referenzen definiert:
```javascript
const tabs = [
  { icon: Home, label: 'Allgemein', key: 'general' },
  { icon: Image, label: 'UI-Config', key: 'background' },
  // Admin-only tabs...
];
```

### 2. Dynamischer Header
Der UnifiedPanelHeader erhält jetzt dynamische Werte:
```javascript
<UnifiedPanelHeader 
  title={tabs.find(tab => tab.key === activeTab)?.label || 'Einstellungen'} 
  icon={tabs.find(tab => tab.key === activeTab)?.icon || Settings} 
  onClose={onClose} 
/>
```

### 3. Tab-Icons
Die Tab-Icons werden als React-Komponenten gerendert:
```javascript
{tabs.map((tab, index) => {
  const IconComponent = tab.icon;
  return (
    <Tab
      key={tab.key}
      icon={<IconComponent size={20} />}
      label={tab.label}
      iconPosition="start"
    />
  );
})}
```

## Verhalten

- **Allgemein-Tab**: Header zeigt "Allgemein" mit Home-Icon
- **UI-Config-Tab**: Header zeigt "UI-Config" mit Image-Icon
- **Kategorien-Tab**: Header zeigt "Kategorien" mit FolderOpen-Icon
- **SSH-Tab**: Header zeigt "SSH" mit Monitor-Icon
- **Backup-Tab**: Header zeigt "Backup" mit Archive-Icon
- **System-Tab**: Header zeigt "System" mit RefreshCw-Icon

## Vorteile

1. **Bessere Orientierung**: Benutzer sehen sofort, in welchem Bereich sie sich befinden
2. **Konsistente Icons**: Das gleiche Icon wird im Tab und im Header verwendet
3. **Dynamisch**: Ändert sich automatisch beim Tab-Wechsel
4. **Fallback**: Falls kein Tab gefunden wird, wird "Einstellungen" angezeigt

## Technische Details

- Icons sind Lucide React Komponenten
- Die Größe ist auf 20px standardisiert
- Der Header nutzt den vorhandenen UnifiedPanelHeader
- Die Implementierung ist reaktiv und aktualisiert sich bei Tab-Wechsel
