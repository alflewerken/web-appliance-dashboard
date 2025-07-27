// Utility-Funktionen für Appliance-Filterung und -Sortierung
import { getIconByName } from './lucideIconsLoader';

export const getFilteredAppliances = (
  appliances,
  selectedCategory,
  searchTerm,
  showOnlyWithStatus = false
) => {
  let filtered = appliances;

  // Nach Status filtern (neu)
  if (showOnlyWithStatus) {
    filtered = filtered.filter(
      app => app.statusCommand && app.statusCommand.trim() !== ''
    );
  }

  // Nach Kategorie filtern
  if (selectedCategory !== 'all') {
    if (selectedCategory === 'favorites') {
      filtered = filtered.filter(app => app.isFavorite);
    } else if (selectedCategory === 'recent') {
      filtered = filtered
        .filter(app => app.lastUsed)
        .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))
        .slice(0, 20);
    } else {
      filtered = filtered.filter(app => app.category === selectedCategory);
    }
  }

  // Nach Suchbegriff filtern
  if (searchTerm) {
    filtered = filtered.filter(
      app =>
        app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (app.description &&
          app.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }

  return filtered;
};

export const getTimeBasedSections = appliances => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Nur Services mit lastUsed Datum berücksichtigen
  const recentAppliances = appliances.filter(app => app.lastUsed);

  // Sortiere alle nach lastUsed (neueste zuerst)
  const sortedAppliances = recentAppliances.sort(
    (a, b) => new Date(b.lastUsed) - new Date(a.lastUsed)
  );

  const lastHour = sortedAppliances.filter(
    app => new Date(app.lastUsed) >= oneHourAgo
  );

  const lastTwoHours = sortedAppliances.filter(
    app =>
      new Date(app.lastUsed) >= twoHoursAgo &&
      new Date(app.lastUsed) < oneHourAgo
  );

  const lastFiveHours = sortedAppliances.filter(
    app =>
      new Date(app.lastUsed) >= fiveHoursAgo &&
      new Date(app.lastUsed) < twoHoursAgo
  );

  const lastTwentyFourHours = sortedAppliances.filter(
    app =>
      new Date(app.lastUsed) >= twentyFourHoursAgo &&
      new Date(app.lastUsed) < fiveHoursAgo
  );

  const lastWeek = sortedAppliances.filter(
    app =>
      new Date(app.lastUsed) >= oneWeekAgo &&
      new Date(app.lastUsed) < twentyFourHoursAgo
  );

  return {
    lastHour,
    lastTwoHours,
    lastFiveHours,
    lastTwentyFourHours,
    lastWeek,
  };
};

// Funktion zum Kombinieren von statischen und API-Kategorien
export const getAllCategories = (
  staticCategories,
  apiCategories,
  iconMap,
  categoriesLastUpdated
) => {
  // Sicherstellen, dass apiCategories ein Array ist
  const safeApiCategories = Array.isArray(apiCategories) ? apiCategories : [];

  // Debug: Log API categories
  // Sortiere API-Kategorien nach order
  const sortedApiCategories = [...safeApiCategories].sort(
    (a, b) => (a.order || 0) - (b.order || 0)
  );

  return [
    ...staticCategories,
    ...sortedApiCategories.map(cat => {
      let IconComponent = null;

      try {
        // Dynamisch das Icon laden
        if (cat.icon) {
          IconComponent = getIconByName(cat.icon);
        }
      } catch (error) {}

      // Debug: Log each category
      return {
        id: cat.name,
        name: cat.name,
        icon: IconComponent, // Kann null sein, wird in AppSidebar zu Server-Fallback
        color: cat.color, // Keine Fallback-Farbe hier, kommt aus der DB
        order: cat.order, // Preserve order for sorting
      };
    }),
  ];
};

// Funktion zum Zählen von Appliances pro Kategorie
export const getCategoryCount = (categoryId, appliances) => {
  if (categoryId === 'all') return appliances.length;
  if (categoryId === 'favorites')
    return appliances.filter(app => app.isFavorite).length;
  if (categoryId === 'recent')
    return appliances.filter(app => app.lastUsed).length;
  return appliances.filter(app => app.category === categoryId).length;
};
