import { useState, useEffect } from 'react';
import { SettingsService } from '../services/settingsService';
import { useSSE } from './useSSE';
import { forceRealIPadDOMUpdate } from '../utils/realIPadFix';

export const useSettings = () => {
  const [selectedCategory, setSelectedCategory] = useState(null); // Start mit null statt 'all'
  const [currentTheme, setCurrentTheme] = useState('dark');
  const [adminMode, setAdminMode] = useState(false);
  const [settingsLastUpdated, setSettingsLastUpdated] = useState(Date.now());
  const [forceUpdate, setForceUpdate] = useState(0); // Add missing state
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const { addEventListener } = useSSE();

  // Enhanced iPad detection for Safari Simulator and real devices
  const isIPad =
    /iPad/.test(navigator.userAgent) ||
    /iPad/.test(navigator.platform) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
    navigator.platform === 'iPad' ||
    // Special detection for Safari iPad Simulator and real devices
    (navigator.platform === 'MacIntel' &&
      navigator.maxTouchPoints === 5 &&
      window.innerWidth >= 768 &&
      window.innerWidth <= 1366) ||
    // Zusätzliche Erkennung für iPadOS 13+
    ('ontouchstart' in window &&
      window.innerWidth >= 768 &&
      window.innerWidth <= 1366 &&
      navigator.maxTouchPoints > 0);

  // Detect if it's a real iPad (not simulator) - UPDATED
  // Da sowohl Simulator als auch echtes iPad maxTouchPoints = 5 haben,
  // müssen wir andere Methoden verwenden
  const isRealIPad = isIPad; // Behandle alle iPads gleich

  const loadDefaultCategory = async () => {
    try {
      const settings = await SettingsService.fetchSettings();
      const defaultCategory = settings.default_category || 'all';
      setSelectedCategory(defaultCategory);
      setSettingsLoaded(true);
      return defaultCategory;
    } catch (error) {
      console.error('Error loading default category:', error);
      setSelectedCategory('all');
      setSettingsLoaded(true);
      return 'all';
    }
  };

  const loadAdminMode = async () => {
    try {
      // Check if we just reloaded for admin mode change
      const reloadRequired = sessionStorage.getItem('adminModeReloadRequired');
      const adminModeAfterReload = sessionStorage.getItem(
        'adminModeAfterReload'
      );

      if (reloadRequired === 'true' && adminModeAfterReload !== null) {
        const newAdminMode = adminModeAfterReload === 'true';
        setAdminMode(newAdminMode);

        // Clean up
        sessionStorage.removeItem('adminModeReloadRequired');
        sessionStorage.removeItem('adminModeAfterReload');

        // Show success message
        const successMessage = document.createElement('div');
        successMessage.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: rgba(0, 255, 0, 0.1);
          color: #4CAF50;
          padding: 15px 25px;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 500;
          border: 1px solid rgba(0, 255, 0, 0.3);
          z-index: 999999;
          animation: slideIn 0.3s ease;
        `;
        successMessage.textContent = `Admin Mode ${newAdminMode ? 'aktiviert' : 'deaktiviert'} ✓`;
        if (document.body) {
          document.body.appendChild(successMessage);

          setTimeout(() => {
            successMessage.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => successMessage.remove(), 300);
          }, 2000);
        }

        return;
      }

      // Normal load
      const adminModeValue = await SettingsService.loadAdminMode();
      setAdminMode(adminModeValue);
    } catch (error) {
      setAdminMode(false);
    }
  };

  const loadAndApplyTheme = async () => {
    try {
      const settings = await SettingsService.fetchSettings();
      const themeMode = settings.theme_mode || 'dark';
      setCurrentTheme(themeMode);
      applyTheme(themeMode);
    } catch (error) {
      applyTheme('dark');
    }
  };

  const applyTheme = themeMode => {
    // Check if DOM is available (for tests)
    if (typeof document === 'undefined' || !document.body) {
      return;
    }

    const { body } = document;
    const html = document.documentElement;

    // Entferne alle Theme-Klassen
    body.classList.remove('theme-light', 'theme-dark', 'theme-auto');
    html.classList.remove('theme-light', 'theme-dark', 'theme-auto');

    // Setze Theme-Klasse basierend auf Einstellung
    if (themeMode === 'light') {
      body.classList.add('theme-light');
      html.classList.add('theme-light');
      body.style.backgroundColor = '#f2f2f7';
      body.style.color = '#000000';
    } else if (themeMode === 'dark') {
      body.classList.add('theme-dark');
      html.classList.add('theme-dark');
      body.style.backgroundColor = '#000000';
      body.style.color = '#ffffff';
    } else if (themeMode === 'auto') {
      body.classList.add('theme-auto');
      html.classList.add('theme-auto');

      // Verwende System-Präferenz
      const prefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches;
      if (prefersDark) {
        body.style.backgroundColor = '#000000';
        body.style.color = '#ffffff';
      } else {
        body.style.backgroundColor = '#f2f2f7';
        body.style.color = '#000000';
      }
    }

    // Speichere Theme im LocalStorage für theme-handler.js
    try {
      localStorage.setItem('dashboard-theme-mode', themeMode);
    } catch (error) {
      console.error('Failed to save theme to localStorage:', error);
    }

    };

  const updateSetting = async (key, value) => {
    try {
      await SettingsService.updateSetting(key, value);
      setSettingsLastUpdated(Date.now());
      return true;
    } catch (error) {
      return false;
    }
  };

  useEffect(() => {
    const initializeSettings = async () => {
      await Promise.all([
        loadDefaultCategory(),
        loadAndApplyTheme(),
        loadAdminMode(),
      ]);
    };

    initializeSettings();

    // Subscribe to SSE events for real-time updates
    const unsubscribeSetting = addEventListener('setting_update', data => {
      if (data.key === 'theme_mode') {
        setCurrentTheme(data.value);
        applyTheme(data.value);
      } else if (data.key === 'default_category') {
        setSelectedCategory(data.value);
      } else if (data.key === 'admin_mode') {
        const newAdminMode = data.value === 'true';
        // Einfach den Admin-Modus setzen, kein Reload
        setAdminMode(newAdminMode);
      }
    });

    const unsubscribeBulk = addEventListener(
      'settings_bulk_update',
      async data => {
        if (data.theme_mode !== undefined) {
          setCurrentTheme(data.theme_mode);
          applyTheme(data.theme_mode);
        }

        if (data.default_category !== undefined) {
          setSelectedCategory(data.default_category);
        }

        if (data.admin_mode !== undefined) {
          const newAdminMode = data.admin_mode === 'true';
          setAdminMode(newAdminMode);
        }

        // Trigger re-render for other components
        setSettingsLastUpdated(Date.now());
      }
    );

    // Cleanup
    return () => {
      unsubscribeSetting();
      unsubscribeBulk();
    };
  }, [addEventListener]);

  return {
    selectedCategory: selectedCategory || 'all', // Fallback auf 'all' wenn noch nicht geladen
    setSelectedCategory,
    currentTheme,
    setCurrentTheme,
    adminMode,
    setAdminMode,
    settingsLastUpdated,
    forceUpdate, // Export force update counter
    settingsLoaded,
    loadDefaultCategory,
    loadAndApplyTheme,
    loadAdminMode,
    applyTheme,
    updateSetting,
  };
};
