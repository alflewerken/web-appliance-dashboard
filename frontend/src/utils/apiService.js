/**
 * API Service for Web Appliance Dashboard
 *
 * @author Web Appliance Dashboard
 * @version 1.0.0
 */

import { API_ENDPOINTS, VALIDATION_RULES, DEFAULTS } from './constants';

/**
 * Generic API utility functions
 */
export const apiUtils = {
  /**
   * Validate category data before sending to API
   */
  validateCategory: categoryData => {
    const errors = [];

    if (!categoryData.name || !categoryData.name.trim()) {
      errors.push('Name ist erforderlich');
    }

    if (
      categoryData.name &&
      categoryData.name.length > VALIDATION_RULES.CATEGORY.name.maxLength
    ) {
      errors.push(
        `Name darf maximal ${VALIDATION_RULES.CATEGORY.name.maxLength} Zeichen haben`
      );
    }

    if (
      categoryData.description &&
      categoryData.description.length >
        VALIDATION_RULES.CATEGORY.description.maxLength
    ) {
      errors.push(
        `Beschreibung darf maximal ${VALIDATION_RULES.CATEGORY.description.maxLength} Zeichen haben`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * Prepare category data for API submission
   */
  prepareCategoryData: formData => ({
    name: formData.name.trim(),
    icon: formData.icon || DEFAULTS.CATEGORY.icon,
    color: formData.color || DEFAULTS.CATEGORY.color,
    description: formData.description ? formData.description.trim() : null,
  }),

  /**
   * Process category data received from API
   */
  processCategoryData: apiData => ({
    ...apiData,
    icon: apiData.icon || DEFAULTS.CATEGORY.icon,
    color: apiData.color || DEFAULTS.CATEGORY.color,
    description: apiData.description || '',
  }),

  /**
   * Validate appliance data before sending to API
   */
  validateAppliance: applianceData => {
    const errors = [];

    if (!applianceData.name || !applianceData.name.trim()) {
      errors.push('Name ist erforderlich');
    }

    if (!applianceData.url || !applianceData.url.trim()) {
      errors.push('URL ist erforderlich');
    }

    if (
      applianceData.url &&
      !VALIDATION_RULES.APPLIANCE.url.pattern.test(applianceData.url)
    ) {
      errors.push('URL muss mit http:// oder https:// beginnen');
    }

    if (
      applianceData.name &&
      applianceData.name.length > VALIDATION_RULES.APPLIANCE.name.maxLength
    ) {
      errors.push(
        `Name darf maximal ${VALIDATION_RULES.APPLIANCE.name.maxLength} Zeichen haben`
      );
    }

    if (
      applianceData.description &&
      applianceData.description.length >
        VALIDATION_RULES.APPLIANCE.description.maxLength
    ) {
      errors.push(
        `Beschreibung darf maximal ${VALIDATION_RULES.APPLIANCE.description.maxLength} Zeichen haben`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * Handle API errors consistently
   */
  handleApiError: (error, operation = 'API operation') => {
    if (error.response) {
      // Server responded with error status
      return `Server-Fehler (${error.response.status}): ${error.response.data?.error || error.message}`;
    } else if (error.request) {
      // Request was made but no response
      return 'Keine Antwort vom Server. Bitte prüfen Sie Ihre Internetverbindung.';
    } else {
      // Something else happened
      return `Unerwarteter Fehler: ${error.message}`;
    }
  },

  /**
   * Create a generic fetch wrapper with error handling
   */
  fetchWithErrorHandling: async (url, options = {}) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }));
        throw new Error(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      throw new Error(
        apiUtils.handleApiError(error, `${options.method || 'GET'} ${url}`)
      );
    }
  },
};

/**
 * Categories API service
 */
export const categoriesApi = {
  /**
   * Get all categories
   */
  getAll: async () => apiUtils.fetchWithErrorHandling(API_ENDPOINTS.CATEGORIES),

  /**
   * Get category by ID
   */
  getById: async id =>
    apiUtils.fetchWithErrorHandling(`${API_ENDPOINTS.CATEGORIES}/${id}`),

  /**
   * Create new category
   */
  create: async categoryData => {
    const preparedData = apiUtils.prepareCategoryData(categoryData);

    return apiUtils.fetchWithErrorHandling(API_ENDPOINTS.CATEGORIES, {
      method: 'POST',
      body: JSON.stringify(preparedData),
    });
  },

  /**
   * Update existing category
   */
  update: async (id, categoryData) => {
    const preparedData = apiUtils.prepareCategoryData(categoryData);

    return apiUtils.fetchWithErrorHandling(
      `${API_ENDPOINTS.CATEGORIES}/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(preparedData),
      }
    );
  },

  /**
   * Delete category
   */
  delete: async id =>
    apiUtils.fetchWithErrorHandling(`${API_ENDPOINTS.CATEGORIES}/${id}`, {
      method: 'DELETE',
    }),
};

/**
 * Appliances API service
 */
export const appliancesApi = {
  /**
   * Get all appliances
   */
  getAll: async () => apiUtils.fetchWithErrorHandling(API_ENDPOINTS.APPLIANCES),

  /**
   * Get appliance by ID
   */
  getById: async id =>
    apiUtils.fetchWithErrorHandling(`${API_ENDPOINTS.APPLIANCES}/${id}`),

  /**
   * Create new appliance
   */
  create: async applianceData =>
    apiUtils.fetchWithErrorHandling(API_ENDPOINTS.APPLIANCES, {
      method: 'POST',
      body: JSON.stringify(applianceData),
    }),

  /**
   * Update existing appliance
   */
  update: async (id, applianceData) =>
    apiUtils.fetchWithErrorHandling(`${API_ENDPOINTS.APPLIANCES}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(applianceData),
    }),

  /**
   * Delete appliance
   */
  delete: async id =>
    apiUtils.fetchWithErrorHandling(`${API_ENDPOINTS.APPLIANCES}/${id}`, {
      method: 'DELETE',
    }),

  /**
   * Update last used timestamp
   */
  updateLastUsed: async id =>
    apiUtils.fetchWithErrorHandling(`${API_ENDPOINTS.APPLIANCES}/${id}/open`, {
      method: 'POST',
    }),
};

/**
 * Settings API service
 */
export const settingsApi = {
  /**
   * Get all settings
   */
  getAll: async () => apiUtils.fetchWithErrorHandling(API_ENDPOINTS.SETTINGS),

  /**
   * Get specific setting by key
   */
  getByKey: async key =>
    apiUtils.fetchWithErrorHandling(`${API_ENDPOINTS.SETTINGS}/${key}`),

  /**
   * Update single setting
   */
  updateSingle: async (key, value, description = null) =>
    apiUtils.fetchWithErrorHandling(API_ENDPOINTS.SETTINGS, {
      method: 'POST',
      body: JSON.stringify({ key, value, description }),
    }),

  /**
   * Update multiple settings
   */
  updateMultiple: async settings =>
    apiUtils.fetchWithErrorHandling(API_ENDPOINTS.SETTINGS, {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  /**
   * Delete setting
   */
  delete: async key =>
    apiUtils.fetchWithErrorHandling(`${API_ENDPOINTS.SETTINGS}/${key}`, {
      method: 'DELETE',
    }),
};

/**
 * Background API service
 */
export const backgroundApi = {
  /**
   * Get current background
   */
  getCurrent: async () =>
    apiUtils.fetchWithErrorHandling(`${API_ENDPOINTS.BACKGROUND}/current`),

  /**
   * Get all background images
   */
  getAll: async () =>
    apiUtils.fetchWithErrorHandling(`${API_ENDPOINTS.BACKGROUND}/list`),

  /**
   * Upload background image
   */
  upload: async file => {
    const formData = new FormData();
    formData.append('background', file);

    const token = localStorage.getItem('token');
    const response = await fetch(`${API_ENDPOINTS.BACKGROUND}/upload`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: 'Upload failed' }));
      throw new Error(
        errorData.error || `Upload failed: ${response.statusText}`
      );
    }

    return await response.json();
  },

  /**
   * Activate background
   */
  activate: async id =>
    apiUtils.fetchWithErrorHandling(
      `${API_ENDPOINTS.BACKGROUND}/activate/${id}`,
      {
        method: 'POST',
      }
    ),

  /**
   * Delete background
   */
  delete: async id =>
    apiUtils.fetchWithErrorHandling(`${API_ENDPOINTS.BACKGROUND}/${id}`, {
      method: 'DELETE',
    }),

  /**
   * Disable background
   */
  disable: async () =>
    apiUtils.fetchWithErrorHandling(`${API_ENDPOINTS.BACKGROUND}/disable`, {
      method: 'POST',
    }),
};

/**
 * Backup API service
 */
export const backupApi = {
  /**
   * Create backup
   */
  create: async () => apiUtils.fetchWithErrorHandling(API_ENDPOINTS.BACKUP),

  /**
   * Restore from backup
   */
  restore: async backupData =>
    apiUtils.fetchWithErrorHandling(API_ENDPOINTS.RESTORE, {
      method: 'POST',
      body: JSON.stringify(backupData),
    }),
};

/**
 * Health check API service
 */
export const healthApi = {
  /**
   * Check API health
   */
  check: async () => apiUtils.fetchWithErrorHandling(API_ENDPOINTS.HEALTH),
};
