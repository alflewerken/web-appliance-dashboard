import { Grid, Clock, Heart } from 'lucide-react';

// Konstanten für die Anwendung

export const constants = {
  // Statische Kategorien für Sidebar
  staticCategories: [
    { id: 'all', name: 'Alle Services', icon: Grid, color: '#8E8E93' },
    { id: 'recent', name: 'Zuletzt verwendet', icon: Clock, color: '#FF9500' },
    { id: 'favorites', name: 'Favoriten', icon: Heart, color: '#FF3B30' },
  ],
  // Farbpalette
  colorPresets: [
    '#FF3B30',
    '#FF9500',
    '#FFCC02',
    '#34C759',
    '#00C7BE',
    '#007AFF',
    '#5856D6',
    '#AF52DE',
    '#FF2D92',
    '#A2845E',
    '#8E8E93',
    '#636366',
  ],

  // Standard-Einstellungen für Hintergrundbilder
  defaultBackgroundSettings: {
    enabled: false,
    opacity: 0.3,
    blur: 5,
    position: 'center',
  },

  // Standard-Formulardaten für neue Appliances
  defaultFormData: {
    name: '',
    url: '',
    description: '',
    icon: 'Server',
    color: '#007AFF',
    category: 'productivity',
    startCommand: '',
    stopCommand: '',
    statusCommand: '',
    sshConnection: '',
    transparency: 0.7,
    blur: 8,
    isFavorite: false,
    openModeMini: 'browser_tab',
    openModeMobile: 'browser_tab',
    openModeDesktop: 'browser_tab',
  },

  // Datei-Upload-Limits
  maxFileSize: 50 * 1024 * 1024, // 50MB
  supportedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  supportedBackupTypes: ['application/json'],

  // API-Endpunkte
  apiEndpoints: {
    appliances: '/api/appliances',
    categories: '/api/categories',
    settings: '/api/settings',
    backup: '/api/backup',
    restore: '/api/restore',
    background: {
      current: '/api/background/current',
      list: '/api/background/list',
      upload: '/api/background/upload',
      activate: '/api/background/activate',
      delete: '/api/background',
      disable: '/api/background/disable',
    },
  },

  // Zeiträume für "recent" Kategorien
  timeRanges: {
    oneMonth: 30 * 24 * 60 * 60 * 1000,
    threeMonths: 90 * 24 * 60 * 60 * 1000,
    sixMonths: 180 * 24 * 60 * 60 * 1000,
  },

  // Standard-Themes
  themes: {
    light: 'light',
    dark: 'dark',
    auto: 'auto',
  },
};

// UI-Text-Konstanten
export const UI_TEXT = {
  // Modal-Texte
  ADD_SERVICE: 'Neuer Service',
  EDIT_SERVICE: 'Service bearbeiten',
  SAVE_CHANGES: 'Änderungen speichern',
  CANCEL: 'Abbrechen',

  // Formular-Labels
  NAME: 'Name',
  URL: 'URL',
  DESCRIPTION: 'Beschreibung',
  CATEGORY: 'Kategorie',
  ICON: 'Icon',
  COLOR: 'Farbe',

  // Platzhalter-Texte
  PLACEHOLDER_NAME: 'z.B. OpenHAB',
  PLACEHOLDER_URL: 'http://192.168.1.100:8080',
  PLACEHOLDER_DESCRIPTION: 'z.B. Smart Home Control',

  // Sidebar-Texte
  MY_SERVICES: 'Meine Services',
  SETTINGS: 'Einstellungen',

  // Allgemeine Texte
  SEARCH: 'Suchen',
  LOADING: 'Lade Ihre Services...',
  NO_SERVICES_FOUND: 'Keine Services gefunden',
  ADD_FIRST_SERVICE: 'Fügen Sie Ihren ersten Service hinzu',
};

// Farbpalette (separate Export für bessere Verwendung)
export const COLOR_PRESETS = constants.colorPresets;

// Standard-Appliance-Daten (separate Export)
export const DEFAULT_APPLIANCE = constants.defaultFormData;

// Service-Kategorien (separate Export für Sidebar)
export const SERVICE_CATEGORIES = constants.staticCategories;
