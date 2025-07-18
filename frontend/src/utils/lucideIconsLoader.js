// Dynamischer Icon Loader für Lucide React Icons
// Vermeidet zirkuläre Abhängigkeiten durch lazy loading

import * as LucideIcons from 'lucide-react';

// Direkt alle Icons exportieren für einfachen Zugriff
export const lucideIcons = LucideIcons;

// Get icon by name with fallback
export const getIconByName = iconName => {
  if (!iconName || typeof iconName !== 'string') {
    return LucideIcons.Server || LucideIcons.Box || (() => null);
  }

  // Try exact match first
  if (LucideIcons[iconName]) {
    return LucideIcons[iconName];
  }

  // Try with "Icon" suffix
  const iconWithSuffix = iconName + 'Icon';
  if (LucideIcons[iconWithSuffix]) {
    return LucideIcons[iconWithSuffix];
  }

  // Try with different cases
  const upperName = iconName.charAt(0).toUpperCase() + iconName.slice(1);
  if (LucideIcons[upperName]) {
    return LucideIcons[upperName];
  }

  // Fallback to Server icon
  return LucideIcons.Server || LucideIcons.Box || (() => null);
};

// Get all available icon names
export const getIconNames = () => {
  const allKeys = Object.keys(LucideIcons).filter(key => {
    const component = LucideIcons[key];
    // Nur die wichtigsten ausschließen
    return (
      key !== 'createLucideIcon' &&
      key !== 'Icon' &&
      key !== 'icons' && // Der 'icons' Export
      key[0] === key[0].toUpperCase() && // Muss mit Großbuchstaben beginnen
      typeof component !== 'string' // Keine String-Exporte
    );
  });

  // Entferne Duplikate: Wenn sowohl "Name" als auch "NameIcon" existieren,
  // behalte nur die Version ohne "Icon" suffix
  const uniqueIcons = new Set();
  const iconSuffixPattern = /Icon$/;

  allKeys.forEach(key => {
    // Wenn der Key mit "Icon" endet
    if (iconSuffixPattern.test(key)) {
      const baseKey = key.replace(iconSuffixPattern, '');
      // Füge nur hinzu, wenn die Basis-Version nicht existiert
      if (!allKeys.includes(baseKey)) {
        uniqueIcons.add(key);
      }
    } else {
      // Normale Icons ohne "Icon" suffix immer hinzufügen
      uniqueIcons.add(key);
    }
  });

  return Array.from(uniqueIcons).sort();
};
