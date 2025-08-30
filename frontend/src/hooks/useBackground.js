import { useState, useEffect, useRef } from 'react';
import { BackgroundService } from '../services/backgroundService';
import { useSSE } from './useSSE';
import { backgroundSyncManager } from '../utils/backgroundSyncManager';

export const useBackground = () => {
  // Initialize from localStorage for immediate display
  const getInitialSettings = () => {
    try {
      const stored = localStorage.getItem('backgroundSettings');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      // Silently handle error
    }
    return {
      enabled: false,
      opacity: 0.3,
      blur: 5,
      position: 'center',
    };
  };

  const [currentBackground, setCurrentBackground] = useState(null);
  const [backgroundImages, setBackgroundImages] = useState([]);
  const [backgroundSettings, setBackgroundSettings] = useState(getInitialSettings());
  const [settingsVersion, setSettingsVersion] = useState(0); // Force re-render trigger
  const backgroundRef = useRef(null);
  const settingsRef = useRef(backgroundSettings);
  const { addEventListener } = useSSE();

  // Keep ref in sync with state
  useEffect(() => {
    settingsRef.current = backgroundSettings;
  }, [backgroundSettings]);

  const updateBackgroundStyles = settings => {
    // Save to localStorage for early initialization
    localStorage.setItem('backgroundSettings', JSON.stringify(settings));
    
    // Update body attributes
    if (settings.enabled) {
      document.body.classList.add('has-background-image');
      document.body.setAttribute('data-opacity', settings.opacity);
      document.body.setAttribute('data-blur', settings.blur);
    } else {
      document.body.classList.remove('has-background-image');
      document.body.removeAttribute('data-opacity');
      document.body.removeAttribute('data-blur');
    }

    // Update background element if it exists
    const backgroundElement =
      backgroundRef.current ||
      document.querySelector('.background-image') ||
      document.querySelector('[data-background="true"]');

    if (backgroundElement && settings.enabled) {
      // Direct style manipulation with immediate effect
      backgroundElement.style.transition =
        'opacity 0.2s ease, filter 0.2s ease';
      backgroundElement.style.opacity = settings.opacity;
      backgroundElement.style.filter = `blur(${settings.blur}px)`;
      backgroundElement.style.webkitFilter = `blur(${settings.blur}px)`;
      backgroundElement.style.backgroundPosition =
        settings.position || 'center';

      // Update overlay if exists
      const overlay = document.querySelector('.background-overlay');
      if (overlay) {
        overlay.style.opacity = Math.max(
          0,
          Math.min(1, 1 - (settings.opacity || 0.3))
        );
      }

      // Trigger a custom event to notify other components
      window.dispatchEvent(
        new CustomEvent('backgroundSettingsUpdated', {
          detail: settings,
        })
      );
    }
  };

  const loadCurrentBackground = async () => {
    try {
      const background = await BackgroundService.loadCurrentBackground();
      setCurrentBackground(background);
    } catch (error) {
      console.error('Failed to load current background:', error);
      setCurrentBackground(null);
    }
  };

  const loadAllBackgroundImages = async () => {
    try {
      const images = await BackgroundService.loadAllBackgroundImages();
      setBackgroundImages(images);
    } catch (error) {
      setBackgroundImages([]);
    }
  };

  const loadBackgroundSettings = async () => {
    try {
      const settings = await BackgroundService.loadBackgroundSettings();
      setBackgroundSettings(settings);

      // Save to localStorage for early initialization
      localStorage.setItem('backgroundSettings', JSON.stringify(settings));

      // Force re-apply styles when settings change
      // Always update styles, not just when enabled
      updateBackgroundStyles(settings);
    } catch (error) {
      // Silently handle error
    }
  };

  const activateBackground = async backgroundId => {
    try {
      // Store current blur/opacity/position values before activation
      const currentBlur = settingsRef.current.blur;
      const currentOpacity = settingsRef.current.opacity;
      const currentPosition = settingsRef.current.position;
      
      const success = await BackgroundService.activateBackground(backgroundId);
      if (success) {
        // Reload all data
        await Promise.all([
          loadCurrentBackground(),
          loadAllBackgroundImages(),
        ]);
        
        // Load settings but preserve blur/opacity/position if they weren't changed
        const newSettings = await BackgroundService.loadBackgroundSettings();
        
        // Preserve existing values if the backend didn't explicitly change them
        const mergedSettings = {
          ...newSettings,
          blur: newSettings.blur !== undefined ? newSettings.blur : currentBlur,
          opacity: newSettings.opacity !== undefined ? newSettings.opacity : currentOpacity,
          position: newSettings.position || currentPosition,
        };
        
        setBackgroundSettings(mergedSettings);
        localStorage.setItem('backgroundSettings', JSON.stringify(mergedSettings));
        updateBackgroundStyles(mergedSettings);
      }
      return success;
    } catch (error) {
      return false;
    }
  };

  const deleteBackgroundImage = async backgroundId => {
    try {
      const success =
        await BackgroundService.deleteBackgroundImage(backgroundId);
      if (success) {
        // Lade alle Daten neu
        await Promise.all([
          loadCurrentBackground(),
          loadAllBackgroundImages(),
          loadBackgroundSettings(),
        ]);
      }
      return success;
    } catch (error) {
      return false;
    }
  };

  const disableBackground = async () => {
    try {
      const success = await BackgroundService.disableBackground();
      if (success) {
        await loadBackgroundSettings();
      }
      return success;
    } catch (error) {
      return false;
    }
  };

  const uploadBackgroundImage = async file => {
    try {
      const success = await BackgroundService.uploadBackgroundImage(file);
      if (success) {
        // Lade alle Daten neu
        await Promise.all([
          loadCurrentBackground(),
          loadAllBackgroundImages(),
          loadBackgroundSettings(),
        ]);
      }
      return success;
    } catch (error) {
      throw error;
    }
  };

  const handleBackgroundSettingsUpdate = async () => {
    try {
      await Promise.all([
        loadBackgroundSettings(),
        loadCurrentBackground(),
        loadAllBackgroundImages(),
      ]);

      // Force re-render nach einem kurzen Delay
      setTimeout(() => {
        const backgroundElement = document.querySelector('.background-image');
        if (backgroundElement) {
          backgroundElement.style.display = 'none';
          backgroundElement.offsetHeight;
          backgroundElement.style.display = '';
        }
      }, 100);
    } catch (error) {
      console.error('Failed to disable background:', error);
    }
  };

  // Effect für Blur-Anwendung
  useEffect(() => {
    if (currentBackground && backgroundSettings.enabled) {
      const applyBlurEffect = () => {
        const backgroundElement =
          backgroundRef.current ||
          document.querySelector('.background-image') ||
          document.querySelector('[data-background="true"]');

        if (backgroundElement) {
          const blurValue = Math.max(
            0,
            Math.min(50, backgroundSettings.blur || 0)
          );
          const filterValue = `blur(${blurValue}px)`;

          backgroundElement.style.transition = 'none';
          backgroundElement.style.filter = filterValue;
          backgroundElement.style.webkitFilter = filterValue;
          backgroundElement.style.MozFilter = filterValue;
          backgroundElement.style.msFilter = filterValue;
          backgroundElement.style.OFilter = filterValue;

          backgroundElement.offsetHeight;

          requestAnimationFrame(() => {
            backgroundElement.style.transition =
              'filter 0.2s ease-out, -webkit-filter 0.2s ease-out';
          });
        }
      };

      applyBlurEffect();
      const timer = setTimeout(applyBlurEffect, 50);

      return () => clearTimeout(timer);
    }
  }, [currentBackground, backgroundSettings.blur, backgroundSettings.enabled]);

  // Effect to update styles when backgroundSettings change
  useEffect(() => {
    updateBackgroundStyles(backgroundSettings);
    // Initialize sync manager with current settings
    backgroundSyncManager.setInitialSettings(backgroundSettings);
  }, [backgroundSettings]);

  useEffect(() => {
    const initializeBackground = async () => {
      // Apply initial settings from localStorage immediately
      const initialSettings = getInitialSettings();
      updateBackgroundStyles(initialSettings);
      
      // Then load fresh data from backend
      await Promise.all([
        loadCurrentBackground(),
        loadAllBackgroundImages(),
        loadBackgroundSettings(),
      ]);
    };

    initializeBackground();

    // Listen for settings changes from sync manager
    const unsubscribeSyncManager = backgroundSyncManager.addListener(
      (settings, source) => {
        if (source !== 'local') {
          setBackgroundSettings(settings);
          updateBackgroundStyles(settings);
          setSettingsVersion(v => v + 1);
        }
      }
    );

    // Subscribe to SSE events for real-time updates
    const unsubscribeUploaded = addEventListener(
      'background_uploaded',
      data => {
        loadAllBackgroundImages();
        loadCurrentBackground();
      }
    );

    const unsubscribeActivated = addEventListener(
      'background_activated',
      data => {
        loadCurrentBackground();
        loadBackgroundSettings();
      }
    );

    const unsubscribeDeleted = addEventListener('background_deleted', data => {
      loadAllBackgroundImages();
      loadCurrentBackground();
      loadBackgroundSettings();
    });

    const unsubscribeDisabled = addEventListener('background_disabled', () => {
      loadBackgroundSettings();
      setCurrentBackground(null);
    });

    // Listen for settings updates
    const unsubscribeSettingsUpdate = addEventListener(
      'setting_update',
      data => {
        backgroundSyncManager.handleSSEUpdate(data.key, data.value);
      }
    );

    // Listen for bulk settings updates
    const unsubscribeSettingsBulk = addEventListener(
      'settings_bulk_update',
      data => {
        Object.entries(data).forEach(([key, value]) => {
          backgroundSyncManager.handleSSEUpdate(key, value);
        });
      }
    );

    // Cleanup
    return () => {
      unsubscribeSyncManager();
      unsubscribeUploaded();
      unsubscribeActivated();
      unsubscribeDeleted();
      unsubscribeDisabled();
      unsubscribeSettingsUpdate();
      unsubscribeSettingsBulk();
    };
  }, [addEventListener]);

  return {
    currentBackground,
    backgroundImages,
    backgroundSettings,
    backgroundRef,
    settingsVersion, // Export for force re-render
    setBackgroundSettings,
    setBackgroundImages,
    loadCurrentBackground,
    loadAllBackgroundImages,
    loadBackgroundSettings,
    activateBackground,
    deleteBackgroundImage,
    disableBackground,
    uploadBackgroundImage,
    handleBackgroundSettingsUpdate,
  };
};
