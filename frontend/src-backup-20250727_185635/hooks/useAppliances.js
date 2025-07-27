import { useState, useEffect } from 'react';
import { ApplianceService } from '../services/applianceService';
import { useSSE } from './useSSE';
import proxyService from '../services/proxyService';

export const useAppliances = () => {
  const [appliances, setAppliances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addEventListener } = useSSE();

  const fetchAppliances = async () => {
    try {
      setError(null);
      const data = await ApplianceService.fetchAppliances();
      setAppliances(data);
      setLoading(false); // Only set to false after first load
    } catch (error) {
      setError(error.message);
      setAppliances([]); // Leeres Array statt Demo-Daten
      setLoading(false);
    }
  };

  const createAppliance = async appliance => {
    try {
      const result = await ApplianceService.createAppliance(appliance);

      // Optimistic update - sofort zur Liste hinzufügen
      if (result && result.id) {
        // Ensure the optimistic update has all required fields
        const enhancedResult = {
          ...result,
          description: result.description || '',
          category: result.category || 'productivity',
          lastUsed: result.lastUsed || new Date().toISOString(),
          isFavorite: result.isFavorite || false,
          color: result.color || '#007AFF',
          icon: result.icon || 'Server',
          transparency:
            result.transparency !== undefined ? result.transparency : 0.7,
          blur: result.blur !== undefined ? result.blur : 8,
          service_status: result.service_status || 'unknown',
        };

        setAppliances(prev => [...prev, enhancedResult]);
      }

      // SSE wird ggf. nochmal aktualisieren, aber das ist OK
      return result;
    } catch (error) {
      console.error('Error in createAppliance:', error);
      throw error;
    }
  };

  const updateAppliance = async (id, appliance) => {
    // Optimistic update
    setAppliances(prev =>
      prev.map(app => (app.id === id ? { ...app, ...appliance } : app))
    );

    try {
      const result = await ApplianceService.updateAppliance(id, appliance);
      // SSE wird die finale Aktualisierung übernehmen
      return result;
    } catch (error) {
      // Bei Fehler: Rollback
      await fetchAppliances();
      throw error;
    }
  };

  const patchAppliance = async (id, updates) => {
    // Optimistic update
    setAppliances(prev =>
      prev.map(app => (app.id === id ? { ...app, ...updates } : app))
    );

    try {
      const result = await ApplianceService.patchAppliance(id, updates);
      // SSE wird die finale Aktualisierung übernehmen
      return result;
    } catch (error) {
      // Bei Fehler: Rollback
      await fetchAppliances();
      throw error;
    }
  };

  const deleteAppliance = async id => {
    // Optimistic update
    const backup = appliances;
    setAppliances(prev => prev.filter(app => app.id !== id));

    try {
      const result = await ApplianceService.deleteAppliance(id);
      // SSE wird die finale Aktualisierung übernehmen
      return result;
    } catch (error) {
      // Bei Fehler: Rollback
      setAppliances(backup);
      throw error;
    }
  };

  const toggleFavorite = async appliance => {
    // Stelle sicher, dass transparency und blur Werte erhalten bleiben
    const updatedAppliance = {
      name: appliance.name,
      url: appliance.url,
      description: appliance.description,
      icon: appliance.icon,
      color: appliance.color,
      category: appliance.category,
      isFavorite: !appliance.isFavorite,
      startCommand: appliance.startCommand,
      stopCommand: appliance.stopCommand,
      statusCommand: appliance.statusCommand,
      autoStart: appliance.autoStart,
      sshConnection: appliance.sshConnection,
      // Wichtig: transparency und blur explizit übernehmen
      transparency:
        appliance.transparency !== undefined ? appliance.transparency : 0.7,
      blur: appliance.blur !== undefined ? appliance.blur : 8,
    };

    const result = await ApplianceService.updateAppliance(
      appliance.id,
      updatedAppliance
    );

    if (result) {
      // Optimistic update für sofortiges Feedback
      setAppliances(prev =>
        prev.map(app =>
          app.id === appliance.id
            ? { ...app, isFavorite: !appliance.isFavorite }
            : app
        )
      );
    }

    return result;
  };

  const openAppliance = async (appliance, applianceIdParam) => {
    // Prevent duplicate opens with a simple debounce
    const openKey = `opening_${appliance?.id || applianceIdParam}_${Date.now()}`;
    if (window._openingAppliance) {
      console.log('[DEBUG] Preventing duplicate open - already opening an appliance');
      return;
    }
    
    window._openingAppliance = true;
    setTimeout(() => {
      window._openingAppliance = false;
    }, 500); // Clear flag after 500ms

    console.log('[DEBUG] openAppliance called for:', appliance?.name || 'unknown');

    // Handle both old format (url, applianceId) and new format (appliance object)
    let url, applianceId;

    if (typeof appliance === 'object' && appliance.id) {
      // New format: appliance object
      applianceId = appliance.id;

      // Verwende Proxy-URL statt direkter URL
      url = proxyService.convertToProxyUrl(appliance);
      console.log('[DEBUG] Using proxy URL:', url);
    } else {
      // Old format: separate url and id (for backwards compatibility)
      // Für altes Format müssen wir die Appliance erst laden
      applianceId = applianceIdParam || appliance;
      const applianceObj = appliances.find(a => a.id === applianceId);
      if (applianceObj) {
        url = proxyService.convertToProxyUrl(applianceObj);
      } else {
        console.error('Appliance not found:', applianceId);
        return;
      }
    }

    // Check if in mini dashboard mode (width OR height < 300px)
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isMiniDashboard = width < 300 || height < 300;

    // Für iOS/Safari: IMMER direkt navigieren (kein neuer Tab)
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    try {
      // Update lastUsed timestamp
      if (applianceId) {
        try {
          await ApplianceService.updateLastUsed(applianceId);
          // Optimistic update for immediate UI feedback
          setAppliances(prev =>
            prev.map(app =>
              app.id === applianceId
                ? { ...app, lastUsed: new Date().toISOString() }
                : app
            )
          );
        } catch (error) {
          console.error('Failed to update last used:', error);
          // Don't block opening the app if update fails
        }
      }

      if (isMiniDashboard) {
        // Im Miniatur-Widget-Modus: Die ApplianceCard behandelt das Öffnen selbst
        // Hier nur als Fallback
        console.log('[DEBUG] Opening in mini dashboard mode');
        window.open(url, '_blank', 'noopener,noreferrer');
      } else if (isIOS) {
        // Auf iOS IMMER im gleichen Tab öffnen (vermeidet Popup-Blocker)
        console.log('[DEBUG] Opening on iOS - same tab');
        window.location.href = url;
      } else {
        // Check if we're running as a PWA
        const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                     window.navigator.standalone || 
                     document.referrer.includes('android-app://');
        
        console.log('[DEBUG] Opening URL:', url, 'isPWA:', isPWA, 'at', new Date().toISOString());
        
        // Add a final check to prevent duplicate opens
        const openCheckKey = `lastOpen_${url}`;
        const lastOpen = window[openCheckKey];
        const now = Date.now();
        
        if (lastOpen && (now - lastOpen) < 1000) {
          console.log('[DEBUG] Skipping duplicate open within 1 second');
          return;
        }
        
        window[openCheckKey] = now;
        
        if (isPWA) {
          // In PWA mode, always open in external browser
          // This prevents opening within the PWA window
          console.log('[DEBUG] Using window.open for PWA');
          window.open(url, '_blank', 'noopener,noreferrer');
        } else {
          // Desktop/Android Browser: Use a temporary anchor element for better compatibility
          // Create a temporary anchor element
          console.log('[DEBUG] Using anchor click for browser');
          const link = document.createElement('a');
          link.href = url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';

          // Append to body (required for Firefox)
          document.body.appendChild(link);

          // Trigger click
          link.click();

          // Clean up
          setTimeout(() => {
            document.body.removeChild(link);
          }, 100);
        }
      }
    } catch (error) {
      // Zeige Fehlermeldung
      console.error('Error opening appliance:', error);
    }
  };

  useEffect(() => {
    fetchAppliances();

    // Subscribe to SSE events for real-time updates

    const unsubscribeCreated = addEventListener('appliance_created', data => {
      setAppliances(prev => {
        // Ensure data has all required fields
        const enhancedData = {
          ...data,
          description: data.description || '',
          category: data.category || 'productivity',
          lastUsed: data.lastUsed || new Date().toISOString(),
          isFavorite: data.isFavorite || false,
          color: data.color || '#007AFF',
          icon: data.icon || 'Server',
          transparency:
            data.transparency !== undefined ? data.transparency : 0.7,
          blur: data.blur !== undefined ? data.blur : 8,
          startCommand: data.start_command || data.startCommand || '',
          stopCommand: data.stop_command || data.stopCommand || '',
          statusCommand: data.status_command || data.statusCommand || '',
          serviceStatus: data.service_status || data.serviceStatus || 'unknown',
          sshConnection: data.ssh_connection || data.sshConnection || '',
          vncEnabled: data.vncEnabled || 
                     (data.remoteDesktopEnabled && data.remoteProtocol === 'vnc') ||
                     false,
          rdpEnabled: data.rdpEnabled || 
                     (data.remoteDesktopEnabled && data.remoteProtocol === 'rdp') ||
                     false,
          remoteDesktopEnabled: data.remoteDesktopEnabled || false,
          remoteProtocol: data.remoteProtocol || 'vnc',
        };

        // Prüfe ob die Appliance bereits existiert (durch optimistic update)
        const exists = prev.some(
          app =>
            app.id === enhancedData.id || app.id === parseInt(enhancedData.id)
        );
        if (exists) {
          // Wenn bereits vorhanden, aktualisiere sie statt hinzuzufügen
          return prev.map(app =>
            app.id === enhancedData.id || app.id === parseInt(enhancedData.id)
              ? enhancedData
              : app
          );
        }
        // Ansonsten füge sie hinzu
        return [...prev, enhancedData];
      });
    });

    const unsubscribeUpdated = addEventListener('appliance_updated', data => {
      setAppliances(prev => {
        const updated = prev.map(app => {
          if (app.id === data.id || app.id === parseInt(data.id)) {
            return { ...app, ...data };
          }
          return app;
        });
        return updated;
      });
    });

    // Listen for applianceUpdate events (from slider changes)
    const unsubscribeApplianceUpdate = addEventListener(
      'applianceUpdate',
      data => {
        setAppliances(prev => {
          const updated = prev.map(app => {
            if (app.id === data.id || app.id === parseInt(data.id)) {
              // Update with the new appliance data
              return { ...app, ...data.appliance };
            }
            return app;
          });
          return updated;
        });
      }
    );

    const unsubscribePatched = addEventListener('appliance_patched', data => {
      setAppliances(prev =>
        prev.map(app =>
          app.id === data.id || app.id === parseInt(data.id)
            ? { ...app, ...data.updates }
            : app
        )
      );
    });

    const unsubscribeDeleted = addEventListener('appliance_deleted', data => {
      setAppliances(prev =>
        prev.filter(app => app.id !== data.id && app.id !== parseInt(data.id))
      );
    });

    const unsubscribeRestored = addEventListener('appliance_restored', data => {
      // Update the restored appliance with the new data
      if (data.appliance) {
        setAppliances(prev => {
          const updated = prev.map(app => {
            if (
              app.id === data.appliance.id ||
              app.id === parseInt(data.appliance.id)
            ) {
              return { ...data.appliance };
            }
            return app;
          });
          return updated;
        });
      }

      // Optional: Show a notification to the user
      if (window.showNotification) {
        window.showNotification(
          `Service "${data.appliance?.name}" wurde wiederhergestellt`,
          'success'
        );
      }
    });

    const unsubscribeStatusChanged = addEventListener(
      'service_status_changed',
      eventData => {
        // Handle both direct data and nested data structure
        const data = eventData.data || eventData;

        setAppliances(prev => {
          const updated = prev.map(app => {
            // Ensure both IDs are compared as numbers
            const appId =
              typeof app.id === 'string' ? parseInt(app.id) : app.id;
            const dataId =
              typeof data.id === 'string' ? parseInt(data.id) : data.id;

            if (appId === dataId) {
              return {
                ...app,
                serviceStatus: data.status,
                lastStatusUpdate: Date.now(), // Force re-render
              };
            }
            return app;
          });

          // Force a new array reference to ensure React detects the change
          return [...updated];
        });
      }
    );

    // Listen for category deletion to reset appliances with that category
    const unsubscribeCategoryDeleted = addEventListener(
      'category_deleted',
      data => {
        // We need to find the category name from the ID
        // This might require fetching current categories or maintaining a map
        // For now, we'll need to reset appliances that might be affected
        fetchAppliances(); // Refetch to ensure consistency
      }
    );

    // Listen for undeleted appliances (restored from deletion)
    const unsubscribeUndeleted = addEventListener(
      'appliance_undeleted',
      data => {
        // Force refresh to get the new appliance
        setTimeout(() => {
          fetchAppliances();
        }, 100);

        // Optional: Show a notification to the user
        if (window.showNotification) {
          window.showNotification(
            `Service "${data.appliance?.name}" wurde wiederhergestellt (${data.customCommandsRestored || 0} Kommandos)`,
            'success'
          );
        }
      }
    );

    // Cleanup
    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeApplianceUpdate();
      unsubscribePatched();
      unsubscribeDeleted();
      unsubscribeRestored();
      unsubscribeStatusChanged();
      unsubscribeCategoryDeleted();
      unsubscribeUndeleted();
    };
  }, [addEventListener]);

  // Listen for visibility changes to refresh data when tab becomes visible
  useEffect(() => {
    let refreshInterval;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab became visible, force update of all appliances
        setAppliances(prev => [...prev]);
        // Also fetch fresh data after a short delay
        setTimeout(() => {
          fetchAppliances();
        }, 100);

        // Set up periodic refresh while tab is visible
        refreshInterval = setInterval(() => {
          // Force update to trigger re-render with current service_status
          setAppliances(prev =>
            prev.map(app => ({
              ...app,
              _forceUpdate: Date.now(),
            }))
          );
        }, 5000); // Update every 5 seconds
      } else {
        // Clear interval when tab becomes hidden
        if (refreshInterval) {
          clearInterval(refreshInterval);
        }
      }
    };

    // Initial check
    if (!document.hidden) {
      handleVisibilityChange();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  // Auto-refresh service status every 30 seconds
  useEffect(() => {
    let statusInterval;

    const refreshStatus = () => {
      ApplianceService.checkAllServiceStatus()
        .then(() => {
          // Service status refreshed
        })
        .catch(error => {
          console.error('Error refreshing service status:', error);
        });
    };

    // Initial status check after 2 seconds
    const initialTimeout = setTimeout(refreshStatus, 2000);

    // Set up interval for regular checks
    statusInterval = setInterval(refreshStatus, 30000); // 30 seconds

    // Cleanup on unmount
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(statusInterval);
    };
  }, []);

  return {
    appliances,
    loading,
    error,
    fetchAppliances,
    createAppliance,
    updateAppliance,
    patchAppliance,
    deleteAppliance,
    toggleFavorite,
    openAppliance,
  };
};
