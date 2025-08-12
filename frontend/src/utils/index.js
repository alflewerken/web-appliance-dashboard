// Utils Index - für vereinfachte Imports
export * from './iconMap';
export * from './constants';
export * from './applianceUtils';

// Spezifische Named Exports für bessere IDE-Unterstützung
export { iconMap, getAvailableIcons } from './iconMap';
export {
  constants,
  UI_TEXT,
  COLOR_PRESETS,
  DEFAULT_APPLIANCE,
  SERVICE_CATEGORIES,
} from './constants';
export {
  getFilteredAppliances,
  getTimeBasedSections,
  getAllCategories,
  getCategoryCount,
} from './applianceUtils';
